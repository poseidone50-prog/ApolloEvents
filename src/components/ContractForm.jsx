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
      <div className="bg-white rounded-2xl border border-border shadow-lg p-6 print:shadow-none print:border-none print:p-0 print:m-0 text-sm">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Apollo Events" className="h-20 w-20 object-contain drop-shadow-md" />
            <div>
              <p className="font-extrabold text-xl">Apollo Events</p>
              <p className="text-xs text-muted-foreground">Fireworks · Eventi · Spettacoli</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-lg">CONTRATTO</p>
            <p className="text-muted-foreground">N° {contractNumber || "—"}</p>
            <p className="text-muted-foreground">{contractDate ? format(new Date(contractDate), "dd/MM/yyyy", { locale: it }) : "—"}</p>
          </div>
        </div>

        {/* Customer & Event */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border rounded-xl p-3">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Cliente</p>
            <p className="font-bold text-base">{customer.name}</p>
            {customer.address && <p>{customer.address}</p>}
            {customer.phone && <p>Tel: {customer.phone}</p>}
            {customer.email && <p>Email: {customer.email}</p>}
          </div>
          <div className="border rounded-xl p-3">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Evento</p>
            {eventLocation && <p><span className="font-semibold">Luogo:</span> {eventLocation}</p>}
            {eventDate && <p><span className="font-semibold">Data:</span> {format(new Date(eventDate), "dd/MM/yyyy", { locale: it })}</p>}
            {eventTime && <p><span className="font-semibold">Ora:</span> {eventTime}</p>}
          </div>
        </div>

        {/* Items */}
        <table className="w-full mb-4">
          <thead>
            <tr className="border-b-2">
              <th className="text-left py-2">Descrizione Servizio/Articolo</th>
              <th className="text-right py-2">Q.tà</th>
              <th className="text-right py-2">Prz. Unitario</th>
              <th className="text-right py-2">Prezzo Totale</th>
            </tr>
          </thead>
          <tbody>
            {items.filter(i => i.description).map((item, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">€{parseFloat(item.unit_price).toFixed(2)}</td>
                <td className="py-2 text-right font-semibold">€{(item.quantity * item.unit_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Subtotals & Discount */}
        <div className="text-right space-y-1 mb-6 border-b pb-4 text-sm">
          {discount > 0 && (
             <>
               <div className="flex justify-end gap-8"><span className="text-muted-foreground">Totale Servizi</span><span>€{itemsTotal.toFixed(2)}</span></div>
               <div className="flex justify-end gap-8"><span className="text-muted-foreground font-semibold">Sconto</span><span className="font-semibold">- €{parseFloat(discount).toFixed(2)}</span></div>
             </>
          )}
          <div className="flex justify-end gap-8 text-base">
             <span className="font-bold">Totale Contratto</span>
             <span className="font-extrabold text-lg">€{finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Deposits History */}
        {(deposits.length > 0) && (
          <div className="mb-6">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Cronologia Pagamenti / Acconti</p>
            <div className="border rounded-xl p-3 bg-muted/20">
              {deposits.map((dep, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span>Acconto del {dep.date ? format(new Date(dep.date), "dd/MM/yyyy", { locale: it }) : "—"}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">€{parseFloat(dep.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 mt-1 border-t font-semibold">
                <span>Totale Versato</span>
                <span className="text-emerald-600 dark:text-emerald-400">€{paidTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className="flex justify-end gap-8 text-lg font-black mt-4 p-3 bg-muted/40 rounded-xl">
           <span>SALDO DA VERSARE</span>
           <span>€{balance.toFixed(2)}</span>
        </div>

        {notes && <div className="border rounded-xl p-3 mb-6 mt-6 text-xs text-muted-foreground"><p className="font-semibold mb-1">Note / Condizioni:</p><p className="whitespace-pre-line">{notes}</p></div>}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-[5cm]">
          <div className="border-t-2 border-gray-400 pt-3 text-center text-xs text-muted-foreground">Firma Cliente per Accettazione<br /><br /><br /></div>
          <div className="border-t-2 border-gray-400 pt-3 text-center text-xs text-muted-foreground">Apollo Events<br /><br /><br /></div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 print:hidden flex-wrap">
          <Button variant="outline" onClick={() => setPreview(false)} className="flex-1 rounded-xl">← Modifica</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-[2] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4 mr-1" />{saving ? "Salvataggio..." : "Salva Definitivo"}
          </Button>
          <Button onClick={() => window.print()} className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            <Printer className="w-4 h-4 mr-1" /> Stampa Foglio
          </Button>
          <Button onClick={handleSendEmail} disabled={sending} variant="outline" className="flex-1 rounded-xl border-dashed">
            <Mail className="w-4 h-4 mr-1" />{sending ? "..." : "Invia Copia"}
          </Button>
        </div>
      </div>
    );
  }

  // ======================
  // EDITOR VIEW
  // ======================
  return (
    <div className="space-y-4">
      {/* Selector Menu */}
      <div className="bg-secondary/10 rounded-xl border border-secondary/20 p-4 space-y-3">
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