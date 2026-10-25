import { useId, useState, type FormEvent } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { decodeProductName } from "@/lib/product-display";
import { buildQuickEnquiryUrl, quickEnquirySchema } from "@/lib/quick-enquiry";
import { captureLeadAction } from "@/lib/lead-events";
import { trackContact } from "@/lib/meta-pixel";

export function ProductEnquiryForm({
  product,
  onComplete,
}: {
  product: string;
  onComplete?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [town, setTown] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const result = quickEnquirySchema.safeParse({ name, phone, product, town });
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setFailure("");
    setPending(true);
    try {
      const saved = await captureLeadAction("whatsapp_click", [result.data.product], {
        customerName: result.data.name,
        phone: result.data.phone,
        town: result.data.town,
      });
      if (!saved.ok) {
        setFailure("Your enquiry could not be saved. Please try again.");
        return;
      }
      trackContact("whatsapp");
      window.location.assign(
        buildQuickEnquiryUrl(
          result.data.name,
          result.data.phone,
          result.data.product,
          result.data.town,
        ),
      );
      onComplete?.();
    } catch {
      setFailure("Your enquiry could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="border-l-4 border-primary bg-muted p-3 text-base font-semibold break-words">
        {decodeProductName(product)}
      </p>
      {[
        {
          key: "name",
          label: "Name",
          value: name,
          set: setName,
          type: "text",
          autoComplete: "name",
          maxLength: 80,
          required: true,
        },
        {
          key: "phone",
          label: "Phone number",
          value: phone,
          set: setPhone,
          type: "tel",
          autoComplete: "tel",
          maxLength: 25,
          required: true,
        },
        {
          key: "town",
          label: "Town (optional)",
          value: town,
          set: setTown,
          type: "text",
          autoComplete: "address-level2",
          maxLength: 100,
          required: false,
        },
      ].map((field) => (
        <div key={field.key}>
          <label htmlFor={`${id}-${field.key}`} className="block text-sm font-semibold">
            {field.label}
            {field.required ? " *" : ""}
          </label>
          <input
            id={`${id}-${field.key}`}
            className="form-input mt-2"
            type={field.type}
            autoComplete={field.autoComplete}
            maxLength={field.maxLength}
            required={field.required}
            value={field.value}
            onChange={(event) => field.set(event.target.value)}
            aria-invalid={Boolean(errors[field.key])}
            aria-describedby={errors[field.key] ? `${id}-${field.key}-error` : undefined}
          />
          {errors[field.key] && (
            <p id={`${id}-${field.key}-error`} className="mt-1 text-sm text-destructive">
              {errors[field.key]}
            </p>
          )}
        </div>
      ))}
      {errors.product && (
        <p role="alert" className="text-sm text-destructive">
          {errors.product}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-none border-2 border-foreground shadow-brutal-sm"
      >
        {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
        {pending ? "Saving enquiry…" : "Continue on WhatsApp"}
      </Button>
    </form>
  );
}

export function ProductEnquiryButton({
  product,
  className = "",
}: {
  product: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={`h-auto min-h-11 w-full whitespace-normal rounded-none border-2 border-foreground px-2 py-3 text-xs font-bold shadow-brutal-sm ${className}`}
      >
        Enquire Now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm max-h-[90dvh] overflow-y-auto rounded-none border-2 border-foreground shadow-brutal p-6">
          <DialogTitle className="pr-6 text-2xl">Enquire now</DialogTitle>
          <DialogDescription>Progress Group</DialogDescription>
          <ProductEnquiryForm product={product} onComplete={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
