import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ShoppingCart, Plus, Minus, Trash2, Check, Search, XCircle, Calendar, Package } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const playBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // 800Hz beep
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Low volume
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1); // 100ms
  } catch (e) {
    // Ignore if audio not supported
  }
};

export default function PointOfSale() {
  const [articles, setArticles] = useState([]);
  const [articleMap, setArticleMap] = useState(new Map());
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [closing, setClosing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    base44.entities.Article.list("-updated_date", 500).then(arts => {
      setArticles(arts);
      const map = new Map();
      arts.forEach(a => { if (a.barcode) map.set(a.barcode, a); });
      setArticleMap(map);
    });
  }, []);

  const addToCart = (article) => {
    if ((article.quantity || 0) <= 0) {
      toast.error("Articolo non disponibile in magazzino");
      return;
    }
    playBeep();
    setCart(prev => {
      const existing = prev.find(i => i.article_id === article.id);
      if (existing) {
        if (existing.quantity >= article.quantity) {
          toast.error("Quantità massima raggiunta");
          return prev;
        }
        return prev.map(i =>
          i.article_id === article.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price }
            : i
        );
      }
      return [...prev, {
        article_id: article.id,
        barcode: article.barcode,
        description: article.description || article.name,
        quantity: 1,
        unit_price: article.sale_price || article.price || 0,
        vat_rate: article.vat_rate || 22,
        total: article.sale_price || article.price || 0,
      }];
    });
  };

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    
    // O(1) Lookup
    const article = articleMap.get(code) || articles.find(a => a.barcode === code);
    
    if (article) {
      addToCart(article);
      setBarcode("");
      setShowSuggestions(false);
      toast.success(`${article.description || article.name} aggiunto`);
    } else {
      // If pressing enter on text that is not a barcode, maybe add the first suggestion
      const matches = getSuggestions();
      if (matches.length > 0) {
        addToCart(matches[0]);
        setBarcode("");
        setShowSuggestions(false);
        toast.success(`${matches[0].description || matches[0].name} aggiunto`);
      } else {
        toast.error("Articolo non trovato");
      }
    }
    inputRef.current?.focus();
  };

  const updateQuantity = (articleId, delta) => {
    setCart(prev =>
      prev.map(i => {
        if (i.article_id !== articleId) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null;
        return { ...i, quantity: newQty, total: newQty * i.unit_price };
      }).filter(Boolean)
    );
  };

  const removeItem = (articleId) => {
    setCart(prev => prev.filter(i => i.article_id !== articleId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  // Optional: Proportionally reduce VAT if there's a global discount, or keep simple.
  const rawVatTotal = cart.reduce((sum, i) => sum + (i.total * (i.vat_rate / 100) / (1 + i.vat_rate / 100)), 0);
  const rawTotal = subtotal;
  
  const total = Math.max(0, rawTotal - (discount || 0));
  const vatTotal = rawTotal > 0 ? rawVatTotal * (total / rawTotal) : 0; // Propz. recalculating VAT after discount

  const closeSale = async () => {
    if (cart.length === 0) {
      toast.error("Il carrello è vuoto");
      return;
    }
    setClosing(true);

    const existingSales = await base44.entities.Sale.list();
    const todayStr = format(new Date(), "dd/MM/yyyy");
    
    // Trova tutte le vendite di "oggi"
    const todaysSales = existingSales.filter(s => {
       if (!s.closed_at && !s.created_date) return false;
       return format(new Date(s.closed_at || s.created_date), "dd/MM/yyyy") === todayStr;
    });

    const dailyCount = todaysSales.length + 1;
    const dailyCountFormatted = dailyCount.toString().padStart(2, '0');
    const nextNum = `${dailyCountFormatted} del ${todayStr}`;

    await base44.entities.Sale.create({
      sale_number: nextNum,
      items: cart,
      subtotal: rawTotal,
      discount: discount,
      vat_total: vatTotal,
      total,
      status: "closed",
      closed_at: new Date().toISOString(),
    });

    for (const item of cart) {
      const article = articles.find(a => a.id === item.article_id);
      if (article) {
        await base44.entities.Article.update(article.id, {
          quantity: Math.max(0, (article.quantity || 0) - item.quantity),
        });
      }
    }

    const updatedArticles = await base44.entities.Article.list("-updated_date", 500);
    setArticles(updatedArticles);
    const map = new Map();
    updatedArticles.forEach(a => { if (a.barcode) map.set(a.barcode, a); });
    setArticleMap(map);

    setCart([]);
    setDiscount(0);
    setClosing(false);
    toast.success(`Vendita #${nextNum} completata!`);
    inputRef.current?.focus();
  };
  
  const getSuggestions = () => {
    const q = barcode.trim().toLowerCase();
    if (!q) return [];
    return articles.filter(a => 
      (a.description || a.name || "").toLowerCase().includes(q) || 
      (a.barcode || "").toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const suggestions = getSuggestions();

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-secondary" />
          Vendita a Banco
        </h1>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {format(new Date(), "dd/MM/yyyy", { locale: it })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: SCAN & SEARCH */}
        <div className="lg:col-span-7 space-y-4">
          <form onSubmit={handleBarcodeScan} className="flex gap-2 relative">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={barcode}
                onChange={e => {
                  setBarcode(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Scansiona codice a barre o cerca per nome..."
                className="pl-10 h-14 rounded-xl text-lg shadow-sm"
                autoFocus
              />
              
              {/* AUTOCOMPLETE DROPDOWN */}
              {showSuggestions && barcode.trim() !== "" && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {suggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      {suggestions.map(art => (
                        <div 
                          key={art.id} 
                          onClick={() => {
                            addToCart(art);
                            setBarcode("");
                            setShowSuggestions(false);
                            inputRef.current?.focus();
                          }}
                          className="px-4 py-3 hover:bg-muted cursor-pointer flex items-center justify-between border-b border-border/50 last:border-0"
                        >
                          <div>
                            <p className="font-semibold text-sm">{art.description || art.name}</p>
                            <p className="text-xs text-muted-foreground">{art.barcode} · Cons: {art.quantity}pz</p>
                          </div>
                          <span className="font-bold">€{(art.sale_price || art.price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nessun articolo trovato per "{barcode}"
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button type="submit" className="h-14 px-8 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg shadow-sm font-bold">
              Aggiungi
            </Button>
          </form>
          
          <div className="bg-muted/30 rounded-xl p-8 text-center border border-dashed border-border mt-8 hidden lg:block">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-muted-foreground mb-1">Pronto per la scansione</h3>
            <p className="text-sm text-muted-foreground/70">Usa il lettore ottico o digita il nome per trovare l'articolo in tempo reale.</p>
          </div>
        </div>

        {/* RIGHT COLUMN: RECEIPT */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border shadow-md overflow-hidden lg:sticky lg:top-20">
          <div className="bg-muted p-4 border-b border-border text-center">
            <h2 className="font-black text-xl uppercase tracking-wider text-card-foreground">Scontrino</h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">Cassa 01 · {format(new Date(), "dd/MM/yy HH:mm")}</p>
          </div>
          
          <div className="p-4 min-h-[300px] max-h-[50vh] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-12">
                <ShoppingCart className="w-12 h-12 mb-3 mx-auto" />
                <p>Nessun articolo<br/>nello scontrino</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.article_id} className="group relative pr-8">
                    <div className="flex justify-between items-start font-mono text-sm border-b border-dotted border-border pb-2">
                      <div className="pr-4">
                        <p className="font-bold truncate max-w-[180px]" title={item.description}>{item.description}</p>
                        <p className="text-xs text-muted-foreground flex gap-3 mt-1 items-center">
                          <span>{item.quantity} x €{item.unit_price.toFixed(2)}</span>
                          <span className="flex items-center gap-1 bg-muted rounded-md px-1 py-0.5">
                            <button onClick={() => updateQuantity(item.article_id, -1)} className="hover:text-destructive"><Minus className="w-3 h-3"/></button>
                            <span>q.tà</span>
                            <button onClick={() => updateQuantity(item.article_id, 1)} className="hover:text-primary"><Plus className="w-3 h-3"/></button>
                          </span>
                        </p>
                      </div>
                      <span className="font-bold text-right pt-0.5">€{item.total.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={() => removeItem(item.article_id)} 
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOTAL & ACTIONS */}
          <div className="p-4 bg-muted/30 border-t border-border">
            <div className="flex justify-between items-center mb-3 font-mono text-sm">
              <span className="text-muted-foreground">SUBTOTALE LORDO</span>
              <span className="text-muted-foreground">€{rawTotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center mb-3 font-mono text-sm">
              <span className="text-muted-foreground font-semibold">SCONTO (€)</span>
              <Input 
                  type="number" 
                  value={discount === 0 ? '' : discount} 
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))} 
                  placeholder="0.00" 
                  min="0"
                  max={rawTotal}
                  step="0.5"
                  className="w-24 h-8 text-right bg-background border-border shadow-inner font-mono text-sm" 
              />
            </div>

            <div className="flex justify-between items-center mb-4 font-mono text-sm pt-2 border-t border-dashed border-border/50">
              <span className="text-muted-foreground">IVA COMPRESA RAPPORTATA</span>
              <span className="text-muted-foreground">€{vatTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-end mb-6">
              <span className="font-bold uppercase text-xl">Totale</span>
              <span className="font-black text-4xl">€{total.toFixed(2)}</span>
            </div>
            
            <div className="flex gap-3">
               <Button
                variant="outline"
                disabled={cart.length === 0}
                className="flex-1 h-14 rounded-xl text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive font-bold"
                onClick={() => {
                  if (window.confirm("Svuotare lo scontrino?")) setCart([]);
                }}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Annulla
              </Button>
              <Button
                onClick={closeSale}
                disabled={cart.length === 0 || closing}
                className="flex-[2] h-14 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg font-black shadow-lg"
              >
                {closing ? (
                  <div className="w-5 h-5 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin mx-auto" />
                ) : (
                  <>
                    <Check className="w-6 h-6 mr-2" />
                    PAGA
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}