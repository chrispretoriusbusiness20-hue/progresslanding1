export const ENQUIRY_OPTIONS = [
  { id: "installation", label: "I need installation included", group: "fire" },
  { id: "flue-kit", label: "I need a flue kit", group: "fire" },
  { id: "replacement", label: "I have an existing braai / fireplace to replace", group: "fire" },
  { id: "site-visit", label: "I need a site visit / measurement first", group: "fire" },
  { id: "model-comparison", label: "I'm still deciding between models", group: "fire" },
  { id: "gas-connection", label: "I need a gas connection / plumbing", group: "gas" },
  { id: "gas-wood-comparison", label: "I want a gas vs wood comparison", group: "gas" },
  { id: "delivery-only", label: "I need delivery only (no installation)", group: "outdoor" },
  { id: "custom-size", label: "I need a custom size", group: "outdoor" },
  { id: "urgent", label: "I have a tight deadline / urgent", group: "all" },
  { id: "finance", label: "I need finance / payment plan options", group: "all" },
] as const;

export type EnquiryRequest = (typeof ENQUIRY_OPTIONS)[number]["id"];

export function getEnquiryOptions(product: { name: string; category: string }) {
  const category = product.category.toLowerCase();
  const description = `${category} ${product.name.toLowerCase()}`;
  const gas = /\bgas\b/.test(description);
  const outdoor = /\bboma\b|\bpatio\b|\boutdoor\b/.test(description);
  const fire =
    /braai|fireplace|fire-pit|fire pit|closed-combustion|pellet|biomass|gas-grate|gas grate/.test(
      description,
    );
  return ENQUIRY_OPTIONS.filter(
    (option) =>
      option.group === "all" ||
      (option.group === "fire" && fire) ||
      (option.group === "gas" && gas) ||
      (option.group === "outdoor" && outdoor),
  );
}
