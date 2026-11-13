import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { it } from "date-fns/locale";

function safeFormatDate(dateStr, fmt = "dd/MM/yyyy") {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, fmt, { locale: it });
  } catch {
    return String(dateStr);
  }
}

async function loadLogoDataUrl(url = "/logo.png") {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export function normalizeContractData(raw) {
  const contractNumber = raw.contract_number ?? raw.contractNumber ?? "";
  const contractDate = raw.contract_date ?? raw.contractDate ?? "";
  const customerName = raw.customer_name ?? raw.customer?.name ?? "";
  const customerAddress = raw.customer_address ?? raw.customer?.address ?? "";
  const customerPhone = raw.customer_phone ?? raw.customer?.phone ?? "";
  const customerEmail = raw.customer_email ?? raw.customer?.email ?? "";
  const eventLocation = raw.event_location ?? raw.eventLocation ?? "";
  const eventDate = raw.event_date ?? raw.eventDate ?? "";
  const eventTime = raw.event_time ?? raw.eventTime ?? "";
  const items = Array.isArray(raw.items) ? raw.items.filter(i => i && (i.description || Number(i.unit_price) > 0)) : [];
  const discount = parseFloat(raw.discount) || 0;

  let deposits = Array.isArray(raw.deposits) ? [...raw.deposits] : [];
  if (deposits.length === 0 && Number(raw.deposit) > 0) {
    deposits.push({
      date: contractDate || new Date().toISOString().slice(0, 10),
      amount: Number(raw.deposit),
    });
  }

  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const computedTotal = Math.max(0, itemsTotal - discount);
  const rawTotal = parseFloat(raw.total) || 0;
  const finalTotal = rawTotal > 0 ? rawTotal : computedTotal;
  const paidTotal = deposits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const balance = Math.max(0, finalTotal - paidTotal);
  const notes = raw.notes || "";

  return {
    contractNumber,
    contractDate,
    customerName,
    customerAddress,
    customerPhone,
    customerEmail,
    eventLocation,
    eventDate,
    eventTime,
    items,
    discount,
    deposits,
    itemsTotal,
    finalTotal,
    paidTotal,
    balance,
    notes,
  };
}

export async function generateContractColorPdf(rawContract) {
  const c = normalizeContractData(rawContract);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top decorative color bar (Apollo Red + Deep Navy)
  doc.setFillColor(236, 14, 14);
  doc.rect(0, 0, 75, 4, "F");
  doc.setFillColor(15, 23, 42);
  doc.rect(75, 0, pageWidth - 75, 4, "F");

  let y = 10;

  // 2. Logo + Company Header
  const logoDataUrl = await loadLogoDataUrl("/logo.png");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y, 20, 20);
    } catch {
      // ignore if image fails
    }
  }

  const brandX = logoDataUrl ? margin + 23 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("APOLLO EVENTS", brandX, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(236, 14, 14);
  doc.text("FIREWORKS · SPETTACOLI PIROTECNICI & EVENTI", brandX, y + 14.5);

  // Right Header: CONTRATTO badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("CONTRATTO", pageWidth - margin, y + 6, { align: "right" });

  // Box Rif. N° & Data
  const badgeW = 54;
  const badgeX = pageWidth - margin - badgeW;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, y + 8.5, badgeW, 12.5, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("RIF. N°:", badgeX + 3, y + 13.5);
  doc.text("DATA:", badgeX + 3, y + 18.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(String(c.contractNumber || "—"), badgeX + 18, y + 13.5);
  doc.text(c.contractDate ? safeFormatDate(c.contractDate) : "—", badgeX + 18, y + 18.5);

  y += 24;

  // Header bottom border line (Navy + Red accent)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setDrawColor(236, 14, 14);
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + 45, y);

  y += 5;

  // 3. Dati Committente & Dettagli Evento (2 colored cards side by side)
  const cardGap = 6;
  const cardW = (contentWidth - cardGap) / 2;
  const cardH = 30;

  // Left Card: Dati Committente (Soft Indigo/Slate)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, "FD");
  // Left stripe Navy
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, y, 2.2, cardH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 138);
  doc.text("DATI COMMITTENTE", margin + 5, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const custNameLines = doc.splitTextToSize(c.customerName || "—", cardW - 8);
  doc.text(custNameLines[0], margin + 5, y + 11.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  let custY = y + 16.5;
  if (c.customerAddress) {
    const addrLines = doc.splitTextToSize(c.customerAddress, cardW - 8);
    doc.text(addrLines[0], margin + 5, custY);
    custY += 4.5;
  }
  if (c.customerPhone) {
    doc.setFont("helvetica", "bold");
    doc.text("Tel:", margin + 5, custY);
    doc.setFont("helvetica", "normal");
    doc.text(String(c.customerPhone), margin + 13, custY);
    custY += 4.5;
  }
  if (c.customerEmail) {
    doc.setFont("helvetica", "bold");
    doc.text("Email:", margin + 5, custY);
    doc.setFont("helvetica", "normal");
    doc.text(String(c.customerEmail), margin + 16, custY);
  }

  // Right Card: Dettagli Evento (Warm Amber/Red tint)
  const rightCardX = margin + cardW + cardGap;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightCardX, y, cardW, cardH, 2, 2, "FD");
  // Left stripe Apollo Red
  doc.setFillColor(236, 14, 14);
  doc.rect(rightCardX, y, 2.2, cardH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(236, 14, 14);
  doc.text("DETTAGLI EVENTO", rightCardX + 5, y + 5.5);

  let evY = y + 12;
  doc.setFontSize(8.5);
  const drawEventRow = (label, val) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, rightCardX + 5, evY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const valLines = doc.splitTextToSize(val || "—", cardW - 30);
    doc.text(valLines[0], rightCardX + cardW - 4, evY, { align: "right" });
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.2);
    doc.line(rightCardX + 5, evY + 1.5, rightCardX + cardW - 4, evY + 1.5);
    evY += 6;
  };
  drawEventRow("Luogo:", c.eventLocation || "—");
  drawEventRow("Data Evento:", c.eventDate ? safeFormatDate(c.eventDate) : "—");
  drawEventRow("Orario:", c.eventTime || "—");

  y += cardH + 6;

  // 4. Tabella Servizi / Articoli
  const colDescW = contentWidth - 70;
  const colQtyW = 16;
  const colPriceW = 26;
  const colTotalW = 28;

  // Table Header
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRIZIONE SERVIZIO / ARTICOLO", margin + 3, y + 5.3);
  doc.text("Q.TÀ", margin + colDescW + colQtyW / 2, y + 5.3, { align: "center" });
  doc.text("PREZZO UNIT.", margin + colDescW + colQtyW + colPriceW - 2, y + 5.3, { align: "right" });
  doc.text("IMPORTO", margin + contentWidth - 3, y + 5.3, { align: "right" });

  y += 8;

  const displayItems = c.items.length > 0 ? c.items : [{ description: "Servizio pirotecnico / evento", quantity: 1, unit_price: c.finalTotal }];

  displayItems.forEach((item, idx) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const rowTotal = qty * price;
    const descLines = doc.splitTextToSize(String(item.description || "—"), colDescW - 6);
    const rowH = Math.max(7.5, descLines.length * 4.5 + 3);

    if (y + rowH > pageHeight - 60) {
      doc.addPage();
      y = 15;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, contentWidth, rowH, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(descLines, margin + 3, y + 5);

    doc.text(String(qty), margin + colDescW + colQtyW / 2, y + 5, { align: "center" });
    doc.text(`€ ${price.toFixed(2)}`, margin + colDescW + colQtyW + colPriceW - 2, y + 5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`€ ${rowTotal.toFixed(2)}`, margin + contentWidth - 3, y + 5, { align: "right" });

    y += rowH;
  });

  y += 4;

  // 5. Subtotals, Discount & Totale Pattuito
  const totBoxW = 78;
  const totBoxX = pageWidth - margin - totBoxW;

  if (c.discount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Totale Servizi:", totBoxX + 2, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`€ ${c.itemsTotal.toFixed(2)}`, pageWidth - margin - 2, y + 4, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(225, 29, 72); // Rose red
    doc.text("Sconto Applicato:", totBoxX + 2, y + 4);
    doc.text(`- € ${c.discount.toFixed(2)}`, pageWidth - margin - 2, y + 4, { align: "right" });
    y += 6;
  }

  // Highlighted Totale Pattuito box (Indigo/Blue tint)
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.4);
  doc.roundedRect(totBoxX, y, totBoxW, 9.5, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text("TOTALE PATTUITO", totBoxX + 3, y + 6.2);
  doc.setFontSize(11);
  doc.text(`€ ${c.finalTotal.toFixed(2)}`, pageWidth - margin - 3, y + 6.2, { align: "right" });

  y += 14;

  // 6. Riepilogo Acconti Ricevuti (Full-color Emerald Box)
  if (c.deposits.length > 0) {
    const depBoxH = 13 + c.deposits.length * 5.5;
    if (y + depBoxH > pageHeight - 55) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.text("RIEPILOGO ACCONTI E PAGAMENTI RICEVUTI", margin, y + 3);
    y += 4.5;

    doc.setFillColor(236, 253, 245); // Emerald 50
    doc.setDrawColor(167, 243, 208); // Emerald 200
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, depBoxH - 4, 2, 2, "FD");

    // Left Emerald Stripe
    doc.setFillColor(16, 185, 129);
    doc.rect(margin, y, 2.2, depBoxH - 4, "F");

    let depY = y + 5;
    c.deposits.forEach((dep) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const dStr = dep.date ? safeFormatDate(dep.date) : "—";
      doc.text(`Acconto versato in data ${dStr}`, margin + 5, depY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(4, 120, 87);
      doc.text(`€ ${(parseFloat(dep.amount) || 0).toFixed(2)}`, pageWidth - margin - 4, depY, { align: "right" });
      depY += 5.2;
    });

    doc.setDrawColor(110, 231, 183);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, depY - 2, pageWidth - margin - 4, depY - 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text("TOTALE VERSATO", margin + 5, depY + 2.2);
    doc.setFontSize(10);
    doc.text(`€ ${c.paidTotal.toFixed(2)}`, pageWidth - margin - 4, depY + 2.2, { align: "right" });

    y += depBoxH + 3;
  }

  // 7. Note Aggiuntive
  if (c.notes && c.notes.trim()) {
    const noteLines = doc.splitTextToSize(c.notes.trim(), contentWidth - 10);
    const noteBoxH = Math.max(12, noteLines.length * 4.2 + 8);
    if (y + noteBoxH > pageHeight - 55) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, noteBoxH, 1.5, 1.5, "FD");
    doc.setFillColor(100, 116, 139);
    doc.rect(margin, y, 2, noteBoxH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text("NOTE AGGIUNTIVE / ACCORDI SPECIFICI", margin + 5, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(noteLines, margin + 5, y + 9);

    y += noteBoxH + 4;
  }

  // 8. Saldo Rimanente da Versare Banner (Deep Navy + Amber Gold stripe)
  if (y + 50 > pageHeight - 10) {
    doc.addPage();
    y = 15;
  }

  const balH = 12;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, balH, 2, 2, "F");
  doc.setFillColor(251, 191, 36); // Amber 400
  doc.rect(margin, y, 3, balH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text("SALDO RIMANENTE DA VERSARE", margin + 6, y + 7.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(251, 191, 36);
  doc.text(`€ ${c.balance.toFixed(2)}`, pageWidth - margin - 4, y + 7.8, { align: "right" });

  y += balH + 12;

  // 9. Signatures
  const sigW = 70;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin + 6, y + 10, margin + 6 + sigW, y + 10);
  doc.line(pageWidth - margin - 6 - sigW, y + 10, pageWidth - margin - 6, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("FIRMA CLIENTE PER ACCETTAZIONE", margin + 6 + sigW / 2, y + 14.5, { align: "center" });
  doc.text("PER APOLLO EVENTS", pageWidth - margin - 6 - sigW / 2, y + 14.5, { align: "center" });

  y += 20;

  // 10. Condizioni Generali di Pagamento
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("CONDIZIONI GENERALI DI PAGAMENTO", margin, y);
  y += 3.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const cond1 = "Caparra Confirmatoria: A conferma della stipula, è richiesto un versamento non rimborsabile di almeno € 100,00. In caso di recesso, la somma sarà trattenuta (art. 1385 c.c.). Acconto: Entro 3 mesi prima dell'evento, è richiesto un acconto del 50% dell'importo totale.";
  const cond2 = "Modalità di Saldo: Versamento anticipato dell'intera somma residua entro 5 giorni dalla data dell'evento. In caso di saldo il giorno stesso dell'evento, è richiesto un ulteriore anticipo del 50% della rimanenza entro 5 giorni prima, corrispondendo la parte finale il giorno dell'evento.";
  const condLines1 = doc.splitTextToSize(cond1, contentWidth);
  doc.text(condLines1, margin, y);
  y += condLines1.length * 3.1 + 1;
  const condLines2 = doc.splitTextToSize(cond2, contentWidth);
  doc.text(condLines2, margin, y);

  const safeNum = String(c.contractNumber || "SenzaNumero").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeCust = String(c.customerName || "Cliente").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Contratto_ApolloEvents_${safeNum}_${safeCust}.pdf`;

  const pdfBlob = doc.output("blob");
  const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

  return { doc, pdfBlob, pdfFile, fileName, normalized: c };
}

export function buildContractEmailContent(rawContract, fileName) {
  const c = normalizeContractData(rawContract);
  const subject = `Contratto N° ${c.contractNumber || "—"} – Apollo Events (${c.customerName || "Cliente"})`;
  const itemsText = c.items.length > 0
    ? c.items.map(i => `- ${i.description}: ${i.quantity} x €${(parseFloat(i.unit_price) || 0).toFixed(2)} = €${((parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0)).toFixed(2)}`).join("\n")
    : `- Servizio Evento: €${c.finalTotal.toFixed(2)}`;

  const body = [
    `Gentile ${c.customerName || "Cliente"},`,
    ``,
    `In allegato trasmettiamo il Contratto N° ${c.contractNumber || "—"} in formato PDF a colori (${fileName}).`,
    ``,
    `RIEPILOGO EVENTO:`,
    `- Luogo: ${c.eventLocation || "—"}`,
    `- Data: ${c.eventDate ? safeFormatDate(c.eventDate) : "—"}${c.eventTime ? ` ore ${c.eventTime}` : ""}`,
    ``,
    `SERVIZI INCLUSI:`,
    itemsText,
    ...(c.discount > 0 ? [`Sconto applicato: -€${c.discount.toFixed(2)}`] : []),
    ``,
    `Totale Pattuito: €${c.finalTotal.toFixed(2)}`,
    `Acconti Versati: €${c.paidTotal.toFixed(2)}`,
    `Saldo Rimanente: €${c.balance.toFixed(2)}`,
    ...(c.notes ? [``, `Note: ${c.notes}`] : []),
    ``,
    `Cordiali saluti,`,
    `Apollo Events`,
  ].join("\n");

  return {
    to: c.customerEmail || "",
    subject,
    body,
  };
}
