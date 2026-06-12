import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ReactionBar } from "@/components/ReactionBar";
import { getCachedArticle, type NewsItem } from "@/lib/mock-news";
import { timeAgo } from "@/lib/format";
import { useAppState } from "@/hooks/use-app-state";

export const Route = createFileRoute("/article/$id")({
  head: () => ({
    meta: [
      { title: "Article · WorldTimeline" },
      { name: "description", content: "Read the full story with source attribution." },
    ],
  }),
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Article not found.</div>
  ),
});

// Build an elaborated summary (>=10 lines) from whatever the source gave us.
// We split available text into paragraphs and append structured context so the
// user has a substantive read before deciding to visit the source.
function buildExtendedParagraphs(item: NewsItem): string[] {
  const base = (item.summary || "").trim();
  const sentences = base
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lead = sentences.slice(0, 2).join(" ") || item.title;
  const middle = sentences.slice(2, 5).join(" ");
  const tail = sentences.slice(5).join(" ");

  const paragraphs: string[] = [];
  paragraphs.push(lead);
  if (middle) paragraphs.push(middle);
  if (tail) paragraphs.push(tail);

  paragraphs.push(
    `Context: this story is filed under ${item.category} and is being reported from ${item.region} by ${item.source}. It was published ${timeAgo(item.publishedAt)}, so details may continue to develop as more outlets confirm or contest the facts.`,
  );
  paragraphs.push(
    `Why it matters: ${item.category} stories in ${item.region} often have downstream effects on policy, markets, and public sentiment. Readers should weigh the framing chosen by ${item.source} against alternative coverage of the same event.`,
  );
  paragraphs.push(
    `What to watch next: follow-up statements from named officials or organizations, corrections to early claims, on-the-ground reporting that adds first-hand accounts, and any timeline updates linking this story to broader ongoing events.`,
  );
  paragraphs.push(
    `How to read this safely: WorldTimeline aggregates third-party reporting. Treat the summary above as a starting point — open the original source for the full reporting, photographs, on-record quotes, and any updates or corrections issued after publication.`,
  );

  return paragraphs;
}

function ArticlePage() {
  const { id } = Route.useParams();
  const { award } = useAppState();
  const [item, setItem] = useState<NewsItem | null>(() => getCachedArticle(id));

  useEffect(() => {
    setItem(getCachedArticle(id));
    award("read_summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const paragraphs = useMemo(() => (item ? buildExtendedParagraphs(item) : []), [item]);

  if (!item) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
          </Link>
          <div className="mt-6 rounded-xl border border-border bg-surface-1 p-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            We couldn't find this story in the local cache. Open it at the source instead.
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const hasSource = Boolean(item.url) && item.url !== "#";

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
        </Link>

        <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="aspect-[16/9] w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="text-primary">{item.category}</span>
              <span>·</span>
              <span>{item.source}</span>
              <span>·</span>
              <span>{item.region}</span>
              <span className="ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(item.publishedAt)}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight">
              {item.title}
            </h1>

            <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {hasSource && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => award("read_article")}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground"
              >
                Read full article at source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <ReactionBar item={item} showReadLink={false} defaultCommentsOpen />
        </article>
      </main>
      <BottomNav />
    </div>
  );
}
