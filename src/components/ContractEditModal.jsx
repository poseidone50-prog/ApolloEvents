import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ContractEditModal({ contract, onClose, onSave }) {
  const [form, setForm] = useState({ ...contract });
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Contract.update(contract.id, form);
    setSaving(false);
    toast.success("Contratto aggiornato!");
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg">Modifica Contratto</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>N° Contratto</Label><Input value={form.contract_number || ""} onChange={e => set("contract_number", e.target.value)} className="rounded-xl" /></div>
            <div><Label>Data Contratto</Label><Input type="date" value={form.contract_date || ""} onChange={e => set("contract_date", e.target.value)} className="rounded-xl" /></div>
          </div>
          <div><Label>Nome Cliente *</Label><Input value={form.customer_name || ""} onChange={e => set("customer_name", e.target.value)} className="rounded-xl" /></div>
          <div><Label>Indirizzo</Label><Input value={form.customer_address || ""} onChange={e => set("customer_address", e.target.value)} className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefono</Label><Input value={form.customer_phone || ""} onChange={e => set("customer_phone", e.target.value)} className="rounded-xl" /></div>
            <div><Label>Email</Label><Input type="email" value={form.customer_email || ""} onChange={e => set("customer_email", e.target.value)} className="rounded-xl" /></div>
          </div>
          <div><Label>Luogo Servizio</Label><Input value={form.event_location || ""} onChange={e => set("event_location", e.target.value)} className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data Evento</Label><Input type="date" value={form.event_date || ""} onChange={e => set("event_date", e.target.value)} className="rounded-xl" /></div>
            <div><Label>Ora Evento</Label><Input type="time" value={form.event_time || ""} onChange={e => set("event_time", e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Totale Lordo (€)</Label>
              <Input type="number" step="0.01" value={form.total || 0} onChange={e => set("total", parseFloat(e.target.value) || 0)} className="rounded-xl font-bold" />
            </div>
            <div>
              <Label>Sconto (€)</Label>
              <Input type="number" step="0.01" value={form.discount || 0} onChange={e => set("discount", parseFloat(e.target.value) || 0)} className="rounded-xl text-destructive font-bold" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
              <Label className="text-emerald-700 font-extrabold uppercase text-[11px] tracking-widest pl-1">Cronologia Pagamenti</Label>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => {
                  const currentBalance = Math.max(0, ((form.total || 0) - (form.discount || 0)) - (Array.isArray(form.deposits) ? form.deposits.reduce((acc, d) => acc + (d.amount || 0), 0) : 0));
                  if (currentBalance > 0) {
                    const deps = Array.isArray(form.deposits) ? [...form.deposits] : [];
                    deps.push({ date: new Date().toISOString().slice(0, 10), amount: currentBalance });
                    set("deposits", deps);
                  }
                }} className="h-7 text-[10px] px-2.5 bg-emerald-100/50 hover:bg-emerald-200/50 text-emerald-700 border border-emerald-200 rounded-md font-bold transition-colors">
                  + REGISTRA SALDO
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  const deps = Array.isArray(form.deposits) ? [...form.deposits] : [];
                  deps.push({ date: new Date().toISOString().slice(0, 10), amount: 0 });
                  set("deposits", deps);
                }} className="h-7 text-[10px] px-2.5 bg-white shadow-sm hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold transition-colors">
                  + ACCONTO
                </Button>
              </div>
            </div>
            
            {Array.isArray(form.deposits) && form.deposits.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {form.deposits.map((d, i) => (
                  <div key={i} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border/50">
                    <Input type="date" value={d.date} onChange={e => {
                      const copy = [...form.deposits];
                      copy[i].date = e.target.value;
                      set("deposits", copy);
                    }} className="h-8 text-xs rounded-md w-32" />
                    <Input type="number" value={d.amount} onChange={e => {
                      const copy = [...form.deposits];
                      copy[i].amount = parseFloat(e.target.value) || 0;
                      set("deposits", copy);
                    }} className="h-8 text-xs rounded-md flex-1 text-right font-bold text-emerald-600" />
                    <button onClick={() => {
                      const copy = form.deposits.filter((_, idx) => idx !== i);
                      set("deposits", copy);
                    }} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center py-2 italic">Nessun acconto registrato</p>
            )}
          </div>

          <div><Label>Stato</Label>
            <Select value={form.status || "bozza"} onValueChange={v => set("status", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bozza">Bozza</SelectItem>
                <SelectItem value="confermato">Confermato</SelectItem>
                <SelectItem value="completato">Completato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2} className="rounded-xl text-sm" /></div>
          
          <div className="bg-muted/50 p-3 rounded-xl border border-border space-y-1">
             <div className="flex justify-between text-xs text-muted-foreground">
               <span>Totale Netto</span>
               <span>€{((form.total || 0) - (form.discount || 0)).toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-xs text-emerald-600 font-medium">
               <span>Pagato</span>
               <span>€{(Array.isArray(form.deposits) ? form.deposits.reduce((acc, d) => acc + (d.amount || 0), 0) : 0).toFixed(2)}</span>
             </div>
             <div className="flex justify-between font-bold text-sm pt-1 border-t border-border/50">
               <span>Saldo Rimanente</span>
               <span className="text-primary font-black">€{Math.max(0, ((form.total || 0) - (form.discount || 0)) - (Array.isArray(form.deposits) ? form.deposits.reduce((acc, d) => acc + (d.amount || 0), 0) : 0)).toFixed(2)}</span>
             </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            {saving ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </div>
      </div>
    </div>
  );
}