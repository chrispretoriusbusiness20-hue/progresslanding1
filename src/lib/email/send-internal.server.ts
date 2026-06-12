import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'progresslanding1'
const SENDER_DOMAIN = 'notify.www.progressgrp.co.za'
const FROM_DOMAIN = 'www.progressgrp.co.za'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface SendInternalEmailInput {
  templateName: string
  recipientEmail?: string
  templateData?: Record<string, unknown>
  idempotencyKey?: string
}

export interface SendInternalEmailResult {
  ok: boolean
  reason?: string
  error?: string
}

/**
 * Server-only helper to enqueue a Lovable transactional email from server
 * functions / public action routes (no end-user JWT required).
 * Mirrors the logic of /lovable/email/transactional/send.
 */
export async function sendInternalEmail(
  input: SendInternalEmailInput,
): Promise<SendInternalEmailResult> {
  const template = TEMPLATES[input.templateName]
  if (!template) {
    return { ok: false, error: `Template '${input.templateName}' not found` }
  }

  const recipient = template.to || input.recipientEmail
  if (!recipient) {
    return { ok: false, error: 'recipientEmail is required' }
  }

  const normalizedEmail = recipient.toLowerCase()
  const messageId = crypto.randomUUID()
  const idempotencyKey = input.idempotencyKey ?? messageId
  const templateData = input.templateData ?? {}

  // Suppression check
  const { data: suppressed, error: suppressionError } = await supabaseAdmin
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed', suppressionError)
    return { ok: false, error: 'Failed to verify suppression status' }
  }

  if (suppressed) {
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: 'suppressed',
    })
    return { ok: false, reason: 'email_suppressed' }
  }

  // Unsubscribe token
  let unsubscribeToken: string
  const { data: existingToken } = await supabaseAdmin
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (!stored) return { ok: false, error: 'Failed to store unsubscribe token' }
    unsubscribeToken = stored.token
  } else {
    return { ok: false, reason: 'email_suppressed' }
  }

  // Render template
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })

  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: input.templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: input.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', enqueueError)
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { ok: false, error: 'Failed to enqueue email' }
  }

  return { ok: true }
}
