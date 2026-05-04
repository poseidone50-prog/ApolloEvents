import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { History as HistoryIcon, ShoppingCart, Truck, ChevronDown, ChevronUp, Trash2, Edit, Users, ScrollText, Search } from "lucide-react";
import ContractEditModal from "../components/ContractEditModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import SaleEditModal from "../components/SaleEditModal";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 2036 - 2019 }, (_, i) => String(2020 + i));
const months = [
  { value: "1", label: "Gennaio" }, { value: "2", label: "Febbraio" },
  { value: "3", label: "Marzo" }, { value: "4", label: "Aprile" },
  { value: "5", label: "Maggio" }, { value: "6", label: "Giugno" },
  { value: "7", label: "Luglio" }, { value: "8", label: "Agosto" },
  { value: "9", label: "Settembre" }, { value: "10", label: "Ottobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Dicembre" },
];

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
    if (day && String(d.getDate()) !== day) return false;
    if (month !== "all" && String(d.getMonth() + 1) !== month) return false;
    if (year !== "all" && String(d.getFullYear()) !== year) return false;
    return true;
  });
}

function SaleCard({ sale, allArticles, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const date = new Date(sale.closed_at || sale.created_date);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Vendita #{sale.sale_number}</p>
            <p className="text-xs text-muted-foreground">{format(date, "dd/MM/yyyy HH:mm", { locale: it })} · {(sale.items || []).length} articoli</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">€{(sale.total || 0).toFixed(2)}</span>
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
                <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x €{(item.unit_price || 0).toFixed(2)}</p>
              </div>
              <span className="font-semibold">€{(item.total || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">IVA</span><span>€{(sale.vat_total || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold"><span>Totale</span><span>€{(sale.total || 0).toFixed(2)}</span></div>
          <div className="flex gap-2 pt-2 border-t border-border">
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

function PurchaseCard({ purchase, onDelete }) {
  const [open, setOpen] = useState(false);
  const date = new Date(purchase.created_date);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{purchase.supplier_name || "Fornitore"}</p>
            <p className="text-xs text-muted-foreground">{format(date, "dd/MM/yyyy HH:mm", { locale: it })} · {(purchase.items || []).length} articoli</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">€{(purchase.total || 0).toFixed(2)}</span>
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
                <p className="text-xs text-muted-foreground">{item.barcode} · {item.quantity}x €{(item.unit_price || 0).toFixed(2)}</p>
              </div>
              <span className="font-semibold">€{(item.total || 0).toFixed(2)}</span>
            </div>
          ))}
          {purchase.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{purchase.notes}</p>}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(purchase)}>
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
  const [loading, setLoading] = useState(true);
  const [editingSale, setEditingSale] = useState(null);
  const [editingContract, setEditingContract] = useState(null);
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
  // Supplier/Article search filters
  const [searchSupplier, setSearchSupplier] = useState("all");
  const [searchArticle, setSearchArticle] = useState("");
  const [saDay, setSaDay] = useState(""); const [saMonth, setSaMonth] = useState("all"); const [saYear, setSaYear] = useState("all");

  const loadData = async () => {
    setLoading(true);
    const [s, p, arts, sups, conts] = await Promise.all([
      base44.entities.Sale.filter({ status: "closed" }, "-created_date", 500),
      base44.entities.Purchase.list("-created_date", 500),
      base44.entities.Article.list("-updated_date", 500),
      base44.entities.Supplier.list(),
      base44.entities.Contract.list("-created_date", 500),
    ]);
    setSales(s); setPurchases(p); setAllArticles(arts); setSuppliers(sups); setContracts(conts);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteSale = async (sale) => {
    if (!window.confirm(`Eliminare la vendita #${sale.sale_number}? Le quantità verranno ripristinate.`)) return;
    for (const item of (sale.items || [])) {
      const arts = await base44.entities.Article.filter({ barcode: item.barcode });
      if (arts.length > 0) await base44.entities.Article.update(arts[0].id, { quantity: (arts[0].quantity || 0) + item.quantity });
    }
    await base44.entities.Sale.delete(sale.id);
    toast.success("Vendita eliminata e magazzino ripristinato");
    loadData();
  };

  const handleDeletePurchase = async (purchase) => {
    if (!window.confirm("Eliminare questo acquisto?")) return;
    await base44.entities.Purchase.delete(purchase.id);
    toast.success("Acquisto eliminato");
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
      String(s.sale_number || "").includes(q) ||
      (s.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").includes(q))
    ).map(s => ({ ...s, _type: "sale" })),
    ...purchases.filter(p =>
      (p.supplier_name || "").toLowerCase().includes(q) ||
      (p.invoice_number || "").toLowerCase().includes(q) ||
      (p.items || []).some(i => (i.description || "").toLowerCase().includes(q) || (i.barcode || "").includes(q))
    ).map(p => ({ ...p, _type: "purchase" })),
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

  // Supplier/Article combined search on purchases
  const combinedPurchases = filterByDate(purchases, "created_date", saDay, saMonth, saYear).filter(p => {
    const matchSupplier = searchSupplier === "all" || p.supplier_id === searchSupplier;
    const matchArticle = !searchArticle || (p.items || []).some(i =>
      (i.description || "").toLowerCase().includes(searchArticle.toLowerCase()) ||
      (i.barcode || "").toLowerCase().includes(searchArticle.toLowerCase())
    );
    return matchSupplier && matchArticle;
  });

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-muted border-t-secondary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
        <HistoryIcon className="w-6 h-6 text-secondary" />
        Storico
      </h1>

      <Tabs defaultValue="sales">
        <TabsList className="w-full rounded-xl grid grid-cols-4">
          <TabsTrigger value="sales" className="rounded-lg text-xs"><ShoppingCart className="w-3 h-3 mr-1" />Vendite</TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-lg text-xs"><Truck className="w-3 h-3 mr-1" />Acquisti</TabsTrigger>
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
            <span className="font-bold">Totale: €{filteredSales.reduce((s, v) => s + (v.total || 0), 0).toFixed(2)}</span>
          </div>
          {filteredSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessuna vendita trovata</p>
          ) : filteredSales.map(sale => (
            <SaleCard key={sale.id} sale={sale} allArticles={allArticles} onDelete={handleDeleteSale} onEdit={setEditingSale} />
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
            <span className="font-bold">Totale: €{filteredPurchases.reduce((s, v) => s + (v.total || 0), 0).toFixed(2)}</span>
          </div>
          {filteredPurchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun acquisto trovato</p>
          ) : filteredPurchases.map(p => (
            <PurchaseCard key={p.id} purchase={p} onDelete={handleDeletePurchase} />
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
                  <p className="text-xs text-muted-foreground">N° {c.contract_number || "—"} · {c.contract_date ? new Date(c.contract_date).toLocaleDateString("it-IT") : ""}</p>
                  {c.event_location && <p className="text-xs text-muted-foreground">{c.event_location}{c.event_date ? ` – ${new Date(c.event_date).toLocaleDateString("it-IT")}` : ""}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold">€{(c.total || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Acc: €{(c.deposit || 0).toFixed(2)}</p>
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
              placeholder="Cerca in vendite, acquisti, contratti, fornitori..."
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

          {globalResults.map((item, idx) => {
            if (item._type === "sale") return (
              <SaleCard key={`sale-${item.id}`} sale={item} allArticles={allArticles} onDelete={handleDeleteSale} onEdit={setEditingSale} />
            );
            if (item._type === "purchase") return (
              <PurchaseCard key={`pur-${item.id}`} purchase={item} onDelete={handleDeletePurchase} />
            );
            if (item._type === "contract") return (
              <div key={`con-${item.id}`} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{item.customer_name}</p>
                    <p className="text-xs text-muted-foreground">N° {item.contract_number || "—"} · {item.contract_date ? new Date(item.contract_date).toLocaleDateString("it-IT") : ""}</p>
                    {item.event_location && <p className="text-xs text-muted-foreground">{item.event_location}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{(item.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Acc: €{(item.deposit || 0).toFixed(2)}</p>
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