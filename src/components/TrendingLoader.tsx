import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

const MESSAGES = [
  "Analysing trends",
  "Ranking momentum",
  "Compiling live signals",
];

const CYCLE_MS = 1800;

export function TrendingLoader() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24">
      <div className="relative grid h-24 w-24 place-items-center">
        <span className="absolute h-full w-full rounded-full border border-primary/40 animate-[orbit-ring_2s_ease-out_infinite]" />
        <span className="absolute h-full w-full rounded-full border border-primary/40 animate-[orbit-ring_2s_ease-out_infinite_0.6s]" />
        <span className="absolute h-full w-full rounded-full border border-primary/40 animate-[orbit-ring_2s_ease-out_infinite_1.2s]" />
        <Flame className="h-8 w-8 text-primary glow-primary" strokeWidth={2.5} />
      </div>

      <span
        key={index}
        className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground animate-[fade-text_1.8s_ease-in-out]"
      >
        {MESSAGES[index]}
      </span>

      <style>{`
        @keyframes orbit-ring {
          0% { transform: scale(0.4); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes fade-text {
          0% { opacity: 0; transform: translateY(2px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
