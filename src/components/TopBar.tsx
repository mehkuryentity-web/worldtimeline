import { Globe2, Zap } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";

export function TopBar() {
  const { state } = useAppState();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-surface-2">
            <Globe2 className="h-4 w-4 text-primary" />
          </span>
          <div className="leading-tight">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              World
            </div>
            <div className="-mt-0.5 text-sm font-semibold tracking-tight">
              Timeline<span className="text-primary">_</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-xs tabular-nums">{state.points}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">pts</span>
        </div>
      </div>
    </header>
  );
}
