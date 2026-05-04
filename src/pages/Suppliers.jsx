import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SupplierForm from "../components/SupplierForm";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadSuppliers = async () => {
    setLoading(true);
    const data = await base44.entities.Supplier.list("-updated_date", 200);
    setSuppliers(data);
    setLoading(false);
  };

  useEffect(() => { loadSuppliers(); }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Sei sicuro di voler eliminare questo fornitore?")) {
      await base44.entities.Supplier.delete(id);
      loadSuppliers();
    }
  };

  const filtered = suppliers.filter(s =>
    (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.company || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.city || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Fornitori</h1>
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
          placeholder="Cerca fornitore..."
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
          <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nessun fornitore trovato</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(supplier => (
            <div key={supplier.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{supplier.name}</p>
                  {supplier.company && <p className="text-sm text-muted-foreground">{supplier.company}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {supplier.vat_number && <span>P.IVA: {supplier.vat_number}</span>}
                    {supplier.city && <span>{supplier.city} ({supplier.province})</span>}
                    {supplier.phone && <span>Tel: {supplier.phone}</span>}
                    {supplier.email && <span>{supplier.email}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(supplier); setShowForm(true); }} className="p-2 hover:bg-muted rounded-lg">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-2 hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SupplierForm
          supplier={editing}
          onSave={() => { setShowForm(false); loadSuppliers(); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}