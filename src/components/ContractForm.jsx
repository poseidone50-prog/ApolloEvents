import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Save, Mail, Plus, Trash2, FolderOpen, FileDown } from "lucide-react";
import CustomerPicker from "./CustomerPicker";
import ContractEmailModal from "./ContractEmailModal";
import { generateContractColorPdf, buildContractEmailContent } from "../utils/contractPdf";
import { toast } from "sonner";
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

export default function ContractForm() {
  const [existingContracts, setExistingContracts] = useState([]);
  const [loadedId, setLoadedId] = useState("new");

  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState({ name: "", address: "", phone: "", email: "" });
  const [eventLocation, setEventLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");

  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [deposits, setDeposits] = useState([]);
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState(0);

  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailModalData, setEmailModalData] = useState(null);

  const loadAllContracts = async () => {
    const list = await base44.entities.Contract.list("-created_date", 500);
    setExistingContracts((list || []).filter(c => c && c.id));
  };

  useEffect(() => { loadAllContracts(); }, []);

  const handleSelectContract = (cid) => {
    setLoadedId(cid);
    if (cid === "new") {
      setContractNumber("");
      setContractDate(new Date().toISOString().slice(0, 10));
      setCustomer({ name: "", address: "", phone: "", email: "" });
      setEventLocation("");
      setEventDate("");
      setEventTime("");
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      setDiscount(0);
      setDeposits([]);
      setNotes("");
      setTotal(0);
      return;
    }
    const c = existingContracts.find(x => x.id === cid);
    if (c) {
      setContractNumber(c.contract_number || "");
      setContractDate(c.contract_date || new Date().toISOString().slice(0, 10));
      setCustomer({
        name: c.customer_name || "",
        address: c.customer_address || "",
        phone: c.customer_phone || "",
        email: c.customer_email || "",
      });
      setEventLocation(c.event_location || "");
      setEventDate(c.event_date || "");
      setEventTime(c.event_time || "");
      setItems(c.items && c.items.length > 0 ? c.items : [{ description: "", quantity: 1, unit_price: 0 }]);
      setDiscount(c.discount || 0);
      setNotes(c.notes || "");
      setTotal(c.total || 0);

      const deps = Array.isArray(c.deposits) ? [...c.deposits] : [];
      if (deps.length === 0 && c.deposit > 0) {
        deps.push({ date: c.contract_date || new Date().toISOString().slice(0, 10), amount: c.deposit });
      }
      setDeposits(deps);
    }
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const addItem = () => setItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const addDeposit = () => setDeposits(prev => [...prev, { date: new Date().toISOString().slice(0, 10), amount: 0 }]);
  const addBalance = () => {
    if (balance > 0) {
      setDeposits(prev => [...prev, { date: new Date().toISOString().slice(0, 10), amount: balance }]);
    }
  };
  const updateDeposit = (idx, field, value) => {
    setDeposits(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };
  const removeDeposit = (idx) => setDeposits(prev => prev.filter((_, i) => i !== idx));

  // Math
  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const computedTotal = Math.max(0, itemsTotal - (parseFloat(discount) || 0));
  const finalTotal = total || computedTotal;
  const paidTotal = deposits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const balance = Math.max(0, finalTotal - paidTotal);

  const buildCurrentContractPayload = () => ({
    contract_number: contractNumber,
    contract_date: contractDate,
    customer_name: customer.name,
    customer_address: customer.address,
    customer_phone: customer.phone,
    customer_email: customer.email,
    event_location: eventLocation,
    event_date: eventDate,
    event_time: eventTime,
    items,
    discount: parseFloat(discount) || 0,
    deposits,
    notes,
    total: finalTotal,
    deposit: paidTotal,
    status: "confermato",
  });

  const handleSave = async () => {
    if (!customer.name) {
      toast.error("Inserisci il nome cliente");
      return;
    }
    setSaving(true);
    try {
      const payload = buildCurrentContractPayload();
      if (loadedId === "new") {
        const res = await base44.entities.Contract.create(payload);
        setLoadedId(res.id);
        toast.success("Contratto creato!");
      } else {
        await base44.entities.Contract.update(loadedId, payload);
        toast.success("Contratto aggiornato!");
      }
      await loadAllContracts();
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il salvataggio del contratto");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdfOnly = async () => {
    try {
      setSending(true);
      const payload = buildCurrentContractPayload();
      const pdfRes = await generateContractColorPdf(payload);
      pdfRes.doc.save(pdfRes.fileName);
      toast.success(`PDF a colori "${pdfRes.fileName}" scaricato!`);
    } catch (err) {
      console.error(err);
      toast.error("Errore durante la generazione del PDF");
    } finally {
      setSending(false);
    }
  };

  const handleSendEmailWithPdf = async () => {
    if (!customer.name) {
      toast.error("Inserisci almeno il nome del cliente prima di generare e inviare il contratto in PDF");
      return;
    }
    setSending(true);
    try {
      const payload = buildCurrentContractPayload();
      // Salva automaticamente il contratto se non è ancora stato salvato o aggiorna le modifiche
      if (loadedId === "new") {
        const created = await base44.entities.Contract.create(payload);
        setLoadedId(created.id);
        await loadAllContracts();
      } else {
        await base44.entities.Contract.update(loadedId, payload);
        await loadAllContracts();
      }

      // 1. Trasforma il contratto in PDF a colori
      const pdfRes = await generateContractColorPdf(payload);
      const emailContent = buildContractEmailContent(payload, pdfRes.fileName);

      // 2. Scarica sempre il PDF a colori sul dispositivo
      pdfRes.doc.save(pdfRes.fileName);

      // 3. Se su smartphone/tablet con supporto Web Share per file PDF, proponi anche la condivisione diretta con allegato
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
      const canShareFile = typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [pdfRes.pdfFile] });

      if (isMobile && canShareFile) {
        try {
          await navigator.share({
            files: [pdfRes.pdfFile],
            title: emailContent.subject,
            text: emailContent.body,
          });
          toast.success("Contratto in PDF a colori pronto per l'invio!");
          setSending(false);
          return;
        } catch (shareErr) {
          // Se l'utente chiude il pannello nativo, mostra comunque la finestra modale di invio email
        }
      }

      setEmailModalData({ pdfResult: pdfRes, emailContent });
      toast.success("Contratto trasformato in PDF a colori!");
    } catch (err) {
      console.error(err);
      toast.error("Errore durante la creazione del PDF del contratto");
    } finally {
      setSending(false);
    }
  };

  // ======================
  // PRINT VIEW (FULL COLOR)
  // ======================
  if (preview) {
    return (
      <div className="space-y-4">
        {/* Top Action Bar (screen only) */}
        <div className="flex gap-2 print:hidden flex-wrap bg-card border border-border rounded-xl p-3 shadow-sm max-w-[21cm] mx-auto">
          <Button variant="outline" onClick={() => setPreview(false)} className="rounded-xl font-semibold">
            ← Modifica
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold">
            <Save className="w-4 h-4 mr-1.5" />{saving ? "..." : "Salva"}
          </Button>
          <Button onClick={() => window.print()} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Printer className="w-4 h-4 mr-1.5" /> Stampa
          </Button>
          <Button onClick={handleDownloadPdfOnly} disabled={sending} variant="outline" className="rounded-xl border-red-300 text-red-700 hover:bg-red-50 font-semibold">
            <FileDown className="w-4 h-4 mr-1.5" /> Scarica PDF a Colori
          </Button>
          <Button onClick={handleSendEmailWithPdf} disabled={sending} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
            <Mail className="w-4 h-4 mr-1.5" />{sending ? "Generazione PDF..." : "Trasforma in PDF a Colori e Invia Email"}
          </Button>
        </div>

        <div
          className="bg-white p-7 print:p-0 text-sm leading-relaxed text-slate-800 max-w-[21cm] mx-auto shadow-2xl rounded-sm print:shadow-none flex flex-col relative overflow-hidden"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', Times, serif",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        >
          <style>{"@media print { @page { margin: 0.8cm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }"}</style>

          {/* Top Color Bar */}
          <div className="flex h-2 -mx-7 -mt-7 mb-4 print:mx-0 print:mt-0">
            <div className="w-1/3 bg-[#b91c1c]" />
            <div className="w-2/3 bg-slate-900" />
          </div>

          {/* Header */}
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
                <p><span className="font-semibold text-slate-500 inline-block w-24">Contratto N°:</span> <span className="font-bold text-slate-900 text-sm">{contractNumber || "—"}</span></p>
                <p className="mt-0.5"><span className="font-semibold text-slate-500 inline-block w-24">Data Stipula:</span> <span className="font-bold text-slate-900">{contractDate ? safeFormatDate(contractDate) : "—"}</span></p>
              </div>
            </div>
          </div>

          {/* Customer & Event Details */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900"></div>
              <h3 className="font-bold text-[9px] uppercase tracking-widest text-blue-900 mb-1 pl-1">Dati Committente</h3>
              <p className="font-black text-base text-slate-900 leading-tight pl-1">{customer.name}</p>
              {customer.address && <p className="mt-0.5 text-slate-600 pl-1">{customer.address}</p>}
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 pl-1">
                {customer.phone && <p><span className="font-semibold text-slate-500">Tel:</span> {customer.phone}</p>}
                {customer.email && <p><span className="font-semibold text-slate-500">Email:</span> {customer.email}</p>}
              </div>
            </div>
            <div className="bg-amber-50/70 p-2.5 rounded-md border border-amber-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ec0e0e]"></div>
              <h3 className="font-bold text-[9px] uppercase tracking-widest text-[#ec0e0e] mb-1 pl-1">Dettagli Evento</h3>
              <div className="space-y-1 text-[11px] text-slate-700 pl-1">
                {eventLocation && <p className="flex justify-between border-b border-amber-200/80 pb-0.5"><span className="font-semibold text-slate-500">Luogo:</span> <span className="font-bold text-right">{eventLocation}</span></p>}
                {eventDate && <p className="flex justify-between border-b border-amber-200/80 pb-0.5"><span className="font-semibold text-slate-500">Data Evento:</span> <span className="font-bold">{safeFormatDate(eventDate)}</span></p>}
                {eventTime && <p className="flex justify-between border-b border-amber-200/80 pb-0.5"><span className="font-semibold text-slate-500">Orario:</span> <span className="font-bold">{eventTime}</span></p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-3 rounded-md overflow-hidden border border-slate-300 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                  <th className="py-1.5 px-3 font-semibold">Descrizione Servizio / Articolo</th>
                  <th className="py-1.5 px-3 font-semibold text-center w-16">Q.tà</th>
                  <th className="py-1.5 px-3 font-semibold text-right w-24">Prezzo Unit.</th>
                  <th className="py-1.5 px-3 font-semibold text-right w-28">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.filter(i => i.description).map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                    <td className="py-1.5 px-3 text-[11px] font-medium text-slate-800">{item.description}</td>
                    <td className="py-1.5 px-3 text-[11px] text-center text-slate-600">{item.quantity}</td>
                    <td className="py-1.5 px-3 text-[11px] text-right text-slate-600">€ {(parseFloat(item.unit_price) || 0).toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-[11px] text-right font-bold text-slate-900">€ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subtotals & Discount */}
          <div className="flex flex-col items-end space-y-1 mb-3">
            {discount > 0 && (
              <>
                <div className="flex justify-between w-64 text-[11px] px-2"><span className="text-slate-500">Totale Servizi:</span><span className="font-semibold">€ {itemsTotal.toFixed(2)}</span></div>
                <div className="flex justify-between w-64 text-[11px] text-rose-600 px-2"><span className="font-semibold">Sconto Applicato:</span><span className="font-bold">- € {parseFloat(discount).toFixed(2)}</span></div>
              </>
            )}
            <div className="flex justify-between w-72 text-base bg-blue-50 border border-blue-500 rounded-md px-3 py-1.5 mt-1">
              <span className="font-black uppercase text-blue-900">Totale Pattuito</span>
              <span className="font-black text-blue-900">€ {finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Deposits History */}
          {deposits.length > 0 && (
            <div className="mb-3 break-inside-avoid">
              <h3 className="font-bold text-[9px] uppercase tracking-widest text-emerald-700 mb-1">Riepilogo Acconti Ricevuti</h3>
              <div className="border border-emerald-300 rounded-md bg-emerald-50 p-2.5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                <ul className="space-y-0.5 pl-1">
                  {deposits.map((dep, idx) => (
                    <li key={idx} className="flex justify-between text-[11px] border-b border-emerald-200/70 pb-0.5 last:border-0 last:pb-0">
                      <span className="text-slate-700">Acconto versato in data {dep.date ? safeFormatDate(dep.date) : "—"}</span>
                      <span className="font-bold text-emerald-700">€ {(parseFloat(dep.amount) || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-[11px] pt-1 mt-1 border-t border-emerald-300 font-bold uppercase tracking-wide pl-1">
                  <span className="text-emerald-900">Totale Versato</span>
                  <span className="text-emerald-700 text-sm">€ {paidTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {notes && (
            <div className="border-l-4 border-slate-400 bg-slate-50 pl-3 py-1.5 mb-3 text-[11px] text-slate-600 break-inside-avoid rounded-r-md">
              <p className="font-bold mb-0.5 text-slate-800 uppercase tracking-wider text-[9px]">Note Aggiuntive / Accordi Specifici</p>
              <p className="whitespace-pre-line leading-relaxed">{notes}</p>
            </div>
          )}

          {/* Balance */}
          <div className="flex justify-between items-center p-3 px-4 bg-slate-900 text-white rounded-md shadow-lg mb-4 relative overflow-hidden break-inside-avoid">
            <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
            <span className="font-bold text-xs uppercase tracking-widest text-slate-200 ml-2">Saldo Rimanente da Versare</span>
            <span className="font-black text-xl tracking-tight text-amber-400">€ {balance.toFixed(2)}</span>
          </div>

          {/* Signatures & Conditions */}
          <div className="mt-8 break-inside-avoid">
            <div className="grid grid-cols-2 gap-16 mb-4">
              <div className="text-center">
                <div className="border-b border-slate-400 h-10 mb-1.5"></div>
                <p className="font-bold text-[9px] uppercase tracking-widest text-slate-500">Firma Cliente per Accettazione</p>
              </div>
              <div className="text-center">
                <div className="border-b border-slate-400 h-10 mb-1.5"></div>
                <p className="font-bold text-[9px] uppercase tracking-widest text-slate-500">Per Apollo Events</p>
              </div>
            </div>

            <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 text-justify leading-tight">
              <p className="font-bold mb-1 uppercase tracking-widest text-slate-700">Condizioni Generali di Pagamento</p>
              <p className="mb-0.5"><strong>Caparra Confirmatoria:</strong> A conferma della stipula, è richiesto un versamento non rimborsabile di almeno € 100,00. In caso di recesso, la somma sarà trattenuta (art. 1385 c.c.). <strong>Acconto:</strong> Entro 3 mesi prima dell'evento, è richiesto un acconto del 50% dell'importo totale.</p>
              <p><strong>Modalità di Saldo:</strong> Versamento anticipato dell'intera somma residua entro 5 giorni dalla data dell'evento. In caso di saldo il giorno stesso dell'evento, è richiesto un ulteriore anticipo del 50% della rimanenza entro 5 giorni prima, corrispondendo la parte finale il giorno dell'evento.</p>
            </div>
          </div>

          {/* Bottom Actions (screen only) */}
          <div className="flex gap-2.5 mt-8 print:hidden flex-wrap justify-center border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setPreview(false)} className="rounded-full px-5 shadow-sm border-slate-300 text-slate-700">
              ← Torna alla Modifica
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-full px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md">
              <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva Definitivo"}
            </Button>
            <Button onClick={() => window.print()} className="rounded-full px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md">
              <Printer className="w-4 h-4 mr-2" /> Stampa Foglio
            </Button>
            <Button onClick={handleDownloadPdfOnly} disabled={sending} variant="outline" className="rounded-full px-5 border-red-300 text-red-700 hover:bg-red-50 font-semibold shadow-sm">
              <FileDown className="w-4 h-4 mr-2" /> Scarica PDF a Colori
            </Button>
            <Button onClick={handleSendEmailWithPdf} disabled={sending} className="rounded-full px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md">
              <Mail className="w-4 h-4 mr-2" />{sending ? "Generazione PDF..." : "Invia Copia PDF a Colori al Cliente"}
            </Button>
          </div>
        </div>

        {emailModalData && (
          <ContractEmailModal
            pdfResult={emailModalData.pdfResult}
            emailContent={emailModalData.emailContent}
            onClose={() => setEmailModalData(null)}
          />
        )}
      </div>
    );
  }

  // ======================
  // EDITOR VIEW
  // ======================
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between px-2 mb-2 pt-2 flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Gestione Contratti</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Crea, modifica, stampa e invia al cliente il contratto in formato PDF a colori.
          </p>
        </div>
      </div>

      {/* Selector Menu */}
      <div className="bg-secondary/10 rounded-2xl border border-secondary/20 p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="font-bold text-secondary text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Gestione Pratica Contratto
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              <Save className="w-4 h-4 mr-1" /> {saving ? "..." : "Salva"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPdfOnly} disabled={sending} className="rounded-xl font-bold">
              <FileDown className="w-4 h-4 mr-1" /> PDF a Colori
            </Button>
            <Button size="sm" onClick={handleSendEmailWithPdf} disabled={sending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              <Mail className="w-4 h-4 mr-1" /> {sending ? "..." : "Invia PDF via Email"}
            </Button>
          </div>
        </div>
        <Select value={loadedId} onValueChange={handleSelectContract}>
          <SelectTrigger className="w-full bg-background font-medium">
            <SelectValue placeholder="Seleziona pratica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" className="font-bold text-primary">➕ Crea Nuovo Contratto</SelectItem>
            {existingContracts.map(c => (
              <SelectItem key={c.id} value={c.id}>
                N° {c.contract_number || "—"} - {c.customer_name} (Del {c.contract_date ? safeFormatDate(c.contract_date) : ""})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Intestazione Contratto</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>N° Contratto</Label><Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="001/2026" className="rounded-xl" /></div>
          <div><Label>Data</Label><Input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} className="rounded-xl" /></div>
        </div>
      </div>

      {/* Customer */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Cliente</h2>
        <CustomerPicker customer={customer} onChange={setCustomer} />
      </div>

      {/* Event */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Dettagli Evento</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Luogo del Servizio</Label><Input value={eventLocation} onChange={e => setEventLocation(e.target.value)} placeholder="Via, Città..." className="rounded-xl" /></div>
          <div><Label>Data Evento</Label><Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="rounded-xl" /></div>
          <div><Label>Ora Evento</Label><Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="rounded-xl" /></div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Servizi / Prodotti Inclusi</h2>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={addItem}><Plus className="w-4 h-4 mr-1" />Aggiungi Riga</Button>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-xl p-3">
            <div className="col-span-6">
              <Label className="text-xs">Descrizione</Label>
              <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Es. Spettacolo Pirotecnico Base..." className="rounded-lg h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Q.tà</Label>
              <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="rounded-lg h-9" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Prezzo €</Label>
              <Input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} className="rounded-lg h-9" />
            </div>
            <div className="col-span-1 flex justify-center">
              <button type="button" onClick={() => removeItem(idx)} className="p-1.5 hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </div>
        ))}

        {/* Discount Line */}
        <div className="flex justify-end pt-3 border-t border-dashed mt-4">
          <div className="w-1/2 md:w-1/3 text-right">
            <Label className="text-sm font-semibold mb-1 block text-muted-foreground">Sconto Applicato (€)</Label>
            <Input type="number" step="0.5" value={discount === 0 ? "" : discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" className="rounded-xl text-right font-mono" />
          </div>
        </div>

        <div className="text-right font-black text-lg pt-3">Totale Calcolato: €{computedTotal.toFixed(2)}</div>
      </div>

      {/* Deposits Box */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm text-emerald-600 uppercase tracking-wider">Acconti e Pagamenti Ricevuti</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={addBalance} disabled={balance <= 0}>
              <Plus className="w-4 h-4 mr-1" /> Registra Saldo
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={addDeposit}>
              <Plus className="w-4 h-4 mr-1" /> Registra Acconto
            </Button>
          </div>
        </div>

        {deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl">Ancora nessun acconto registrato.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map((dep, idx) => (
              <div key={idx} className="flex gap-3 items-end p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <div className="flex-1">
                  <Label className="text-xs text-emerald-700 dark:text-emerald-400">Data Ricezione</Label>
                  <Input type="date" value={dep.date} onChange={e => updateDeposit(idx, "date", e.target.value)} className="rounded-lg bg-white/50 dark:bg-black/50" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-emerald-700 dark:text-emerald-400">Importo Versato (€)</Label>
                  <Input type="number" step="0.01" value={dep.amount === 0 ? "" : dep.amount} onChange={e => updateDeposit(idx, "amount", parseFloat(e.target.value) || 0)} className="rounded-lg bg-white/50 dark:bg-black/50 font-bold" />
                </div>
                <button type="button" onClick={() => removeDeposit(idx)} className="p-3 text-emerald-600/50 hover:text-destructive hover:bg-white/50 rounded-lg mb-0.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="text-right text-emerald-600 font-bold text-sm pr-2">Totale acconti: €{paidTotal.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Totals & Notes */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Note e Chiusura</h2>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condizioni di contratto o note libere..." className="rounded-xl" />

        <div className="border-t border-border pt-4 px-2 space-y-2 text-right">
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span>Totale Contratto</span>
            <div className="w-32">
              <Input type="number" step="0.5" value={total === 0 ? computedTotal : total} onChange={e => setTotal(parseFloat(e.target.value) || 0)} className="rounded-lg text-right font-mono font-bold h-8" />
            </div>
          </div>

          <div className="flex justify-between items-end font-bold text-2xl pt-2">
            <span className="uppercase text-muted-foreground text-lg">Saldo Finale a Debito</span>
            <span className="tracking-tight text-primary">€{balance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button onClick={handleSave} disabled={saving} className="h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base shadow-xl font-bold">
          <Save className="w-5 h-5 mr-2" /> {saving ? "Salvataggio..." : "Salva Contratto"}
        </Button>
        <Button onClick={() => { setPreview(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-base shadow-xl font-bold">
          <Printer className="w-5 h-5 mr-2" /> Visualizza &amp; Stampa
        </Button>
        <Button onClick={handleSendEmailWithPdf} disabled={sending} className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base shadow-xl font-bold">
          <Mail className="w-5 h-5 mr-2" /> {sending ? "Generazione PDF..." : "Invia in PDF a Colori"}
        </Button>
      </div>

      {emailModalData && (
        <ContractEmailModal
          pdfResult={emailModalData.pdfResult}
          emailContent={emailModalData.emailContent}
          onClose={() => setEmailModalData(null)}
        />
      )}
    </div>
  );
}
