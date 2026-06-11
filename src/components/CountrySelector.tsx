import { useState } from "react";
import { Globe2, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { COUNTRIES, findCountry } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export function CountrySelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = findCountry(value);

  const filtered = q
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : COUNTRIES;

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
          {filtered.map((c) => {
            const active = c.code === value;
            return (
              <button
                key={c.code}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setQ("");
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-xs transition hover:bg-background ${
                  active ? "text-primary" : "text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{c.flag}</span>
                  <span>{c.name}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
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
