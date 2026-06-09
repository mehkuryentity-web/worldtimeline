import { CATEGORIES, type Category } from "@/lib/mock-news";

interface Props {
  value: Category;
  onChange: (c: Category) => void;
}

export function CategoryTabs({ value, onChange }: Props) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <div className="flex gap-2">
        {CATEGORIES.map((c) => {
          const active = c === value;
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-1 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
