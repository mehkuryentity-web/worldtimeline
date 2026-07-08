import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ReactionBar } from "@/components/ReactionBar";
import { getCachedArticle, type NewsItem } from "@/lib/mock-news";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/article/$id")({
  component: ArticlePage,
});

const KEY = "wt_summary_v3";

function load(id: string) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw)[id] : null;
  } catch {
    return null;
  }
}

function save(id: string, lines: string[]) {
  try {
    const raw = localStorage.getItem(KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = lines;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function ArticlePage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const goBack = () => {
    // history.back() is a POP navigation, which is what the router's
    // scrollRestoration actually tracks -- Link to="/" was a PUSH (a fresh
    // visit), which always lands at the top regardless of where the user
    // scrolled to before opening this article.
    if (window.history.length > 1) {
      router.history.back();
    } else {
      // Deep-linked straight into this article (no prior in-app page) --
      // nothing to go back to, so fall back to a normal visit to the feed.
      router.navigate({ to: "/" });
    }
  };


  const [item] = useState<NewsItem | null>(() => getCachedArticle(id));
  const [lines, setLines] = useState<string[]>(() => load(id) ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    if (lines.length) return;

    (async () => {
      setLoading(true);

      const { data } = await supabase.functions.invoke("article-summary", {
        body: {
          id: item.id,
          title: item.title,
          content: item.summary,
          url: item.url,
        },
      });

      const out = data?.lines;

      if (Array.isArray(out) && out.every((l) => typeof l === "string")) {
        setLines(out);
        save(item.id, out);
      }

      setLoading(false);
    })();
  }, [id]);

  if (!item) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <button onClick={goBack} className="text-xs flex gap-1">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <h1 className="text-xl font-semibold">{item.title}</h1>

        {loading && !lines.length ? (
          <div className="flex gap-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Synthesising takeaways...
          </div>
        ) : lines.length ? (
          <div className="space-y-2 text-sm leading-relaxed">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Summary unavailable
          </div>
        )}

        {item.url && item.url !== "#" && (
          <a href={item.url} target="_blank" className="text-xs text-primary">
            Read source <ExternalLink className="h-3 w-3 inline" />
          </a>
        )}

        <ReactionBar item={item} showReadLink={false} />
      </main>

      <BottomNav />
    </div>
  );
}
