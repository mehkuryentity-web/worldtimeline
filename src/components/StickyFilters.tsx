import { useCallback, useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { CountrySelector } from "@/components/CountrySelector";
import { CATEGORIES, type Category } from "@/lib/mock-news";

// Height of the sticky TopBar (px) — bar pins just below it when floating
const TOPBAR_HEIGHT = 57;

type Mode = "all" | "5m" | "10m" | "30m" | "1h" | "24h" | "custom";

interface CustomRange {
  hours: string;
  minutes: string;
}

interface Props {
  country: string;
  onCountryChange: (code: string) => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  customRange: CustomRange;
  onCustomRangeChange: (
    updater: (p: CustomRange) => CustomRange
  ) => void;
  category: Category;
  onCategoryChange: (c: Category) => void;
}

// Country selector, time-window selector, and category pills, all pinned
// and shown/hidden together as ONE unit driven by a single scroll
// listener -- previously the category pills had their own independent
// sticky logic (in CategoryTabs.tsx) and country/time had none. Rather
// than run two separate copies of the same pin/show-on-scroll-up logic
// side by side (which can drift out of sync), everything lives in one
// component here so there's exactly one source of truth for "are we
// pinned, are we showing".
export function StickyFilters({
  country,
  onCountryChange,
  mode,
  onModeChange,
  customRange,
  onCustomRangeChange,
  category,
  onCategoryChange,
}: Props) {
  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null); // marks original position in the flow
  const scrollRef = useRef<HTMLDivElement>(null); // pinned pill row, for scroll-active-into-view
  const inFlowScrollRef = useRef<HTMLDivElement>(null); // in-flow pill row (separate DOM node)
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Click-and-drag horizontal scrolling for the category pill row --
  // native touch scroll already works fine on mobile, but desktop has no
  // touch surface, so without this the pills are only reachable via a
  // trackpad's horizontal swipe (not obvious, and not available at all
  // with a plain mouse). Bound separately to the in-flow and pinned pill
  // rows since they're two different DOM nodes.
  const useDragScroll = (ref: React.RefObject<HTMLDivElement>) => {
    const isDown = useRef(false);
    const startX = useRef(0);
    const startScrollLeft = useRef(0);
    const moved = useRef(false); // did the mouse actually travel? (vs. a plain click)

    const onMouseDown = (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      // Prevent the browser's default mouse-click focus behavior on the
      // pill button underneath -- a newly-focused element near a `fixed`
      // TopBar/pinned bar gets auto-scrolled "into view" by the browser,
      // which doesn't know the fixed bars overlay the content, so it nudges
      // the whole page down and reveals more of the feed. Skipping focus
      // on mouse click sidesteps that; keyboard/tab focus is unaffected.
      e.preventDefault();
      isDown.current = true;
      moved.current = false;
      startX.current = e.pageX;
      startScrollLeft.current = el.scrollLeft;
    };

    const onMouseMove = (e: React.MouseEvent) => {
      if (!isDown.current) return;
      const el = ref.current;
      if (!el) return;
      const dx = e.pageX - startX.current;
      if (Math.abs(dx) > 3) moved.current = true;
      el.scrollLeft = startScrollLeft.current - dx;
    };

    const endDrag = () => {
      isDown.current = false;
    };

    // Swallow the click that follows a drag so releasing the mouse over a
    // pill doesn't also select it -- only a real (non-dragged) click does.
    const onClickCapture = (e: React.MouseEvent) => {
      if (moved.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    return { onMouseDown, onMouseMove, onMouseUp: endDrag, onMouseLeave: endDrag, onClickCapture };
  };

  const inFlowDrag = useDragScroll(inFlowScrollRef);
  const pinnedDrag = useDragScroll(scrollRef);

  // Whether the bar has scrolled past the top (should pin)
  const [pinned, setPinned] = useState(false);
  // Whether to show the pinned bar (hide on scroll-down, show on scroll-up)
  const [showPinned, setShowPinned] = useState(true);

  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;

      // Determine whether sentinel has scrolled above the TopBar
      if (sentinelRef.current) {
        const { top } = sentinelRef.current.getBoundingClientRect();
        setPinned(top < TOPBAR_HEIGHT);
      }

      // Show/hide the pinned bar based on scroll direction
      if (Math.abs(delta) > 4) {
        if (delta > 0) {
          // Scrolling down — hide
          setShowPinned(false);
        } else {
          // Scrolling up — show instantly
          setShowPinned(true);
        }
        lastScrollY.current = y;
      }

      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  // Scroll active pill into view when selection changes. Walk up from the
  // active button to find its actual scroll container instead of assuming
  // it's the pinned copy (scrollRef) -- when the bar isn't pinned yet, the
  // pinned copy isn't even mounted (scrollRef.current is null), so that
  // assumption silently did nothing for the in-flow row.
  //
  // Position math uses getBoundingClientRect() rather than el.offsetLeft --
  // offsetLeft is relative to the nearest *positioned* ancestor, which
  // once everything sits inside the `fixed` pinned bar is NOT necessarily
  // the scroll container itself, so it under/over-counts depending on
  // which direction you're scrolling (this was why "scroll right" pills
  // worked but "scroll left" ones didn't -- the numbers were only right
  // by coincidence in one direction).
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    // el -> "flex gap-2" pills wrapper -> the scrollable row div
    const container = el.parentElement?.parentElement as HTMLDivElement | null;
    if (!container) return;

    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const elLeft = elRect.left - containerRect.left + container.scrollLeft;
    const elRight = elLeft + elRect.width;
    const cLeft = container.scrollLeft;
    const cRight = cLeft + container.clientWidth;

    if (elLeft < cLeft + 16) {
      container.scrollTo({ left: elLeft - 16, behavior: "smooth" });
    } else if (elRight > cRight - 16) {
      container.scrollTo({ left: elRight - container.clientWidth + 16, behavior: "smooth" });
    }
  }, [category]);

  const showCustom = mode === "custom";

  const filterRow = (
    <div className="flex items-center justify-between gap-2">
      <CountrySelector value={country} onChange={onCountryChange} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-3 w-3" />

          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as Mode)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="all">All News</option>
            <option value="5m">5 min</option>
            <option value="10m">10 min</option>
            <option value="30m">30 min</option>
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {showCustom && (
          <div className="flex gap-2 items-center">
            <input
              className="border px-2 py-1 text-xs w-20"
              placeholder="hrs"
              value={customRange.hours}
              onChange={(e) =>
                onCustomRangeChange((p) => ({
                  ...p,
                  hours: e.target.value,
                }))
              }
            />

            <input
              className="border px-2 py-1 text-xs w-20"
              placeholder="min"
              value={customRange.minutes}
              onChange={(e) =>
                onCustomRangeChange((p) => ({
                  ...p,
                  minutes: e.target.value,
                }))
              }
            />
          </div>
        )}
      </div>
    </div>
  );

  const pills = (
    <div className="flex gap-2">
      {CATEGORIES.map((c) => {
        const active = c === category;
        return (
          <button
            key={c}
            ref={active ? activeRef : null}
            onClick={() => onCategoryChange(c)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-surface-1 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Sentinel: marks the original position of the whole filter block */}
      <div ref={sentinelRef} />

      {/* In-flow copy (visible when not yet pinned) -- same visual layout
          index.tsx used to render directly: filter row, then pills row. */}
      <div
        className="space-y-4"
        style={{
          // Hide in-flow copy once pinned (pinned copy takes over), same
          // trick used everywhere else in this app -- visibility, not
          // display, so it keeps its layout space and nothing jumps.
          visibility: pinned ? "hidden" : "visible",
        }}
      >
        {filterRow}
        <div
          ref={inFlowScrollRef}
          className="no-scrollbar overflow-x-auto cursor-grab select-none active:cursor-grabbing"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          onMouseDown={inFlowDrag.onMouseDown}
          onMouseMove={inFlowDrag.onMouseMove}
          onMouseUp={inFlowDrag.onMouseUp}
          onMouseLeave={inFlowDrag.onMouseLeave}
          onClickCapture={inFlowDrag.onClickCapture}
        >
          {pills}
        </div>
      </div>

      {/* Pinned floating copy -- both rows travel and hide/show together */}
      {pinned && (
        <div
          className="fixed left-0 right-0 z-20 border-b border-border bg-background/95 backdrop-blur transition-all duration-200"
          style={{
            top: TOPBAR_HEIGHT,
            transform: showPinned ? "translateY(0)" : "translateY(-110%)",
            opacity: showPinned ? 1 : 0,
            pointerEvents: showPinned ? "auto" : "none",
          }}
        >
          <div className="mx-auto max-w-md px-4 py-2 space-y-2">
            {filterRow}
            <div
              ref={scrollRef}
              className="no-scrollbar overflow-x-auto cursor-grab select-none active:cursor-grabbing"
              style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
              onMouseDown={pinnedDrag.onMouseDown}
              onMouseMove={pinnedDrag.onMouseMove}
              onMouseUp={pinnedDrag.onMouseUp}
              onMouseLeave={pinnedDrag.onMouseLeave}
              onClickCapture={pinnedDrag.onClickCapture}
            >
              {pills}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
