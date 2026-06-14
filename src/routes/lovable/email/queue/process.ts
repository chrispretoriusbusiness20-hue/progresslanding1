import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

// From address used for all outbound mail via Resend.
// progressgrp.co.za must be verified in the Resend dashboard.
const RESEND_FROM = 'Progress Group <sales@progressgrp.co.za>'
const RESEND_REPLY_TO = 'sales@progressgrp.co.za'

interface ResendError {
  status: number
  message: string
  retryAfterSeconds: number | null
}

async function sendViaResend(
  apiKey: string,
  payload: {
    to: string
    subject: string
    html: string
    text?: string
    idempotency_key?: string
  },
): Promise<{ ok: true; id: string } | { ok: false; error: ResendError }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(payload.idempotency_key
        ? { 'Idempotency-Key': payload.idempotency_key }
        : {}),
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      reply_to: RESEND_REPLY_TO,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  })

  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id ?? '' }
  }

  const bodyText = await res.text().catch(() => '')
  const retryAfterHeader = res.headers.get('retry-after')
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10) || null
    : null
  return {
    ok: false,
    error: {
      status: res.status,
      message: `Resend ${res.status}: ${bodyText.slice(0, 800)}`,
      retryAfterSeconds,
    },
  }
}

async function moveToDlq(
  supabase: SupabaseClient<any, any>,
  queue: string,
  msg: { msg_id: number; message: Record<string, any> },
  reason: string
): Promise<void> {
  const payload = msg.message
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
  })
  const { error } = await supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  })
  if (error) {
    console.error('Failed to move message to DLQ', { queue, msg_id: msg.msg_id, reason, error })
  }
}

export const Route = createFileRoute("/lovable/email/queue/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const resendApiKey = process.env.RESEND_API_KEY
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables', {
            hasResend: Boolean(resendApiKey),
            hasUrl: Boolean(supabaseUrl),
            hasServiceKey: Boolean(supabaseServiceKey),
          })
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const token = authHeader.slice('Bearer '.length).trim()
        if (token !== supabaseServiceKey) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const supabase: SupabaseClient<any, any> = createClient(supabaseUrl, supabaseServiceKey)

        const { data: state } = await supabase
          .from('email_send_state')
          .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
          .single()

        if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
          return Response.json({ skipped: true, reason: 'rate_limited' })
        }

        const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE
        const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS
        const ttlMinutes: Record<string, number> = {
          auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
          transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
        }

        let totalProcessed = 0

        for (const queue of ['auth_emails', 'transactional_emails']) {
          const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
            queue_name: queue,
            batch_size: batchSize,
            vt: 30,
          })

          if (readError) {
            console.error('Failed to read email batch', { queue, error: readError })
            continue
          }
          if (!messages?.length) continue

          const messageIds = Array.from(
            new Set(
              messages
                .map((msg: any) =>
                  msg?.message?.message_id && typeof msg.message.message_id === 'string'
                    ? msg.message.message_id
                    : null
                )
                .filter((id: string | null): id is string => Boolean(id))
            )
          )
          const failedAttemptsByMessageId = new Map<string, number>()
          if (messageIds.length > 0) {
            const { data: failedRows } = await supabase
              .from('email_send_log')
              .select('message_id')
              .in('message_id', messageIds)
              .eq('status', 'failed')
            for (const row of failedRows ?? []) {
              const id = row?.message_id
              if (typeof id !== 'string' || !id) continue
              failedAttemptsByMessageId.set(id, (failedAttemptsByMessageId.get(id) ?? 0) + 1)
            }
          }

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            const payload = msg.message
            const failedAttempts =
              payload?.message_id && typeof payload.message_id === 'string'
                ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
                : msg.read_ct ?? 0

            const queuedAt = payload.queued_at ?? msg.enqueued_at
            if (queuedAt) {
              const ageMs = Date.now() - new Date(queuedAt).getTime()
              const maxAgeMs = ttlMinutes[queue] * 60 * 1000
              if (ageMs > maxAgeMs) {
                console.warn('Email expired (TTL exceeded)', { queue, msg_id: msg.msg_id })
                await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`)
                continue
              }
            }

            if (failedAttempts >= MAX_RETRIES) {
              await moveToDlq(supabase, queue, msg, `Max retries (${MAX_RETRIES}) exceeded`)
              continue
            }

            if (payload.message_id) {
              const { data: alreadySent } = await supabase
                .from('email_send_log')
                .select('id')
                .eq('message_id', payload.message_id)
                .eq('status', 'sent')
                .maybeSingle()

              if (alreadySent) {
                await supabase.rpc('delete_email', {
                  queue_name: queue,
                  message_id: msg.msg_id,
                })
                continue
              }
            }

            const result = await sendViaResend(resendApiKey, {
              to: payload.to,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
              idempotency_key: payload.idempotency_key,
            })

            if (result.ok) {
              await supabase.from('email_send_log').insert({
                message_id: payload.message_id,
                template_name: payload.label || queue,
                recipient_email: payload.to,
                status: 'sent',
                metadata: { provider: 'resend', resend_id: result.id },
              })
              const { error: delError } = await supabase.rpc('delete_email', {
                queue_name: queue,
                message_id: msg.msg_id,
              })
              if (delError) {
                console.error('Failed to delete sent message from queue', { queue, msg_id: msg.msg_id, error: delError })
              }
              totalProcessed++
            } else {
              const { status, message, retryAfterSeconds } = result.error
              console.error('Resend send failed', {
                queue,
                msg_id: msg.msg_id,
                to: payload.to,
                template: payload.label,
                status,
                error: message,
              })

              await supabase.from('email_send_log').insert({
                message_id: payload.message_id,
                template_name: payload.label || queue,
                recipient_email: payload.to,
                status: 'failed',
                error_message: message.slice(0, 1000),
                metadata: { provider: 'resend', status },
              })

              if (status === 429) {
                const wait = retryAfterSeconds ?? 60
                await supabase
                  .from('email_send_state')
                  .update({
                    retry_after_until: new Date(Date.now() + wait * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', 1)
                return Response.json({ processed: totalProcessed, stopped: 'rate_limited' })
              }

              // 401/403 = bad API key / unverified domain — permanent, DLQ and stop.
              if (status === 401 || status === 403) {
                await moveToDlq(supabase, queue, msg, message.slice(0, 1000))
                return Response.json({ processed: totalProcessed, stopped: 'forbidden' })
              }

              // 422 = validation error (bad from/to/etc.) — permanent for this message.
              if (status === 422 || status === 400) {
                await moveToDlq(supabase, queue, msg, message.slice(0, 1000))
                continue
              }

              if (payload?.message_id && typeof payload.message_id === 'string') {
                failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
              }
              // Other 5xx: leave in queue, VT expires, retried next cycle.
            }

            if (i < messages.length - 1) {
              await new Promise((r) => setTimeout(r, sendDelayMs))
            }
          }
        }

        return Response.json({ processed: totalProcessed })
      },
    },
  },
})
