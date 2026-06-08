import { useState } from "react";
import { Loader2, Upload, X, Image as ImageIcon, ClipboardCopy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type UploadedPhoto = {
  id: string;
  url: string;
  name: string;
};

const SUPABASE_BUCKET = "site-photos";
const MAX_SIZE_MB = 8;
const ACCEPTED = "image/*";

function makeObjectKey(file: File, kind: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${kind}/${stamp}-${rand}.${ext}`;
}

export function SiteSurvey() {
  const [internal, setInternal] = useState<UploadedPhoto[]>([]);
  const [external, setExternal] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState<"internal" | "external" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleUpload = async (
    files: FileList | null,
    kind: "internal" | "external",
  ) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(kind);
    try {
      const next: UploadedPhoto[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} is not an image.`);
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          throw new Error(`${file.name} is larger than ${MAX_SIZE_MB} MB.`);
        }
        const key = makeObjectKey(file, kind);
        const { error: upErr } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(key, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(key);
        next.push({ id: key, url: data.publicUrl, name: file.name });
      }
      if (kind === "internal") setInternal((prev) => [...prev, ...next]);
      else setExternal((prev) => [...prev, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (id: string, kind: "internal" | "external") => {
    if (kind === "internal") setInternal((p) => p.filter((x) => x.id !== id));
    else setExternal((p) => p.filter((x) => x.id !== id));
  };

  const buildSummary = () => {
    const lines: string[] = [];
    if (internal.length) {
      lines.push("Internal photos:");
      internal.forEach((p) => lines.push(`- ${p.url}`));
    }
    if (external.length) {
      lines.push("");
      lines.push("External photos:");
      external.forEach((p) => lines.push(`- ${p.url}`));
    }
    return lines.join("\n");
  };

  const summary = buildSummary();
  const hasAny =
    internal.length > 0 ||
    external.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  return (
    <div className="mb-8 border-2 border-foreground bg-background p-5 shadow-brutal-sm sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-foreground bg-primary text-primary-foreground">
          <Ruler className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-primary">
            Site survey
          </p>
          <h3 className="mt-1 font-display text-xl leading-tight sm:text-2xl">
            Add cavity dimensions &amp; site photos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional but recommended — speeds up sizing and quoting. Photos upload securely; paste the summary into the form below.
          </p>
        </div>
      </div>

      {/* Cavity dimensions */}
      <fieldset className="mt-6">
        <legend className="text-xs font-bold uppercase tracking-[0.24em] text-foreground">
          Cavity (mm)
        </legend>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <NumField
            label="Width"
            value={cavity.width}
            onChange={(v) => setCavity((p) => ({ ...p, width: v }))}
          />
          <NumField
            label="Height"
            value={cavity.height}
            onChange={(v) => setCavity((p) => ({ ...p, height: v }))}
          />
          <NumField
            label="Depth"
            value={cavity.depth}
            onChange={(v) => setCavity((p) => ({ ...p, depth: v }))}
          />
        </div>
      </fieldset>

      {/* Chimney */}
      <fieldset className="mt-5">
        <legend className="text-xs font-bold uppercase tracking-[0.24em] text-foreground">
          Chimney (mm) — optional
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumField
            label="Flue diameter"
            value={chimney.diameter}
            onChange={(v) => setChimney((p) => ({ ...p, diameter: v }))}
          />
          <NumField
            label="Chimney height"
            value={chimney.height}
            onChange={(v) => setChimney((p) => ({ ...p, height: v }))}
          />
        </div>
      </fieldset>

      {/* Photos */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <PhotoGroup
          title="Internal photos"
          hint="Inside the room — show the cavity, hearth and surround."
          uploading={uploading === "internal"}
          photos={internal}
          onPick={(files) => handleUpload(files, "internal")}
          onRemove={(id) => removePhoto(id, "internal")}
        />
        <PhotoGroup
          title="External photos"
          hint="Outside the home — show the roofline / flue exit point."
          uploading={uploading === "external"}
          photos={external}
          onPick={(files) => handleUpload(files, "external")}
          onRemove={(id) => removePhoto(id, "external")}
        />
      </div>

      {error && (
        <p className="mt-4 border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Summary / copy */}
      {hasAny && (
        <div className="mt-6 border-2 border-dashed border-foreground/40 bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-foreground">
              Paste this into the form below
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 border-2 border-foreground bg-background px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground/80">
            {summary}
          </pre>
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1 w-full border-2 border-foreground bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

function PhotoGroup({
  title,
  hint,
  uploading,
  photos,
  onPick,
  onRemove,
}: {
  title: string;
  hint: string;
  uploading: boolean;
  photos: UploadedPhoto[];
  onPick: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-foreground">{title}</p>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {photos.length} file{photos.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      <label
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-foreground/40 bg-card px-4 py-6 text-center text-xs font-semibold uppercase tracking-wider transition hover:border-primary hover:bg-primary/5 ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-primary" />
            Tap to add photos
            <span className="text-[10px] font-normal normal-case text-muted-foreground">
              Up to {MAX_SIZE_MB}&nbsp;MB each
            </span>
          </>
        )}
        <input
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="group relative aspect-square overflow-hidden border-2 border-foreground bg-card">
              <img
                src={p.url}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center border-2 border-foreground bg-background opacity-0 transition group-hover:opacity-100"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center border-2 border-foreground bg-background opacity-0 transition group-hover:opacity-100"
                aria-label={`Open ${p.name}`}
              >
                <ImageIcon className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
