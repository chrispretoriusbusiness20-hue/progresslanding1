import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { chatTurn } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  agentLabel?: string;
};

const STORAGE_KEY = "pg_chat_session";

const AGENT_COLORS: Record<string, string> = {
  Sales: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Support: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Closing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Follow-up": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      agentLabel: "Sales",
      content:
        "Hi! I'm your Progress Group assistant — ask me about lighting, fireplaces, braais or aircons. I can also book a follow-up if you'd like a callback.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatTurnFn = useServerFn(chatTurn);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const mutation = useMutation({
    mutationFn: (message: string) => chatTurnFn({ data: { sessionId, message } }),
    onSuccess: (res) => {
      if (res.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
        window.localStorage.setItem(STORAGE_KEY, res.sessionId);
      }
      const followUpNote = res.followUpCreated
        ? `\n\n_Follow-up booked for ${new Date(res.followUpCreated.due_at).toLocaleString()}._`
        : "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", agentLabel: res.agentLabel, content: res.reply + followUpNote },
      ]);
    },
    onError: (err: Error) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", agentLabel: "Sales", content: `Sorry — ${err.message}` },
      ]);
    },
  });

  function send() {
    const text = input.trim();
    if (!text || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    mutation.mutate(text);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <div className="text-sm font-semibold leading-tight">Progress AI Team</div>
                <div className="text-[11px] opacity-80">Sales · Support · Closing · Follow-ups</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-3 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col",
                  m.role === "user" ? "items-end" : "items-start",
                )}
              >
                {m.role === "assistant" && m.agentLabel && (
                  <span
                    className={cn(
                      "mb-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      AGENT_COLORS[m.agentLabel] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.agentLabel} agent
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-background text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border bg-background px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product, quote, or book a callback…"
              className="flex-1 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              disabled={mutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || mutation.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
