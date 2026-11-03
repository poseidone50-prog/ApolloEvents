import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SupplierForm from "./SupplierForm";
import { X } from "lucide-react";
import { toast } from "sonner";

const categories = ["F2 5°C", "F2 5°D", "F2 5°E", "F3 4°"];

export default function ArticleForm({ article, onSave, onClose, fromPurchaseInvoice = false }) {
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);

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
    quantity: fromPurchaseInvoice && !article?.id ? 1 : 0,
    ...article,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Supplier.list().then(list => {
      setSuppliers((list || []).filter(s => s && s.id));
    });
  }, []);

  const handleNewSupplierSave = async (newSup) => {
    const updated = await base44.entities.Supplier.list();
    setSuppliers((updated || []).filter(s => s && s.id));
    if (newSup?.id) {
      setForm(prev => ({
        ...prev,
        supplier_id: newSup.id,
        supplier_name: newSup.name || "",
      }));
    }
    setShowSupplierForm(false);
  };

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
    e.stopPropagation();
    if (!form.description || !form.description.trim()) {
      toast.error("Inserisci la descrizione dell'articolo");
      return;
    }
    setSaving(true);
    try {
      const enteredQty = Number(form.quantity) || 0;
      const data = {
        ...form,
        barcode: (form.barcode || "").trim(),
        description: form.description.trim(),
        supplier_id: form.supplier_id || "",
        supplier_name: form.supplier_name || "",
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        vat_rate: Number(form.vat_rate) || 22,
        nec_kg: Number(form.nec_kg) || 0,
        // Se creato da una Fattura d'Acquisto, la giacenza di magazzino verrà incrementata al salvataggio della fattura
        quantity: (!article?.id && fromPurchaseInvoice) ? 0 : enteredQty,
      };
      let saved;
      if (article?.id) {
        saved = await base44.entities.Article.update(article.id, data);
        toast.success("Articolo aggiornato!");
      } else {
        saved = await base44.entities.Article.create(data);
        toast.success("Nuovo articolo creato!");
      }
      onSave({
        ...saved,
        initialInvoiceQty: enteredQty > 0 ? enteredQty : 1,
      });
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il salvataggio dell'articolo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={e => e.stopPropagation()}>
      <div className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg">{article?.id ? "Modifica Articolo" : "Nuovo Articolo"}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Codice a Barre (opzionale)</Label>
              <Input value={form.barcode} onChange={e => handleChange("barcode", e.target.value)} placeholder="Scansiona o inserisci codice..." />
            </div>
            <div className="col-span-2">
              <Label>Descrizione *</Label>
              <Input value={form.description} onChange={e => handleChange("description", e.target.value)} placeholder="Nome articolo" required />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label>Fornitore</Label>
                <button type="button" onClick={() => setShowSupplierForm(true)} className="text-xs text-secondary font-bold hover:underline">
                  + Nuovo Fornitore
                </button>
              </div>
              <Select value={form.supplier_id || undefined} onValueChange={handleSupplierChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona fornitore" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.company ? ` – ${s.company}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="col-span-2">
              <Label>{fromPurchaseInvoice && !article?.id ? "Quantità da inserire in Fattura" : "Quantità in Magazzino"}</Label>
              <Input type="number" value={form.quantity} onChange={e => handleChange("quantity", e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            {saving ? "Salvataggio..." : (article?.id ? "Aggiorna" : (fromPurchaseInvoice ? "Crea Articolo e Inserisci in Fattura" : "Crea Articolo"))}
          </Button>
        </form>
      </div>

      {showSupplierForm && (
        <SupplierForm
          onSave={handleNewSupplierSave}
          onClose={() => setShowSupplierForm(false)}
        />
      )}
    </div>
  );
}
