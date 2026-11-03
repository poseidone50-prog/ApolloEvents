import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Minus, Trash2, Check, Search, Printer, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import SupplierForm from "./SupplierForm";
import ArticleForm from "./ArticleForm";

export default function PurchaseEditModal({ purchase, articles: initialArticles, suppliers: initialSuppliers, onClose, onSave, onPreview }) {
  const [articles, setArticles] = useState((initialArticles || []).filter(a => a && a.id));
  const [suppliers, setSuppliers] = useState((initialSuppliers || []).filter(s => s && s.id));
  const [selectedSupplierId, setSelectedSupplierId] = useState(purchase.supplier_id || "");
  const [supplierNameInput, setSupplierNameInput] = useState(purchase.supplier_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(purchase.invoice_number || "");
  const [invoiceDate, setInvoiceDate] = useState(
    purchase.invoice_date || (purchase.created_date ? purchase.created_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [notes, setNotes] = useState(purchase.notes || "");
  const [items, setItems] = useState(purchase.items ? purchase.items.map(i => ({ ...i })) : []);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [prefillArticle, setPrefillArticle] = useState(null);
  const [articleSelectKey, setArticleSelectKey] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setArticles((initialArticles || []).filter(a => a && a.id));
  }, [initialArticles]);

  useEffect(() => {
    setSuppliers((initialSuppliers || []).filter(s => s && s.id));
  }, [initialSuppliers]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const handleSelectSupplier = (supId) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setSupplierNameInput(sup.name || "");
    }
  };

  const handleSupplierSaved = async (savedSup) => {
    const sups = await base44.entities.Supplier.list("-updated_date", 1000);
    setSuppliers((sups || []).filter(s => s && s.id));
    if (savedSup?.id) {
      setSelectedSupplierId(savedSup.id);
      setSupplierNameInput(savedSup.name || "");
    }
    setShowSupplierForm(false);
  };

  const addItemByArticle = (article, initialQty = 1) => {
    const qtyToAdd = Number(initialQty) > 0 ? Number(initialQty) : 1;
    setItems(prev => {
      const existing = prev.find(i => (i.article_id && i.article_id === article.id) || (i.barcode && article.barcode && i.barcode === article.barcode));
      if (existing) {
        return prev.map(i => ((i.article_id && i.article_id === article.id) || (i.barcode && article.barcode && i.barcode === article.barcode))
          ? { ...i, quantity: (Number(i.quantity) || 0) + qtyToAdd, total: ((Number(i.quantity) || 0) + qtyToAdd) * (Number(i.unit_price) || 0) }
          : i
        );
      }
      const price = Number(article.purchase_price) || 0;
      return [...prev, {
        article_id: article.id || "",
        barcode: article.barcode || "",
        description: article.description || "",
        quantity: qtyToAdd,
        unit_price: price,
        total: price * qtyToAdd,
      }];
    });
  };

  const handleArticleSaved = async (savedArt) => {
    const arts = await base44.entities.Article.list("-updated_date", 1000);
    setArticles((arts || []).filter(a => a && a.id));
    if (savedArt?.id) {
      addItemByArticle(savedArt, savedArt.initialInvoiceQty || 1);
    }
    setShowArticleForm(false);
    setPrefillArticle(null);
  };

  const matchingArticles = barcode.trim()
    ? articles.filter(a =>
        (a.description || "").toLowerCase().includes(barcode.toLowerCase()) ||
        (a.barcode || "").toLowerCase().includes(barcode.toLowerCase())
      ).slice(0, 20)
    : [];

  const handleAddByBarcode = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const article = articles.find(
      a => (a.barcode && a.barcode.toLowerCase() === code.toLowerCase()) ||
           (a.description && a.description.toLowerCase() === code.toLowerCase())
    );
    if (article) {
      addItemByArticle(article);
      setBarcode("");
      inputRef.current?.focus();
      return;
    }
    if (matchingArticles.length > 0) {
      addItemByArticle(matchingArticles[0]);
      setBarcode("");
      inputRef.current?.focus();
      return;
    }
    const isNumericBarcode = /^\d+$/.test(code);
    setPrefillArticle({
      barcode: isNumericBarcode ? code : "",
      description: isNumericBarcode ? "" : code,
      supplier_id: selectedSupplierId || "",
      supplier_name: selectedSupplier?.name || supplierNameInput || "",
    });
    setShowArticleForm(true);
  };

  const handleAddManualRow = () => {
    setItems(prev => [
      ...prev,
      {
        article_id: "",
        barcode: "",
        description: barcode.trim() || "",
        quantity: 1,
        unit_price: 0,
        total: 0,
      },
    ]);
    setBarcode("");
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

  const updateDescription = (idx, desc) => {
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, description: desc }));
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const findArticleForItem = (item, list = articles) => {
    if (item.article_id) {
      const byId = list.find(a => a.id === item.article_id);
      if (byId) return byId;
    }
    if (item.barcode) {
      const byBarcode = list.find(a => a.barcode === item.barcode);
      if (byBarcode) return byBarcode;
    }
    if (item.description) {
      const byDesc = list.find(a => (a.description || "").toLowerCase() === item.description.toLowerCase());
      if (byDesc) return byDesc;
    }
    return null;
  };

  const handleSave = async () => {
    const cleanItems = items
      .map(it => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.unit_price) || 0;
        return {
          article_id: it.article_id || "",
          barcode: it.barcode || "",
          description: (it.description || "").trim(),
          quantity: q,
          unit_price: p,
          total: q * p,
        };
      })
      .filter(it => it.quantity > 0 && it.description);

    if (cleanItems.length === 0) {
      toast.error("La fattura deve contenere almeno un articolo con descrizione e quantità maggiore di 0");
      return;
    }
    setSaving(true);
    try {
      let finalSupplierId = selectedSupplierId;
      let finalSupplierName = selectedSupplier?.name || supplierNameInput.trim() || purchase.supplier_name || "";

      if (!finalSupplierId && finalSupplierName) {
        const existingByName = suppliers.find(
          s => (s.name || "").toLowerCase() === finalSupplierName.toLowerCase()
        );
        if (existingByName) {
          finalSupplierId = existingByName.id;
          finalSupplierName = existingByName.name;
        } else {
          const newSup = await base44.entities.Supplier.create({ name: finalSupplierName });
          finalSupplierId = newSup.id;
          finalSupplierName = newSup.name;
        }
      }

      const currentArticles = [...articles];
      const resolvedItems = [];
      for (const item of cleanItems) {
        let art = findArticleForItem(item, currentArticles);
        if (!art) {
          art = await base44.entities.Article.create({
            barcode: item.barcode || "",
            description: item.description,
            supplier_id: finalSupplierId,
            supplier_name: finalSupplierName,
            purchase_price: item.unit_price,
            sale_price: item.unit_price,
            vat_rate: 22,
            nec_kg: 0,
            category: "F2 5°C",
            quantity: 0,
          });
          currentArticles.push(art);
        }
        resolvedItems.push({
          ...item,
          article_id: art.id,
          barcode: item.barcode || art.barcode || "",
        });
      }

      const stockDiffs = {};
      const latestItemInfo = {};

      for (const oldItem of purchase.items || []) {
        const art = findArticleForItem(oldItem, currentArticles);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) - (Number(oldItem.quantity) || 0);
        }
      }

      for (const newItem of resolvedItems) {
        const art = findArticleForItem(newItem, currentArticles);
        if (art) {
          stockDiffs[art.id] = (stockDiffs[art.id] || 0) + (Number(newItem.quantity) || 0);
          latestItemInfo[art.id] = newItem;
        }
      }

      for (const [artId, diff] of Object.entries(stockDiffs)) {
        const art = currentArticles.find(a => a.id === artId);
        if (art && (diff !== 0 || latestItemInfo[artId])) {
          const newStock = Math.max(0, (Number(art.quantity) || 0) + diff);
          const updateData = { quantity: newStock };
          if (latestItemInfo[artId]) {
            updateData.purchase_price = Number(latestItemInfo[artId].unit_price) || art.purchase_price || 0;
            if (finalSupplierId) {
              updateData.supplier_id = finalSupplierId;
              updateData.supplier_name = finalSupplierName;
            }
          }
          await base44.entities.Article.update(artId, updateData);
        }
      }

      const cleanTotal = resolvedItems.reduce((s, i) => s + i.total, 0);

      await base44.entities.Purchase.update(purchase.id, {
        supplier_id: finalSupplierId || "",
        supplier_name: finalSupplierName || "",
        invoice_number: invoiceNumber || "",
        invoice_date: invoiceDate || "",
        items: resolvedItems,
        total: cleanTotal,
        notes: notes || "",
      });

      toast.success("Fattura d'acquisto e giacenze di magazzino aggiornate!");
      onSave();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante il salvataggio della fattura");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerPreview = () => {
    if (onPreview) {
      onPreview({
        ...purchase,
        supplier_id: selectedSupplierId || "",
        supplier_name: selectedSupplier?.name || supplierNameInput || purchase.supplier_name || "",
        invoice_number: invoiceNumber || "",
        invoice_date: invoiceDate || "",
        items,
        total,
        notes,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
      <div
        className="bg-card w-full md:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border"
        style={{ maxHeight: "85vh" }}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-2 z-10">
          <h2 className="font-bold text-base truncate">
            Modifica Fattura {purchase.invoice_number ? `N° ${purchase.invoice_number}` : ""}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {onPreview && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTriggerPreview}
                className="rounded-xl font-bold"
                title="Visualizza & Stampa Fattura"
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
          {/* Intestazione Fattura */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Fornitore</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-lg"
                  onClick={() => setShowSupplierForm(true)}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> + Nuovo Fornitore
                </Button>
              </div>
              <Select value={selectedSupplierId || undefined} onValueChange={handleSelectSupplier}>
                <SelectTrigger className="rounded-xl bg-background">
                  <SelectValue placeholder="Seleziona fornitore dalla rubrica..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.company ? ` – ${s.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={supplierNameInput}
                onChange={e => {
                  setSupplierNameInput(e.target.value);
                  const exact = suppliers.find(s => (s.name || "").toLowerCase() === e.target.value.trim().toLowerCase());
                  setSelectedSupplierId(exact ? exact.id : "");
                }}
                placeholder="Oppure scrivi nome fornitore..."
                className="rounded-xl bg-background text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">N° Fattura</Label>
              <Input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="es. 001/2026"
                className="rounded-xl bg-background mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data Fattura</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="rounded-xl bg-background mt-1"
              />
            </div>
          </div>

          {/* Ricerca e aggiunta articolo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Aggiungi Articolo
              </Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-lg"
                  onClick={handleAddManualRow}
                >
                  <Plus className="w-3 h-3 mr-1" /> Riga Manuale
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  onClick={() => {
                    setPrefillArticle({
                      supplier_id: selectedSupplierId || "",
                      supplier_name: selectedSupplier?.name || supplierNameInput || "",
                    });
                    setShowArticleForm(true);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> + Nuovo Articolo
                </Button>
              </div>
            </div>

            <Select
              key={articleSelectKey}
              onValueChange={(artId) => {
                const a = articles.find(x => x.id === artId);
                if (a) {
                  addItemByArticle(a);
                  toast.success(`"${a.description}" aggiunto`);
                }
                setArticleSelectKey(k => k + 1);
              }}
            >
              <SelectTrigger className="rounded-xl bg-background">
                <SelectValue placeholder={`Scegli articolo dal catalogo (${articles.length})...`} />
              </SelectTrigger>
              <SelectContent>
                {articles.slice(0, 200).map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.description} {a.barcode ? `(${a.barcode})` : ""} – €{Number(a.purchase_price || 0).toFixed(2)} [Giac: {a.quantity || 0}]
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {barcode.trim() && (
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
                {matchingArticles.length === 0 && (
                  <div className="p-2 text-center space-y-1.5">
                    <p className="text-xs text-muted-foreground">Nessun articolo trovato per "{barcode}"</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <Button type="button" size="sm" variant="outline" className="text-xs rounded-lg" onClick={handleAddManualRow}>
                        + Inserisci come riga
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="text-xs rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                        onClick={() => {
                          const code = barcode.trim();
                          const isNumericBarcode = /^\d+$/.test(code);
                          setPrefillArticle({
                            barcode: isNumericBarcode ? code : "",
                            description: isNumericBarcode ? "" : code,
                            supplier_id: selectedSupplierId || "",
                            supplier_name: selectedSupplier?.name || supplierNameInput || "",
                          });
                          setShowArticleForm(true);
                        }}
                      >
                        + Crea in Catalogo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lista Articoli nella fattura */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Articoli in Fattura ({items.length})
            </Label>
            {items.map((item, idx) => (
              <div key={idx} className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={item.description}
                      onChange={e => updateDescription(idx, e.target.value)}
                      placeholder="Descrizione articolo..."
                      className="h-8 text-sm font-medium bg-background rounded-lg"
                    />
                    {item.barcode && <p className="text-xs text-muted-foreground mt-0.5 px-1">{item.barcode}</p>}
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
              placeholder="Note fattura..."
              className="rounded-xl mt-1"
            />
          </div>

          {/* Totale */}
          <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
            <span>Totale Fattura</span>
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

      {showSupplierForm && (
        <SupplierForm
          onSave={handleSupplierSaved}
          onClose={() => setShowSupplierForm(false)}
        />
      )}

      {showArticleForm && (
        <ArticleForm
          article={prefillArticle}
          fromPurchaseInvoice={true}
          onSave={handleArticleSaved}
          onClose={() => { setShowArticleForm(false); setPrefillArticle(null); }}
        />
      )}
    </div>
  );
}
