import { supabase } from "@/integrations/supabase/client";

interface SummaryPayload {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  source?: string;
  url?: string;
}

export const generateArticleSummary = async ({ data }: { data: SummaryPayload }) => {
  try {
    // Send the full content field directly to the Edge Function
    const { data: responseData, error } = await supabase.functions.invoke("article-summary", {
      body: {
        title: data.title,
        content: data.content || data.summary || "",
      },
    });

    if (error) throw error;

    // Split the text result into lines for the UI to map over
    const recapText = responseData?.recap || "";
    const lines = recapText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return { lines };
  } catch (error: any) {
    console.error("Error in generateArticleSummary server function:", error);
    throw new Error(error.message || "Failed to generate summary");
  }
};
