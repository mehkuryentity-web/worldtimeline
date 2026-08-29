import { useCallback, useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { CountrySelector } from "@/components/CountrySelector";

// Same trick as CategoryTabs.tsx: height of the sticky TopBar (px) — this
// bar pins just below it once its original position scrolls past.
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
  // Reports the rendered height of the pinned bar whenever it's actually
  // showing on screen (pinned AND not scrolled-away) so CategoryTabs can
  // shift itself down to sit just below it instead of overlapping. Reports
  // 0 when the pinned bar isn't showing.
  onPinnedHeightChange?: (height: number) => void;
}

export function FilterBar({
  country,
  onCountryChange,
  mode,
  onModeChange,
  customRange,
  onCustomRangeChange,
  onPinnedHeightChange,
}: Props) {
  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null); // marks original position in the flow
  const pinnedRef = useRef<HTMLDivElement>(null);

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

  // Tell the parent how tall the pinned bar currently is, only while it's
  // actually visible on screen -- covers both "not pinned yet" and "pinned
  // but scrolled away" by reporting 0 in those cases.
  useEffect(() => {
    if (!onPinnedHeightChange) return;

    if (!pinned || !showPinned) {
      onPinnedHeightChange(0);
      return;
    }

    const el = pinnedRef.current;
    if (!el) return;

    const report = () => onPinnedHeightChange(el.offsetHeight);
    report();

    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pinned, showPinned, onPinnedHeightChange]);

  const showCustom = mode === "custom";

  const body = (
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

  return (
    <>
      {/* Sentinel: marks the original position of the bar in the flow */}
      <div ref={sentinelRef} />

      {/* In-flow bar (visible when not yet pinned) */}
      <div
        style={{
          // Hide in-flow bar once pinned (pinned copy takes over), same
          // trick as CategoryTabs -- visibility, not display, so it keeps
          // its layout space and nothing jumps.
          visibility: pinned ? "hidden" : "visible",
        }}
      >
        {body}
      </div>

      {/* Pinned floating bar (appears when bar scrolls past TopBar) */}
      {pinned && (
        <div
          ref={pinnedRef}
          className="fixed left-0 right-0 z-20 border-b border-border bg-background/95 backdrop-blur transition-all duration-200"
          style={{
            top: TOPBAR_HEIGHT,
            transform: showPinned ? "translateY(0)" : "translateY(-110%)",
            opacity: showPinned ? 1 : 0,
            pointerEvents: showPinned ? "auto" : "none",
          }}
        >
          <div className="mx-auto max-w-md px-4 py-2">{body}</div>
        </div>
      )}
    </>
  );
}
