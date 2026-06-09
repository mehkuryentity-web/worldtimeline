import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Zap, Check } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { POINTS } from "@/lib/rewards";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Breaking News · WorldTimeline" },
      { name: "description", content: "Report breaking news to the WorldTimeline community and earn rewards." },
    ],
  }),
  component: SubmitPage,
});

function SubmitPage() {
  const navigate = useNavigate();
  const { state, award, update } = useAppState();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = title.trim().length >= 10 && detail.trim().length >= 20;

  const submit = () => {
    if (!canSubmit) return;
    update((s) => ({
      ...s,
      submissions: [
        { id: crypto.randomUUID(), title: title.trim(), detail: detail.trim(), at: new Date().toISOString() },
        ...s.submissions,
      ],
    }));
    award("submit_breaking");
    setSubmitted(true);
    setTitle("");
    setDetail("");
    setTimeout(() => navigate({ to: "/" }), 1200);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <section className="rounded-xl border border-breaking/40 bg-surface-1 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-breaking px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
              Breaking
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Submit a tip
            </span>
          </div>
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Report something happening now</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified tips get amplified across the global feed. Earn{" "}
            <span className="text-accent">+{POINTS.submit_breaking} pts</span> per accepted submission.
          </p>
        </section>

        <div className="space-y-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Headline
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is happening?"
              maxLength={140}
              className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
            <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{title.length}/140</div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Details · sources · location
            </label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={6}
              placeholder="What did you see? Who else is reporting? Include any links."
              className="mt-1 w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit || submitted}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-mono text-xs uppercase tracking-wider text-primary-foreground transition disabled:opacity-50"
          >
            {submitted ? (
              <>
                <Check className="h-4 w-4" /> Submitted · +{POINTS.submit_breaking} pts
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" /> Send to newsroom
              </>
            )}
          </button>
        </div>

        {state.submissions.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Your submissions
            </h2>
            <div className="space-y-2">
              {state.submissions.map((s) => (
                <div key={s.id} className="rounded-md border border-border bg-surface-1 p-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Zap className="h-3 w-3 text-accent" /> under review
                  </div>
                  <div className="mt-1 text-sm font-medium">{s.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
