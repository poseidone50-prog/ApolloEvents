import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

export default function SupplierForm({ supplier, onSave, onClose }) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    vat_number: "",
    fiscal_code: "",
    address: "",
    city: "",
    province: "",
    zip_code: "",
    phone: "",
    email: "",
    notes: "",
    ...supplier,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (supplier?.id) {
      await base44.entities.Supplier.update(supplier.id, form);
    } else {
      await base44.entities.Supplier.create(form);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg">{supplier?.id ? "Modifica Fornitore" : "Nuovo Fornitore"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => handleChange("name", e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Label>Ragione Sociale</Label>
              <Input value={form.company} onChange={e => handleChange("company", e.target.value)} />
            </div>
            <div>
              <Label>Partita IVA</Label>
              <Input value={form.vat_number} onChange={e => handleChange("vat_number", e.target.value)} />
            </div>
            <div>
              <Label>Codice Fiscale</Label>
              <Input value={form.fiscal_code} onChange={e => handleChange("fiscal_code", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Indirizzo</Label>
              <Input value={form.address} onChange={e => handleChange("address", e.target.value)} />
            </div>
            <div>
              <Label>Città</Label>
              <Input value={form.city} onChange={e => handleChange("city", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prov.</Label>
                <Input value={form.province} onChange={e => handleChange("province", e.target.value)} />
              </div>
              <div>
                <Label>CAP</Label>
                <Input value={form.zip_code} onChange={e => handleChange("zip_code", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Telefono</Label>
              <Input value={form.phone} onChange={e => handleChange("phone", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Note</Label>
              <Textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            {saving ? "Salvataggio..." : (supplier?.id ? "Aggiorna" : "Crea Fornitore")}
          </Button>
        </form>
      </div>
    </div>
  );
}