import { timeAgo } from "@/lib/format";

interface Props {
  items?: string[];
}

export function Ticker({ items = [] }: Props) {
  if (items.length === 0) return null;
  const stamp = timeAgo(new Date().toISOString());
  const row = (
    <div className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((title, i) => (
        <span key={`${i}-${title}`} className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">LIVE</span>
          <span className="text-xs text-foreground/80">{title}</span>
          <span className="font-mono text-[10px] text-muted-foreground">· {stamp}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-border bg-surface-1/60 py-1.5">
      <div className="ticker flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
