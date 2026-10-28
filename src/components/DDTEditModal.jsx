import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Minus, Trash2, Check, Search, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CustomerPicker from "./CustomerPicker";

export default function DDTEditModal({ ddt, articles, onClose, onSave, onPreview }) {
  const [docNumber, setDocNumber] = useState(ddt.docNumber || "");
  const [docDate, setDocDate] = useState(
    ddt.docDate || (ddt.created_date ? ddt.created_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [customer, setCustomer] = useState(
    ddt.customer || { name: "", address: "", city: "", vat: "", fiscal: "", sdi: "", destination: "" }
  );
  const [causale, setCausale] = useState(ddt.causale || "Vendita");
  const [vettore, setVettore] = useState(ddt.vettore || "");
  const [notes, setNotes] = useState(ddt.notes || "");
  const [items, setItems] = useState(ddt.items ? ddt.items.map(i => ({ ...i })) : []);
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
        article_id: article.id || "",
        barcode: article.barcode || "",
        description: article.description || "",
        quantity: 1,
        unit_price: Number(article.sale_price) || 0,
        vat_rate: Number(article.vat_rate) || 22,
        total: Number(article.sale_price) || 0,
      }];
    });
  };

  const handleAddByBarcode = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const article = articles.find(
      a => a.barcode === code || (a.description || "").toLowerCase() === code.toLowerCase()
    );
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

  const setExactQty = (idx, val) => {
    if (val === "") {
      setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, quantity: "", total: 0 }));
      return;
    }
    const q = parseInt(val, 10);
    if (isNaN(q) || q < 0) return;
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        return { ...item, quantity: q, total: q * (Number(item.unit_price) || 0) };
      })
    );
  };

  const updatePrice = (idx, priceVal) => {
    if (priceVal === "") {
      setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, unit_price: "", total: 0 }));
      return;
    }
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const p = parseFloat(priceVal) || 0;
        return { ...item, unit_price: priceVal, total: (Number(item.quantity) || 0) * p };
      })
    );
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const findArticleForItem = (item) => {
    if (item.article_id) {
      const byId = articles.find(a => a.id === item.article_id);
      if (byId) return byId;
    }
    if (item.barcode) {
      const byBarcode = articles.find(a => a.barcode === item.barcode);
      if (byBarcode) return byBarcode;
    }
    return null;
  };

  const handleSave = async () => {
    if (!customer.name || !customer.name.trim()) {
      toast.error("Inserisci il destinatario del DDT");
      return;
    }
    const cleanItems = items
      .map(it => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.unit_price) || 0;
        const vr = Number(it.vat_rate) || 22;
        return {
          article_id: it.article_id || "",
          barcode: it.barcode || "",
          description: it.description || "",
          quantity: q,
          unit_price: p,
          vat_rate: vr,
          total: q * p,
        };
      })
      .filter(it => it.quantity > 0);

    if (cleanItems.length === 0) {
      toast.error("Il DDT deve contenere almeno un articolo con quantità maggiore di 0");
      return;
    }

    setSaving(true);
    try {
      const stockDiffs = {};

      for (const oldItem of ddt.items || []) {
        const art = findArticleForItem(oldItem);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) + (Number(oldItem.quantity) || 0);
        }
      }

      for (const newItem of cleanItems) {
        const art = findArticleForItem(newItem);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) - (Number(newItem.quantity) || 0);
        }
      }

      for (const [artId, diff] of Object.entries(stockDiffs)) {
        if (diff !== 0) {
          const art = articles.find(a => a.id === artId);
          if (art) {
            const newStock = Math.max(0, (Number(art.quantity) || 0) + diff);
            await base44.entities.Article.update(artId, { quantity: newStock });
          }
        }
      }

      const cleanTotal = cleanItems.reduce((s, i) => s + i.total, 0);
      const cleanVatTotal = cleanItems.reduce(
        (s, i) => s + (i.total * (i.vat_rate / 100)) / (1 + i.vat_rate / 100),
        0
      );
      const cleanSubtotal = cleanTotal - cleanVatTotal;

      await base44.entities.Document.update(ddt.id, {
        docNumber: docNumber || "",
        docDate: docDate || "",
        customer: {
          name: customer.name || "",
          address: customer.address || "",
          city: customer.city || "",
          phone: customer.phone || "",
          email: customer.email || "",
          vat: customer.vat || "",
          fiscal: customer.fiscal || "",
          sdi: customer.sdi || "",
          destination: customer.destination || "",
        },
        causale: causale || "",
        vettore: vettore || "",
        items: cleanItems,
        subtotal: cleanSubtotal,
        vatTotal: cleanVatTotal,
        total: cleanTotal,
        notes: notes || "",
      });

      toast.success("DDT e giacenze di magazzino aggiornati!");
      onSave();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il salvataggio del DDT");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerPreview = () => {
    if (onPreview) {
      onPreview({
        ...ddt,
        docNumber,
        docDate,
        customer,
        causale,
        vettore,
        notes,
        items,
        total,
      });
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
          <h2 className="font-bold text-base truncate">
            Modifica DDT {ddt.docNumber ? `N° ${ddt.docNumber}` : ""}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {onPreview && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTriggerPreview}
                className="rounded-xl font-bold"
                title="Visualizza & Stampa DDT"
              >
                <Printer className="w-4 h-4 mr-1" />
                Stampa
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
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Intestazione DDT */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div>
              <Label className="text-xs">N° DDT</Label>
              <Input
                value={docNumber}
                onChange={e => setDocNumber(e.target.value)}
                placeholder="es. 001/2026"
                className="rounded-xl bg-background mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data DDT</Label>
              <Input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="rounded-xl bg-background mt-1"
              />
            </div>
            <div className="col-span-2">
              <CustomerPicker customer={customer} onChange={setCustomer} />
            </div>
            <div>
              <Label className="text-xs">Causale Trasporto</Label>
              <Input
                value={causale}
                onChange={e => setCausale(e.target.value)}
                placeholder="Es. Vendita"
                className="rounded-xl bg-background mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Vettore</Label>
              <Input
                value={vettore}
                onChange={e => setVettore(e.target.value)}
                placeholder="Es. Mittente"
                className="rounded-xl bg-background mt-1"
              />
            </div>
          </div>

          {/* Ricerca e aggiunta articolo */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Aggiungi Articolo
            </Label>
            <form onSubmit={handleAddByBarcode} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Cerca per nome o codice a barre..."
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button type="submit" className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                Aggiungi
              </Button>
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
          </div>

          {/* Lista Articoli nel DDT */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Articoli nel DDT ({items.length})
            </Label>
            {items.map((item, idx) => (
              <div key={item.article_id || idx} className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.barcode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg"
                    title="Rimuovi articolo"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(idx, -1)}
                      className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => setExactQty(idx, e.target.value)}
                      className="w-16 h-8 text-center font-bold text-sm rounded-lg px-1 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(idx, 1)}
                      className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={e => updatePrice(idx, e.target.value)}
                      className="w-24 h-8 text-sm text-right rounded-lg bg-background"
                    />
                  </div>

                  <span className="font-bold text-sm w-16 text-right">
                    €{(Number(item.total) || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Note */}
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Note DDT..."
              className="rounded-xl mt-1"
            />
          </div>

          {/* Totale */}
          <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
            <span>Totale DDT</span>
            <span>€{total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {saving ? "Salvataggio..." : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Salva e Aggiorna Giacenze
                </>
              )}
            </Button>
            {onPreview && (
              <Button
                type="button"
                onClick={handleTriggerPreview}
                className="flex-1 h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
              >
                <Printer className="w-4 h-4 mr-1" />
                Visualizza & Stampa
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
