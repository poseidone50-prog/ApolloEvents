import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SupplierForm from "./SupplierForm";
import { X } from "lucide-react";

const categories = ["F2 5°C", "F2 5°D", "F2 5°E", "F3 4°"];

export default function ArticleForm({ article, onSave, onClose }) {
  const [suppliers, setSuppliers] = useState([]);
  // Modal state for creating a new supplier
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  // After creating a supplier, refresh the list and close the modal
  const handleNewSupplierSave = async () => {
    const updated = await base44.entities.Supplier.list();
    setSuppliers(updated);
    setShowSupplierForm(false);
  };

  const [form, setForm] = useState({
    barcode: "",
    description: "",
    supplier_id: "",
    supplier_name: "",
    purchase_price: 0,
    sale_price: 0,
    vat_rate: 22,
    nec_kg: 0,
    category: "F2 5°C",
    quantity: 0,
    ...article,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Supplier.list().then(setSuppliers);
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSupplierChange = (supplierId) => {
    const sup = suppliers.find(s => s.id === supplierId);
    setForm(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: sup ? sup.name : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    let finalSupplierId = form.supplier_id;
    let finalSupplierName = form.supplier_name;

    // No inline supplier creation – use the SupplierForm modal instead

    const data = {
      ...form,
      supplier_id: finalSupplierId,
      supplier_name: finalSupplierName,
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
      vat_rate: Number(form.vat_rate),
      nec_kg: Number(form.nec_kg),
      quantity: Number(form.quantity),
    };
    if (article?.id) {
      await base44.entities.Article.update(article.id, data);
    } else {
      await base44.entities.Article.create(data);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg">{article?.id ? "Modifica Articolo" : "Nuovo Articolo"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Codice a Barre</Label>
              <Input value={form.barcode} onChange={e => handleChange("barcode", e.target.value)} placeholder="Scansiona o inserisci" required />
            </div>
            <div className="col-span-2">
              <Label>Descrizione</Label>
              <Input value={form.description} onChange={e => handleChange("description", e.target.value)} placeholder="Nome articolo" required />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label>Fornitore</Label>
                <button type="button" onClick={() => setShowSupplierForm(true)} className="text-xs text-secondary font-medium hover:underline">
                  + Nuovo Fornitore
                </button>
              </div>
              <Select value={form.supplier_id} onValueChange={handleSupplierChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona fornitore" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showSupplierForm && (
                <SupplierForm
                  onSave={handleNewSupplierSave}
                  onClose={() => setShowSupplierForm(false)}
                />
              )}
            </div>
            <div>
              <Label>Prezzo Acquisto (€)</Label>
              <Input type="number" step="0.01" value={form.purchase_price} onChange={e => handleChange("purchase_price", e.target.value)} />
            </div>
            <div>
              <Label>Prezzo Vendita (€)</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={e => handleChange("sale_price", e.target.value)} />
            </div>
            <div>
              <Label>IVA (%)</Label>
              <Input type="number" step="0.01" value={form.vat_rate} onChange={e => handleChange("vat_rate", e.target.value)} />
            </div>
            <div>
              <Label>NEC (kg)</Label>
              <Input type="number" step="0.001" value={form.nec_kg} onChange={e => handleChange("nec_kg", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => handleChange("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantità</Label>
              <Input type="number" value={form.quantity} onChange={e => handleChange("quantity", e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            {saving ? "Salvataggio..." : (article?.id ? "Aggiorna" : "Crea Articolo")}
          </Button>
        </form>
      </div>
    </div>
  );
}