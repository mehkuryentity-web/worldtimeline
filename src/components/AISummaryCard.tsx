import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
  const [countryContext, setCountryContext] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  const generate = () => {
    setLoading(true);

    // hard reset so refresh ALWAYS works
    setOpening("");
    setLines([]);
    setIdentity("");
    setCountryContext("");
    setConclusion("");

    const result = buildBriefing({
      headlines,
      userName: state?.user?.name ?? null,
      country: state?.country ?? "GLOBAL",
    });

    setOpening(result.opening);
    setLines(result.lines);
    setIdentity(result.identity);
    setCountryContext(result.countryContext);
    setConclusion(result.conclusion);

    setLoading(false);
    setTime(new Date());
  };

  useEffect(() => {
    generate();
  }, [headlines, state?.user?.name, state?.country]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {time.toLocaleTimeString().slice(0, 5)}
        </div>

        <button
          onClick={generate}
          className="text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* BODY */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing briefing...
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p className="font-medium">{opening}</p>

          <p className="text-muted-foreground">{countryContext}</p>

          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}

          <p className="font-medium border-t border-border pt-3">
            {conclusion}
          </p>
        </div>
      )}

      {/* IDENTITY */}
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Narrator: {identity}
      </div>
    </div>
  );
}
