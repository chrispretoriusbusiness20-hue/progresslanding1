import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { catalogueQuoteDetails } from "./catalogue-quote";
import { formatRand } from "./product-display";
import { getProductImageUrl } from "./product-images";
import logo from "@/assets/progress-header-transparent.png.asset.json";

async function imageData(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function downloadCatalogueQuote(name: string) {
  const details = catalogueQuoteDetails(name);
  const doc = new jsPDF();
  const date = new Date();
  const reference = `Q-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const [brand, photo] = await Promise.all([
    imageData(logo.url),
    imageData(getProductImageUrl({ ...details.product, productName: name })),
  ]);
  if (brand) {
    try { doc.addImage(brand, "PNG", 14, 12, 80, 22); } catch { /* Text brand below remains available. */ }
  }
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("Progress Group", 14, 45);
  doc.setFontSize(14).text("Product quotation", 14, 55);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Quote number: ${reference}`, 14, 65);
  doc.text(`Date: ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`, 14, 72);
  doc.text("sales@progressgrp.co.za", 14, 79);
  if (photo) {
    try {
      const properties = doc.getImageProperties(photo);
      const scale = Math.min(45 / properties.width, 45 / properties.height);
      const width = properties.width * scale;
      const height = properties.height * scale;
      doc.addImage(photo, properties.fileType, 148 + (45 - width) / 2, 38 + (45 - height) / 2, width, height);
    } catch { /* A failed image must not prevent the quote download. */ }
  }
  autoTable(doc, {
    startY: 94,
    head: [["Product", "Qty", "Price incl. VAT"]],
    body: [[details.name, "1", details.total === null ? "Price to be confirmed" : formatRand(details.total)]],
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { cellWidth: 112 }, 1: { cellWidth: 18 }, 2: { cellWidth: 52 } },
    margin: 14,
  });
  autoTable(doc, {
    startY: 145,
    body: details.total === null
      ? [["Product price", "To be confirmed"], ["Total", "To be confirmed"]]
      : [["Subtotal excl. VAT", formatRand(details.subtotal)], ["VAT included (15%)", formatRand(details.vat)], ["Total incl. VAT", formatRand(details.total)]],
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 62, halign: "right", fontStyle: "bold" } },
    margin: 14,
  });
  doc.setFont("helvetica", "normal").setFontSize(10);
  const notes = [
    "Product only. Delivery from Bellville is priced separately by distance.",
    "Installation and optional add-ons are not included in this quotation.",
    "Contact sales to confirm availability, delivery and any additional requirements.",
    "This quotation is not an invoice or confirmation of an order.",
  ];
  let y = 202;
  for (const note of notes) {
    const lines = doc.splitTextToSize(note, 182);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 5;
  }
  doc.save(`Progress-Quote-${reference}.pdf`);
}