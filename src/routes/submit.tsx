import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Radio, Zap, Check, ImagePlus, X, Send } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { POINTS } from "@/lib/rewards";
import type { UserPost } from "@/lib/rewards";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Breaking News · WorldTimeline" },
      { name: "description", content: "Report breaking news to the WorldTimeline community and earn rewards." },
    ],
  }),
  component: SubmitPage,
});

type MediaItem = { type: "image" | "video"; dataUrl: string; name: string };

const MAX_FILES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB cap to keep localStorage healthy

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function SubmitPage() {
  const navigate = useNavigate();
  const { state, award, update } = useAppState();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [publishToFeed, setPublishToFeed] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim().length >= 10 && detail.trim().length >= 20 && !submitted;

  const onPickFiles = async (files: FileList | null) => {
    setErr(null);
    if (!files) return;
    const next: MediaItem[] = [...media];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) {
        setErr(`Up to ${MAX_FILES} files only.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErr(`${file.name} is over 5MB and was skipped.`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setErr(`${file.name} is not an image or video.`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        next.push({ type: isImage ? "image" : "video", dataUrl, name: file.name });
      } catch {
        setErr(`Couldn't read ${file.name}.`);
      }
    }
    setMedia(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeMedia = (i: number) => setMedia((m) => m.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!canSubmit) return;
    const id = crypto.randomUUID();
    const at = new Date().toISOString();
    const trimmedTitle = title.trim();
    const trimmedDetail = detail.trim();

    update((s) => {
      const next = { ...s };
      next.submissions = [
        { id, title: trimmedTitle, detail: trimmedDetail, at },
        ...s.submissions,
      ];
      if (publishToFeed) {
        const post: UserPost = {
          id: `up_${id}`,
          title: trimmedTitle,
          summary: trimmedDetail,
          category: "Top",
          region: "Community",
          publishedAt: at,
          media: media.map(({ type, dataUrl }) => ({ type, dataUrl })),
        };
        next.userPosts = [post, ...(s.userPosts ?? [])].slice(0, 50);
      }
      return next;
    });

    award("submit_breaking");
    setSubmitted(true);
    setTitle("");
    setDetail("");
    setMedia([]);
    setTimeout(() => navigate({ to: "/" }), 1000);
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
            Optional photos or video help verify. Posts can publish directly to the community feed —
            reader reactions and AI vetting determine whether they get amplified or flagged. Earn{" "}
            <span className="text-accent">+{POINTS.submit_breaking} pts</span> per submission.
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
            <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
              {title.length}/140
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Story · sources · location
            </label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={6}
              placeholder="What did you see? Who else is reporting? Include any links."
              className="mt-1 w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Media · up to {MAX_FILES} (images / video, 5MB each)
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {media.map((m, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-surface-2"
                >
                  {m.type === "image" ? (
                    <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <video src={m.dataUrl} className="h-full w-full object-cover" muted />
                  )}
                  <button
                    onClick={() => removeMedia(i)}
                    aria-label={`Remove ${m.name}`}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {media.length < MAX_FILES && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface-1 text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="font-mono text-[9px] uppercase tracking-wider">Add</span>
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>
            {err && <p className="mt-1 text-[11px] text-destructive">{err}</p>}
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={publishToFeed}
              onChange={(e) => setPublishToFeed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium">Post directly to the feed</span>
              <span className="block text-xs text-muted-foreground">
                Reader reactions and AI vetting will decide if it stays or gets flagged as fake news.
              </span>
            </span>
          </label>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-mono text-xs uppercase tracking-wider text-primary-foreground transition disabled:opacity-50"
          >
            {submitted ? (
              <>
                <Check className="h-4 w-4" /> Submitted · +{POINTS.submit_breaking} pts
              </>
            ) : publishToFeed ? (
              <>
                <Send className="h-4 w-4" /> Publish to feed
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
