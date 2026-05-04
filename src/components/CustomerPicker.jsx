import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, X, Check } from "lucide-react";
import { toast } from "sonner";

// customer = { name, address, city, phone, email, vat, fiscal }
// onChange(customer) called when customer fields change
export default function CustomerPicker({ customer, onChange }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", city: "", phone: "", email: "", vat: "", fiscal: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Customer.list("-updated_date", 200).then(setCustomers);
  }, []);

  const filtered = search
    ? customers.filter(c =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.city || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").toLowerCase().includes(search.toLowerCase())
      )
    : customers.slice(0, 10);

  const selectCustomer = (c) => {
    onChange({ name: c.name || "", address: c.address || "", city: c.city || "", phone: c.phone || "", email: c.email || "", vat: c.vat || "", fiscal: c.fiscal || "" });
    setSearch("");
    setShowDropdown(false);
  };

  const handleSaveNew = async () => {
    if (!newCustomer.name) { toast.error("Inserisci il nome"); return; }
    setSaving(true);
    const saved = await base44.entities.Customer.create(newCustomer);
    const updated = await base44.entities.Customer.list("-updated_date", 200);
    setCustomers(updated);
    selectCustomer(newCustomer);
    setNewCustomer({ name: "", address: "", city: "", phone: "", email: "", vat: "", fiscal: "" });
    setShowNewForm(false);
    setSaving(false);
    toast.success("Cliente salvato!");
  };

  return (
    <div className="space-y-3">
      {/* Search existing */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Cerca cliente salvato..."
            className="pl-9 rounded-xl"
          />
        </div>
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => setShowNewForm(!showNewForm)}>
          <UserPlus className="w-4 h-4 mr-1" /> Nuovo
        </Button>
      </div>

      {/* Dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div className="border border-border rounded-xl max-h-40 overflow-y-auto bg-card shadow-md">
          {filtered.map(c => (
            <button key={c.id} onClick={() => selectCustomer(c)}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.city || c.phone || ""}</span>
            </button>
          ))}
          <button onClick={() => setShowDropdown(false)} className="w-full text-center py-1 text-xs text-muted-foreground hover:bg-muted">
            Chiudi
          </button>
        </div>
      )}

      {/* New customer form */}
      {showNewForm && (
        <div className="border border-border rounded-xl p-3 bg-muted/30 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Nuovo Cliente</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label className="text-xs">Nome *</Label><Input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs">Indirizzo</Label><Input value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div><Label className="text-xs">Città</Label><Input value={newCustomer.city} onChange={e => setNewCustomer(p => ({ ...p, city: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div><Label className="text-xs">Telefono</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div><Label className="text-xs">P.IVA</Label><Input value={newCustomer.vat} onChange={e => setNewCustomer(p => ({ ...p, vat: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
            <div><Label className="text-xs">Cod. Fiscale</Label><Input value={newCustomer.fiscal} onChange={e => setNewCustomer(p => ({ ...p, fiscal: e.target.value }))} className="rounded-lg h-8 text-sm" /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSaveNew} disabled={saving} className="flex-1 rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              <Check className="w-3 h-3 mr-1" />{saving ? "..." : "Salva Cliente"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewForm(false)} className="rounded-lg"><X className="w-3 h-3" /></Button>
          </div>
        </div>
      )}

      {/* Customer fields (editable) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nome / Ragione Sociale *</Label>
          <Input value={customer.name} onChange={e => onChange({ ...customer, name: e.target.value })} className="rounded-xl" />
        </div>
        <div className="col-span-2">
          <Label>Indirizzo</Label>
          <Input value={customer.address || ""} onChange={e => onChange({ ...customer, address: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label>Telefono</Label>
          <Input value={customer.phone || ""} onChange={e => onChange({ ...customer, phone: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={customer.email || ""} onChange={e => onChange({ ...customer, email: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label>P.IVA</Label>
          <Input value={customer.vat || ""} onChange={e => onChange({ ...customer, vat: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label>Codice Fiscale</Label>
          <Input value={customer.fiscal || ""} onChange={e => onChange({ ...customer, fiscal: e.target.value })} className="rounded-xl" />
        </div>
      </div>
    </div>
  );
}