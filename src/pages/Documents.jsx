import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  FileText, Truck, Search, Trash2, Printer, Plus, ScrollText,
  Save, FolderOpen, PackagePlus, ShoppingCart, UserPlus, Edit
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
import SupplierForm from "../components/SupplierForm";
import ArticleForm from "../components/ArticleForm";

const LOGO = "/logo.png";

function safeFormatDate(dateStr, fmt = "dd/MM/yyyy") {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, fmt, { locale: it });
  } catch {
    return String(dateStr);
  }
}

const emptyCustomer = () => ({
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  vat: "",
  fiscal: "",
  sdi: "",
  destination: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// FATTURA ACQUISTI / FATTURA VENDITA / DDT – documento generico con anteprima
// ─────────────────────────────────────────────────────────────────────────────
function DocumentForm({ type }) {
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [customer, setCustomer] = useState(emptyCustomer());
  // Solo per DDT
  const [causale, setCausale] = useState("Vendita");
  const [vettore, setVettore] = useState("");
  // DDT links
  const [invoiceIssued, setInvoiceIssued] = useState(false);
  const [receiptIssued, setReceiptIssued] = useState(false);
  const [linkedInvoiceNumber, setLinkedInvoiceNumber] = useState("");
  const [linkedSaleNumber, setLinkedSaleNumber] = useState("");
  // Solo per Fattura Acquisti
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierNameInput, setSupplierNameInput] = useState("");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  // Modale Nuovo Articolo
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [prefillArticle, setPrefillArticle] = useState(null);
  const [articleSelectKey, setArticleSelectKey] = useState(0);

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
      setExistingDocs((list || []).filter(d => d && d.id));
    } else {
      const list = await base44.entities.Document.filter({ type }, "-created_date", 500);
      setExistingDocs((list || []).filter(d => d && d.id));
    }
  };

  const loadArticlesAndSuppliers = async () => {
    const arts = await base44.entities.Article.list("-updated_date", 1000);
    setArticles((arts || []).filter(a => a && a.id));
    if (isPurchase) {
      const sups = await base44.entities.Supplier.list("-updated_date", 1000);
      setSuppliers((sups || []).filter(s => s && s.id));
    }
  };

  useEffect(() => {
    loadArticlesAndSuppliers();
    loadDocs();
  }, [type]);

  const filteredArticles = barcodeSearch.trim()
    ? articles.filter(a =>
        (a.description || "").toLowerCase().includes(barcodeSearch.toLowerCase()) ||
        (a.barcode || "").toLowerCase().includes(barcodeSearch.toLowerCase())
      ).slice(0, 30)
    : [];

  const filteredSuppliers = supplierNameInput.trim() && !suppliers.some(s => s.id === selectedSupplierId && s.name === supplierNameInput)
    ? suppliers.filter(s =>
        (s.name || "").toLowerCase().includes(supplierNameInput.toLowerCase()) ||
        (s.company || "").toLowerCase().includes(supplierNameInput.toLowerCase())
      ).slice(0, 10)
    : [];

  const handleSelectSupplier = (supId) => {
    setSelectedSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setSupplierNameInput(sup.name || "");
    }
  };

  const handleSupplierSaved = async (savedSup) => {
    const sups = await base44.entities.Supplier.list("-updated_date", 1000);
    const validSups = (sups || []).filter(s => s && s.id);
    setSuppliers(validSups);
    if (savedSup?.id) {
      setSelectedSupplierId(savedSup.id);
      setSupplierNameInput(savedSup.name || "");
    }
    setShowSupplierForm(false);
    setEditingSupplier(null);
  };

  const addArticleToItems = (a, initialQty = 1) => {
    const qtyToAdd = Number(initialQty) > 0 ? Number(initialQty) : 1;
    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.article_id && i.article_id === a.id);
      if (existingIdx > -1) {
        return prev.map((i, idx) => {
          if (idx !== existingIdx) return i;
          const q = (Number(i.quantity) || 0) + qtyToAdd;
          const p = Number(i.unit_price) || 0;
          return { ...i, quantity: q, total: q * p };
        });
      }
      const defaultPrice = isPurchase ? (Number(a.purchase_price) || 0) : (Number(a.sale_price) || 0);
      return [...prev, {
        article_id: a.id,
        barcode: a.barcode || "",
        description: a.description || "",
        quantity: qtyToAdd,
        unit_price: defaultPrice,
        vat_rate: Number(a.vat_rate) || 22,
        total: defaultPrice * qtyToAdd,
      }];
    });
    setBarcodeSearch("");
  };

  const handleAddByBarcode = (e) => {
    e.preventDefault();
    const code = barcodeSearch.trim();
    if (!code) return;
    const exactMatch = articles.find(
      a => (a.barcode && a.barcode.toLowerCase() === code.toLowerCase()) ||
           (a.description && a.description.toLowerCase() === code.toLowerCase())
    );
    if (exactMatch) {
      addArticleToItems(exactMatch);
      toast.success(`"${exactMatch.description}" aggiunto`);
      inputRef.current?.focus();
      return;
    }
    if (filteredArticles.length > 0) {
      addArticleToItems(filteredArticles[0]);
      toast.success(`"${filteredArticles[0].description}" aggiunto`);
      inputRef.current?.focus();
      return;
    }
    // Se l'articolo non esiste ancora in magazzino, apri il form Nuovo Articolo precompilato
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
        description: barcodeSearch.trim() || "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        total: 0,
      },
    ]);
    setBarcodeSearch("");
  };

  const handleArticleSaved = async (savedArt) => {
    const arts = await base44.entities.Article.list("-updated_date", 1000);
    setArticles((arts || []).filter(a => a && a.id));
    if (savedArt?.id) {
      addArticleToItems(savedArt, savedArt.initialInvoiceQty || 1);
    }
    setShowArticleForm(false);
    setPrefillArticle(null);
  };

  const updateQty = (idx, delta) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const q = (Number(item.quantity) || 0) + delta;
      if (q <= 0) return null;
      return { ...item, quantity: q, total: q * (Number(item.unit_price) || 0) };
    }).filter(Boolean));
  };

  const setExactQty = (idx, val) => {
    if (val === "") {
      setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, quantity: "", total: 0 }));
      return;
    }
    const q = parseInt(val, 10);
    if (isNaN(q) || q < 0) return;
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, quantity: q, total: q * (Number(item.unit_price) || 0) };
    }));
  };

  const updatePrice = (idx, price) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const p = parseFloat(price) || 0;
      return { ...item, unit_price: price === "" ? "" : price, total: (Number(item.quantity) || 0) * p };
    }));
  };

  const updateDescription = (idx, desc) => {
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, description: desc }));
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSelectDoc = (did) => {
    setLoadedId(did);
    setPreview(false);
    if (did === "new") {
      setDocNumber("");
      setDocDate(new Date().toISOString().slice(0, 10));
      setCustomer(emptyCustomer());
      setSelectedSupplierId("");
      setSupplierNameInput("");
      setItems([]);
      setNotes("");
      setCausale("Vendita");
      setVettore("");
      setInvoiceIssued(false);
      setReceiptIssued(false);
      setLinkedInvoiceNumber("");
      setLinkedSaleNumber("");
      return;
    }
    const d = existingDocs.find(x => x.id === did);
    if (!d) return;
    if (isPurchase) {
      setDocNumber(d.invoice_number || "");
      setDocDate(d.invoice_date || new Date().toISOString().slice(0, 10));
      setSelectedSupplierId(d.supplier_id || "");
      setSupplierNameInput(d.supplier_name || "");
      setItems(Array.isArray(d.items) ? d.items.map(it => ({ ...it })) : []);
      setNotes(d.notes || "");
    } else {
      setDocNumber(d.docNumber || "");
      setDocDate(d.docDate || new Date().toISOString().slice(0, 10));
      setCustomer({ ...emptyCustomer(), ...(d.customer || {}) });
      setItems(Array.isArray(d.items) ? d.items.map(it => ({ ...it })) : []);
      setNotes(d.notes || "");
      setCausale(d.causale || "Vendita");
      setVettore(d.vettore || "");
      setInvoiceIssued(Boolean(d.invoice_issued));
      setReceiptIssued(Boolean(d.receipt_issued));
      setLinkedInvoiceNumber(d.linked_invoice_number || "");
      setLinkedSaleNumber(d.linked_sale_number || "");
    }
  };

  const subtotal = items.reduce((s, i) => {
    const t = Number(i.total) || 0;
    const vr = Number(i.vat_rate) || 22;
    return s + (t / (1 + vr / 100));
  }, 0);
  const vatTotal = items.reduce((s, i) => {
    const t = Number(i.total) || 0;
    const vr = Number(i.vat_rate) || 22;
    return s + (t - t / (1 + vr / 100));
  }, 0);
  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const docLabel = isPurchase ? "Fattura Acquisti" : isDDT ? "DDT" : "Fattura";
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const handleOpenPreview = () => {
    setPreview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (isPurchase && !selectedSupplierId && !supplierNameInput.trim()) {
      toast.error("Seleziona o inserisci il nome di un fornitore prima di salvare");
      return;
    }
    if (!isPurchase && (!customer.name || !customer.name.trim())) {
      toast.error("Inserisci il nome del destinatario / cliente prima di salvare");
      return;
    }
    const normalizedItems = items
      .map(it => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.unit_price) || 0;
        const vr = Number(it.vat_rate) || 22;
        return {
          ...it,
          description: (it.description || "").trim(),
          quantity: q,
          unit_price: p,
          vat_rate: vr,
          total: q * p,
        };
      })
      .filter(it => it.quantity > 0 && it.description);

    if (normalizedItems.length === 0) {
      toast.error("Aggiungi almeno un articolo con descrizione e quantità maggiore di 0");
      return;
    }

    setSaving(true);
    try {
      const normTotal = normalizedItems.reduce((s, i) => s + i.total, 0);
      const normSubtotal = normalizedItems.reduce((s, i) => s + (i.total / (1 + i.vat_rate / 100)), 0);
      const normVatTotal = normTotal - normSubtotal;

      if (isPurchase) {
        let finalSupplierId = selectedSupplierId;
        let finalSupplierName = selectedSupplier?.name || supplierNameInput.trim();

        // Se l'utente ha scritto manualmente il nome di un nuovo fornitore senza selezionarlo, crealo automaticamente
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
          setSelectedSupplierId(finalSupplierId);
        }

        // Assicuriamoci che eventuali righe manuali in Fattura Acquisti siano collegate o create in Magazzino
        const resolvedItems = [];
        let currentArticles = [...articles];
        for (const item of normalizedItems) {
          let art = currentArticles.find(
            a => (item.article_id && a.id === item.article_id) ||
                 (item.barcode && a.barcode && a.barcode === item.barcode) ||
                 (a.description && a.description.toLowerCase() === item.description.toLowerCase())
          );
          if (!art) {
            art = await base44.entities.Article.create({
              barcode: item.barcode || "",
              description: item.description,
              supplier_id: finalSupplierId,
              supplier_name: finalSupplierName,
              purchase_price: item.unit_price,
              sale_price: item.unit_price,
              vat_rate: item.vat_rate || 22,
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

        const payload = {
          supplier_id: finalSupplierId,
          supplier_name: finalSupplierName,
          invoice_number: docNumber,
          invoice_date: docDate,
          items: resolvedItems,
          total: normTotal,
          notes,
        };
        if (loadedId === "new") {
          const res = await base44.entities.Purchase.create(payload);
          for (const item of resolvedItems) {
            const art = currentArticles.find(a => a.id === item.article_id);
            if (art) {
              const newQty = (Number(art.quantity) || 0) + item.quantity;
              await base44.entities.Article.update(art.id, {
                quantity: newQty,
                purchase_price: item.unit_price,
                supplier_id: finalSupplierId,
                supplier_name: finalSupplierName,
              });
              art.quantity = newQty;
            }
          }
          setLoadedId(res.id);
          toast.success("Fattura Acquisti salvata e giacenze aggiornate!");
        } else {
          const oldDoc = existingDocs.find(x => x.id === loadedId);
          const stockDiffs = {};
          const latestItemInfo = {};

          for (const oldItem of (oldDoc?.items || [])) {
            const art = currentArticles.find(a => a.id === oldItem.article_id || (oldItem.barcode && a.barcode === oldItem.barcode));
            if (art) {
              stockDiffs[art.id] = (stockDiffs[art.id] || 0) - (Number(oldItem.quantity) || 0);
            }
          }

          for (const newItem of resolvedItems) {
            const art = currentArticles.find(a => a.id === newItem.article_id || (newItem.barcode && a.barcode === newItem.barcode));
            if (art) {
              stockDiffs[art.id] = (stockDiffs[art.id] || 0) + (Number(newItem.quantity) || 0);
              latestItemInfo[art.id] = newItem;
            }
          }

          for (const [artId, diff] of Object.entries(stockDiffs)) {
            const art = currentArticles.find(a => a.id === artId);
            if (art && (diff !== 0 || latestItemInfo[artId])) {
              const updateData = {
                quantity: Math.max(0, (Number(art.quantity) || 0) + diff),
              };
              if (latestItemInfo[artId]) {
                updateData.purchase_price = Number(latestItemInfo[artId].unit_price) || art.purchase_price || 0;
                updateData.supplier_id = finalSupplierId;
                updateData.supplier_name = finalSupplierName;
              }
              await base44.entities.Article.update(artId, updateData);
            }
          }

          await base44.entities.Purchase.update(loadedId, payload);
          toast.success("Fattura Acquisti e giacenze aggiornate!");
        }
        await loadArticlesAndSuppliers();
        setItems(resolvedItems);
      } else {
        const payload = {
          type,
          docNumber,
          docDate,
          customer,
          items: normalizedItems,
          notes,
          causale,
          vettore,
          subtotal: normSubtotal,
          vatTotal: normVatTotal,
          total: normTotal,
        };
        if (loadedId === "new") {
          const res = await base44.entities.Document.create(payload);
          if (type === "ddt") {
            for (const item of normalizedItems) {
              const art = articles.find(a => a.id === item.article_id || (item.barcode && a.barcode === item.barcode));
              if (art) {
                await base44.entities.Article.update(art.id, {
                  quantity: Math.max(0, (Number(art.quantity) || 0) - item.quantity),
                });
              }
            }
            await loadArticlesAndSuppliers();
          }
          setLoadedId(res.id);
          toast.success(`${docLabel} salvato!`);
        } else {
          if (type === "ddt") {
            const oldDoc = existingDocs.find(x => x.id === loadedId);
            const stockDiffs = {};
            for (const oldItem of (oldDoc?.items || [])) {
              const art = articles.find(a => a.id === oldItem.article_id || (oldItem.barcode && a.barcode === oldItem.barcode));
              if (art) {
                stockDiffs[art.id] = (stockDiffs[art.id] || 0) + (Number(oldItem.quantity) || 0);
              }
            }
            for (const newItem of normalizedItems) {
              const art = articles.find(a => a.id === newItem.article_id || (newItem.barcode && a.barcode === newItem.barcode));
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
            await loadArticlesAndSuppliers();
          }
          await base44.entities.Document.update(loadedId, payload);
          toast.success(type === "ddt" ? "DDT e giacenze aggiornati!" : `${docLabel} aggiornato!`);
        }
        setItems(normalizedItems);
      }

      await loadDocs();
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il salvataggio del documento");
    } finally {
      setSaving(false);
    }
  };

  const handleEmitInvoice = async () => {
    if (loadedId === "new") {
      toast.error("Salva prima il DDT come definitivo prima di emettere la fattura");
      return;
    }
    const invNumber = window.prompt("Inserisci il numero della fattura da generare (es. 01/2026):");
    if (invNumber === null) return;
    if (!invNumber.trim()) {
      toast.error("Numero fattura non valido");
      return;
    }

    setSaving(true);
    try {
      const invoicePayload = {
        type: "fattura",
        docNumber: invNumber,
        docDate: new Date().toISOString().slice(0, 10),
        customer,
        items,
        notes: `Fattura differita riferita a DDT N° ${docNumber} del ${safeFormatDate(docDate)}\n${notes}`,
        subtotal,
        vatTotal,
        total,
      };

      const newInvoice = await base44.entities.Document.create(invoicePayload);
      await base44.entities.Document.update(loadedId, {
        invoice_issued: true,
        linked_invoice_id: newInvoice.id,
        linked_invoice_number: invNumber,
      });

      setInvoiceIssued(true);
      setLinkedInvoiceNumber(invNumber);
      toast.success("Fattura differita emessa con successo!");
      await loadDocs();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'emissione della fattura");
    } finally {
      setSaving(false);
    }
  };

  const handleEmitReceipt = async () => {
    if (loadedId === "new") {
      toast.error("Salva prima il DDT come definitivo prima di emettere lo scontrino");
      return;
    }
    if (!window.confirm("Confermi l'emissione dello scontrino per questo DDT?")) return;

    setSaving(true);
    try {
      const existingSales = await base44.entities.Sale.list();
      const todayStr = format(new Date(), "dd/MM/yyyy");
      const todaysSales = existingSales.filter(s => {
        if (!s.closed_at && !s.created_date) return false;
        return safeFormatDate(s.closed_at || s.created_date) === todayStr;
      });
      const dailyCount = todaysSales.length + 1;
      const dailyCountFormatted = dailyCount.toString().padStart(2, "0");
      const nextNum = `${dailyCountFormatted} del ${todayStr}`;

      const salePayload = {
        sale_number: nextNum,
        items,
        subtotal: total,
        discount: 0,
        vat_total: vatTotal,
        total,
        status: "closed",
        closed_at: new Date().toISOString(),
        linked_ddt_id: loadedId,
        linked_ddt_number: docNumber,
      };

      const newSale = await base44.entities.Sale.create(salePayload);
      await base44.entities.Document.update(loadedId, {
        receipt_issued: true,
        linked_sale_id: newSale.id,
        linked_sale_number: nextNum,
      });

      setReceiptIssued(true);
      setLinkedSaleNumber(nextNum);
      toast.success(`Scontrino #${nextNum} emesso con successo!`);
      await loadDocs();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'emissione dello scontrino");
    } finally {
      setSaving(false);
    }
  };

  // ── ANTEPRIMA STAMPA ──────────────────────────────────────────────────────
  if (preview) {
    return (
      <div className="space-y-4">
        {/* Barra comandi superiore (solo schermo) */}
        <div className="flex gap-2 print:hidden flex-wrap bg-card border border-border rounded-xl p-3 shadow-sm">
          <Button variant="outline" onClick={() => setPreview(false)} className="flex-1 rounded-xl font-semibold">
            ← Torna alla Modifica
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-[2] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            <Save className="w-4 h-4 mr-1" />{saving ? "Salvataggio..." : "Salva Definitivo"}
          </Button>
          <Button onClick={() => window.print()} className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
            <Printer className="w-4 h-4 mr-1" /> Stampa Ora
          </Button>
        </div>

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
              <p className="text-gray-600">{safeFormatDate(docDate)}</p>
            </div>
          </div>

          {/* Mittente / Destinatario */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {isPurchase ? (
              <>
                <div className="border border-gray-300 rounded-xl p-3">
                  <p className="font-bold text-xs uppercase text-gray-500 mb-2">Fornitore</p>
                  <p className="font-bold">{selectedSupplier?.name || supplierNameInput || "—"}</p>
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
                  {customer.sdi && <p>Cod. Univoco: {customer.sdi}</p>}
                </div>
                <div className="col-span-2 border border-gray-300 rounded-xl p-3">
                  <p className="font-bold text-xs uppercase text-gray-500 mb-1">Sede di Destinazione della Merce</p>
                  <p className="font-medium">
                    {customer.destination || [customer.address, customer.city].filter(Boolean).join(" - ") || "Stessa sede del destinatario"}
                  </p>
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
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-400 italic">
                    Nessun articolo inserito
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-2 pr-2 font-medium">{item.description}</td>
                    <td className="py-2 pr-2 text-gray-400 text-xs">{item.barcode}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    {!isDDT && <td className="py-2 text-right">€{(Number(item.unit_price) || 0).toFixed(2)}</td>}
                    {isFattura && <td className="py-2 text-right">{item.vat_rate || 22}%</td>}
                    {!isDDT && <td className="py-2 text-right font-semibold">€{(Number(item.total) || 0).toFixed(2)}</td>}
                  </tr>
                ))
              )}
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

          {/* Pulsanti inferiori (solo schermo) */}
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
      </div>
    );
  }

  // ── EDITOR ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 print:hidden">
      {/* Selettore documento esistente */}
      <div className="bg-secondary/10 rounded-xl border border-secondary/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="font-bold text-secondary text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Gestione {docLabel}
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              <Save className="w-4 h-4 mr-1" /> {saving ? "..." : "Salva"}
            </Button>
            <Button
              size="sm"
              onClick={handleOpenPreview}
              className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold"
            >
              <Printer className="w-4 h-4 mr-1" /> Visualizza & Stampa
            </Button>
          </div>
        </div>
        <Select value={loadedId} onValueChange={handleSelectDoc}>
          <SelectTrigger className="w-full bg-background font-medium">
            <SelectValue placeholder="Seleziona documento..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new" className="font-bold text-primary">➕ Crea Nuovo {docLabel}</SelectItem>
            {existingDocs.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {isPurchase
                  ? `N° ${d.invoice_number || "—"} – ${d.supplier_name || "?"} (${d.invoice_date ? safeFormatDate(d.invoice_date) : ""})`
                  : `N° ${d.docNumber || "—"} – ${d.customer?.name || "?"} (${d.docDate ? safeFormatDate(d.docDate) : ""})`
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
          <div className="space-y-3 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="font-semibold">Fornitore</Label>
              <div className="flex items-center gap-2">
                {selectedSupplier && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8 text-xs"
                    onClick={() => { setEditingSupplier(selectedSupplier); setShowSupplierForm(true); }}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" /> Modifica Fornitore
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl h-8 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
                  onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> + Nuovo Fornitore
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Seleziona da rubrica fornitori ({suppliers.length})</Label>
                <Select value={selectedSupplierId || undefined} onValueChange={handleSelectSupplier}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Seleziona fornitore dall'elenco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.company ? ` – ${s.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Label className="text-xs text-muted-foreground">Oppure scrivi / cerca Nome Fornitore</Label>
                <Input
                  value={supplierNameInput}
                  onChange={e => {
                    setSupplierNameInput(e.target.value);
                    const exact = suppliers.find(s => (s.name || "").toLowerCase() === e.target.value.trim().toLowerCase());
                    setSelectedSupplierId(exact ? exact.id : "");
                  }}
                  placeholder="Scrivi nome fornitore..."
                  className="rounded-xl mt-1"
                />
                {filteredSuppliers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto p-1">
                    {filteredSuppliers.map(s => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => handleSelectSupplier(s.id)}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center justify-between"
                      >
                        <span className="font-medium truncate">{s.name}</span>
                        {s.company && <span className="text-xs text-muted-foreground ml-2 truncate">{s.company}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

      {/* Ricerca e inserimento articoli */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Articoli ({items.length})
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-semibold"
              onClick={handleAddManualRow}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Riga Manuale
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl h-8 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
              onClick={() => {
                setPrefillArticle({
                  supplier_id: selectedSupplierId || "",
                  supplier_name: selectedSupplier?.name || supplierNameInput || "",
                });
                setShowArticleForm(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> + Nuovo Articolo
            </Button>
          </div>
        </div>

        {/* Selettore rapido da menu a tendina + Ricerca / Barcode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Seleziona articolo dal catalogo ({articles.length})</Label>
            <Select
              key={articleSelectKey}
              onValueChange={(artId) => {
                const a = articles.find(x => x.id === artId);
                if (a) {
                  addArticleToItems(a);
                  toast.success(`"${a.description}" aggiunto`);
                }
                setArticleSelectKey(k => k + 1);
              }}
            >
              <SelectTrigger className="rounded-xl mt-1">
                <SelectValue placeholder="Scegli un articolo dall'elenco..." />
              </SelectTrigger>
              <SelectContent>
                {articles.slice(0, 200).map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.description} {a.barcode ? `(${a.barcode})` : ""} – €{Number(isPurchase ? a.purchase_price : a.sale_price || 0).toFixed(2)} [Giac: {a.quantity || 0}]
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Oppure cerca per nome / scansiona barcode</Label>
            <form onSubmit={handleAddByBarcode} className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={barcodeSearch}
                  onChange={e => setBarcodeSearch(e.target.value)}
                  placeholder="Cerca per nome o codice a barre..."
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button type="submit" className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
                Aggiungi
              </Button>
            </form>
          </div>
        </div>

        {barcodeSearch.trim() && (
          <div className="border border-border rounded-xl max-h-48 overflow-y-auto p-1 bg-background space-y-1">
            {filteredArticles.map(a => (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  addArticleToItems(a);
                  toast.success(`"${a.description}" aggiunto`);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center justify-between"
              >
                <span className="truncate font-medium">{a.description}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {a.barcode} · €{Number(isPurchase ? a.purchase_price : a.sale_price || 0).toFixed(2)} (Giac: {a.quantity || 0})
                </span>
              </button>
            ))}
            {filteredArticles.length === 0 && (
              <div className="p-2 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Nessun articolo trovato per "{barcodeSearch}"</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs"
                    onClick={handleAddManualRow}
                  >
                    + Inserisci "{barcodeSearch}" come riga in fattura
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    onClick={() => {
                      const code = barcodeSearch.trim();
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
                    + Crea "{barcodeSearch}" in Catalogo Articoli
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista articoli aggiunti */}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-xl p-3 flex-wrap sm:flex-nowrap border border-border/60">
              <div className="flex-1 min-w-[160px]">
                <Input
                  value={item.description}
                  onChange={e => updateDescription(idx, e.target.value)}
                  placeholder="Descrizione articolo..."
                  className="h-8 text-sm font-medium bg-background rounded-lg"
                />
                {item.barcode && <p className="text-xs text-muted-foreground mt-0.5 px-1">{item.barcode}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQty(idx, -1)}
                  className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center font-bold text-sm"
                >
                  −
                </button>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => setExactQty(idx, e.target.value)}
                  className="w-14 h-8 text-center font-bold text-sm rounded-lg px-1 bg-background"
                />
                <button
                  type="button"
                  onClick={() => updateQty(idx, 1)}
                  className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  step="0.01"
                  value={item.unit_price}
                  onChange={e => updatePrice(idx, e.target.value)}
                  className="h-8 text-sm text-right rounded-lg bg-background"
                  title="Prezzo unitario (€)"
                />
              </div>
              <span className="font-bold text-sm w-16 text-right">
                €{(Number(item.total) || 0).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 hover:bg-destructive/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Totali */}
      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 text-sm space-y-1">
          {isFattura && (
            <>
              <div className="flex justify-between text-muted-foreground"><span>Imponibile</span><span>€{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>€{vatTotal.toFixed(2)}</span></div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>{isDDT ? "Valore Totale Merce (per eventuale Fattura/Scontrino)" : "Totale"}</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="bg-card rounded-xl border border-border p-4">
        <Label>Note</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Note aggiuntive..." className="rounded-xl mt-1" />
      </div>

      {isDDT && loadedId !== "new" && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="font-bold text-sm text-card-foreground">Collegamenti / Emissione Differita</p>
          {invoiceIssued ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl p-3 text-sm font-semibold">
              ✓ Fattura Differita Emessa (N° {linkedInvoiceNumber})
            </div>
          ) : receiptIssued ? (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl p-3 text-sm font-semibold">
              ✓ Scontrino Emesso (N° {linkedSaleNumber})
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleEmitInvoice} variant="outline" className="rounded-xl border-secondary/40 text-secondary hover:bg-secondary/10 font-bold h-12">
                <FileText className="w-4 h-4 mr-2" /> Emetti Fattura
              </Button>
              <Button onClick={handleEmitReceipt} variant="outline" className="rounded-xl border-primary/40 text-primary hover:bg-primary/10 font-bold h-12">
                <ShoppingCart className="w-4 h-4 mr-2" /> Emetti Scontrino
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold shadow-xl"
        >
          <Save className="w-5 h-5 mr-2" /> {saving ? "Salvataggio..." : "Salva"}
        </Button>
        <Button
          onClick={handleOpenPreview}
          className="flex-1 h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-base font-bold shadow-xl"
        >
          <Printer className="w-5 h-5 mr-2" /> Visualizza & Stampa
        </Button>
      </div>

      {/* Modale Nuovo / Modifica Fornitore */}
      {showSupplierForm && (
        <SupplierForm
          supplier={editingSupplier}
          onSave={handleSupplierSaved}
          onClose={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
        />
      )}

      {/* Modale Nuovo Articolo */}
      {showArticleForm && (
        <ArticleForm
          article={prefillArticle}
          fromPurchaseInvoice={isPurchase}
          onSave={handleArticleSaved}
          onClose={() => { setShowArticleForm(false); setPrefillArticle(null); }}
        />
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
