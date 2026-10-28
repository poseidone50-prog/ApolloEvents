import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Minus, Trash2, Check, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SaleEditModal({ sale, articles, onClose, onSave, onPreview }) {
  const [items, setItems] = useState(sale.items ? sale.items.map(i => ({ ...i })) : []);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const addItemByArticle = (article) => {
    setItems(prev => {
      const existing = prev.find(i => i.article_id === article.id || (i.barcode && i.barcode === article.barcode));
      if (existing) {
        return prev.map(i => (i.article_id === article.id || (i.barcode && i.barcode === article.barcode))
          ? {
              ...i,
              quantity: (Number(i.quantity) || 0) + 1,
              total: ((Number(i.quantity) || 0) + 1) * (Number(i.unit_price) || 0),
            }
          : i
        );
      }
      return [...prev, {
        article_id: article.id,
        barcode: article.barcode,
        description: article.description,
        quantity: 1,
        unit_price: Number(article.sale_price) || 0,
        vat_rate: Number(article.vat_rate) || 22,
        total: Number(article.sale_price) || 0,
      }];
    });
  };

  const addItem = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const article = articles.find(a => a.barcode === code || (a.description || "").toLowerCase() === code.toLowerCase());
    if (!article) {
      toast.error("Articolo non trovato");
      return;
    }
    addItemByArticle(article);
    setBarcode("");
    inputRef.current?.focus();
  };

  const updateQty = (idx, delta) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const q = (Number(item.quantity) || 0) + delta;
        if (q <= 0) return null;
        return { ...item, quantity: q, total: q * (Number(item.unit_price) || 0) };
      }).filter(Boolean)
    );
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const vatTotal = items.reduce((s, i) => {
    const t = Number(i.total) || 0;
    const vr = Number(i.vat_rate) || 22;
    return s + (t * (vr / 100) / (1 + vr / 100));
  }, 0);

  const findArticle = (item) => {
    if (item.article_id) {
      const byId = articles.find(a => a.id === item.article_id);
      if (byId) return byId;
    }
    if (item.barcode) {
      const byCode = articles.find(a => a.barcode === item.barcode);
      if (byCode) return byCode;
    }
    return null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const stockDiffs = {};
      for (const oldItem of (sale.items || [])) {
        const art = findArticle(oldItem);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) + (Number(oldItem.quantity) || 0);
        }
      }
      for (const newItem of items) {
        const art = findArticle(newItem);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) - (Number(newItem.quantity) || 0);
        }
      }

      for (const [artId, diff] of Object.entries(stockDiffs)) {
        if (diff !== 0) {
          const art = articles.find(a => a.id === artId);
          if (art) {
            await base44.entities.Article.update(artId, {
              quantity: Math.max(0, (Number(art.quantity) || 0) + diff),
            });
          }
        }
      }

      await base44.entities.Sale.update(sale.id, {
        items,
        subtotal,
        vat_total: vatTotal,
        total: subtotal,
      });
      toast.success("Vendita e giacenze aggiornate!");
      onSave();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il salvataggio della vendita");
    } finally {
      setSaving(false);
    }
  };

  const matchingArticles = barcode.trim()
    ? articles.filter(a =>
        (a.description || "").toLowerCase().includes(barcode.toLowerCase()) ||
        (a.barcode || "").toLowerCase().includes(barcode.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
      <div
        className="bg-card w-full md:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border"
        style={{ maxHeight: "85vh" }}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-2 z-10">
          <h2 className="font-bold text-base truncate">Modifica Vendita #{sale.sale_number}</h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {onPreview && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPreview({ ...sale, items, subtotal, vat_total: vatTotal, total: subtotal })}
                className="rounded-xl font-bold"
              >
                <Printer className="w-4 h-4 mr-1" /> Stampa
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
            >
              <Check className="w-4 h-4 mr-1" />
              {saving ? "..." : "Salva"}
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <form onSubmit={addItem} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={inputRef} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Cerca per nome o codice a barre..." className="pl-9 rounded-xl" />
            </div>
            <Button type="submit" className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground">Aggiungi</Button>
          </form>

          {matchingArticles.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2 bg-background">
              {matchingArticles.map(a => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => { addItemByArticle(a); setBarcode(""); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center justify-between"
                >
                  <span className="truncate font-medium">{a.description}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {a.barcode} (Giac: {a.quantity || 0})
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.article_id || idx} className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">€{(Number(item.unit_price) || 0).toFixed(2)}/pz</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateQty(idx, -1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                  <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(idx, 1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  <button type="button" onClick={() => removeItem(idx)} className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center ml-1"><Trash2 className="w-3 h-3 text-destructive" /></button>
                </div>
                <span className="font-bold text-sm w-16 text-right">€{(Number(item.total) || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>IVA inclusa</span><span>€{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base"><span>Totale</span><span>€{subtotal.toFixed(2)}</span></div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            {saving ? "Salvataggio..." : <><Check className="w-4 h-4 mr-2" />Salva Modifiche e Aggiorna Giacenze</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
