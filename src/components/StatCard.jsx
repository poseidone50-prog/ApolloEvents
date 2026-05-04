import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, className }) {
  return (
    <div className={cn("bg-card rounded-xl p-4 shadow-sm border border-border", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-secondary" />
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}