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
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 300;
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

export function normalizeContractData(raw = {}) {
  const contractNumber = raw.contract_number ?? raw.contractNumber ?? "";
  const contractDate = raw.contract_date ?? raw.contractDate ?? "";
  const customerName = raw.customer_name ?? raw.customer?.name ?? "";
  const customerAddress = raw.customer_address ?? raw.customer?.address ?? "";
  const customerPhone = raw.customer_phone ?? raw.customer?.phone ?? "";
  const customerEmail = raw.customer_email ?? raw.customer?.email ?? "";
  const eventLocation = raw.event_location ?? raw.eventLocation ?? "";
  const eventDate = raw.event_date ?? raw.eventDate ?? "";
  const eventTime = raw.event_time ?? raw.eventTime ?? "";
  const items = Array.isArray(raw.items)
    ? raw.items.filter(i => i && (i.description || Number(i.unit_price) > 0))
    : [];
  const discount = parseFloat(raw.discount) || 0;

  let deposits = Array.isArray(raw.deposits) ? [...raw.deposits] : [];
  if (deposits.length === 0 && Number(raw.deposit) > 0) {
    deposits.push({
      date: contractDate || new Date().toISOString().slice(0, 10),
      amount: Number(raw.deposit),
    });
  }

  const itemsTotal = items.reduce(
    (s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0),
    0
  );
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

export function encodeContractForUrl(rawContract) {
  try {
    const c = normalizeContractData(rawContract);
    const compact = {
      n: c.contractNumber,
      dt: c.contractDate,
      cn: c.customerName,
      ca: c.customerAddress,
      cp: c.customerPhone,
      ce: c.customerEmail,
      el: c.eventLocation,
      ed: c.eventDate,
      et: c.eventTime,
      i: c.items.map(it => ({
        d: it.description || "",
        q: Number(it.quantity) || 1,
        p: Number(it.unit_price) || 0,
      })),
      sc: c.discount,
      dp: c.deposits.map(d => ({ dt: d.date || "", a: Number(d.amount) || 0 })),
      t: c.finalTotal,
      nt: c.notes,
    };
    const jsonStr = JSON.stringify(compact);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = "";
    utf8Bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

export function decodeContractFromUrl(encoded) {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const compact = JSON.parse(jsonStr);
    return {
      contract_number: compact.n || "",
      contract_date: compact.dt || "",
      customer_name: compact.cn || "",
      customer_address: compact.ca || "",
      customer_phone: compact.cp || "",
      customer_email: compact.ce || "",
      event_location: compact.el || "",
      event_date: compact.ed || "",
      event_time: compact.et || "",
      items: Array.isArray(compact.i)
        ? compact.i.map(x => ({ description: x.d, quantity: x.q, unit_price: x.p }))
        : [],
      discount: compact.sc || 0,
      deposits: Array.isArray(compact.dp)
        ? compact.dp.map(x => ({ date: x.dt, amount: x.a }))
        : [],
      total: compact.t || 0,
      notes: compact.nt || "",
    };
  } catch {
    return null;
  }
}

export async function generateContractColorPdf(rawContract) {
  const c = normalizeContractData(rawContract);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Fascia superiore elegante bicolore (Rosso Bordeaux + Blu Notte + filetto Oro)
  doc.setFillColor(185, 28, 28); // Crimson Red
  doc.rect(0, 0, 72, 4.5, "F");
  doc.setFillColor(15, 23, 42); // Deep Navy
  doc.rect(72, 0, pageWidth - 72, 4.5, "F");
  doc.setFillColor(217, 119, 6); // Gold accent line
  doc.rect(0, 4.5, pageWidth, 0.7, "F");

  let y = 11;

  // 2. Intestazione elegante e ben leggibile con Logo e Dati di Apollo Events
  const logoDataUrl = await loadLogoDataUrl("/logo.png");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y - 1, 24, 24);
    } catch {
      // ignore if image fails
    }
  }

  const brandX = logoDataUrl ? margin + 27 : margin;

  // Nome Azienda in carattere Serif elegante (Times Bold) grande e nitido
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42);
  doc.text("Apollo Events", brandX, y + 7.5);

  // Sottotitolo elegante in Times Bold Italic rosso bordeaux
  doc.setFont("times", "bolditalic");
  doc.setFontSize(11.5);
  doc.setTextColor(185, 28, 28);
  doc.text("Spettacoli Pirotecnici · Eventi · Allestimenti", brandX, y + 13.5);

  // Dati descrittivi intestazione leggibili ed eleganti
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Progettazione e Realizzazione Spettacoli Pirotecnici ed Eventi Esclusivi", brandX, y + 18.8);

  // Riquadro Destro: Titolo Documento e Riferimenti
  doc.setFont("times", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  doc.text("CONTRATTO D'EVENTO", pageWidth - margin, y + 5.5, { align: "right" });

  const badgeW = 56;
  const badgeX = pageWidth - margin - badgeW;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.roundedRect(badgeX, y + 8, badgeW, 14, 2, 2, "FD");

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Contratto N°:", badgeX + 3.5, y + 13.5);
  doc.text("Data Stipula:", badgeX + 3.5, y + 19.2);

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(String(c.contractNumber || "—"), badgeX + badgeW - 3.5, y + 13.5, { align: "right" });
  doc.text(c.contractDate ? safeFormatDate(c.contractDate) : "—", badgeX + badgeW - 3.5, y + 19.2, { align: "right" });

  y += 26;

  // Linea divisoria intestazione (Blu Notte + accento Bordeaux)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(1.2);
  doc.line(margin, y, margin + 52, y);

  y += 5.5;

  // 3. Dati Committente & Dettagli Evento (2 riquadri a colori affiancati)
  const cardGap = 6;
  const cardW = (contentWidth - cardGap) / 2;
  const cardH = 33;

  // Scheda Sinistra: Dati Committente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, "FD");
  doc.setFillColor(30, 58, 138); // Blu Reale
  doc.rect(margin, y, 2.5, cardH, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text("DATI COMMITTENTE", margin + 5.5, y + 6);

  doc.setFont("times", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  const custNameLines = doc.splitTextToSize(c.customerName || "—", cardW - 9);
  doc.text(custNameLines[0], margin + 5.5, y + 12.5);

  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  let custY = y + 18;
  if (c.customerAddress) {
    const addrLines = doc.splitTextToSize(c.customerAddress, cardW - 9);
    doc.text(addrLines[0], margin + 5.5, custY);
    custY += 5;
  }
  if (c.customerPhone) {
    doc.setFont("times", "bold");
    doc.text("Telefono:", margin + 5.5, custY);
    doc.setFont("times", "normal");
    doc.text(String(c.customerPhone), margin + 21, custY);
    custY += 5;
  }
  if (c.customerEmail) {
    doc.setFont("times", "bold");
    doc.text("Email:", margin + 5.5, custY);
    doc.setFont("times", "normal");
    doc.text(String(c.customerEmail), margin + 17, custY);
  }

  // Scheda Destra: Dettagli Evento
  const rightCardX = margin + cardW + cardGap;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(252, 211, 77);
  doc.setLineWidth(0.35);
  doc.roundedRect(rightCardX, y, cardW, cardH, 2, 2, "FD");
  doc.setFillColor(185, 28, 28); // Rosso Bordeaux
  doc.rect(rightCardX, y, 2.5, cardH, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text("DETTAGLI EVENTO", rightCardX + 5.5, y + 6);

  let evY = y + 13;
  doc.setFontSize(9.5);
  const drawEventRow = (label, val) => {
    doc.setFont("times", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, rightCardX + 5.5, evY);
    doc.setFont("times", "bold");
    doc.setTextColor(15, 23, 42);
    const valLines = doc.splitTextToSize(val || "—", cardW - 32);
    doc.text(valLines[0], rightCardX + cardW - 4, evY, { align: "right" });
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.25);
    doc.line(rightCardX + 5.5, evY + 1.8, rightCardX + cardW - 4, evY + 1.8);
    evY += 6.5;
  };
  drawEventRow("Luogo Evento:", c.eventLocation || "—");
  drawEventRow("Data Evento:", c.eventDate ? safeFormatDate(c.eventDate) : "—");
  drawEventRow("Orario:", c.eventTime || "—");

  y += cardH + 6.5;

  // 4. Tabella Servizi / Prodotti Inclusi
  const colDescW = contentWidth - 72;
  const colQtyW = 16;
  const colPriceW = 28;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 8.5, 1.5, 1.5, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRIZIONE SERVIZIO / ARTICOLO", margin + 3.5, y + 5.7);
  doc.text("Q.TÀ", margin + colDescW + colQtyW / 2, y + 5.7, { align: "center" });
  doc.text("PREZZO UNIT.", margin + colDescW + colQtyW + colPriceW - 2, y + 5.7, { align: "right" });
  doc.text("IMPORTO", margin + contentWidth - 3.5, y + 5.7, { align: "right" });

  y += 8.5;

  const displayItems = c.items.length > 0
    ? c.items
    : [{ description: "Servizio pirotecnico / spettacolo d'evento", quantity: 1, unit_price: c.finalTotal }];

  displayItems.forEach((item, idx) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const rowTotal = qty * price;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(String(item.description || "—"), colDescW - 7);
    const rowH = Math.max(8, descLines.length * 4.8 + 3.2);

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

    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(descLines, margin + 3.5, y + 5.3);

    doc.text(String(qty), margin + colDescW + colQtyW / 2, y + 5.3, { align: "center" });
    doc.text(`€ ${price.toFixed(2)}`, margin + colDescW + colQtyW + colPriceW - 2, y + 5.3, { align: "right" });

    doc.setFont("times", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`€ ${rowTotal.toFixed(2)}`, margin + contentWidth - 3.5, y + 5.3, { align: "right" });

    y += rowH;
  });

  y += 4.5;

  // 5. Subtotals, Discount & Totale Pattuito
  const totBoxW = 82;
  const totBoxX = pageWidth - margin - totBoxW;

  if (c.discount > 0) {
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Totale Servizi:", totBoxX + 2, y + 4);
    doc.setFont("times", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`€ ${c.itemsTotal.toFixed(2)}`, pageWidth - margin - 2, y + 4, { align: "right" });
    y += 5.2;

    doc.setFont("times", "bold");
    doc.setTextColor(225, 29, 72);
    doc.text("Sconto Applicato:", totBoxX + 2, y + 4);
    doc.text(`- € ${c.discount.toFixed(2)}`, pageWidth - margin - 2, y + 4, { align: "right" });
    y += 6.2;
  }

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.45);
  doc.roundedRect(totBoxX, y, totBoxW, 10, 1.5, 1.5, "FD");

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text("TOTALE PATTUITO", totBoxX + 3.5, y + 6.5);
  doc.setFontSize(12);
  doc.text(`€ ${c.finalTotal.toFixed(2)}`, pageWidth - margin - 3.5, y + 6.5, { align: "right" });

  y += 14.5;

  // 6. Riepilogo Acconti Ricevuti
  if (c.deposits.length > 0) {
    const depBoxH = 14 + c.deposits.length * 5.8;
    if (y + depBoxH > pageHeight - 55) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text("RIEPILOGO ACCONTI E PAGAMENTI RICEVUTI", margin, y + 3);
    y += 4.5;

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, depBoxH - 4, 2, 2, "FD");

    doc.setFillColor(16, 185, 129);
    doc.rect(margin, y, 2.5, depBoxH - 4, "F");

    let depY = y + 5.5;
    c.deposits.forEach((dep) => {
      doc.setFont("times", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const dStr = dep.date ? safeFormatDate(dep.date) : "—";
      doc.text(`Acconto versato in data ${dStr}`, margin + 5.5, depY);

      doc.setFont("times", "bold");
      doc.setTextColor(4, 120, 87);
      doc.text(`€ ${(parseFloat(dep.amount) || 0).toFixed(2)}`, pageWidth - margin - 4, depY, { align: "right" });
      depY += 5.5;
    });

    doc.setDrawColor(110, 231, 183);
    doc.setLineWidth(0.3);
    doc.line(margin + 5.5, depY - 2, pageWidth - margin - 4, depY - 2);

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    doc.text("TOTALE VERSATO", margin + 5.5, depY + 2.5);
    doc.setFontSize(11);
    doc.text(`€ ${c.paidTotal.toFixed(2)}`, pageWidth - margin - 4, depY + 2.5, { align: "right" });

    y += depBoxH + 3.5;
  }

  // 7. Note Aggiuntive
  if (c.notes && c.notes.trim()) {
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    const noteLines = doc.splitTextToSize(c.notes.trim(), contentWidth - 10);
    const noteBoxH = Math.max(13, noteLines.length * 4.5 + 8.5);
    if (y + noteBoxH > pageHeight - 55) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, noteBoxH, 1.5, 1.5, "FD");
    doc.setFillColor(100, 116, 139);
    doc.rect(margin, y, 2.2, noteBoxH, "F");

    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text("NOTE AGGIUNTIVE / ACCORDI SPECIFICI", margin + 5.5, y + 4.8);

    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(noteLines, margin + 5.5, y + 9.5);

    y += noteBoxH + 4.5;
  }

  // 8. Saldo Rimanente da Versare Banner
  if (y + 52 > pageHeight - 10) {
    doc.addPage();
    y = 15;
  }

  const balH = 12.5;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, balH, 2, 2, "F");
  doc.setFillColor(251, 191, 36);
  doc.rect(margin, y, 3.2, balH, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(241, 245, 249);
  doc.text("SALDO RIMANENTE DA VERSARE", margin + 6.5, y + 7.8);

  doc.setFont("times", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(251, 191, 36);
  doc.text(`€ ${c.balance.toFixed(2)}`, pageWidth - margin - 4.5, y + 8.1, { align: "right" });

  y += balH + 12;

  // 9. Firme
  const sigW = 72;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin + 6, y + 10, margin + 6 + sigW, y + 10);
  doc.line(pageWidth - margin - 6 - sigW, y + 10, pageWidth - margin - 6, y + 10);

  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Firma Cliente per Accettazione", margin + 6 + sigW / 2, y + 15, { align: "center" });
  doc.text("Per Apollo Events", pageWidth - margin - 6 - sigW / 2, y + 15, { align: "center" });

  y += 20;

  // 10. Condizioni Generali di Pagamento
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4.5;

  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("CONDIZIONI GENERALI DI PAGAMENTO", margin, y);
  y += 4;

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const cond1 = "Caparra Confirmatoria: A conferma della stipula, è richiesto un versamento non rimborsabile di almeno € 100,00. In caso di recesso, la somma sarà trattenuta (art. 1385 c.c.). Acconto: Entro 3 mesi prima dell'evento, è richiesto un acconto del 50% dell'importo totale.";
  const cond2 = "Modalità di Saldo: Versamento anticipato dell'intera somma residua entro 5 giorni dalla data dell'evento. In caso di saldo il giorno stesso dell'evento, è richiesto un ulteriore anticipo del 50% della rimanenza entro 5 giorni prima, corrispondendo la parte finale il giorno dell'evento.";
  const condLines1 = doc.splitTextToSize(cond1, contentWidth);
  doc.text(condLines1, margin, y);
  y += condLines1.length * 3.4 + 1.2;
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
  const encoded = encodeContractForUrl(rawContract);
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://apollo-events.vercel.app";
  const directPdfUrl = encoded ? `${origin}/contratto-pdf?d=${encoded}` : "";

  const refStr = c.contractNumber ? ` N° ${c.contractNumber}` : "";
  const subject = `Contratto${refStr} – Apollo Events`;

  const bodyLines = [
    `Gentile ${c.customerName || "Cliente"},`,
    ``,
    `in allegato alla presente trasmettiamo copia del Contratto${refStr} in formato PDF.`,
    ...(directPdfUrl
      ? [
          ``,
          `È inoltre possibile visualizzare e scaricare direttamente il Contratto in PDF a colori cliccando sul seguente link:`,
          directPdfUrl,
        ]
      : []),
    ``,
    `Restiamo a completa disposizione per qualsiasi chiarimento e porgiamo cordiali saluti.`,
    ``,
    `Apollo Events`,
    `Spettacoli Pirotecnici · Eventi · Allestimenti`,
  ];

  return {
    to: c.customerEmail || "",
    subject,
    body: bodyLines.join("\n"),
    directPdfUrl,
  };
}
