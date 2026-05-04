import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Trash2, Check, UserPlus, Package, Printer, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ArticleForm from "../components/ArticleForm";
import SupplierForm from "../components/SupplierForm";

export default function PurchaseInvoice() {
  const [suppliers, setSuppliers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [savedPurchase, setSavedPurchase] = useState(null);
  const inputRef = useRef(null);

  const loadData = async () => {
    const [sups, arts] = await Promise.all([
      base44.entities.Supplier.list(),
      base44.entities.Article.list("-updated_date", 500),
    ]);
    setSuppliers(sups);
    setArticles(arts);
  };

  useEffect(() => { loadData(); }, []);

  const handleAddByBarcode = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const article = articles.find(a => a.barcode === code);
    if (!article) { toast.error("Articolo non trovato"); return; }
    addItem(article);
    setBarcode("");
    inputRef.current?.focus();
  };

  const addItem = (article) => {
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
        unit_price: article.purchase_price || 0,
        total: article.purchase_price || 0,
      }];
    });
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

  const updatePrice = (id, price) => {
    setItems(prev => prev.map(i => {
      if (i.article_id !== id) return i;
      const p = parseFloat(price) || 0;
      return { ...i, unit_price: p, total: i.quantity * p };
    }));
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.article_id !== id));

  const total = items.reduce((s, i) => s + i.total, 0);
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const handleSave = async () => {
    if (!selectedSupplierId) { toast.error("Seleziona un fornitore"); return; }
    if (items.length === 0) { toast.error("Aggiungi almeno un articolo"); return; }
    setSaving(true);

    const created = await base44.entities.Purchase.create({
      supplier_id: selectedSupplierId,
      supplier_name: selectedSupplier?.name || "",
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      items,
      total,
      notes,
    });

    for (const item of items) {
      const article = articles.find(a => a.id === item.article_id);
      if (article) {
        await base44.entities.Article.update(article.id, {
          quantity: (article.quantity || 0) + item.quantity,
          purchase_price: item.unit_price,
          supplier_id: selectedSupplierId,
          supplier_name: selectedSupplier?.name || "",
        });
      }
    }

    toast.success("Fattura acquisto registrata e magazzino aggiornato!");
    setSavedPurchase(created);
    setItems([]);
    setNotes("");
    setInvoiceNumber("");
    setSelectedSupplierId("");
    await loadData();
    setSaving(false);
  };

  const handleEditSaved = () => {
    if (!savedPurchase) return;
    setSelectedSupplierId(savedPurchase.supplier_id || "");
    setInvoiceNumber(savedPurchase.invoice_number || "");
    setInvoiceDate(savedPurchase.invoice_date || new Date().toISOString().slice(0, 10));
    setNotes(savedPurchase.notes || "");
    setItems(savedPurchase.items || []);
    setSavedPurchase(null);
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Package className="w-6 h-6 text-secondary" />
          Fattura Acquisti
        </h1>
      </div>

      {/* Banner fattura salvata */}
      {savedPurchase && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="font-bold text-green-800 dark:text-green-200">✅ Fattura registrata con successo!</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              <strong>{savedPurchase.supplier_name}</strong>
              {savedPurchase.invoice_number ? ` · N° ${savedPurchase.invoice_number}` : ""}
              {savedPurchase.invoice_date ? ` · ${new Date(savedPurchase.invoice_date).toLocaleDateString("it-IT")}` : ""}
              <strong className="ml-2">· €{(savedPurchase.total || 0).toFixed(2)}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={handleEditSaved}>
              <Edit className="w-4 h-4 mr-1" /> Modifica
            </Button>
            <Button size="sm" className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setSavedPurchase(null)}>
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {/* Supplier + invoice header */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Intestazione Fattura</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex gap-2">
            <div className="flex-1">
              <Label>Fornitore</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona fornitore..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.company ? ` – ${s.company}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowSupplierForm(true)}>
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>N° Fattura</Label>
            <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="es. 001/2026" className="rounded-xl" />
          </div>
          <div>
            <Label>Data Fattura</Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="rounded-xl" />
          </div>
        </div>
      </div>

      {/* Barcode search */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Articoli</h2>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setEditingArticle(null); setShowArticleForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nuovo Articolo
          </Button>
        </div>
        <form onSubmit={handleAddByBarcode} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input ref={inputRef} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Codice a barre..." className="pl-9 rounded-xl" />
          </div>
          <Button type="submit" className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground">Aggiungi</Button>
        </form>

        {barcode && (
          <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
            {articles.filter(a =>
              (a.description || "").toLowerCase().includes(barcode.toLowerCase()) ||
              (a.barcode || "").toLowerCase().includes(barcode.toLowerCase())
            ).slice(0, 30).map(a => (
              <button key={a.id} onClick={() => { addItem(a); setBarcode(""); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center justify-between">
                <span className="truncate">{a.description}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">{a.barcode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.article_id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.barcode}</p>
                </div>
                <button onClick={() => removeItem(item.article_id)} className="p-1 hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.article_id, -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">−</button>
                  <span className="font-bold text-sm w-8 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.article_id, 1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">+</button>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Prezzo Acquisto (€)</Label>
                  <Input type="number" step="0.01" value={item.unit_price} onChange={e => updatePrice(item.article_id, e.target.value)} className="h-8 rounded-lg text-sm" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Totale</p>
                  <p className="font-bold">€{item.total.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes & total */}
      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div>
            <Label>Note</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-border pt-3">
            <span>Totale Fattura</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <Button onClick={handleSave} disabled={saving} className="w-full h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-base font-bold shadow-lg">
          {saving ? "Salvataggio..." : <><Check className="w-5 h-5 mr-2" />Registra Fattura & Aggiorna Magazzino</>}
        </Button>
      )}

      {showArticleForm && (
        <ArticleForm article={editingArticle} onSave={() => { setShowArticleForm(false); loadData(); }} onClose={() => setShowArticleForm(false)} />
      )}
      {showSupplierForm && (
        <SupplierForm onSave={() => { setShowSupplierForm(false); loadData(); }} onClose={() => setShowSupplierForm(false)} />
      )}
    </div>
  );
}