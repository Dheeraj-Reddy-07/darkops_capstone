import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStores } from "@/hooks/useStores";

function cellClass(pulse: number) {
  if (pulse >= 80) return "bg-ok/85 hover:bg-ok";
  if (pulse >= 60) return "bg-warn/85 hover:bg-warn";
  return "bg-crit/85 hover:bg-crit";
}

export function StoreHeatmap() {
  const { data } = useStores();
  const stores = data?.stores || [];

  // Group by city dynamically
  const cityMap = new Map<string, typeof stores>();
  for (const store of stores) {
    const city = store.city || "Other";
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(store);
  }
  const cities = Array.from(cityMap.keys()).sort();
  const cols = [
    cities.slice(0, Math.ceil(cities.length / 2)),
    cities.slice(Math.ceil(cities.length / 2)),
  ];

  if (stores.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Loading store network…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={80}>
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-2">
        {cols.map((group, gi) => (
          <div key={gi} className="space-y-2.5">
            {group.map((city) => (
              <div key={city} className="flex items-center gap-4">
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{city}</span>
                <div className="flex flex-wrap gap-1">
                  {(cityMap.get(city) || []).map((s) => (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        {s.id ? (
                          <Link
                            to="/dark-stores/$id"
                            params={{ id: s.id }}
                            aria-label={`${s.name} PulseScore ${s.pulse}`}
                            className={cn(
                              "size-3.5 rounded-[2px] transition-colors",
                              cellClass(s.pulse ?? 75),
                            )}
                          />
                        ) : (
                          <div
                            aria-label={`${s.name} PulseScore ${s.pulse}`}
                            className={cn(
                              "size-3.5 rounded-[2px] opacity-50 cursor-not-allowed",
                              cellClass(s.pulse ?? 75),
                            )}
                          />
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <span className="num">{s.id || "-"}</span> · {s.name} · PulseScore{" "}
                        <span className="num">{s.pulse ?? "-"}</span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-ok" /> ≥ 80
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-warn" /> 60–79
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-crit" /> &lt; 60
      </span>
    </div>
  );
}
