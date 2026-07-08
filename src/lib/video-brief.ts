import { supabase } from "@/integrations/supabase/client";

export interface VideoBrief {
  title: string;
  brief: string;
}

interface VideoBriefInput {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
}

/**
 * Cached server-side (ai_video_briefs, keyed by video_id) -- the same
 * video showing up across multiple countries' feeds only ever generates
 * one Groq call, not one per region.
 */
export async function getVideoBrief(input: VideoBriefInput): Promise<VideoBrief | null> {
  try {
    const { data, error } = await supabase.functions.invoke("video-brief", {
      body: input,
    });

    if (error) throw error;
    if (!data?.title || !data?.brief) return null;

    return { title: data.title, brief: data.brief };
  } catch (error) {
    console.error("Error in getVideoBrief:", error);
    return null;
  }
}
