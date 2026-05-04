import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ArticleForm from "../components/ArticleForm";
import { cn } from "@/lib/utils";

const categoryColors = {
  "F2 5°C": "bg-blue-100 text-blue-700",
  "F2 5°D": "bg-orange-100 text-orange-700",
  "F2 5°E": "bg-amber-100 text-amber-700",
  "F3 4°": "bg-red-100 text-red-700",
};


export default function Articles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadArticles = async () => {
    setLoading(true);
    const data = await base44.entities.Article.list("-updated_date", 200);
    setArticles(data);
    setLoading(false);
  };

  useEffect(() => { loadArticles(); }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo articolo?")) {
      await base44.entities.Article.delete(id);
      loadArticles();
    }
  };

  const filtered = articles.filter(a =>
    (a.description || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.supplier_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Articoli</h1>
        <Button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl"
        >
          <Plus className="w-4 h-4 mr-1" /> Nuovo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per descrizione, codice, fornitore..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-secondary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nessun articolo trovato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(article => (
            <div key={article.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", categoryColors[article.category] || "bg-muted text-muted-foreground")}>
                      {article.category}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{article.barcode}</span>
                  </div>
                  <p className="font-semibold text-sm truncate">{article.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {article.supplier_name && <span>Forn: {article.supplier_name}</span>}
                    <span>Acq: €{(article.purchase_price || 0).toFixed(2)}</span>
                    <span className="font-semibold text-foreground">Vend: €{(article.sale_price || 0).toFixed(2)}</span>
                    <span>IVA: {article.vat_rate || 22}%</span>
                    <span>NEC: {(article.nec_kg || 0).toFixed(3)} kg</span>
                    <span className="font-semibold">Q.tà: {article.quantity || 0}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(article); setShowForm(true); }} className="p-2 hover:bg-muted rounded-lg">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(article.id)} className="p-2 hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ArticleForm
          article={editing}
          onSave={() => { setShowForm(false); loadArticles(); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}