import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const AGENTS = {
  sales: {
    label: "Sales",
    system: `You are the SALES specialist for The Progress Group (South Africa) — fireplaces, braais, lighting, and aircons.
Goals: understand the visitor's needs, recommend products, explain features/benefits, give ballpark guidance, and steer toward a formal quote via the on-site Google Form.
Tone: warm, knowledgeable, concise. Ask one clarifying question at a time if needed. Mention installation, story type (single/double), flooring (lights vs heat shields/plates), and transport zones when relevant.
Never invent prices — direct visitors to the catalog or quote form for exact figures.`,
  },
  support: {
    label: "Support",
    system: `You are the SUPPORT specialist for The Progress Group. Help existing customers with installation questions, maintenance, troubleshooting (chimneys, draft, ignition, LED drivers), warranties, and replacements.
If the issue needs on-site attention, recommend they request a follow-up and collect their preferred date/time.`,
  },
  closing: {
    label: "Closing",
    system: `You are the CLOSING specialist. The visitor is interested and close to deciding. Recap their choice, confirm specifics (model, qty, story type, install address), surface any add-ons (flue kit, hearth plate, corner install), and guide them to submit the on-site Google Form to lock in the quote.
Be friendly, decisive, and remove friction.`,
  },
  followup: {
    label: "Follow-up",
    system: `You are the FOLLOW-UP specialist. The visitor wants to be reminded or contacted later.
Confirm a reasonable due date/time and a one-line reason. Always call the schedule_follow_up tool to persist it, then summarise the booking back to them.`,
  },
} as const;
type AgentKey = keyof typeof AGENTS;

async function callGateway(body: Record<string, unknown>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted on the workspace.");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function classify(history: Msg[], userMessage: string): Promise<AgentKey> {
  const data = await callGateway({
    messages: [
      {
        role: "system",
        content: `Classify the LATEST user message into exactly one agent for a lighting & fireplace company chat:
- "sales": product questions, recommendations, browsing, pricing curiosity, "what do you sell".
- "support": existing customer issues, install/troubleshooting, warranty.
- "closing": ready to buy, confirming a choice, asking how to lock in a quote/order.
- "followup": asks to be contacted later, scheduled callback, "remind me", "email me tomorrow".
Reply with ONLY one word: sales, support, closing, or followup.`,
      },
      ...history.slice(-6),
      { role: "user", content: userMessage },
    ],
    temperature: 0,
  });
  const raw = String(data.choices?.[0]?.message?.content ?? "sales").toLowerCase();
  const m = raw.match(/sales|support|closing|followup/);
  return (m?.[0] as AgentKey) ?? "sales";
}

const followUpTool = {
  type: "function" as const,
  function: {
    name: "schedule_follow_up",
    description: "Persist a follow-up reminder for staff.",
    parameters: {
      type: "object",
      properties: {
        due_at: { type: "string", description: "ISO 8601 timestamp for when to follow up." },
        reason: { type: "string", description: "Short reason / topic for the follow-up." },
      },
      required: ["due_at", "reason"],
      additionalProperties: false,
    },
  },
};

async function runSpecialist(
  agent: AgentKey,
  history: Msg[],
  userMessage: string,
): Promise<{ reply: string; followUp: { due_at: string; reason: string } | null }> {
  const messages: Msg[] = [
    { role: "system", content: AGENTS[agent].system },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];
  const body: Record<string, unknown> = { messages };
  if (agent === "followup") {
    body.tools = [followUpTool];
    body.tool_choice = { type: "function", function: { name: "schedule_follow_up" } };
  }
  const data = await callGateway(body);
  const choice = data.choices?.[0]?.message;
  let followUp: { due_at: string; reason: string } | null = null;
  const toolCalls = choice?.tool_calls as Array<{ function: { name: string; arguments: string } }> | undefined;
  if (toolCalls?.length) {
    const args = toolCalls[0].function.arguments;
    try {
      const parsed = JSON.parse(args);
      if (parsed?.due_at && parsed?.reason) {
        followUp = { due_at: String(parsed.due_at), reason: String(parsed.reason) };
      }
    } catch {}
  }
  let reply = (choice?.content as string | undefined)?.trim() ?? "";
  if (!reply && followUp) {
    reply = `Got it — I've booked a follow-up for ${new Date(followUp.due_at).toLocaleString()} about "${followUp.reason}". Our team will be in touch.`;
  }
  if (!reply) reply = "Sorry — I didn't catch that. Could you rephrase?";
  return { reply, followUp };
}

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string().uuid().nullable(),
      message: z.string().trim().min(1).max(2000),
      visitor: z
        .object({
          name: z.string().trim().max(120).optional(),
          email: z.string().trim().email().max(200).optional(),
          phone: z.string().trim().max(40).optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let sessionId = data.sessionId;
    if (!sessionId) {
      const { data: row, error } = await supabaseAdmin
        .from("chat_sessions")
        .insert({
          visitor_name: data.visitor?.name ?? null,
          visitor_email: data.visitor?.email ?? null,
          visitor_phone: data.visitor?.phone ?? null,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(`Failed to create session: ${error?.message}`);
      sessionId = row.id;
    }

    const { data: hist } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);
    const history: Msg[] = (hist ?? []).map((m) => ({
      role: m.role as Msg["role"],
      content: m.content,
    }));

    const agent = await classify(history, data.message);
    const { reply, followUp } = await runSpecialist(agent, history, data.message);

    await supabaseAdmin.from("chat_messages").insert([
      { session_id: sessionId, role: "user", content: data.message },
      { session_id: sessionId, role: "assistant", agent, content: reply },
    ]);

    let followUpCreated: { due_at: string; reason: string } | null = null;
    if (followUp) {
      const { error } = await supabaseAdmin.from("follow_ups").insert({
        session_id: sessionId,
        due_at: followUp.due_at,
        reason: followUp.reason,
      });
      if (!error) followUpCreated = followUp;
    }

    return { sessionId, agent, agentLabel: AGENTS[agent].label, reply, followUpCreated };
  });
