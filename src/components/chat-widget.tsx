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
      <a
        href="https://wa.me/27689560320"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-105"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

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
