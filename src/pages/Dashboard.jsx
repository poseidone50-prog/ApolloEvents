import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Package, ShoppingCart, Users, Flame, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import NecBadge from "../components/NecBadge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import StatCard from "../components/StatCard";

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [arts, sls, sups] = await Promise.all([
          base44.entities.Article.list(),
          base44.entities.Sale.filter({ status: "closed" }, "-created_date", 10),
          base44.entities.Supplier.list()
        ]);
        setArticles(arts);
        setSales(sls);
        setSuppliers(sups);
      } catch (error) {
        console.error("Dashboard data load error:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalArticles = articles.length;
  const totalStock = articles.reduce((sum, a) => sum + (a.quantity || 0), 0);
  const todaySales = sales.filter((s) => {
    const d = new Date(s.closed_at || s.created_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-secondary rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Hero */}
      <div className="text-center py-6">
        <img src="/logo.png" alt="Apollo Events" className="w-32 h-32 object-contain mx-auto mb-2 drop-shadow-md" />
        <h1 className="text-[#ec0e0e] text-3xl font-extrabold tracking-tight">Apollo Events</h1>
        <p className="text-muted-foreground mt-1">Gestione Magazzino Pirotecnico</p>
      </div>

      {/* Date */}
      <div className="text-center -mt-3">
        <span className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
        </span>
      </div>

      {/* NEC Badge */}
      <NecBadge articles={articles} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Package} label="Articoli" value={totalArticles} />
        <StatCard icon={TrendingUp} label="In Stock" value={totalStock} />
        <StatCard icon={ShoppingCart} label="Vendite Oggi" value={todaySales.length} />
        <StatCard icon={Users} label="Fornitori" value={suppliers.length} />
      </div>

      {/* Revenue today */}
      <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Incasso Oggi</p>
        <p className="text-3xl font-extrabold mt-1">€ {todayRevenue.toFixed(2)}</p>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Azioni Rapide</h2>
        <Link to="/pos">
          <Button className="w-full h-14 text-base font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl shadow-md">
            <ShoppingCart className="w-5 h-5 mr-2" />
            Vendita a Banco
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/articles">
            <Button variant="outline" className="w-full h-12 rounded-xl">
              <Package className="w-4 h-4 mr-2" />
              Articoli
            </Button>
          </Link>
          <Link to="/suppliers">
            <Button variant="outline" className="w-full h-12 rounded-xl">
              <Users className="w-4 h-4 mr-2" />
              Fornitori
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Sales */}
      {sales.length > 0 &&
      <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ultime Vendite</h2>
            <Link to="/history" className="text-xs text-secondary font-medium">Vedi tutte →</Link>
          </div>
          <div className="space-y-2">
            {sales.slice(0, 5).map((sale) =>
          <div key={sale.id} className="bg-card rounded-xl p-3 border border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Vendita #{sale.sale_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.closed_at || sale.created_date).toLocaleDateString("it-IT")} - {(sale.items || []).length} articoli
                  </p>
                </div>
                <span className="font-bold text-sm">€ {(sale.total || 0).toFixed(2)}</span>
              </div>
          )}
          </div>
        </div>
      }
    </div>);

}