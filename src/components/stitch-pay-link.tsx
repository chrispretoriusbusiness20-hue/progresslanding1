export function StitchPayLink() {
  return (
    <a
      href="https://express.stitch.money/progress-installations"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 left-5 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xl transition-transform hover:scale-105"
      aria-label="Pay online via Stitch"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M3 6a2 2 0 012-2h14a2 2 0 012 2v1H3V6zm18 3v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9h18zM16 14.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
      </svg>
      Pay online
    </a>
  );
}
