import { cn } from "@/lib/utils";

const NEC_LIMITS = [
  {
    label: "F2 5°C",
    maxKg: 80,
    match: (a) => a.category === "F2 5°C",
    color: "bg-blue-500",
    lightColor: "bg-blue-200",
    textColor: "text-blue-200",
  },
  {
    label: "F2 5°D",
    maxKg: 50,
    match: (a) => a.category === "F2 5°D",
    color: "bg-orange-500",
    lightColor: "bg-orange-200",
    textColor: "text-orange-200",
  },
  {
    label: "F2 5°E",
    maxKg: 30,
    match: (a) => a.category === "F2 5°E",
    color: "bg-amber-500",
    lightColor: "bg-amber-200",
    textColor: "text-amber-200",
  },
  {
    label: "F3 4°",
    maxKg: 30,
    match: (a) => a.category === "F3 4°",
    color: "bg-red-500",
    lightColor: "bg-red-200",
    textColor: "text-red-200",
  },
];

function NecBar({ label, current, max, color, lightColor, textColor }) {
  const pct = Math.min((current / max) * 100, 100);
  const over = current > max;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-xs font-semibold", textColor)}>{label}</span>
        <span className={cn("text-xs font-bold", over ? "text-red-400" : textColor)}>
          {current.toFixed(2)} / {max} kg {over && "⚠️"}
        </span>
      </div>
      <div className={cn("h-2.5 rounded-full bg-white/10")}>
        <div
          className={cn("h-2.5 rounded-full transition-all", over ? "bg-red-400" : color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function NecBadge({ articles = [], className }) {
  const totalNec = articles.reduce((sum, a) => sum + ((a.nec_kg || 0) * (a.quantity || 0)), 0);
  const limits = NEC_LIMITS.map(limit => ({
    ...limit,
    current: articles.filter(limit.match).reduce((sum, a) => sum + ((a.nec_kg || 0) * (a.quantity || 0)), 0),
  }));

  return (
    <div className={cn("rounded-2xl overflow-hidden shadow-xl", className)}>
      {/* Total NEC - big and prominent */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-400">NEC Totale Magazzino</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-6xl font-black tracking-tight leading-none">{totalNec.toFixed(2)}</span>
            <span className="text-2xl font-bold text-slate-400">kg</span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-secondary/20 border-2 border-secondary/40 flex items-center justify-center">
          <span className="text-3xl">💥</span>
        </div>
      </div>

      {/* Per-category limits */}
      <div className="bg-slate-800 px-5 py-4 space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Limiti per Categoria</p>
        {limits.map(l => (
          <NecBar key={l.label} label={l.label} current={l.current} max={l.maxKg} color={l.color} lightColor={l.lightColor} textColor={l.textColor} />
        ))}
      </div>
    </div>
  );
}