import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Save, Mail, Plus, Trash2, FolderOpen } from "lucide-react";
import CustomerPicker from "./CustomerPicker";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

const LOGO = "/logo.png";

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
  const [deposits, setDeposits] = useState([]); // array di { date, amount }
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState(0); // If custom total is typed, else computed
  
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const loadAllContracts = async () => {
    const list = await base44.entities.Contract.list("-created_date", 500);
    setExistingContracts(list);
  };

  useEffect(() => { loadAllContracts(); }, []);

  const handleSelectContract = (cid) => {
    setLoadedId(cid);
    if (cid === "new") {
      setContractNumber(""); setContractDate(new Date().toISOString().slice(0, 10));
      setCustomer({ name: "", address: "", phone: "", email: "" });
      setEventLocation(""); setEventDate(""); setEventTime("");
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      setDiscount(0); setDeposits([]); setNotes(""); setTotal(0);
      return;
    }
    const c = existingContracts.find(x => x.id === cid);
    if (c) {
      setContractNumber(c.contract_number || "");
      setContractDate(c.contract_date || new Date().toISOString().slice(0, 10));
      setCustomer({ name: c.customer_name || "", address: c.customer_address || "", phone: c.customer_phone || "", email: c.customer_email || "" });
      setEventLocation(c.event_location || ""); setEventDate(c.event_date || ""); setEventTime(c.event_time || "");
      setItems(c.items && c.items.length > 0 ? c.items : [{ description: "", quantity: 1, unit_price: 0 }]);
      setDiscount(c.discount || 0); setNotes(c.notes || "");
      
      let initialTotal = c.total || 0;
      // Se il totale calcolato - sconto è uguale a initialTotal, possiamo svuotare il campo forzato
      setTotal(initialTotal);
      
      let deps = Array.isArray(c.deposits) ? [...c.deposits] : [];
      if (deps.length === 0 && (c.deposit > 0)) {
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

  const handleSave = async () => {
    if (!customer.name) { toast.error("Inserisci il nome cliente"); return; }
    setSaving(true);
    
    const payload = {
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
      deposit: paidTotal, // legacy fallback for backward compatibility in history 
      status: "confermato",
    };

    if (loadedId === "new") {
      const res = await base44.entities.Contract.create(payload);
      setLoadedId(res.id); // switch to edit mode seamlessly
      toast.success("Contratto creato!");
    } else {
      await base44.entities.Contract.update(loadedId, payload);
      toast.success("Contratto aggiornato!");
    }
    
    await loadAllContracts();
    setSaving(false);
  };

  const handleSendEmail = async () => {
    if (!customer.email) { toast.error("Inserisci email cliente"); return; }
    setSending(true);
    const itemsText = items.map(i => `- ${i.description}: ${i.quantity} x €${parseFloat(i.unit_price).toFixed(2)} = €${(i.quantity * i.unit_price).toFixed(2)}`).join("\n");
    await base44.integrations.Core.SendEmail({
      to: customer.email,
      subject: `Contratto N° ${contractNumber || "—"} – Apollo Events`,
      body: `Gentile ${customer.name},\n\nAllego il riepilogo del contratto aggiornato.\n\nServizio: ${eventLocation}\nData: ${eventDate} ore ${eventTime}\n\nServizi:\n${itemsText}\n\nTotale: €${finalTotal.toFixed(2)}\nAcconti versati: €${paidTotal.toFixed(2)}\nSaldo da saldare: €${balance.toFixed(2)}\n\nNote: ${notes}\n\nCordiali saluti,\nApollo Events`,
    });
    setSending(false);
    toast.success("Email inviata!");
  };

  // ======================
  // PRINT VIEW
  // ======================
  if (preview) {
    return (
      <div className="bg-white p-6 print:p-0 print:pt-16 print:pb-12 text-xs leading-snug text-slate-800 max-w-[21cm] mx-auto shadow-2xl rounded-sm print:shadow-none font-sans flex flex-col print:min-h-[29.7cm]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-4">
            <img src={LOGO} alt="Apollo Events" className="h-16 w-16 object-contain drop-shadow-sm" />
            <div className="tracking-tight">
              <h1 className="font-black text-2xl text-slate-900 uppercase">Apollo Events</h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Spettacoli &amp; Eventi</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="font-black text-xl text-slate-900 tracking-wider mb-1">CONTRATTO</h2>
            <div className="text-xs text-slate-600 bg-slate-50 p-1.5 px-2 rounded border border-slate-200 inline-block text-left">
              <p><span className="font-semibold text-slate-400 uppercase text-[10px] w-12 inline-block">Rif. N°:</span> <span className="font-bold text-slate-800">{contractNumber || "—"}</span></p>
              <p><span className="font-semibold text-slate-400 uppercase text-[10px] w-12 inline-block">Data:</span> <span className="font-bold text-slate-800">{contractDate ? format(new Date(contractDate), "dd/MM/yyyy", { locale: it }) : "—"}</span></p>
            </div>
          </div>
        </div>

        {/* Customer & Event Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 p-3 rounded-md border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
            <h3 className="font-bold text-[9px] uppercase tracking-widest text-slate-400 mb-1.5">Dati Committente</h3>
            <p className="font-black text-base text-slate-800 leading-tight">{customer.name}</p>
            {customer.address && <p className="mt-0.5 text-slate-600">{customer.address}</p>}
            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
              {customer.phone && <p><span className="font-semibold text-slate-400">Tel:</span> {customer.phone}</p>}
              {customer.email && <p><span className="font-semibold text-slate-400">Email:</span> {customer.email}</p>}
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-md border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
            <h3 className="font-bold text-[9px] uppercase tracking-widest text-slate-400 mb-1.5">Dettagli Evento</h3>
            <div className="space-y-1 text-[11px] text-slate-700">
              {eventLocation && <p className="flex justify-between border-b border-slate-200 pb-0.5"><span className="font-semibold text-slate-500">Luogo:</span> <span className="font-bold text-right">{eventLocation}</span></p>}
              {eventDate && <p className="flex justify-between border-b border-slate-200 pb-0.5"><span className="font-semibold text-slate-500">Data Evento:</span> <span className="font-bold">{format(new Date(eventDate), "dd/MM/yyyy", { locale: it })}</span></p>}
              {eventTime && <p className="flex justify-between border-b border-slate-200 pb-0.5"><span className="font-semibold text-slate-500">Orario:</span> <span className="font-bold">{eventTime}</span></p>}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-4 rounded-md overflow-hidden border border-slate-300 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider">
                <th className="py-2 px-3 font-semibold">Descrizione Servizio / Articolo</th>
                <th className="py-2 px-3 font-semibold text-center w-16">Q.tà</th>
                <th className="py-2 px-3 font-semibold text-right w-24">Prezzo Unit.</th>
                <th className="py-2 px-3 font-semibold text-right w-28">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.filter(i => i.description).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-1.5 px-3 text-[11px] font-medium text-slate-800">{item.description}</td>
                  <td className="py-1.5 px-3 text-[11px] text-center text-slate-600">{item.quantity}</td>
                  <td className="py-1.5 px-3 text-[11px] text-right text-slate-600">€ {parseFloat(item.unit_price).toFixed(2)}</td>
                  <td className="py-1.5 px-3 text-[11px] text-right font-bold text-slate-900">€ {(item.quantity * item.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Subtotals & Discount */}
        <div className="flex flex-col items-end space-y-1 mb-4 pr-3">
          {discount > 0 && (
            <>
              <div className="flex justify-between w-56 text-[11px]"><span className="text-slate-500">Totale Servizi:</span><span className="font-semibold">€ {itemsTotal.toFixed(2)}</span></div>
              <div className="flex justify-between w-56 text-[11px] text-rose-600"><span className="font-semibold">Sconto Applicato:</span><span className="font-bold">- € {parseFloat(discount).toFixed(2)}</span></div>
            </>
          )}
          <div className="flex justify-between w-64 text-base border-t-2 border-slate-900 pt-1 mt-1">
            <span className="font-black uppercase text-slate-800">Totale Pattuito</span>
            <span className="font-black text-slate-900">€ {finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Deposits History */}
        {(deposits.length > 0) && (
          <div className="mb-4">
            <h3 className="font-bold text-[9px] uppercase tracking-widest text-emerald-600 mb-1.5">Riepilogo Acconti Ricevuti</h3>
            <div className="border border-emerald-200 rounded-md bg-emerald-50/50 p-3 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
              <ul className="space-y-1">
                {deposits.map((dep, idx) => (
                  <li key={idx} className="flex justify-between text-[11px] border-b border-emerald-200/50 pb-1 last:border-0 last:pb-0">
                    <span className="text-slate-600">Acconto versato in data {dep.date ? format(new Date(dep.date), "dd/MM/yyyy", { locale: it }) : "—"}</span>
                    <span className="font-bold text-emerald-700">€ {parseFloat(dep.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-[11px] pt-1.5 mt-1.5 border-t border-emerald-300 font-bold uppercase tracking-wide">
                <span className="text-emerald-800">Totale Versato</span>
                <span className="text-emerald-700 text-sm">€ {paidTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {notes && (
          <div className="border-l-4 border-slate-300 pl-3 py-1 mb-4 text-[11px] text-slate-600">
             <p className="font-bold mb-0.5 text-slate-800 uppercase tracking-wider text-[9px]">Note Aggiuntive / Accordi Specifici</p>
             <p className="whitespace-pre-line leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Balance */}
        <div className="flex justify-between items-center p-3 px-4 bg-slate-900 text-white rounded-md shadow-lg mb-6 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
           <span className="font-bold text-xs uppercase tracking-widest text-slate-300 ml-1.5">Saldo Rimanente da Versare</span>
           <span className="font-black text-xl tracking-tight">€ {balance.toFixed(2)}</span>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-16 mt-auto mb-8 pt-6">
          <div className="text-center">
            <div className="border-b border-slate-400 h-10 mb-1.5"></div>
            <p className="font-bold text-[9px] uppercase tracking-widest text-slate-500">Firma Cliente per Accettazione</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-400 h-10 mb-1.5"></div>
            <p className="font-bold text-[9px] uppercase tracking-widest text-slate-500">Per Apollo Events</p>
          </div>
        </div>

        {/* Condizioni Generali (Pushed to bottom) */}
        <div className="border-t border-slate-300 pt-3 text-[9px] text-slate-500 mt-2">
          <p className="font-bold mb-1 uppercase tracking-widest text-slate-700">Condizioni Generali di Pagamento</p>
          <div className="grid grid-cols-1 gap-1 text-justify leading-tight">
            <p><strong>Caparra Confirmatoria:</strong> A conferma della stipula del contratto, è richiesto un versamento non rimborsabile di almeno € 100,00. In caso di recesso, la somma sarà trattenuta (art. 1385 c.c.).</p>
            <p><strong>Acconto:</strong> Entro e non oltre tre (3) mesi prima della data fissata per l'evento, è richiesto un acconto pari al 50% dell'importo totale pattuito.</p>
            <p><strong>Modalità di Saldo:</strong> Versamento anticipato dell'intera somma residua entro 5 giorni dalla data dell'evento. In caso di saldo il giorno stesso dell'evento, è richiesto un ulteriore anticipo del 50% della rimanenza entro 5 giorni prima, corrispondendo la parte finale il giorno dell'evento.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8 print:hidden flex-wrap justify-center border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={() => setPreview(false)} className="rounded-full px-6 shadow-sm border-slate-300 text-slate-700">← Torna alla Modifica</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-full px-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md">
            <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva Definitivo"}
          </Button>
          <Button onClick={() => window.print()} className="rounded-full px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md">
            <Printer className="w-4 h-4 mr-2" /> Stampa Foglio
          </Button>
          <Button onClick={handleSendEmail} disabled={sending} variant="outline" className="rounded-full px-6 border-slate-300 text-slate-700 shadow-sm">
            <Mail className="w-4 h-4 mr-2" />{sending ? "..." : "Invia Copia al Cliente"}
          </Button>
        </div>
      </div>
    );
  }

  // ======================
  // EDITOR VIEW
  // ======================
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between px-2 mb-2 pt-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Gestione Contratti</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Crea, modifica e stampa i contratti per i tuoi eventi in formato professionale.</p>
        </div>
      </div>

      {/* Selector Menu */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50/50 rounded-2xl border border-indigo-100/60 p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
        <label className="font-bold text-secondary text-sm flex items-center gap-2">
          <FolderOpen className="w-4 h-4" /> Gestione Pratica Contratto
        </label>
        <Select value={loadedId} onValueChange={handleSelectContract}>
          <SelectTrigger className="w-full bg-background font-medium">
            <SelectValue placeholder="Seleziona pratica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" className="font-bold text-primary">➕ Crea Nuovo Contratto</SelectItem>
            {existingContracts.map(c => (
               <SelectItem key={c.id} value={c.id}>
                 N° {c.contract_number} - {c.customer_name} (Del {c.contract_date ? format(new Date(c.contract_date), "dd/MM/yyyy") : ""})
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
              <button onClick={() => removeItem(idx)} className="p-1.5 hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </div>
        ))}
        
        {/* Discount Line */}
        <div className="flex justify-end pt-3 border-t border-dashed mt-4">
           <div className="w-1/2 md:w-1/3 text-right">
              <Label className="text-sm font-semibold mb-1 block text-muted-foreground">Sconto Applicato (€)</Label>
              <Input type="number" step="0.5" value={discount === 0 ? '' : discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" className="rounded-xl text-right font-mono" />
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
                     <Input type="number" step="0.01" value={dep.amount === 0 ? '' : dep.amount} onChange={e => updateDeposit(idx, "amount", parseFloat(e.target.value) || 0)} className="rounded-lg bg-white/50 dark:bg-black/50 font-bold" />
                  </div>
                  <button onClick={() => removeDeposit(idx)} className="p-3 text-emerald-600/50 hover:text-destructive hover:bg-white/50 rounded-lg mb-0.5"><Trash2 className="w-4 h-4" /></button>
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

      <Button onClick={() => setPreview(true)} className="w-full h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg shadow-xl font-bold">
        <Printer className="w-5 h-5 mr-2" /> Visualizza & Stampa
      </Button>
    </div>
  );
}