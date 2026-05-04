import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Minus, Trash2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SaleEditModal({ sale, articles, onClose, onSave }) {
  const [items, setItems] = useState(sale.items ? sale.items.map(i => ({ ...i })) : []);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const addItem = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const article = articles.find(a => a.barcode === code);
    if (!article) { toast.error("Articolo non trovato"); return; }
    setItems(prev => {
      const existing = prev.find(i => i.article_id === article.id);
      if (existing) {
        return prev.map(i => i.article_id === article.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price }
          : i
        );
      }
      return [...prev, {
        article_id: article.id,
        barcode: article.barcode,
        description: article.description,
        quantity: 1,
        unit_price: article.sale_price || 0,
        vat_rate: article.vat_rate || 22,
        total: article.sale_price || 0,
      }];
    });
    setBarcode("");
    inputRef.current?.focus();
  };

  const updateQty = (id, delta) => {
    setItems(prev =>
      prev.map(i => {
        if (i.article_id !== id) return i;
        const q = i.quantity + delta;
        if (q <= 0) return null;
        return { ...i, quantity: q, total: q * i.unit_price };
      }).filter(Boolean)
    );
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.article_id !== id));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const vatTotal = items.reduce((s, i) => s + (i.total * (i.vat_rate / 100) / (1 + i.vat_rate / 100)), 0);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Sale.update(sale.id, {
      items,
      subtotal,
      vat_total: vatTotal,
      total: subtotal,
    });
    setSaving(false);
    toast.success("Vendita aggiornata");
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-card w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-lg">Modifica Vendita #{sale.sale_number}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={addItem} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={inputRef} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Codice a barre..." className="pl-9 rounded-xl" />
            </div>
            <Button type="submit" className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground">Aggiungi</Button>
          </form>

          <div className="space-y-2">
            {items.map(item => (
              <div key={item.article_id} className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">€{item.unit_price.toFixed(2)}/pz</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.article_id, -1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                  <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.article_id, 1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  <button onClick={() => removeItem(item.article_id)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center ml-1"><Trash2 className="w-3 h-3 text-destructive" /></button>
                </div>
                <span className="font-bold text-sm w-16 text-right">€{item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>IVA inclusa</span><span>€{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base"><span>Totale</span><span>€{subtotal.toFixed(2)}</span></div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            {saving ? "Salvataggio..." : <><Check className="w-4 h-4 mr-2" />Salva Modifiche</>}
          </Button>
        </div>
      </div>
    </div>
  );
}