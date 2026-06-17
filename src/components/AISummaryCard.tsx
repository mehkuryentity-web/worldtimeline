import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildBriefing } from "@/lib/intelligence/briefing";
import { useAppState } from "@/hooks/use-app-state";

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const { state } = useAppState();

  const [opening, setOpening] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [identity, setIdentity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const result = buildBriefing({
        headlines,
        userName: state?.user?.name ?? null,
      });

      setOpening(result.opening);
      setLines(result.lines);
      setIdentity(result.identity);
    } catch (err) {
      console.error("Briefing build failed:", err);

      // safe fallback
      setOpening("Today’s news is unfolding across multiple fronts.");
      setLines(headlines.slice(0, 5));
      setIdentity("NewsSeeker");
    } finally {
      setLoading(false);
    }
  }, [headlines, state?.user?.name]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        AI Briefing
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing briefing...
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p className="font-medium">{opening}</p>

          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Narrator: {identity}
      </div>
    </div>
  );
}
