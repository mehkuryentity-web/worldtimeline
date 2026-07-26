export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_article_summaries: {
        Row: {
          created_at: string
          hook: string | null
          hook_key: string | null
          id: string
          summary: string
        }
        Insert: {
          created_at?: string
          hook?: string | null
          hook_key?: string | null
          id: string
          summary: string
        }
        Update: {
          created_at?: string
          hook?: string | null
          hook_key?: string | null
          id?: string
          summary?: string
        }
        Relationships: []
      }
      ai_briefings: {
        Row: {
          category: string
          conclusion: string
          country: string | null
          created_at: string
          generated_at: string | null
          headlines_hash: string
          id: string
          mode: string
          summary: string
        }
        Insert: {
          category?: string
          conclusion?: string
          country?: string | null
          created_at?: string
          generated_at?: string | null
          headlines_hash: string
          id?: string
          mode?: string
          summary: string
        }
        Update: {
          category?: string
          conclusion?: string
          country?: string | null
          created_at?: string
          generated_at?: string | null
          headlines_hash?: string
          id?: string
          mode?: string
          summary?: string
        }
        Relationships: []
      }
      ai_video_briefs: {
        Row: {
          brief: string
          created_at: string
          title_key: string
          title_label: string
          video_id: string
        }
        Insert: {
          brief: string
          created_at?: string
          title_key: string
          title_label: string
          video_id: string
        }
        Update: {
          brief?: string
          created_at?: string
          title_key?: string
          title_label?: string
          video_id?: string
        }
        Relationships: []
      }
      api_cache: {
        Row: {
          data: Json
          last_error: string | null
          last_error_at: string | null
          last_synced_at: string | null
          source: string
          updated_at: string
        }
        Insert: {
          data?: Json
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          data?: Json
          last_error?: string | null
          last_error_at?: string | null
          last_synced_at?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      grants_archive: {
        Row: {
          amount: number | null
          category: string | null
          country: string | null
          created_at: string
          currency: string | null
          deadline: string | null
          description: string | null
          fetched_at: string
          id: string
          rolling: boolean
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          deadline?: string | null
          description?: string | null
          fetched_at?: string
          id?: string
          rolling?: boolean
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          deadline?: string | null
          description?: string | null
          fetched_at?: string
          id?: string
          rolling?: boolean
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      headline_grounding: {
        Row: {
          fetched_at: string
          snippets: Json
          title: string
        }
        Insert: {
          fetched_at?: string
          snippets?: Json
          title: string
        }
        Update: {
          fetched_at?: string
          snippets?: Json
          title?: string
        }
        Relationships: []
      }
      internships_archive: {
        Row: {
          company: string | null
          country: string | null
          created_at: string
          deadline: string | null
          description: string | null
          duration: string | null
          fetched_at: string
          id: string
          remote: boolean
          rolling: boolean
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          fetched_at?: string
          id?: string
          remote?: boolean
          rolling?: boolean
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          duration?: string | null
          fetched_at?: string
          id?: string
          remote?: boolean
          rolling?: boolean
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      job_archive: {
        Row: {
          company: string | null
          description: string | null
          first_seen_at: string
          job_id: string
          job_types: Json | null
          last_seen_at: string
          location: string | null
          logo_url: string | null
          posted_at: string | null
          remote: boolean | null
          source: string
          tags: Json | null
          title: string | null
          url: string | null
        }
        Insert: {
          company?: string | null
          description?: string | null
          first_seen_at?: string
          job_id: string
          job_types?: Json | null
          last_seen_at?: string
          location?: string | null
          logo_url?: string | null
          posted_at?: string | null
          remote?: boolean | null
          source: string
          tags?: Json | null
          title?: string | null
          url?: string | null
        }
        Update: {
          company?: string | null
          description?: string | null
          first_seen_at?: string
          job_id?: string
          job_types?: Json | null
          last_seen_at?: string
          location?: string | null
          logo_url?: string | null
          posted_at?: string | null
          remote?: boolean | null
          source?: string
          tags?: Json | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      job_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "job_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          job_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          job_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "job_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_matches: {
        Row: {
          created_at: string
          id: string
          job_apply_url: string | null
          job_company: string | null
          job_id: string
          job_location: string | null
          job_title: string | null
          job_type: string | null
          match_score: string | null
          matched_interest: string
          matched_keyword: string | null
          seen: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_apply_url?: string | null
          job_company?: string | null
          job_id: string
          job_location?: string | null
          job_title?: string | null
          job_type?: string | null
          match_score?: string | null
          matched_interest: string
          matched_keyword?: string | null
          seen?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_apply_url?: string | null
          job_company?: string | null
          job_id?: string
          job_location?: string | null
          job_title?: string | null
          job_type?: string | null
          match_score?: string | null
          matched_interest?: string
          matched_keyword?: string | null
          seen?: boolean
          user_id?: string
        }
        Relationships: []
      }
      job_reactions: {
        Row: {
          created_at: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      job_reports: {
        Row: {
          created_at: string
          id: string
          job_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_views: {
        Row: {
          job_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          job_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          job_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      news_archive: {
        Row: {
          author: string | null
          category: string | null
          country: string | null
          enriched: boolean
          external_id: string
          first_seen_at: string
          image: string | null
          last_seen_at: string
          published_at: string | null
          source: string
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          country?: string | null
          enriched?: boolean
          external_id: string
          first_seen_at?: string
          image?: string | null
          last_seen_at?: string
          published_at?: string | null
          source: string
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          country?: string | null
          enriched?: boolean
          external_id?: string
          first_seen_at?: string
          image?: string | null
          last_seen_at?: string
          published_at?: string | null
          source?: string
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      news_items: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          image: string | null
          published_at: string | null
          region: string | null
          source: string | null
          summary: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          published_at?: string | null
          region?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          published_at?: string | null
          region?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      scholarships_archive: {
        Row: {
          award_amount: string | null
          country: string | null
          created_at: string
          deadline: string | null
          description: string | null
          fetched_at: string
          field_of_study: string | null
          funding_type: string | null
          id: string
          level: string | null
          publish_at: string | null
          rolling: boolean
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          award_amount?: string | null
          country?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fetched_at?: string
          field_of_study?: string | null
          funding_type?: string | null
          id?: string
          level?: string | null
          publish_at?: string | null
          rolling?: boolean
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          award_amount?: string | null
          country?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fetched_at?: string
          field_of_study?: string | null
          funding_type?: string | null
          id?: string
          level?: string | null
          publish_at?: string | null
          rolling?: boolean
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string
          interest: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interest: string
          user_id: string
        }
        Update: {
          created_at?: string
          interest?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_archive: {
        Row: {
          category_id: string | null
          channel_title: string | null
          description: string | null
          first_seen_at: string
          last_seen_at: string
          published_at: string | null
          region_code: string
          source: string
          thumbnail_url: string | null
          title: string | null
          video_id: string
          view_count: number | null
        }
        Insert: {
          category_id?: string | null
          channel_title?: string | null
          description?: string | null
          first_seen_at?: string
          last_seen_at?: string
          published_at?: string | null
          region_code?: string
          source: string
          thumbnail_url?: string | null
          title?: string | null
          video_id: string
          view_count?: number | null
        }
        Update: {
          category_id?: string | null
          channel_title?: string | null
          description?: string | null
          first_seen_at?: string
          last_seen_at?: string
          published_at?: string | null
          region_code?: string
          source?: string
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      job_engagement_counts: {
        Row: {
          comment_count: number | null
          interested_count: number | null
          job_id: string | null
          view_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
