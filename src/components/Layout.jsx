import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Package, Users, ShoppingCart, History, Menu, X, Flame, FileText, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/articles", label: "Articoli", icon: Package },
  { path: "/suppliers", label: "Fornitori", icon: Users },
  { path: "/pos", label: "Vendita", icon: ShoppingCart },
  { path: "/documents", label: "Documenti", icon: FileText },
  { path: "/history", label: "Storico", icon: History },
  { path: "/settings", label: "Impostazioni", icon: Settings },
];

// Bottom nav shows only the most-used 5
const bottomNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/pos", label: "Vendita", icon: ShoppingCart },
  { path: "/documents", label: "Documenti", icon: FileText },
  { path: "/history", label: "Storico", icon: History },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="bg-card text-card-foreground sticky top-0 z-50 border-b border-border shadow-sm print:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Apollo Events" className="h-9 w-9 object-contain drop-shadow-md" />
            <span className="font-bold text-lg tracking-tight hidden sm:block text-primary">Apollo Events</span>
          </Link>
          
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 ml-2"
              title="Scollegati / Blocca App"
            >
              <LogOut className="w-4 h-4" />
              Blocca
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-primary-foreground/10 pb-2 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); logout(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-destructive hover:bg-destructive/10 w-full mt-2 border-t border-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              Blocca App
            </button>
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb print:hidden">
        <div className="flex justify-around py-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center py-2 px-2 rounded-lg text-xs font-medium transition-all",
                  active ? "text-secondary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5 mb-0.5", active && "text-secondary")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}