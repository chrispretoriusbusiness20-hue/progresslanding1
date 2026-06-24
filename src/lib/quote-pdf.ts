import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import progressLogo from "@/assets/progress-header-transparent.png.asset.json";
import progressInstallationsLogo from "@/assets/progress-installations-logo.png.asset.json";



export type QuoteLineItem = {
  quantity: number;
  description: string;
  unitPrice: number;
};

export type QuoteInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  storyType: "single" | "double" | "";
  flooring?: string;
  plateType?: "glass" | "granite" | "metal" | "";
  cornerInstall: boolean;
  transportPrice: number | null;
  transportZone?: string | null;
  distanceKm?: number | null;
  travelFee?: number | null;
  notes?: string;
  extrasForAccount?: string;
  asInvoice?: boolean;
};


const ZAR = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, " ").replace(/\.(\d{2})$/, ",$1")}`;

export function generateQuoteNumber(
  prefix: string = "Q",
  firstName: string = "",
  lastName: string = "",
): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const initials = `${(firstName.trim()[0] ?? "X")}${(lastName.trim()[0] ?? "X")}`.toUpperCase();
  // Per-client sequence stored in localStorage so each client name starts at 001 and increments.
  let seq = 1;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = `quoteSeq:${initials}:${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
      const prev = Number.parseInt(window.localStorage.getItem(key) ?? "0", 10);
      seq = (Number.isFinite(prev) ? prev : 0) + 1;
      window.localStorage.setItem(key, String(seq));
    }
  } catch {
    /* ignore storage errors */
  }
  const seqStr = String(seq).padStart(3, "0");
  const base = `${initials}${dd}${mm} - ${seqStr}`;
  return prefix === "INV" ? `INV-${base}` : base;
}


function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateQuotePDF(
  input: QuoteInput,
  options: { download?: boolean } = {},
): Promise<{ filename: string; base64: string; quoteNo: string; triggerDownload: () => void }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const bottomMargin = 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - bottomMargin) {
      doc.addPage();
      y = margin;
    }
  };
  let y = margin;

  const items: QuoteLineItem[] = [];
  if (input.unitPrice !== null && input.unitPrice > 0) {
    items.push({
      quantity: input.quantity,
      description: input.productName,
      unitPrice: input.unitPrice,
    });
  }
  if (input.storyType) {
    const flueUnit = input.storyType === "double" ? 9650 : 7650;
    items.push({
      quantity: 1,
      description: `Flue Kit (${input.storyType} story)`,
      unitPrice: flueUnit,
    });
  }

  {
    const flooringLower = (input.flooring ?? "").toLowerCase();
    const needsPlate = flooringLower.length > 0 && !/tile/.test(flooringLower);
    if (needsPlate) {
      const plateType = input.plateType === "granite" ? "granite" : input.plateType === "metal" ? "metal" : "glass";
      const platePrice = plateType === "granite" ? 2895 : plateType === "metal" ? 1490 : 2495;
      items.push({
        quantity: 1,
        description: `${plateType === "granite" ? "Granite" : plateType === "metal" ? "Metal" : "Glass"} floor plate`,
        unitPrice: platePrice,
      });
    }
  }
  if (input.cornerInstall) {
    const nearby = input.distanceKm !== null && input.distanceKm !== undefined && input.distanceKm <= 50;
    items.push({
      quantity: 1,
      description: nearby ? "Corner installation (within 50 km)" : "Corner installation",
      unitPrice: nearby ? 800 + 650 : 800,
    });
  }
  if (input.transportPrice !== null && input.transportPrice > 0) {
    items.push({
      quantity: 1,
      description: `Delivery${input.transportZone ? ` (${input.transportZone})` : ""}`,
      unitPrice: input.transportPrice,
    });
  }
  if (input.travelFee !== null && input.travelFee !== undefined && input.travelFee > 0) {
    items.push({
      quantity: 1,
      description: "Travel fee (within 50 km)",
      unitPrice: input.travelFee,
    });
  }

  const logoData = await fetchAsDataURL(progressLogo.url);
  // estimate page uses text header, no logo

  // ---------- Header ----------
  if (logoData) {
    try {
      const imgW = 130;
      // Actual asset aspect ratio: 872 x 240
      const imgH = imgW * (240 / 872);
      doc.addImage(logoData, "PNG", (pageW - imgW) / 2, y, imgW, imgH);
      y += imgH + 3;
    } catch {
      // ignore image errors
    }
  }
  doc.setDrawColor(0).setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.text("Tel:  021 - 945 3636", margin, y);
  doc.text("189 Durban Rd", pageW - margin, y, { align: "right" });
  y += 4;
  doc.text("E mail:  info@progressgroup.co.za", margin, y);
  doc.text("Bellville", pageW - margin, y, { align: "right" });
  y += 4;
  doc.setTextColor(0, 0, 200);
  doc.text("www.progressgroup.co.za", pageW - margin, y, { align: "right" });
  doc.setTextColor(0);
  y += 8;

  // ---------- CTA Banner ----------
  const ctaText = "ACCEPT MY QUOTE / GET INVOICE & BOOK INSTALLATION";
  const ctaH = 8;
  const ctaW = pageW - margin * 2;
  doc.setFillColor(249, 115, 22);
  doc.rect(margin, y, ctaW, ctaH, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
  doc.text(ctaText, pageW / 2, y + ctaH / 2 + 2, { align: "center" });
  doc.setTextColor(0);
  y += ctaH + 5;

  // ---------- Quotation header table ----------
  const isInvoice = !!input.asInvoice;
  const docLabel = isInvoice ? "Invoice" : "Quotation";
  const quoteNo = generateQuoteNumber(isInvoice ? "INV" : "Q", input.firstName, input.lastName);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: `${docLabel} No: ${quoteNo}`, styles: { fontStyle: "bold" } },
        { content: `Date: ${formatDate()}`, styles: { fontStyle: "bold" } },
      ],
    ],
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error lastAutoTable is attached by plugin
  y = doc.lastAutoTable.finalY;

  // Client + contact details table
  const clientLines = [
    `${input.firstName} ${input.lastName}`.trim(),
    input.address ?? "",
    "",
  ];
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: (pageW - margin * 2) / 2 },
      1: { cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: "auto" },
    },
    body: [
      [
        { content: "Client Details", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: "Client Contact Details", colSpan: 2, styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      ],
      [clientLines[0], "Tel:", input.phone],
      [clientLines[1], "Cell:", input.phone],
      [clientLines[2], "E Mail:", input.email],
    ],
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 4;

  // ---------- Line items ----------
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Quantity", "Description", "Image", "Unit price", "Total"]],
    body: items.length
      ? items.map((it) => [
          String(it.quantity),
          it.description,
          "",
          ZAR(it.unitPrice),
          ZAR(it.quantity * it.unitPrice),
        ])
      : [["", "Awaiting product selection", "", "", ""]],
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30 },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 4;

  // ---------- Notes ----------
  ensureSpace(8);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("NOTES", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const notesLines: string[] = ["Project details:"];
  if (input.address) notesLines.push(`Location: ${input.address}`);
  notesLines.push("Customer to supply the lintel base and isolator prior to installation.");
  if (input.cornerInstall) notesLines.push("Installation: Corner installation");
  if (input.transportPrice !== null) notesLines.push("Delivery included.");
  if (input.notes) notesLines.push(input.notes);
  if (input.extrasForAccount) {
    notesLines.push(`Flues / extras for client account: ${input.extrasForAccount}`);
  }
  for (const line of notesLines) {
    const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
    ensureSpace(wrapped.length * 4);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4;
  }
  y += 3;

  // ---------- Please note box ----------
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        {
          content: "PLEASE NOTE   IF ANY EXTRA FLUES OR BEND NEEDED IT IS FOR CUSTOMERS ACCOUNT",
          styles: { fontStyle: "bold" },
        },
      ],
    ],
    margin: { left: margin, right: margin, bottom: bottomMargin },
  });
  // @ts-expect-error
  y = doc.lastAutoTable.finalY + 4;

  // ---------- Banking details (left) + totals (right) ----------
  // Keep both columns together on the same page.
  ensureSpace(58);
  const colW = (pageW - margin * 2 - 6) / 2;
  const totalsX = margin + colW + 6;
  const bankStartY = y;

  autoTable(doc, {
    startY: bankStartY,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: "bold" },
      1: { cellWidth: colW - 35 },
    },
    body: [
      [
        { content: "BANKING DETAILS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [60, 60, 60], textColor: 255 } },
      ],
      ["Account Name:", "Lava Fires"],
      ["Bank:", "Nedbank"],
      ["Branch Name:", "Tygerberg Winelands"],
      ["Branch Code:", "118602"],
      ["Account Number:", "1033186821"],
      ["Reference:", "Use invoice number"],
    ],
    margin: { left: margin, bottom: bottomMargin },
    tableWidth: colW,
  });
  // @ts-expect-error
  const bankEnd = doc.lastAutoTable.finalY;

  // Totals
  let ty = bankStartY + 2;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Subtotal (excl. VAT)", totalsX, ty);
  doc.text(ZAR(subtotal), pageW - margin, ty, { align: "right" });
  ty += 6;
  doc.text("VAT (15%)", totalsX, ty);
  doc.text(ZAR(vat), pageW - margin, ty, { align: "right" });
  ty += 7;
  doc.setLineWidth(0.4);
  doc.line(totalsX, ty - 4, pageW - margin, ty - 4);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("TOTAL (incl. VAT)", totalsX, ty);
  doc.text(ZAR(total), pageW - margin, ty, { align: "right" });

  y = Math.max(bankEnd, ty) + 6;

  // ---------- Footer terms ----------
  ensureSpace(6);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("80% DEPOSIT for ACCEPTANCE OF QUOTATION     BALANCE ON COMPLETION", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const footer = [
    "All goods remain the property of Progress until full and final payment is received.",
    "Yearly services of pellet and gas fireplaces and Air cons important.  Contact us to arrange.",
  ];
  for (const line of footer) {
    ensureSpace(4);
    doc.text(line, margin, y);
    y += 4;
  }

  // ---------- Page 2: Installation estimate ----------
  // Excluded when the site is further than 100 km from Cape Town
  // (transport zones "100–200 km" or "200 km+").
  const farFromCT = /100\s*[–-]\s*200|200\s*km\s*\+/i.test(input.transportZone ?? "");
  if (!farFromCT) {
    doc.addPage();
    let py = margin;

    // --- Page 2 header (Progress Installations logo) ---
    const piLogoData = await fetchAsDataURL(progressInstallationsLogo.url);
    if (piLogoData) {
      try {
        const imgW = 90;
        // Actual asset aspect ratio: 360 x 75
        const imgH = imgW * (75 / 360);
        doc.addImage(piLogoData, "PNG", (pageW - imgW) / 2, py, imgW, imgH);
        py += imgH + 4;
      } catch {
        py += 2;
      }
    }
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    doc.text(
      "Certified Installers of Gas, Wood and Pellet fireplaces. Service and Installation of air conditioning and core-drilling services",
      pageW / 2,
      py,
      { align: "center" },
    );
    py += 4;
    doc.setDrawColor(0).setLineWidth(0.3);
    doc.line(margin, py, pageW - margin, py);
    py += 5;
    doc.setFontSize(9);
    doc.text("Tel:  087 550 0413", margin, py);
    doc.text("189 Durban Rd", pageW - margin, py, { align: "right" });
    py += 4;
    doc.text("E mail:  info@progressinstallations.co.za", margin, py);
    doc.text("Bellville", pageW - margin, py, { align: "right" });
    py += 4;
    doc.setTextColor(0, 0, 200);
    doc.text("www.progressgroup.co.za", pageW - margin, py, { align: "right" });
    doc.setTextColor(0);
    py += 10;

    // --- Title ---
    doc.setFont("helvetica", "bold").setFontSize(18);
    doc.text("Installation Estimate", pageW / 2, py, { align: "center" });
    py += 6;
    doc.setFont("helvetica", "italic").setFontSize(10);
    doc.text("Subject to site visit or site photographs", pageW / 2, py, { align: "center" });
    py += 8;

    // --- Fee table ---
    autoTable(doc, {
      startY: py,
      theme: "grid",
      head: [["Estimated Installation Fee", "Amount"]],
      body: [
        ["Within Cape Town", ZAR(5500)],
        ["Core Drilling Fee", ZAR(input.storyType === "double" ? 1650 : 0)],
        ["Travel Fee", ZAR(input.travelFee ?? 0)],
      ],
      foot: [[{ content: "Total", styles: { fontStyle: "bold" } }, { content: ZAR(5500 + (input.storyType === "double" ? 1650 : 0) + (input.travelFee ?? 0)), styles: { fontStyle: "bold", halign: "right" } }]],
      styles: { fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [245, 245, 245], textColor: 0 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 45, halign: "right" },
      },
      margin: { left: margin, right: margin, bottom: bottomMargin },
    });
    // @ts-expect-error
    py = doc.lastAutoTable.finalY + 8;

    // --- Banking details box ---
    autoTable(doc, {
      startY: py,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold" },
        1: { cellWidth: "auto" },
      },
      body: [
        [{ content: "BANKING DETAILS", colSpan: 2, styles: { fontStyle: "bold", fillColor: [60, 60, 60], textColor: 255 } }],
        ["Bank:", "FNB/RMB"],
        ["Account Holder:", "Progress Installations (Pty) Ltd"],
        ["Account Type:", "Gold Business Account"],
        ["Account Number:", "63158448770"],
        ["Branch Code:", "250655"],
        ["Reference:", "Use quote number"],
      ],
      margin: { left: margin, right: margin, bottom: bottomMargin },
    });
    // @ts-expect-error
    py = doc.lastAutoTable.finalY + 8;

    // --- Terms & Conditions ---
    ensureSpacePage2(8);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Terms & Conditions", margin, py);
    py += 6;

    const terms: { title: string; body: string }[] = [
      {
        title: "1. Scope of Quotation:",
        body: "The online quotation provided is an estimate for the installation of a product based on the details you've entered. Actual costs may vary depending on the specific requirements of your installation site.",
      },
      {
        title: "2. Exclusions:",
        body: "The following items are not included in the online quotation:\n• Additional flues and bends needed for the installation.",
      },
      {
        title: "3. Onsite Visit:",
        body: "To confirm the final costing and ensure all details are accurate, an onsite visit is necessary. Upon the visit, a detailed quote will be provided which may differ from the online estimate due to actual site conditions or requirements.",
      },
      {
        title: "4. Amendments:",
        body: "We reserve the right to amend or modify the terms herein without prior notice. It's your responsibility to review these terms and conditions each time you seek a quotation.",
      },
      {
        title: "5. No Binding Offer:",
        body: "The online quotation should be considered as an initial estimate and is not a binding offer. All final quotations will be provided after the onsite visit.",
      },
    ];
    for (const t of terms) {
      ensureSpacePage2(10);
      doc.setFont("helvetica", "bold").setFontSize(9.5);
      doc.text(t.title, margin, py);
      py += 4;
      doc.setFont("helvetica", "normal").setFontSize(9);
      for (const part of t.body.split("\n")) {
        const wrapped = doc.splitTextToSize(part, pageW - margin * 2);
        ensureSpacePage2(wrapped.length * 4);
        doc.text(wrapped, margin, py);
        py += wrapped.length * 4;
      }
      py += 3;
    }

    function ensureSpacePage2(needed: number) {
      if (py + needed > pageH - bottomMargin) {
        doc.addPage();
        py = margin;
      }
    }
  }


  const filename = `Progress-${isInvoice ? "Invoice" : "Quote"}-${quoteNo.replace(/\s/g, "")}.pdf`;
  const triggerDownload = () => doc.save(filename);
  if (options.download !== false) triggerDownload();
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;
  return { filename, base64, quoteNo, triggerDownload };
}

