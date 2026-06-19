import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { bookConsultation } from "@/lib/email/consultation.functions";

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const Route = createFileRoute("/consultation")({
  head: () => ({
    meta: [
      { title: "Private Consultation — The Progress Group" },
      {
        name: "description",
        content:
          "Book a private consultation with The Progress Group. Pick a date and time slot and our specialists will confirm your appointment.",
      },
      { property: "og:title", content: "Private Consultation — The Progress Group" },
      {
        property: "og:description",
        content:
          "Reserve a one-on-one consultation with our fireplace, braai, lighting and aircon specialists.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-12 text-center">Not found</div>,
  component: ConsultationPage,
});

function ConsultationPage() {
  const submit = useServerFn(bookConsultation);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return toIsoDate(d);
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(minDate);
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ date: string; timeSlot: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const n = name.trim();
    const em = email.trim();
    const ph = phone.trim();

    if (!n || !em || !ph || !date || !timeSlot) {
      toast.error("Please fill in every required field");
      return;
    }
    if (!/.+@.+\..+/.test(em)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const picked = new Date(`${date}T00:00:00`);
    const day = picked.getDay();
    if (day === 0) {
      toast.error("Please pick a weekday or Saturday");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submit({
        data: { name: n, email: em, phone: ph, date, timeSlot, topic: topic.trim(), notes: notes.trim() },
      });
      if (result.success) {
        setDone({ date, timeSlot });
        toast.success("Consultation request sent — we'll confirm shortly");
      } else {
        toast.error("Couldn't send your request", { description: result.error });
      }
    } catch (err) {
      toast.error("Couldn't send your request", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-20">
      <div className="mx-auto max-w-xl">
        <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">
          The Progress Group
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Book a private consultation
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Choose a date and time that suits you. One of our specialists will confirm your slot by email.
          Consultations run Monday – Saturday, 09:00 – 16:00 SAST.
        </p>

        {done ? (
          <div className="mt-10 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-medium text-foreground">Request received</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We've sent a confirmation to your email. Your preferred slot:
            </p>
            <p className="mt-3 text-base font-medium text-foreground">
              {new Date(`${done.date}T00:00:00`).toLocaleDateString("en-ZA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {done.timeSlot} SAST
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDone(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Book another
              </button>
              <Link
                to="/"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="c-name" className="block text-sm font-medium text-foreground">
                  Full name
                </label>
                <input
                  id="c-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="c-phone" className="block text-sm font-medium text-foreground">
                  Phone
                </label>
                <input
                  id="c-phone"
                  type="tel"
                  required
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="c-email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="c-email"
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="c-date" className="block text-sm font-medium text-foreground">
                  Preferred date
                </label>
                <input
                  id="c-date"
                  type="date"
                  required
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="c-slot" className="block text-sm font-medium text-foreground">
                  Time slot (SAST)
                </label>
                <select
                  id="c-slot"
                  required
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="c-topic" className="block text-sm font-medium text-foreground">
                What would you like to discuss? <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="c-topic"
                type="text"
                maxLength={120}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Closed-combustion fireplace for a new build"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="c-notes" className="block text-sm font-medium text-foreground">
                Notes <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="c-notes"
                rows={5}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">{notes.length}/2000</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Request consultation"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Your slot is provisional until our team confirms by email.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
