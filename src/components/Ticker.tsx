import { MOCK_NEWS } from "@/lib/mock-news";
import { timeAgo } from "@/lib/format";

export function Ticker() {
  const items = MOCK_NEWS.slice(0, 8);
  const row = (
    <div className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((n) => (
        <span key={n.id} className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            {n.category}
          </span>
          <span className="text-xs text-foreground/80">{n.title}</span>
          <span className="font-mono text-[10px] text-muted-foreground">· {timeAgo(n.publishedAt)}</span>
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
