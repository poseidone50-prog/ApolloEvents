import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  History as HistoryIcon, ShoppingCart, Truck, ChevronDown, ChevronUp,
  Trash2, Edit, Users, ScrollText, Search, FileText, PackagePlus, Printer
} from "lucide-react";
import ContractEditModal from "../components/ContractEditModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import SaleEditModal from "../components/SaleEditModal";
import PurchaseEditModal from "../components/PurchaseEditModal";
import DDTEditModal from "../components/DDTEditModal";

const LOGO = "/logo.png";
const years = Array.from({ length: 2036 - 2019 }, (_, i) => String(2020 + i));
const months = [
  { value: "1", label: "Gennaio" }, { value: "2", label: "Febbraio" },
  { value: "3", label: "Marzo" }, { value: "4", label: "Aprile" },
  { value: "5", label: "Maggio" }, { value: "6", label: "Giugno" },
  { value: "7", label: "Luglio" }, { value: "8", label: "Agosto" },
  { value: "9", label: "Settembre" }, { value: "10", label: "Ottobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Dicembre" },
];

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

function DateFilters({ day, month, year, setDay, setMonth, setYear }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Input type="number" placeholder="Giorno" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} className="rounded-xl" />
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Mese" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i mesi</SelectItem>
          {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Anno" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli anni</SelectItem>
          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function filterByDate(items, dateField, day, month, year) {
  return items.filter(item => {
    const d = new Date(item[dateField] || item.created_date);
    if (isNaN(d.getTime())) return true;
    if (day && String(d.getDate()) !== day) return false;
    if (month !== "all" && String(d.getMonth() + 1) !== month) return false;
    if (year !== "all" && String(d.getFullYear()) !== year) return false;
    return true;
  });
}

function SaleCard({ sale, onDelete, onEdit, onPrint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Vendita #{sale.sale_number}</p>
            <p className="text-xs text-muted-foreground">{safeFormatDate(sale.closed_at || sale.created_date, "dd/MM/yyyy HH:mm")} · {(sale.items || []).length} articoli</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">€{(Number(sale.total) || 0).toFixed(2)}</span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {(sale.items || []).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x €{(Number(item.unit_price) || 0).toFixed(2)}</p>
              </div>
              <span className="font-semibold">€{(Number(item.total) || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">IVA</span><span>€{(Number(sale.vat_total) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold"><span>Totale</span><span>€{(Number(sale.total) || 0).toFixed(2)}</span></div>
          <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
            {onPrint && (
              <Button variant="outline" size="sm" className="flex-1 bg-secondary/10 hover:bg-secondary/20 border-secondary/30 font-semibold" onClick={() => onPrint(sale)}>
                <Printer className="w-3 h-3 mr-1" /> Visualizza & Stampa
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(sale)}>
              <Edit className="w-3 h-3 mr-1" /> Modifica
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(sale)}>
              <Trash2 className="w-3 h-3 mr-1" /> Elimina
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseCard({ purchase, onDelete, onEdit, onPrint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{purchase.supplier_name || "Fornitore"}</p>
            <p className="text-xs text-muted-foreground">
              {purchase.invoice_number ? `Fatt. N° ${purchase.invoice_number} · ` : ""}
              {safeFormatDate(purchase.invoice_date || purchase.created_date)} · {(purchase.items || []).length} articoli
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">€{(Number(purchase.total) || 0).toFixed(2)}</span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {purchase.invoice_number && (
            <p className="text-xs text-muted-foreground">Fattura N° {purchase.invoice_number}</p>
          )}
          {(purchase.items || []).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x €{(Number(item.unit_price) || 0).toFixed(2)}</p>
              </div>
              <span className="font-semibold">€{(Number(item.total) || 0).toFixed(2)}</span>
            </div>
          ))}
          {purchase.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{purchase.notes}</p>}
          <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
            {onPrint && (
              <Button variant="outline" size="sm" className="flex-1 bg-secondary/10 hover:bg-secondary/20 border-secondary/30 font-semibold" onClick={() => onPrint(purchase)}>
                <Printer className="w-3 h-3 mr-1" /> Visualizza & Stampa
              </Button>
            )}
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(purchase)}>
              <Edit className="w-3 h-3 mr-1" /> Modifica
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(purchase)}>
              <Trash2 className="w-3 h-3 mr-1" /> Elimina
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DdtCard({ ddt, onDelete, onEdit, onEmitInvoice, onEmitReceipt, onPrint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">DDT N° {ddt.docNumber || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {safeFormatDate(ddt.docDate || ddt.created_date)} · Dest: {ddt.customer?.name || "N/A"} · {(ddt.items || []).length} articoli
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">€{(Number(ddt.total) || 0).toFixed(2)}</span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {ddt.customer?.destination && (
            <p className="text-xs text-muted-foreground"><span className="font-semibold">Sede di Destinazione:</span> {ddt.customer.destination}</p>
          )}
          {ddt.causale && <p className="text-xs text-muted-foreground"><span className="font-semibold">Causale:</span> {ddt.causale}</p>}
          {ddt.vettore && <p className="text-xs text-muted-foreground"><span className="font-semibold">Vettore:</span> {ddt.vettore}</p>}

          <div className="space-y-1.5 my-2">
            {(ddt.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x</p>
                </div>
                <span className="font-semibold">€{(Number(item.total) || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {ddt.notes && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2 whitespace-pre-line">
              <span className="font-semibold">Note:</span> {ddt.notes}
            </p>
          )}

          <div className="flex flex-col gap-1 py-1 border-t border-border mt-2">
            {ddt.invoice_issued ? (
              <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
                ✓ Fattura Differita Emessa (N° {ddt.linked_invoice_number})
              </p>
            ) : ddt.receipt_issued ? (
              <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
                ✓ Scontrino Emesso (N° {ddt.linked_sale_number})
              </p>
            ) : (
              <p className="text-xs text-amber-500 font-semibold">
                Da fatturare / scontrinare
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
            {onPrint && (
              <Button variant="outline" size="sm" className="flex-1 bg-secondary/10 hover:bg-secondary/20 border-secondary/30 font-semibold" onClick={() => onPrint(ddt)}>
                <Printer className="w-3 h-3 mr-1" /> Visualizza & Stampa
              </Button>
            )}
            {!ddt.invoice_issued && !ddt.receipt_issued && (
              <>
                <Button variant="outline" size="sm" className="flex-1 bg-secondary/10 hover:bg-secondary/20 border-secondary/30" onClick={() => onEmitInvoice(ddt)}>
                  <FileText className="w-3 h-3 mr-1" /> Emetti Fattura
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-primary/10 hover:bg-primary/20 border-primary/30" onClick={() => onEmitReceipt(ddt)}>
                  <ShoppingCart className="w-3 h-3 mr-1" /> Emetti Scontrino
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(ddt)}>
              <Edit className="w-3 h-3 mr-1" /> Modifica
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(ddt)}>
              <Trash2 className="w-3 h-3 mr-1" /> Elimina
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function History() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [ddts, setDdts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSale, setEditingSale] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [editingDdt, setEditingDdt] = useState(null);
  const [editingContract, setEditingContract] = useState(null);
  const [printingDoc, setPrintingDoc] = useState(null); // { kind: "ddt" | "purchase" | "sale", data }

  // Contract search filters
  const [cSearch, setCSearch] = useState("");
  const [cDay, setCDay] = useState(""); const [cMonth, setCMonth] = useState("all"); const [cYear, setCYear] = useState("all");
  // Universal search
  const [globalSearch, setGlobalSearch] = useState("");

  // Sale filters
  const [sSearch, setSSearch] = useState("");
  const [sDay, setSDay] = useState(""); const [sMonth, setSMonth] = useState("all"); const [sYear, setSYear] = useState("all");
  // Purchase filters
  const [pSearch, setPSearch] = useState("");
  const [pDay, setPDay] = useState(""); const [pMonth, setPMonth] = useState("all"); const [pYear, setPYear] = useState("all");
  // DDT filters
  const [dSearch, setDSearch] = useState("");
  const [dDay, setDDay] = useState(""); const [dMonth, setDMonth] = useState("all"); const [dYear, setDYear] = useState("all");

  const loadData = async () => {
    setLoading(true);
    const [s, p, arts, sups, conts, docs] = await Promise.all([
      base44.entities.Sale.filter({ status: "closed" }, "-created_date", 500),
      base44.entities.Purchase.list("-created_date", 500),
      base44.entities.Article.list("-updated_date", 500),
      base44.entities.Supplier.list(),
      base44.entities.Contract.list("-created_date", 500),
      base44.entities.Document.filter({ type: "ddt" }, "-created_date", 500),
    ]);
    setSales(s); setPurchases(p); setAllArticles(arts); setSuppliers(sups); setContracts(conts); setDdts(docs);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteSale = async (sale) => {
    if (!window.confirm(`Eliminare la vendita #${sale.sale_number}? Le quantità verranno ripristinate.`)) return;
    if (sale.linked_ddt_id) {
      await base44.entities.Document.update(sale.linked_ddt_id, {
        receipt_issued: false,
        linked_sale_id: "",
        linked_sale_number: "",
      }).catch(() => {});
    } else {
      for (const item of (sale.items || [])) {
        const art = allArticles.find(a => a.id === item.article_id || (item.barcode && a.barcode === item.barcode));
        if (art) {
          await base44.entities.Article.update(art.id, {
            quantity: (Number(art.quantity) || 0) + (Number(item.quantity) || 0),
          });
        }
      }
    }
    await base44.entities.Sale.delete(sale.id);
    toast.success("Vendita eliminata e magazzino ripristinato");
    loadData();
  };

  const handleDeleteDdt = async (ddt) => {
    if (!window.confirm(`Eliminare il DDT N° ${ddt.docNumber || "—"}? Le quantità verranno ripristinate.`)) return;

    for (const item of (ddt.items || [])) {
      const art = allArticles.find(a => a.id === item.article_id || (item.barcode && a.barcode === item.barcode));
      if (art) {
        await base44.entities.Article.update(art.id, {
          quantity: (Number(art.quantity) || 0) + (Number(item.quantity) || 0),
        });
      }
    }

    await base44.entities.Document.delete(ddt.id);
    toast.success("DDT eliminato e magazzino ripristinato");
    loadData();
  };

  const handleEmitInvoiceForDdt = async (ddt) => {
    const invNumber = window.prompt("Inserisci il numero della fattura da generare (es. 01/2026):");
    if (invNumber === null) return;
    if (!invNumber.trim()) {
      toast.error("Numero fattura non valido");
      return;
    }

    setLoading(true);
    try {
      const invoicePayload = {
        type: "fattura",
        docNumber: invNumber,
        docDate: new Date().toISOString().slice(0, 10),
        customer: ddt.customer,
        items: ddt.items,
        notes: `Fattura differita riferita a DDT N° ${ddt.docNumber} del ${safeFormatDate(ddt.docDate)}\n${ddt.notes || ""}`,
        subtotal: ddt.subtotal || ddt.total,
        vatTotal: ddt.vatTotal || 0,
        total: ddt.total,
      };

      const newInvoice = await base44.entities.Document.create(invoicePayload);
      await base44.entities.Document.update(ddt.id, {
        invoice_issued: true,
        linked_invoice_id: newInvoice.id,
        linked_invoice_number: invNumber,
      });

      toast.success("Fattura differita emessa con successo!");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'emissione della fattura");
      setLoading(false);
    }
  };

  const handleEmitReceiptForDdt = async (ddt) => {
    if (!window.confirm("Confermi l'emissione dello scontrino per questo DDT?")) return;

    setLoading(true);
    try {
      const todayStr = format(new Date(), "dd/MM/yyyy");
      const todaysSales = sales.filter(s => {
        if (!s.closed_at && !s.created_date) return false;
        return safeFormatDate(s.closed_at || s.created_date) === todayStr;
      });
      const dailyCount = todaysSales.length + 1;
      const dailyCountFormatted = dailyCount.toString().padStart(2, "0");
      const nextNum = `${dailyCountFormatted} del ${todayStr}`;

      const salePayload = {
        sale_number: nextNum,
        items: ddt.items,
        subtotal: ddt.total,
        discount: 0,
        vat_total: ddt.vatTotal || 0,
        total: ddt.total,
        status: "closed",
        closed_at: new Date().toISOString(),
        linked_ddt_id: ddt.id,
        linked_ddt_number: ddt.docNumber,
      };

      const newSale = await base44.entities.Sale.create(salePayload);
      await base44.entities.Document.update(ddt.id, {
        receipt_issued: true,
        linked_sale_id: newSale.id,
        linked_sale_number: nextNum,
      });

      toast.success(`Scontrino #${nextNum} emesso con successo!`);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'emissione dello scontrino");
      setLoading(false);
    }
  };

  const handleDeletePurchase = async (purchase) => {
    if (!window.confirm(`Eliminare la fattura d'acquisto ${purchase.invoice_number ? `N° ${purchase.invoice_number}` : ""}? Le quantità caricate verranno scalate dal magazzino.`)) return;

    for (const item of (purchase.items || [])) {
      const art = allArticles.find(a => a.id === item.article_id || (item.barcode && a.barcode === item.barcode));
      if (art) {
        await base44.entities.Article.update(art.id, {
          quantity: Math.max(0, (Number(art.quantity) || 0) - (Number(item.quantity) || 0)),
        });
      }
    }

    await base44.entities.Purchase.delete(purchase.id);
    toast.success("Fattura d'acquisto eliminata e giacenze aggiornate");
    loadData();
  };

  const handleDeleteContract = async (contract) => {
    if (!window.confirm("Eliminare questo contratto?")) return;
    await base44.entities.Contract.delete(contract.id);
    toast.success("Contratto eliminato");
    loadData();
  };

  const filteredSales = filterByDate(sales, "closed_at", sDay, sMonth, sYear).filter(s => {
    if (!sSearch) return true;
    const q = sSearch.toLowerCase();
    return String(s.sale_number || "").toLowerCase().includes(q) ||
           (s.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q));
  });
  const filteredPurchases = filterByDate(purchases, "created_date", pDay, pMonth, pYear).filter(p => {
    if (!pSearch) return true;
    const q = pSearch.toLowerCase();
    return (p.supplier_name || "").toLowerCase().includes(q) ||
           (p.invoice_number || "").toLowerCase().includes(q) ||
           (p.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q));
  });
  const filteredDdts = filterByDate(ddts, "docDate", dDay, dMonth, dYear).filter(d => {
    if (!dSearch) return true;
    const q = dSearch.toLowerCase();
    return String(d.docNumber || "").toLowerCase().includes(q) ||
           (d.customer?.name || "").toLowerCase().includes(q) ||
           (d.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q));
  });
  const filteredContracts = filterByDate(contracts, "contract_date", cDay, cMonth, cYear).filter(c => {
    if (!cSearch) return true;
    return (c.customer_name || "").toLowerCase().includes(cSearch.toLowerCase()) ||
      (c.contract_number || "").toLowerCase().includes(cSearch.toLowerCase()) ||
      (c.event_location || "").toLowerCase().includes(cSearch.toLowerCase());
  });

  // Universal search across all entities
  const q = globalSearch.toLowerCase().trim();
  const globalResults = q ? [
    ...sales.filter(s =>
      String(s.sale_number || "").toLowerCase().includes(q) ||
      (s.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q))
    ).map(s => ({ ...s, _type: "sale" })),
    ...purchases.filter(p =>
      (p.supplier_name || "").toLowerCase().includes(q) ||
      (p.invoice_number || "").toLowerCase().includes(q) ||
      (p.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q))
    ).map(p => ({ ...p, _type: "purchase" })),
    ...ddts.filter(d =>
      (d.customer?.name || "").toLowerCase().includes(q) ||
      String(d.docNumber || "").toLowerCase().includes(q) ||
      (d.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").toLowerCase().includes(q))
    ).map(d => ({ ...d, _type: "ddt" })),
    ...contracts.filter(c =>
      (c.customer_name || "").toLowerCase().includes(q) ||
      (c.contract_number || "").toLowerCase().includes(q) ||
      (c.event_location || "").toLowerCase().includes(q)
    ).map(c => ({ ...c, _type: "contract" })),
    ...suppliers.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.company || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q)
    ).map(s => ({ ...s, _type: "supplier" })),
  ] : [];

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-secondary rounded-full animate-spin" />
    </div>
  );

  // ── ANTEPRIMA STAMPA DA STORICO (DDT / FATTURA ACQUISTO / RICEVUTA VENDITA) ──
  if (printingDoc) {
    const { kind, data } = printingDoc;
    const isDDT = kind === "ddt";
    const isPurchase = kind === "purchase";
    const isSale = kind === "sale";
    const supplierObj = isPurchase ? suppliers.find(s => s.id === data.supplier_id) : null;
    const cust = data.customer || {};
    const docItems = data.items || [];
    const docTotal = docItems.reduce((s, i) => s + (Number(i.total) || 0), 0);

    return (
      <div className="space-y-4 pb-20 md:pb-6 print:pb-0">
        <div className="flex gap-2 print:hidden flex-wrap bg-card border border-border rounded-xl p-3 shadow-sm">
          <Button variant="outline" onClick={() => setPrintingDoc(null)} className="flex-1 rounded-xl font-semibold">
            ← Torna allo Storico
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPrintingDoc(null);
              if (isDDT) setEditingDdt(data);
              else if (isPurchase) setEditingPurchase(data);
              else if (isSale) setEditingSale(data);
            }}
            className="flex-1 rounded-xl font-semibold"
          >
            <Edit className="w-4 h-4 mr-1" /> Modifica
          </Button>
          <Button onClick={() => window.print()} className="flex-[2] rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
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
              <p className="font-extrabold text-xl uppercase">
                {isDDT ? "DDT" : isPurchase ? "Fattura Acquisti" : "Ricevuta di Vendita"}
              </p>
              <p className="text-gray-600">
                N° {isDDT ? (data.docNumber || "—") : isPurchase ? (data.invoice_number || "—") : (data.sale_number || "—")}
              </p>
              <p className="text-gray-600">
                {safeFormatDate(isDDT ? (data.docDate || data.created_date) : isPurchase ? (data.invoice_date || data.created_date) : (data.closed_at || data.created_date))}
              </p>
            </div>
          </div>

          {/* Mittente / Destinatario */}
          {!isSale && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              {isPurchase ? (
                <>
                  <div className="border border-gray-300 rounded-xl p-3">
                    <p className="font-bold text-xs uppercase text-gray-500 mb-2">Fornitore</p>
                    <p className="font-bold">{supplierObj?.name || data.supplier_name || "—"}</p>
                    {supplierObj?.company && <p>{supplierObj.company}</p>}
                    {supplierObj?.address && <p>{supplierObj.address}</p>}
                    {supplierObj?.vat_number && <p>P.IVA: {supplierObj.vat_number}</p>}
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
                    <p className="font-bold">{cust.name || "—"}</p>
                    {cust.address && <p>{cust.address}</p>}
                    {cust.city && <p>{cust.city}</p>}
                    {cust.vat && <p>P.IVA: {cust.vat}</p>}
                    {cust.fiscal && <p>C.F.: {cust.fiscal}</p>}
                    {cust.sdi && <p>Cod. Univoco: {cust.sdi}</p>}
                  </div>
                  <div className="col-span-2 border border-gray-300 rounded-xl p-3">
                    <p className="font-bold text-xs uppercase text-gray-500 mb-1">Sede di Destinazione della Merce</p>
                    <p className="font-medium">
                      {cust.destination || [cust.address, cust.city].filter(Boolean).join(" - ") || "Stessa sede del destinatario"}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {isDDT && (data.causale || data.vettore) && (
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm border border-gray-200 rounded-xl p-3">
              {data.causale && <p><span className="font-semibold">Causale:</span> {data.causale}</p>}
              {data.vettore && <p><span className="font-semibold">Vettore:</span> {data.vettore}</p>}
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
                {!isDDT && <th className="text-right py-2 font-bold">Totale</th>}
              </tr>
            </thead>
            <tbody>
              {docItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 pr-2 font-medium">{item.description}</td>
                  <td className="py-2 pr-2 text-gray-400 text-xs">{item.barcode}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  {!isDDT && <td className="py-2 text-right">€{(Number(item.unit_price) || 0).toFixed(2)}</td>}
                  {!isDDT && <td className="py-2 text-right font-semibold">€{(Number(item.total) || 0).toFixed(2)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {!isDDT && (
            <div className="text-right space-y-1 text-sm mb-6 border-t-2 border-black pt-3">
              <div className="flex justify-end gap-8 font-extrabold text-lg">
                <span>TOTALE</span>
                <span>€{(Number(data.total) || docTotal).toFixed(2)}</span>
              </div>
            </div>
          )}

          {data.notes && (
            <div className="border border-gray-200 rounded-xl p-3 mb-6 text-xs text-gray-600">
              <p className="font-semibold mb-1">Note:</p>
              <p className="whitespace-pre-line">{data.notes}</p>
            </div>
          )}

          {!isSale && (
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
          )}

          <div className="flex gap-2 mt-6 print:hidden flex-wrap">
            <Button variant="outline" onClick={() => setPrintingDoc(null)} className="flex-1 rounded-xl">← Indietro</Button>
            <Button onClick={() => window.print()} className="flex-[2] rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
        <HistoryIcon className="w-6 h-6 text-secondary" />
        Storico
      </h1>

      <Tabs defaultValue="sales">
        <TabsList className="w-full rounded-xl grid grid-cols-5">
          <TabsTrigger value="sales" className="rounded-lg text-xs"><ShoppingCart className="w-3 h-3 mr-1" />Vendite</TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-lg text-xs"><PackagePlus className="w-3 h-3 mr-1" />Acquisti</TabsTrigger>
          <TabsTrigger value="ddts" className="rounded-lg text-xs"><Truck className="w-3 h-3 mr-1" />DDT</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg text-xs"><ScrollText className="w-3 h-3 mr-1" />Contratti</TabsTrigger>
          <TabsTrigger value="search" className="rounded-lg text-xs"><Users className="w-3 h-3 mr-1" />Ricerca</TabsTrigger>
        </TabsList>

        {/* VENDITE */}
        <TabsContent value="sales" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={sSearch} onChange={e => setSSearch(e.target.value)} placeholder="Cerca in vendite (N° ricevuta, articolo, barcode...)" className="pl-9 rounded-xl h-11 bg-background" />
          </div>
          <DateFilters day={sDay} month={sMonth} year={sYear} setDay={setSDay} setMonth={setSMonth} setYear={setSYear} />
          <div className="bg-card rounded-xl p-3 border border-border flex justify-between text-sm">
            <span className="text-muted-foreground">{filteredSales.length} vendite</span>
            <span className="font-bold">Totale: €{filteredSales.reduce((s, v) => s + (Number(v.total) || 0), 0).toFixed(2)}</span>
          </div>
          {filteredSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessuna vendita trovata</p>
          ) : filteredSales.map(sale => (
            <SaleCard
              key={sale.id}
              sale={sale}
              onDelete={handleDeleteSale}
              onEdit={setEditingSale}
              onPrint={(s) => { setPrintingDoc({ kind: "sale", data: s }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          ))}
        </TabsContent>

        {/* ACQUISTI */}
        <TabsContent value="purchases" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={pSearch} onChange={e => setPSearch(e.target.value)} placeholder="Cerca in acquisti (fornitore, fattura, articolo...)" className="pl-9 rounded-xl h-11 bg-background" />
          </div>
          <DateFilters day={pDay} month={pMonth} year={pYear} setDay={setPDay} setMonth={setPMonth} setYear={setPYear} />
          <div className="bg-card rounded-xl p-3 border border-border flex justify-between text-sm">
            <span className="text-muted-foreground">{filteredPurchases.length} acquisti</span>
            <span className="font-bold">Totale: €{filteredPurchases.reduce((s, v) => s + (Number(v.total) || 0), 0).toFixed(2)}</span>
          </div>
          {filteredPurchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun acquisto trovato</p>
          ) : filteredPurchases.map(p => (
            <PurchaseCard
              key={p.id}
              purchase={p}
              onDelete={handleDeletePurchase}
              onEdit={setEditingPurchase}
              onPrint={(pur) => { setPrintingDoc({ kind: "purchase", data: pur }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          ))}
        </TabsContent>

        {/* DDT */}
        <TabsContent value="ddts" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={dSearch} onChange={e => setDSearch(e.target.value)} placeholder="Cerca in DDT (N° documento, destinatario, articolo...)" className="pl-9 rounded-xl h-11 bg-background" />
          </div>
          <DateFilters day={dDay} month={dMonth} year={dYear} setDay={setDDay} setMonth={setDMonth} setYear={setDYear} />
          <div className="bg-card rounded-xl p-3 border border-border flex justify-between text-sm">
            <span className="text-muted-foreground">{filteredDdts.length} DDT</span>
            <span className="font-bold">Totale: €{filteredDdts.reduce((s, v) => s + (Number(v.total) || 0), 0).toFixed(2)}</span>
          </div>
          {filteredDdts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun DDT trovato</p>
          ) : filteredDdts.map(ddt => (
            <DdtCard
              key={ddt.id}
              ddt={ddt}
              onDelete={handleDeleteDdt}
              onEdit={setEditingDdt}
              onEmitInvoice={handleEmitInvoiceForDdt}
              onEmitReceipt={handleEmitReceiptForDdt}
              onPrint={(d) => { setPrintingDoc({ kind: "ddt", data: d }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          ))}
        </TabsContent>

        {/* CONTRATTI */}
        <TabsContent value="contracts" className="space-y-3 mt-4">
          <Input value={cSearch} onChange={e => setCSearch(e.target.value)} placeholder="Cerca per cliente, N°, luogo..." className="rounded-xl" />
          <DateFilters day={cDay} month={cMonth} year={cYear} setDay={setCDay} setMonth={setCMonth} setYear={setCYear} />
          <div className="bg-card rounded-xl p-3 border border-border text-sm text-muted-foreground">{filteredContracts.length} contratti trovati</div>
          {filteredContracts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun contratto trovato</p>
          ) : filteredContracts.map(c => (
            <div key={c.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{c.customer_name}</p>
                  <p className="text-xs text-muted-foreground">N° {c.contract_number || "—"} · {c.contract_date ? safeFormatDate(c.contract_date) : ""}</p>
                  {c.event_location && <p className="text-xs text-muted-foreground">{c.event_location}{c.event_date ? ` – ${safeFormatDate(c.event_date)}` : ""}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold">€{(Number(c.total) || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Acc: €{(Number(c.deposit) || 0).toFixed(2)}</p>
                  <div className="flex gap-1 mt-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditingContract(c)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteContract(c)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* RICERCA UNIVERSALE */}
        <TabsContent value="search" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Cerca in vendite, acquisti, DDT, contratti, fornitori..."
              className="pl-9 rounded-xl h-12 text-base"
            />
          </div>

          {!globalSearch && (
            <p className="text-center text-muted-foreground py-8 text-sm">Digita per cercare in tutti i dati</p>
          )}

          {globalSearch && globalResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nessun risultato trovato</p>
          )}

          {globalResults.length > 0 && (
            <div className="text-xs text-muted-foreground px-1">{globalResults.length} risultati</div>
          )}

          {globalResults.map((item) => {
            if (item._type === "sale") return (
              <SaleCard
                key={`sale-${item.id}`}
                sale={item}
                onDelete={handleDeleteSale}
                onEdit={setEditingSale}
                onPrint={(s) => { setPrintingDoc({ kind: "sale", data: s }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              />
            );
            if (item._type === "purchase") return (
              <PurchaseCard
                key={`pur-${item.id}`}
                purchase={item}
                onDelete={handleDeletePurchase}
                onEdit={setEditingPurchase}
                onPrint={(pur) => { setPrintingDoc({ kind: "purchase", data: pur }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              />
            );
            if (item._type === "ddt") return (
              <DdtCard
                key={`ddt-${item.id}`}
                ddt={item}
                onDelete={handleDeleteDdt}
                onEdit={setEditingDdt}
                onEmitInvoice={handleEmitInvoiceForDdt}
                onEmitReceipt={handleEmitReceiptForDdt}
                onPrint={(d) => { setPrintingDoc({ kind: "ddt", data: d }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              />
            );
            if (item._type === "contract") return (
              <div key={`con-${item.id}`} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{item.customer_name}</p>
                    <p className="text-xs text-muted-foreground">N° {item.contract_number || "—"} · {item.contract_date ? safeFormatDate(item.contract_date) : ""}</p>
                    {item.event_location && <p className="text-xs text-muted-foreground">{item.event_location}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{(Number(item.total) || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Acc: €{(Number(item.deposit) || 0).toFixed(2)}</p>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingContract(item)}><Edit className="w-3 h-3" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteContract(item)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            );
            if (item._type === "supplier") return (
              <div key={`sup-${item.id}`} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    {item.company && <p className="text-xs text-muted-foreground">{item.company}</p>}
                    {item.city && <p className="text-xs text-muted-foreground">{item.city} {item.phone ? `· ${item.phone}` : ""}</p>}
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-lg text-muted-foreground">Fornitore</span>
                </div>
              </div>
            );
            return null;
          })}
        </TabsContent>
      </Tabs>

      {editingSale && (
        <SaleEditModal
          sale={editingSale}
          articles={allArticles}
          onClose={() => setEditingSale(null)}
          onSave={() => { setEditingSale(null); loadData(); }}
          onPreview={(s) => { setEditingSale(null); setPrintingDoc({ kind: "sale", data: s }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}
      {editingPurchase && (
        <PurchaseEditModal
          purchase={editingPurchase}
          articles={allArticles}
          suppliers={suppliers}
          onClose={() => setEditingPurchase(null)}
          onSave={() => { setEditingPurchase(null); loadData(); }}
          onPreview={(p) => { setEditingPurchase(null); setPrintingDoc({ kind: "purchase", data: p }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}
      {editingDdt && (
        <DDTEditModal
          ddt={editingDdt}
          articles={allArticles}
          onClose={() => setEditingDdt(null)}
          onSave={() => { setEditingDdt(null); loadData(); }}
          onPreview={(d) => { setEditingDdt(null); setPrintingDoc({ kind: "ddt", data: d }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}
      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSave={() => { setEditingContract(null); loadData(); }}
        />
      )}
    </div>
  );
}
