import { useState } from "react";
import { Check, Plus, Target, X } from "lucide-react";
import { INTEREST_OPTIONS, setMyInterests } from "@/lib/job-matches";

interface InterestsPickerProps {
  userId: string;
  initialInterests: string[];
  onClose: () => void;
  onSaved: (interests: string[]) => void;
}

export function InterestsPicker({
  userId,
  initialInterests,
  onClose,
  onSaved,
}: InterestsPickerProps) {
  const [selected, setSelected] = useState<string[]>(initialInterests);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (interest: string) => {
    setSelected((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    setSelected((prev) => [...prev, trimmed]);
    setCustomInput("");
  };

  const customInterests = selected.filter((i) => !INTEREST_OPTIONS.includes(i));

  const save = async () => {
    setSaving(true);
    await setMyInterests(userId, selected);
    setSaving(false);
    onSaved(selected);
    onClose();
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> Your interests
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        We'll flag jobs that match these so you don't have to keep scrolling for them.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {INTEREST_OPTIONS.map((interest) => (
          <button
            key={interest}
            onClick={() => toggle(interest)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
              selected.includes(interest)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {selected.includes(interest) && <Check className="mr-1 inline h-3 w-3" />}
            {interest}
          </button>
        ))}
        {customInterests.map((interest) => (
          <button
            key={interest}
            onClick={() => toggle(interest)}
            className="rounded-full border border-primary bg-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground"
          >
            <Check className="mr-1 inline h-3 w-3" />
            {interest}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Add your own (e.g. Copywriting)"
          className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
        <button
          onClick={addCustom}
          className="rounded-md bg-surface-2 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Add interest"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 w-full rounded-md bg-primary py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save interests"}
      </button>
    </div>
  );
}
