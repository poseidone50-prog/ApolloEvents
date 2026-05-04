import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Truck, Search, Trash2, Printer, Plus, ScrollText,
  Save, FolderOpen, PackagePlus, ShoppingCart, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import ContractForm from "../components/ContractForm";
import CustomerPicker from "../components/CustomerPicker";

const LOGO = "/logo.png";
const APOLLO = { name: "Apollo Events", address: "Via ...", city: "", vat: "", fiscal: "" };

// ─────────────────────────────────────────────────────────────────────────────
// FATTURA VENDITA / DDT – documento generico con selettore + anteprima stampa
// ─────────────────────────────────────────────────────────────────────────────
function DocumentForm({ type }) {
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState({ name: "", address: "", city: "", vat: "", fiscal: "" });
  // Solo per DDT
  const [causale, setCausale] = useState("Vendita");
  const [vettore, setVettore] = useState("");
  // Solo per Fattura Acquisti
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState("new");
  const [existingDocs, setExistingDocs] = useState([]);
  const inputRef = useRef(null);

  const isPurchase = type === "acquisto";
  const isDDT = type === "ddt";
  const isFattura = type === "fattura";

  const loadDocs = async () => {
    if (isPurchase) {
      const list = await base44.entities.Purchase.list("-created_date", 500);
      setExistingDocs(list);
    } else {
      const list = await base44.entities.Document.filter({ type }, "-created_date", 500);
      setExistingDocs(list);
    }
  };

  useEffect(() => {
    base44.entities.Article.list("-updated_date", 500).then(setArticles);
    if (isPurchase) base44.entities.Supplier.list().then(setSuppliers);
    loadDocs();
  }, [type]);

  const filteredArticles = barcodeSearch
    ? articles.filter(a =>
        (a.description || "").toLowerCase().includes(barcodeSearch.toLowerCase()) ||
        (a.barcode || "").toLowerCase().includes(barcodeSearch.toLowerCase())
      ).slice(0, 20)
    : [];

  const addArticleToItems = (a) => {
    setItems(prev => {
      const existing = prev.find(i => i.article_id === a.id);
      if (existing) return prev.map(i => i.article_id === a.id
        ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price }
        : i
      );
      return [...prev, {
        article_id: a.id,
        barcode: a.barcode,
        description: a.description,
        quantity: 1,
        unit_price: isPurchase ? (a.purchase_price || 0) : (a.sale_price || 0),
        vat_rate: a.vat_rate || 22,
        total: isPurchase ? (a.purchase_price || 0) : (a.sale_price || 0),
      }];
    });
    setBarcodeSearch("");
  };

  const updateQty = (id, delta) => {
    setItems(prev => prev.map(i => {
      if (i.article_id !== id) return i;
      const q = i.quantity + delta;
      if (q <= 0) return null;
      return { ...i, quantity: q, total: q * i.unit_price };
    }).filter(Boolean));
  };

  const updatePrice = (id, price) => {
    setItems(prev => prev.map(i => {
      if (i.article_id !== id) return i;
      const p = parseFloat(price) || 0;
      return { ...i, unit_price: p, total: i.quantity * p };
    }));
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.article_id !== id));

  const handleSelectDoc = (did) => {
    setLoadedId(did);
    if (did === "new") {
      setDocNumber(""); setDocDate(new Date().toISOString().slice(0, 10));
      setCustomer({ name: "", address: "", city: "", vat: "", fiscal: "" });
      setSelectedSupplierId(""); setItems([]); setNotes(""); setCausale("Vendita"); setVettore("");
      return;
    }
    const d = existingDocs.find(x => x.id === did);
    if (!d) return;
    if (isPurchase) {
      setDocNumber(d.invoice_number || "");
      setDocDate(d.invoice_date || new Date().toISOString().slice(0, 10));
      setSelectedSupplierId(d.supplier_id || "");
      setItems(d.items || []);
      setNotes(d.notes || "");
    } else {
      setDocNumber(d.docNumber || "");
      setDocDate(d.docDate || new Date().toISOString().slice(0, 10));
      setCustomer(d.customer || { name: "", address: "", city: "", vat: "", fiscal: "" });
      setItems(d.items || []);
      setNotes(d.notes || "");
      setCausale(d.causale || "Vendita");
      setVettore(d.vettore || "");
    }
  };

  const handleSave = async () => {
    if (isPurchase && !selectedSupplierId) { toast.error("Seleziona fornitore"); return; }
    if (!isPurchase && !customer.name) { toast.error("Inserisci destinatario"); return; }
    if (items.length === 0) { toast.error("Aggiungi almeno un articolo"); return; }
    setSaving(true);

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

    if (isPurchase) {
      const payload = {
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupplier?.name || "",
        invoice_number: docNumber,
        invoice_date: docDate,
        items,
        total,
        notes,
      };
      if (loadedId === "new") {
        // Aggiorna anche le quantità in magazzino
        const res = await base44.entities.Purchase.create(payload);
        for (const item of items) {
          const art = articles.find(a => a.id === item.article_id);
          if (art) {
            await base44.entities.Article.update(art.id, {
              quantity: (art.quantity || 0) + item.quantity,
              purchase_price: item.unit_price,
              supplier_id: selectedSupplierId,
              supplier_name: selectedSupplier?.name || "",
            });
          }
        }
        setLoadedId(res.id);
        toast.success("Fattura Acquisti salvata!");
      } else {
        await base44.entities.Purchase.update(loadedId, payload);
        toast.success("Fattura Acquisti aggiornata!");
      }
    } else {
      const payload = { type, docNumber, docDate, customer, items, notes, causale, vettore, subtotal, vatTotal, total };
      if (loadedId === "new") {
        const res = await base44.entities.Document.create(payload);
        setLoadedId(res.id);
        toast.success(`${docLabel} salvato!`);
      } else {
        await base44.entities.Document.update(loadedId, payload);
        toast.success(`${docLabel} aggiornato!`);
      }
    }

    await loadDocs();
    setSaving(false);
  };

  const subtotal = items.reduce((s, i) => s + (i.total / (1 + i.vat_rate / 100)), 0);
  const vatTotal = items.reduce((s, i) => s + (i.total - i.total / (1 + i.vat_rate / 100)), 0);
  const total = items.reduce((s, i) => s + i.total, 0);

  const docLabel = isPurchase ? "Fattura Acquisti" : isDDT ? "DDT" : "Fattura";
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // ── ANTEPRIMA STAMPA ──────────────────────────────────────────────────────
  if (preview) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-lg p-6 print:shadow-none print:border-none print:p-8 print:m-0 text-sm text-black">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Apollo Events" className="h-16 w-16 object-contain drop-shadow-md" />
            <div>
              <p className="font-extrabold text-xl text-black">Apollo Events</p>
              <p className="text-xs text-gray-500">Fireworks · Eventi · Spettacoli</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-xl uppercase">{docLabel}</p>
            <p className="text-gray-600">N° {docNumber || "—"}</p>
            <p className="text-gray-600">
              {docDate ? format(new Date(docDate), "dd/MM/yyyy", { locale: it }) : "—"}
            </p>
          </div>
        </div>

        {/* Mittente / Destinatario */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {isPurchase ? (
            <>
              <div className="border border-gray-300 rounded-xl p-3">
                <p className="font-bold text-xs uppercase text-gray-500 mb-2">Fornitore</p>
                <p className="font-bold">{selectedSupplier?.name || "—"}</p>
                {selectedSupplier?.company && <p>{selectedSupplier.company}</p>}
                {selectedSupplier?.address && <p>{selectedSupplier.address}</p>}
                {selectedSupplier?.vat_number && <p>P.IVA: {selectedSupplier.vat_number}</p>}
              </div>
              <div className="border border-gray-300 rounded-xl p-3">
                <p className="font-bold text-xs uppercase text-gray-500 mb-2">Destinatario</p>
                <p className="font-bold">Apollo Events</p>
              </div>
            </>
          ) : (
            <>
              <div className="border border-gray-300 rounded-xl p-3">
                <p className="font-bold text-xs uppercase text-gray-500 mb-2">Mittente</p>
                <p className="font-bold">Apollo Events</p>
              </div>
              <div className="border border-gray-300 rounded-xl p-3">
                <p className="font-bold text-xs uppercase text-gray-500 mb-2">Destinatario</p>
                <p className="font-bold">{customer.name || "—"}</p>
                {customer.address && <p>{customer.address}</p>}
                {customer.city && <p>{customer.city}</p>}
                {customer.vat && <p>P.IVA: {customer.vat}</p>}
                {customer.fiscal && <p>C.F.: {customer.fiscal}</p>}
              </div>
            </>
          )}
        </div>

        {/* Dati aggiuntivi DDT */}
        {isDDT && (causale || vettore) && (
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm border border-gray-200 rounded-xl p-3">
            {causale && <p><span className="font-semibold">Causale:</span> {causale}</p>}
            {vettore && <p><span className="font-semibold">Vettore:</span> {vettore}</p>}
          </div>
        )}

        {/* Tabella articoli */}
        <table className="w-full mb-6 text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 pr-2">Descrizione</th>
              <th className="text-left py-2 pr-2 text-gray-500 text-xs">Barcode</th>
              <th className="text-right py-2">Q.tà</th>
              {!isDDT && <th className="text-right py-2">Prezzo</th>}
              {isFattura && <th className="text-right py-2">IVA%</th>}
              {!isDDT && <th className="text-right py-2 font-bold">Totale</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 pr-2 font-medium">{item.description}</td>
                <td className="py-2 pr-2 text-gray-400 text-xs">{item.barcode}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                {!isDDT && <td className="py-2 text-right">€{(item.unit_price || 0).toFixed(2)}</td>}
                {isFattura && <td className="py-2 text-right">{item.vat_rate}%</td>}
                {!isDDT && <td className="py-2 text-right font-semibold">€{(item.total || 0).toFixed(2)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totali (solo fattura/acquisto) */}
        {!isDDT && (
          <div className="text-right space-y-1 text-sm mb-6 border-t-2 border-black pt-3">
            {isFattura && (
              <>
                <div className="flex justify-end gap-8">
                  <span className="text-gray-500">Imponibile</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8">
                  <span className="text-gray-500">IVA</span>
                  <span>€{vatTotal.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-end gap-8 font-extrabold text-lg">
              <span>TOTALE</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {notes && (
          <div className="border border-gray-200 rounded-xl p-3 mb-6 text-xs text-gray-600">
            <p className="font-semibold mb-1">Note:</p>
            <p className="whitespace-pre-line">{notes}</p>
          </div>
        )}

        {/* Firma */}
        <div className="grid grid-cols-2 gap-8 mt-16">
          <div className="border-t-2 border-gray-400 pt-3 text-center text-xs text-gray-500">
            {isPurchase ? "Firma Fornitore" : "Firma Destinatario per Accettazione"}
            <br /><br /><br />
          </div>
          <div className="border-t-2 border-gray-400 pt-3 text-center text-xs text-gray-500">
            Apollo Events
            <br /><br /><br />
          </div>
        </div>

        {/* Pulsanti (solo schermo) */}
        <div className="flex gap-2 mt-6 print:hidden flex-wrap">
          <Button variant="outline" onClick={() => setPreview(false)} className="flex-1 rounded-xl">← Modifica</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-[2] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4 mr-1" />{saving ? "Salvataggio..." : "Salva Definitivo"}
          </Button>
          <Button onClick={() => window.print()} className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            <Printer className="w-4 h-4 mr-1" /> Stampa
          </Button>
        </div>
      </div>
    );
  }

  // ── EDITOR ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 print:hidden">
      {/* Selettore documento esistente */}
      <div className="bg-secondary/10 rounded-xl border border-secondary/20 p-4 space-y-3">
        <label className="font-bold text-secondary text-sm flex items-center gap-2">
          <FolderOpen className="w-4 h-4" /> Gestione {docLabel}
        </label>
        <Select value={loadedId} onValueChange={handleSelectDoc}>
          <SelectTrigger className="w-full bg-background font-medium">
            <SelectValue placeholder="Seleziona documento..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" className="font-bold text-primary">➕ Crea Nuovo {docLabel}</SelectItem>
            {existingDocs.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {isPurchase
                  ? `N° ${d.invoice_number || "—"} – ${d.supplier_name || "?"} (${d.invoice_date ? format(new Date(d.invoice_date), "dd/MM/yyyy") : ""})`
                  : `N° ${d.docNumber || "—"} – ${d.customer?.name || "?"} (${d.docDate ? format(new Date(d.docDate), "dd/MM/yyyy") : ""})`
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Intestazione */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Intestazione {docLabel}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>N° Documento</Label>
            <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="001/2026" className="rounded-xl" />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="rounded-xl" />
          </div>
        </div>

        {/* Fornitore (acquisto) o Destinatario (fattura/ddt) */}
        {isPurchase ? (
          <div>
            <Label>Fornitore</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleziona fornitore..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.company ? ` – ${s.company}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <CustomerPicker customer={customer} onChange={setCustomer} />
        )}

        {/* Campi aggiuntivi DDT */}
        {isDDT && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Causale Trasporto</Label>
              <Input value={causale} onChange={e => setCausale(e.target.value)} placeholder="Es. Vendita" className="rounded-xl" />
            </div>
            <div>
              <Label>Vettore</Label>
              <Input value={vettore} onChange={e => setVettore(e.target.value)} placeholder="Es. Mittente" className="rounded-xl" />
            </div>
          </div>
        )}
      </div>

      {/* Ricerca articoli */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Articoli</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={barcodeSearch}
            onChange={e => setBarcodeSearch(e.target.value)}
            placeholder="Cerca per nome o barcode..."
            className="pl-9 rounded-xl"
          />
        </div>
        {filteredArticles.length > 0 && (
          <div className="border border-border rounded-xl max-h-40 overflow-y-auto">
            {filteredArticles.map(a => (
              <button key={a.id} onClick={() => addArticleToItems(a)}
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between">
                <span className="truncate">{a.description}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">{a.barcode}</span>
              </button>
            ))}
          </div>
        )}

        {/* Lista articoli aggiunti */}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.article_id} className="flex items-center gap-2 bg-muted/50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.barcode}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.article_id, -1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center font-bold text-sm">−</button>
                <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.article_id, 1)} className="w-7 h-7 rounded-lg bg-background flex items-center justify-center font-bold text-sm">+</button>
              </div>
              {!isDDT && (
                <div className="w-24">
                  <Input type="number" step="0.01" value={item.unit_price} onChange={e => updatePrice(item.article_id, e.target.value)} className="h-8 text-sm text-right rounded-lg" />
                </div>
              )}
              {!isDDT && <span className="font-bold text-sm w-16 text-right">€{(item.total || 0).toFixed(2)}</span>}
              <button onClick={() => removeItem(item.article_id)} className="p-1 hover:bg-destructive/10 rounded-lg">
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Totali */}
      {items.length > 0 && !isDDT && (
        <div className="bg-card rounded-xl border border-border p-4 text-sm space-y-1">
          {isFattura && (
            <>
              <div className="flex justify-between text-muted-foreground"><span>Imponibile</span><span>€{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>€{vatTotal.toFixed(2)}</span></div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Totale</span><span>€{total.toFixed(2)}</span></div>
        </div>
      )}

      {/* Note */}
      <div className="bg-card rounded-xl border border-border p-4">
        <Label>Note</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Note aggiuntive..." className="rounded-xl mt-1" />
      </div>

      <Button
        onClick={() => {
          if (isPurchase && !selectedSupplierId) { toast.error("Seleziona fornitore"); return; }
          if (!isPurchase && !customer.name) { toast.error("Inserisci destinatario"); return; }
          if (items.length === 0) { toast.error("Aggiungi almeno un articolo"); return; }
          setPreview(true);
        }}
        className="w-full h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-base font-bold shadow-xl"
      >
        <Printer className="w-5 h-5 mr-2" /> Visualizza & Stampa
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDITA AL BANCO – seleziona vendita chiusa e stampa ricevuta
// ─────────────────────────────────────────────────────────────────────────────
function SaleReceiptForm() {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loadedId, setLoadedId] = useState("new");
  const [preview, setPreview] = useState(false);

  const loadSales = async () => {
    const list = await base44.entities.Sale.filter({ status: "closed" }, "-created_date", 200);
    setSales(list);
  };

  useEffect(() => { loadSales(); }, []);

  const handleSelect = (sid) => {
    setLoadedId(sid);
    setPreview(false);
    if (sid === "new") { setSelectedSale(null); return; }
    const s = sales.find(x => x.id === sid);
    setSelectedSale(s || null);
  };

  if (preview && selectedSale) {
    const date = new Date(selectedSale.closed_at || selectedSale.created_date);
    return (
      <div className="bg-white rounded-2xl border border-border shadow-lg p-6 print:shadow-none print:border-none print:p-8 print:m-0 text-sm text-black">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Apollo Events" className="h-16 w-16 object-contain" />
            <div>
              <p className="font-extrabold text-xl">Apollo Events</p>
              <p className="text-xs text-gray-500">Fireworks · Eventi · Spettacoli</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-xl uppercase">RICEVUTA DI VENDITA</p>
            <p className="text-gray-600">N° {selectedSale.sale_number || "—"}</p>
            <p className="text-gray-600">{format(date, "dd/MM/yyyy HH:mm", { locale: it })}</p>
          </div>
        </div>

        {/* Tabella articoli */}
        <table className="w-full mb-6 text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2">Descrizione</th>
              <th className="text-right py-2">Q.tà</th>
              <th className="text-right py-2">Prezzo</th>
              <th className="text-right py-2">IVA%</th>
              <th className="text-right py-2 font-bold">Totale</th>
            </tr>
          </thead>
          <tbody>
            {(selectedSale.items || []).map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 font-medium">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">€{(item.unit_price || 0).toFixed(2)}</td>
                <td className="py-2 text-right">{item.vat_rate || 22}%</td>
                <td className="py-2 text-right font-semibold">€{(item.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totali */}
        <div className="text-right space-y-1 border-t-2 border-black pt-3 mb-6">
          <div className="flex justify-end gap-8 text-gray-500">
            <span>IVA inclusa</span>
            <span>€{(selectedSale.vat_total || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-end gap-8 font-extrabold text-xl">
            <span>TOTALE</span>
            <span>€{(selectedSale.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">Grazie per il tuo acquisto – Apollo Events</p>

        <div className="flex gap-2 mt-6 print:hidden">
          <Button variant="outline" onClick={() => setPreview(false)} className="flex-1 rounded-xl">← Indietro</Button>
          <Button onClick={() => window.print()} className="flex-[2] rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            <Printer className="w-4 h-4 mr-1" /> Stampa Ricevuta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 print:hidden">
      {/* Selettore vendita */}
      <div className="bg-secondary/10 rounded-xl border border-secondary/20 p-4 space-y-3">
        <label className="font-bold text-secondary text-sm flex items-center gap-2">
          <FolderOpen className="w-4 h-4" /> Seleziona Vendita al Banco
        </label>
        <Select value={loadedId} onValueChange={handleSelect}>
          <SelectTrigger className="w-full bg-background font-medium">
            <SelectValue placeholder="Seleziona vendita..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" className="font-bold text-primary">— Seleziona una vendita —</SelectItem>
            {sales.map(s => (
              <SelectItem key={s.id} value={s.id}>
                #{s.sale_number} – {format(new Date(s.closed_at || s.created_date), "dd/MM/yyyy HH:mm", { locale: it })} – €{(s.total || 0).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSale && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Riepilogo Vendita #{selectedSale.sale_number}
          </h2>
          <p className="text-xs text-muted-foreground">
            {format(new Date(selectedSale.closed_at || selectedSale.created_date), "dd/MM/yyyy HH:mm", { locale: it })} · {(selectedSale.items || []).length} articoli
          </p>
          <div className="space-y-2">
            {(selectedSale.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x €{(item.unit_price || 0).toFixed(2)}</p>
                </div>
                <span className="font-bold">€{(item.total || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Totale</span>
            <span>€{(selectedSale.total || 0).toFixed(2)}</span>
          </div>
          <Button
            onClick={() => setPreview(true)}
            className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
          >
            <Printer className="w-4 h-4 mr-2" /> Visualizza & Stampa Ricevuta
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINA PRINCIPALE DOCUMENTI
// ─────────────────────────────────────────────────────────────────────────────
export default function Documents() {
  return (
    <div className="space-y-4 pb-20 md:pb-6 print:pb-0">
      <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 print:hidden">
        <FileText className="w-6 h-6 text-secondary" />
        Documenti
      </h1>
      <Tabs defaultValue="acquisto">
        <TabsList className="w-full rounded-xl grid grid-cols-4 print:hidden">
          <TabsTrigger value="acquisto" className="rounded-lg text-xs">
            <PackagePlus className="w-3 h-3 mr-1" />Fatt. Acquisti
          </TabsTrigger>
          <TabsTrigger value="fattura" className="rounded-lg text-xs">
            <FileText className="w-3 h-3 mr-1" />Fattura Vendita
          </TabsTrigger>
          <TabsTrigger value="ddt" className="rounded-lg text-xs">
            <Truck className="w-3 h-3 mr-1" />DDT
          </TabsTrigger>
          <TabsTrigger value="contratto" className="rounded-lg text-xs">
            <ScrollText className="w-3 h-3 mr-1" />Contratto
          </TabsTrigger>
        </TabsList>
        <TabsContent value="acquisto" className="mt-4">
          <DocumentForm type="acquisto" />
        </TabsContent>
        <TabsContent value="fattura" className="mt-4">
          <DocumentForm type="fattura" />
        </TabsContent>
        <TabsContent value="ddt" className="mt-4">
          <DocumentForm type="ddt" />
        </TabsContent>
        <TabsContent value="contratto" className="mt-4">
          <ContractForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}