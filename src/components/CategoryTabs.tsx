import { useEffect, useRef, useState, useCallback } from "react";
import { CATEGORIES, type Category } from "@/lib/mock-news";

interface Props {
  value: Category;
  onChange: (c: Category) => void;
  // How far down to shift the pinned bar, in px -- used to stack this bar
  // just below FilterBar's own pinned copy (country/time selectors) when
  // that one is also pinned and visible, instead of overlapping it.
  // Defaults to 0 (sits directly under the TopBar) for any other usage.
  topOffset?: number;
}

// Height of the sticky TopBar (px) — bar pins just below it when floating
const TOPBAR_HEIGHT = 57;

export function CategoryTabs({ value, onChange, topOffset = 0 }: Props) {
  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null); // sits just above the bar in the DOM flow
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

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

  // Scroll active pill into view when selection changes
  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;

    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const cLeft = container.scrollLeft;
    const cRight = cLeft + container.offsetWidth;

    if (elLeft < cLeft + 16) {
      container.scrollTo({ left: elLeft - 16, behavior: "smooth" });
    } else if (elRight > cRight - 16) {
      container.scrollTo({ left: elRight - container.offsetWidth + 16, behavior: "smooth" });
    }
  }, [value]);

  const pills = (
    <div className="flex gap-2">
      {CATEGORIES.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            ref={active ? activeRef : null}
            onClick={() => onChange(c)}
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
      {/* Sentinel: marks the original position of the bar in the flow */}
      <div ref={sentinelRef} />

      {/* In-flow bar (visible when not yet pinned) */}
      <div
        className="no-scrollbar overflow-x-auto"
        style={{
          // Hide in-flow bar once pinned (pinned copy takes over)
          visibility: pinned ? "hidden" : "visible",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {pills}
      </div>

      {/* Pinned floating bar (appears when bar scrolls past TopBar) */}
      {pinned && (
        <div
          className="fixed left-0 right-0 z-20 border-b border-border bg-background/95 backdrop-blur transition-all duration-200"
          style={{
            top: TOPBAR_HEIGHT + topOffset,
            transform: showPinned ? "translateY(0)" : "translateY(-110%)",
            opacity: showPinned ? 1 : 0,
            pointerEvents: showPinned ? "auto" : "none",
          }}
        >
          <div
            ref={scrollRef}
            className="no-scrollbar mx-auto max-w-md overflow-x-auto px-4 py-2"
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {pills}
          </div>
        </div>
      )}
    </>
  );
}
