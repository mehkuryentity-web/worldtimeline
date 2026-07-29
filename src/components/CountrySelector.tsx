import { useEffect, useState } from "react";
import { Globe2, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { COUNTRIES, findCountry, type Country } from "@/lib/countries";
import { useCountryCoverage, LOW_COVERAGE_THRESHOLD } from "@/hooks/useCountryCoverage";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

const RECENT_KEY = "wt_recent_countries";
const MAX_RECENT = 5;

function readRecent(): Country[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const codes: string[] = raw ? JSON.parse(raw) : [];
    return codes
      .map((code) => COUNTRIES.find((c) => c.code === code))
      .filter((c): c is Country => Boolean(c));
  } catch {
    return [];
  }
}

function pushRecent(code: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const next = [code, ...existing.filter((c) => c !== code)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc) — recent list just won't persist
  }
}

export function CountrySelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<Country[]>([]);
  const current = findCountry(value);
  const { data: coverage } = useCountryCoverage();

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const isSearching = q.length > 0;
  const filtered = isSearching
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : COUNTRIES;

  const recentCodes = new Set(recent.map((c) => c.code));
  const restList = isSearching ? filtered : filtered.filter((c) => !recentCodes.has(c.code));

  function handleSelect(code: string) {
    onChange(code);
    pushRecent(code);
    setOpen(false);
    setQ("");
  }

  function renderRow(c: Country) {
    const active = c.code === value;
    const articleCount = coverage?.[c.code];
    const isLowCoverage =
      typeof articleCount === "number" && articleCount < LOW_COVERAGE_THRESHOLD;

    return (
      <button
        key={c.code}
        onClick={() => handleSelect(c.code)}
        className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-xs transition hover:bg-background ${
          active ? "text-primary" : "text-foreground"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-base leading-none">{c.flag}</span>
          <span>{c.name}</span>
          {isLowCoverage && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500/70"
              title="Low coverage — fewer articles right now"
            />
          )}
        </span>
        {active && <Check className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground transition hover:border-primary/60"
          aria-label="Select country for localized news"
        >
          <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="leading-none">{current.flag}</span>
          <span>{current.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 border-border bg-surface-1 p-0"
      >
        <div className="border-b border-border p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search country…"
            className="w-full rounded-md bg-background px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {!isSearching && recent.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Recent
              </div>
              {recent.map(renderRow)}
              <div className="my-1 border-t border-border" />
            </>
          )}

          {restList.map(renderRow)}

          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center font-mono text-[11px] text-muted-foreground">
              No match
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
