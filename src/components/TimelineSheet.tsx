import { X } from "lucide-react";
import { useEffect } from "react";
import type { Timeline } from "@/lib/mock-news";
import { timeAgo } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  timeline: Timeline;
}

export function TimelineSheet({ open, onClose, timeline }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-border bg-surface-1 pb-[max(env(safe-area-inset-bottom),1rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-1/95 px-4 py-3 backdrop-blur">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Timeline</div>
            <h3 className="mt-0.5 text-sm font-semibold tracking-tight">{timeline.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="relative px-4 py-4">
          <span className="absolute bottom-4 left-[1.55rem] top-4 w-px bg-border" aria-hidden />
          {timeline.events.map((ev, i) => (
            <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0">
              <span
                className={`relative z-10 mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full ${
                  i === 0 ? "bg-primary glow-primary" : "bg-surface-2 border border-border"
                }`}
              />
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {timeAgo(ev.at)} ago
                </div>
                <div className="mt-0.5 text-sm font-medium leading-snug">{ev.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ev.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
