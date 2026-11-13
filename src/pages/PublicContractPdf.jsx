import { useEffect, useState } from "react";
import { decodeContractFromUrl, generateContractColorPdf, normalizeContractData } from "../utils/contractPdf";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const LOGO = "/logo.png";

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

export default function PublicContractPdf() {
  const [contract, setContract] = useState(null);
  const [pdfResult, setPdfResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("d");
    if (!encoded) {
      setError(true);
      return;
    }
    const decoded = decodeContractFromUrl(encoded);
    if (!decoded) {
      setError(true);
      return;
    }
    const norm = normalizeContractData(decoded);
    setContract(norm);

    let objectUrl = "";
    generateContractColorPdf(decoded).then((res) => {
      setPdfResult(res);
      objectUrl = URL.createObjectURL(res.pdfBlob);
      setPdfUrl(objectUrl);
      // Scarica automaticamente il PDF a colori all'apertura del link
      res.doc.save(res.fileName);
    });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md text-center space-y-2">
          <img src={LOGO} alt="Apollo Events" className="h-16 w-16 mx-auto object-contain" />
          <h1 className="text-xl font-bold text-slate-900">Link Contratto non valido</h1>
          <p className="text-sm text-slate-500">Il link del contratto non è completo o è scaduto.</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-3">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-red-700 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Generazione Contratto in PDF a colori...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 print:bg-white print:p-0">
      {/* Top Bar */}
      <div className="max-w-[21cm] mx-auto mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Apollo Events" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-bold text-slate-900 text-sm">
              Contratto {contract.contractNumber ? `N° ${contract.contractNumber}` : ""} – Apollo Events
            </p>
            <p className="text-xs text-emerald-700 font-medium">
              ✓ Il documento PDF a colori è pronto per il download
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => pdfResult && pdfResult.doc.save(pdfResult.fileName)}
            className="rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold shadow"
          >
            <FileDown className="w-4 h-4 mr-1.5" /> Scarica PDF a Colori
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="rounded-xl font-semibold"
          >
            <Printer className="w-4 h-4 mr-1.5" /> Stampa
          </Button>
        </div>
      </div>

      {/* Full-color Contract Sheet */}
      <div
        className="bg-white p-8 print:p-0 text-sm leading-relaxed text-slate-800 max-w-[21cm] mx-auto shadow-2xl rounded-md print:shadow-none flex flex-col relative overflow-hidden"
        style={{
          fontFamily: "'Georgia', 'Times New Roman', Times, serif",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <style>{"@media print { @page { margin: 0.8cm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }"}</style>

        {/* Top Color Bar */}
        <div className="flex h-2 -mx-8 -mt-8 mb-5 print:mx-0 print:mt-0">
          <div className="w-1/3 bg-[#b91c1c]" />
          <div className="w-2/3 bg-slate-900" />
        </div>

        {/* Elegant Header */}
        <div className="flex justify-between items-center mb-4 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Apollo Events" className="h-16 w-16 object-contain drop-shadow-sm" />
            <div>
              <h1 className="font-bold text-3xl text-slate-900 tracking-wide">Apollo Events</h1>
              <p className="text-sm font-semibold italic text-[#b91c1c] mt-0.5">
                Spettacoli Pirotecnici · Eventi · Allestimenti
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Progettazione e Realizzazione Spettacoli Pirotecnici ed Eventi Esclusivi
              </p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-lg text-slate-900 uppercase tracking-wider">Contratto d&apos;Evento</h2>
            <div className="text-xs text-slate-700 bg-slate-50 p-2 px-3 rounded-md border border-slate-300 inline-block text-left mt-1.5">
              <p>
                <span className="font-semibold text-slate-500 inline-block w-24">Contratto N°:</span>
                <span className="font-bold text-slate-900 text-sm">{contract.contractNumber || "—"}</span>
              </p>
              <p className="mt-0.5">
                <span className="font-semibold text-slate-500 inline-block w-24">Data Stipula:</span>
                <span className="font-bold text-slate-900">{contract.contractDate ? safeFormatDate(contract.contractDate) : "—"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Customer & Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900"></div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-blue-900 mb-1 pl-1">Dati Committente</h3>
            <p className="font-bold text-lg text-slate-900 leading-tight pl-1">{contract.customerName || "—"}</p>
            {contract.customerAddress && <p className="mt-1 text-slate-700 text-xs pl-1">{contract.customerAddress}</p>}
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-700 pl-1">
              {contract.customerPhone && <p><span className="font-bold text-slate-500">Telefono:</span> {contract.customerPhone}</p>}
              {contract.customerEmail && <p><span className="font-bold text-slate-500">Email:</span> {contract.customerEmail}</p>}
            </div>
          </div>

          <div className="bg-amber-50/70 p-3.5 rounded-md border border-amber-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#b91c1c]"></div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#b91c1c] mb-1.5 pl-1">Dettagli Evento</h3>
            <div className="space-y-1.5 text-xs text-slate-800 pl-1">
              <p className="flex justify-between border-b border-amber-200/80 pb-1">
                <span className="font-bold text-slate-500">Luogo Evento:</span>
                <span className="font-bold text-right">{contract.eventLocation || "—"}</span>
              </p>
              <p className="flex justify-between border-b border-amber-200/80 pb-1">
                <span className="font-bold text-slate-500">Data Evento:</span>
                <span className="font-bold">{contract.eventDate ? safeFormatDate(contract.eventDate) : "—"}</span>
              </p>
              <p className="flex justify-between border-b border-amber-200/80 pb-1">
                <span className="font-bold text-slate-500">Orario:</span>
                <span className="font-bold">{contract.eventTime || "—"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-4 rounded-md overflow-hidden border border-slate-300 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                <th className="py-2 px-3 font-bold">Descrizione Servizio / Articolo</th>
                <th className="py-2 px-3 font-bold text-center w-16">Q.tà</th>
                <th className="py-2 px-3 font-bold text-right w-28">Prezzo Unit.</th>
                <th className="py-2 px-3 font-bold text-right w-28">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs">
              {contract.items.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                  <td className="py-2 px-3 font-medium text-slate-800">{item.description}</td>
                  <td className="py-2 px-3 text-center text-slate-700">{item.quantity}</td>
                  <td className="py-2 px-3 text-right text-slate-700">€ {(parseFloat(item.unit_price) || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">€ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end space-y-1 mb-4">
          {contract.discount > 0 && (
            <>
              <div className="flex justify-between w-64 text-xs px-2">
                <span className="text-slate-500">Totale Servizi:</span>
                <span className="font-bold">€ {contract.itemsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-xs text-rose-600 px-2">
                <span className="font-bold">Sconto Applicato:</span>
                <span className="font-bold">- € {contract.discount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between w-72 text-base bg-blue-50 border border-blue-500 rounded-md px-3.5 py-2 mt-1">
            <span className="font-bold uppercase text-blue-900">Totale Pattuito</span>
            <span className="font-bold text-blue-900">€ {contract.finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Deposits */}
        {contract.deposits.length > 0 && (
          <div className="mb-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-700 mb-1">Riepilogo Acconti e Pagamenti Ricevuti</h3>
            <div className="border border-emerald-300 rounded-md bg-emerald-50 p-3 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              <ul className="space-y-1 pl-1 text-xs">
                {contract.deposits.map((dep, idx) => (
                  <li key={idx} className="flex justify-between border-b border-emerald-200/70 pb-1 last:border-0 last:pb-0">
                    <span className="text-slate-700">Acconto versato in data {dep.date ? safeFormatDate(dep.date) : "—"}</span>
                    <span className="font-bold text-emerald-700">€ {(parseFloat(dep.amount) || 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-xs pt-1.5 mt-1.5 border-t border-emerald-300 font-bold uppercase tracking-wide pl-1">
                <span className="text-emerald-900">Totale Versato</span>
                <span className="text-emerald-700 text-sm">€ {contract.paidTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {contract.notes && (
          <div className="border-l-4 border-slate-400 bg-slate-50 pl-3 py-2 mb-4 text-xs text-slate-700 rounded-r-md">
            <p className="font-bold mb-0.5 text-slate-800 uppercase tracking-wider text-[10px]">Note Aggiuntive / Accordi Specifici</p>
            <p className="whitespace-pre-line">{contract.notes}</p>
          </div>
        )}

        {/* Balance */}
        <div className="flex justify-between items-center p-3.5 px-4 bg-slate-900 text-white rounded-md shadow-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
          <span className="font-bold text-xs uppercase tracking-widest text-slate-200 ml-2">Saldo Rimanente da Versare</span>
          <span className="font-bold text-xl tracking-tight text-amber-400">€ {contract.balance.toFixed(2)}</span>
        </div>

        {/* Signatures & Conditions */}
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-16 mb-5">
            <div className="text-center">
              <div className="border-b border-slate-400 h-10 mb-1.5"></div>
              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-600">Firma Cliente per Accettazione</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-400 h-10 mb-1.5"></div>
              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-600">Per Apollo Events</p>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-2.5 text-[10px] text-slate-600 text-justify leading-snug">
            <p className="font-bold mb-1 uppercase tracking-wider text-slate-800">Condizioni Generali di Pagamento</p>
            <p className="mb-0.5"><strong>Caparra Confirmatoria:</strong> A conferma della stipula, è richiesto un versamento non rimborsabile di almeno € 100,00. In caso di recesso, la somma sarà trattenuta (art. 1385 c.c.). <strong>Acconto:</strong> Entro 3 mesi prima dell&apos;evento, è richiesto un acconto del 50% dell&apos;importo totale.</p>
            <p><strong>Modalità di Saldo:</strong> Versamento anticipato dell&apos;intera somma residua entro 5 giorni dalla data dell&apos;evento. In caso di saldo il giorno stesso dell&apos;evento, è richiesto un ulteriore anticipo del 50% della rimanenza entro 5 giorni prima, corrispondendo la parte finale il giorno dell&apos;evento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
