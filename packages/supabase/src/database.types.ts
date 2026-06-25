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
      analyses: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          model: string
          prompt_version: string
          run_id: string
          schema_version: string
          session: string
          snapshot: Json
          source: string
          style: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          model: string
          prompt_version: string
          run_id: string
          schema_version: string
          session: string
          snapshot: Json
          source?: string
          style: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          model?: string
          prompt_version?: string
          run_id?: string
          schema_version?: string
          session?: string
          snapshot?: Json
          source?: string
          style?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_drivers: {
        Row: {
          direction: number
          driver_code: string
          id: string
          instrument_id: string
          weight: number
        }
        Insert: {
          direction: number
          driver_code: string
          id?: string
          instrument_id: string
          weight?: number
        }
        Update: {
          direction?: number
          driver_code?: string
          id?: string
          instrument_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_drivers_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      candles: {
        Row: {
          close: number
          high: number
          id: string
          instrument_id: string
          low: number
          open: number
          timeframe: string
          ts: string
          volume: number | null
        }
        Insert: {
          close: number
          high: number
          id?: string
          instrument_id: string
          low: number
          open: number
          timeframe: string
          ts: string
          volume?: number | null
        }
        Update: {
          close?: number
          high?: number
          id?: string
          instrument_id?: string
          low?: number
          open?: number
          timeframe?: string
          ts?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candles_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_calendar: {
        Row: {
          country: string | null
          event_at: string
          event_key: string
          forecast: string | null
          id: string
          impact: string | null
          previous: string | null
          source: string
          title: string
        }
        Insert: {
          country?: string | null
          event_at: string
          event_key: string
          forecast?: string | null
          id?: string
          impact?: string | null
          previous?: string | null
          source: string
          title: string
        }
        Update: {
          country?: string | null
          event_at?: string
          event_key?: string
          forecast?: string | null
          id?: string
          impact?: string | null
          previous?: string | null
          source?: string
          title?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          active: boolean
          asset_class: string
          broker: string
          canonical_symbol: string | null
          display_name: string
          id: string
          min_size: number | null
          pip_size: number | null
          precision: number | null
          price_decimals: number | null
          quote_hours: string | null
          source_symbol: string | null
          symbol: string
        }
        Insert: {
          active?: boolean
          asset_class: string
          broker: string
          canonical_symbol?: string | null
          display_name: string
          id?: string
          min_size?: number | null
          pip_size?: number | null
          precision?: number | null
          price_decimals?: number | null
          quote_hours?: string | null
          source_symbol?: string | null
          symbol: string
        }
        Update: {
          active?: boolean
          asset_class?: string
          broker?: string
          canonical_symbol?: string | null
          display_name?: string
          id?: string
          min_size?: number | null
          pip_size?: number | null
          precision?: number | null
          price_decimals?: number | null
          quote_hours?: string | null
          source_symbol?: string | null
          symbol?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          started_at: string
          stats: Json | null
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          started_at?: string
          stats?: Json | null
          status: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          started_at?: string
          stats?: Json | null
          status?: string
        }
        Relationships: []
      }
      macro_series: {
        Row: {
          id: string
          series_code: string
          ts: string
          value: number
        }
        Insert: {
          id?: string
          series_code: string
          ts: string
          value: number
        }
        Update: {
          id?: string
          series_code?: string
          ts?: string
          value?: number
        }
        Relationships: []
      }
      news: {
        Row: {
          id: string
          impact: string | null
          instrument_ids: string[]
          published_at: string
          sentiment: number | null
          source: string
          summary: string | null
          title: string
          url_hash: string
        }
        Insert: {
          id?: string
          impact?: string | null
          instrument_ids?: string[]
          published_at: string
          sentiment?: number | null
          source: string
          summary?: string | null
          title: string
          url_hash: string
        }
        Update: {
          id?: string
          impact?: string | null
          instrument_ids?: string[]
          published_at?: string
          sentiment?: number | null
          source?: string
          summary?: string | null
          title?: string
          url_hash?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          // CR-02 / T-04-PREC: colonnes Postgres `bigint`. PostgREST sérialise
          // bigint en `string` (JSON) car >2^53 dépasse IEEE-754. Le type généré
          // par défaut (number) est faux pour les gros montants atomiques USDT —
          // override manuel en `string`. NE PAS regénérer sans ré-appliquer.
          amount_atomic: string | null
          created_at: string
          expected_amount_atomic: string
          id: string
          plan: string
          reject_reason: string | null
          reservation_expires_at: string | null
          screenshot_url: string | null
          source: string
          status: string
          tx_hash: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          // bigint -> string (voir Row ci-dessus).
          amount_atomic?: string | null
          created_at?: string
          expected_amount_atomic: string
          id?: string
          plan: string
          reject_reason?: string | null
          reservation_expires_at?: string | null
          screenshot_url?: string | null
          source?: string
          status?: string
          tx_hash: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          // bigint -> string (voir Row ci-dessus).
          amount_atomic?: string | null
          created_at?: string
          expected_amount_atomic?: string
          id?: string
          plan?: string
          reject_reason?: string | null
          reservation_expires_at?: string | null
          screenshot_url?: string | null
          source?: string
          status?: string
          tx_hash?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_outcomes: {
        Row: {
          candle_count: number | null
          outcome: string
          realized_r: number
          resolved_at: string
          setup_id: string
          source: string
        }
        Insert: {
          candle_count?: number | null
          outcome: string
          realized_r: number
          resolved_at?: string
          setup_id: string
          source?: string
        }
        Update: {
          candle_count?: number | null
          outcome?: string
          realized_r?: number
          resolved_at?: string
          setup_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_outcomes_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: true
            referencedRelation: "trade_setups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          source?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          computed_for_ts: string
          content_hash: string
          created_at: string
          id: string
          instrument_id: string
          kind: string
          partial: boolean
          payload: Json
          style: string
          timeframe_set: string
        }
        Insert: {
          computed_for_ts: string
          content_hash: string
          created_at?: string
          id?: string
          instrument_id: string
          kind: string
          partial?: boolean
          payload: Json
          style: string
          timeframe_set: string
        }
        Update: {
          computed_for_ts?: string
          content_hash?: string
          created_at?: string
          id?: string
          instrument_id?: string
          kind?: string
          partial?: boolean
          payload?: Json
          style?: string
          timeframe_set?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_posts: {
        Row: {
          dedupe_key: string
          id: string
          post_type: string
          posted_at: string
          run_id: string | null
          tg_message_id: number | null
        }
        Insert: {
          dedupe_key: string
          id?: string
          post_type: string
          posted_at?: string
          run_id?: string | null
          tg_message_id?: number | null
        }
        Update: {
          dedupe_key?: string
          id?: string
          post_type?: string
          posted_at?: string
          run_id?: string | null
          tg_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_posts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_setups: {
        Row: {
          analysis_id: string
          confidence: string
          created_at: string
          direction: string
          entry_price: number
          id: string
          instrument_id: string
          opportunity_score: number
          payload: Json
          risk_level: string
          risk_reward: number
          session: string
          session_day: string
          source: string
          status: string
          stop_loss: number
          style: string
          take_profits: Json
          valid_until: string
        }
        Insert: {
          analysis_id: string
          confidence: string
          created_at?: string
          direction: string
          entry_price: number
          id?: string
          instrument_id: string
          opportunity_score: number
          payload: Json
          risk_level: string
          risk_reward: number
          session: string
          session_day: string
          source?: string
          status?: string
          stop_loss: number
          style: string
          take_profits: Json
          valid_until: string
        }
        Update: {
          analysis_id?: string
          confidence?: string
          created_at?: string
          direction?: string
          entry_price?: number
          id?: string
          instrument_id?: string
          opportunity_score?: number
          payload?: Json
          risk_level?: string
          risk_reward?: number
          session?: string
          session_day?: string
          source?: string
          status?: string
          stop_loss?: number
          style?: string
          take_profits?: Json
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_setups_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_setups_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          created_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_codes: {
        Row: {
          affiliate_id: string
          code: string
          created_at: string
        }
        Insert: {
          affiliate_id: string
          code: string
          created_at?: string
        }
        Update: {
          affiliate_id?: string
          code?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_codes_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_applications: {
        Row: {
          applicant_email: string
          created_at: string
          facebook: string | null
          id: string
          interactions: string | null
          reject_reason: string | null
          social_links: string | null
          status: string
          subscriber_count: number | null
          telegram: string | null
        }
        Insert: {
          applicant_email: string
          created_at?: string
          facebook?: string | null
          id?: string
          interactions?: string | null
          reject_reason?: string | null
          social_links?: string | null
          status?: string
          subscriber_count?: number | null
          telegram?: string | null
        }
        Update: {
          applicant_email?: string
          created_at?: string
          facebook?: string | null
          id?: string
          interactions?: string | null
          reject_reason?: string | null
          social_links?: string | null
          status?: string
          subscriber_count?: number | null
          telegram?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          affiliate_id: string
          attributed_at: string
          id: string
          user_id: string
        }
        Insert: {
          affiliate_id: string
          attributed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string
          attributed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          // CR-02 / T-07: bigint Postgres -> string (PostgREST). NE PAS regénérer sans ré-appliquer.
          affiliate_id: string
          amount_atomic: string
          base_atomic: string
          created_at: string
          id: string
          period: string
          rate_bps: number
          referral_id: string | null
          source: string
          status: string
        }
        Insert: {
          // bigint -> string (voir Row).
          affiliate_id: string
          amount_atomic?: string
          base_atomic?: string
          created_at?: string
          id?: string
          period: string
          rate_bps: number
          referral_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          // bigint -> string (voir Row).
          affiliate_id?: string
          amount_atomic?: string
          base_atomic?: string
          created_at?: string
          id?: string
          period?: string
          rate_bps?: number
          referral_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          // CR-02 / T-07: bigint Postgres -> string (PostgREST). NE PAS regénérer sans ré-appliquer.
          amount_atomic: string
          commission_id: string
          id: string
          paid_at: string
          tx_hash: string
        }
        Insert: {
          // bigint -> string (voir Row).
          amount_atomic: string
          commission_id: string
          id?: string
          paid_at?: string
          tx_hash: string
        }
        Update: {
          // bigint -> string (voir Row).
          amount_atomic?: string
          commission_id?: string
          id?: string
          paid_at?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      affiliate_dashboard: {
        Row: {
          active_referrals: number | null
          affiliate_id: string | null
          commissions_due_atomic: string | null
          commissions_paid_atomic: string | null
          revenue_current_month_atomic: string | null
          revenue_total_atomic: string | null
          total_signups: number | null
        }
        Relationships: []
      }
      pattern_stats: {
        Row: {
          avg_r: number | null
          bucket: string | null
          dimension: string | null
          expectancy: number | null
          n: number | null
          period: string | null
          win_rate: number | null
        }
        Relationships: []
      }
      v_data_freshness: {
        Row: {
          canonical_symbol: string | null
          instrument_id: string | null
          is_stale: boolean | null
          last_ts: string | null
          quote_hours: string | null
          timeframe: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candles_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_mrr: {
        // Phase 17 (0017) — matview de référence MRR « cash encaissé par mois »
        // (checkpoint A1, option B). revenue_atomic = bigint Postgres -> string
        // (PostgREST, comme les autres *_atomic). NE PAS regénérer sans ré-appliquer.
        Row: {
          month: string | null
          payments_count: number | null
          revenue_atomic: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      affiliate_rate_bps: {
        Args: { p_signups: number }
        Returns: number
      }
      compute_affiliate_commissions: {
        Args: { p_period: string }
        Returns: Json
      }
      mark_commission_paid: {
        Args: {
          p_amount_atomic: number
          p_commission_id: string
          p_tx_hash: string
        }
        Returns: undefined
      }
      activate_subscription_for_payment: {
        Args: {
          p_payment_id: string
          p_period: string
          p_plan: string
          p_user_id: string
        }
        Returns: undefined
      }
      has_active_subscription: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      get_mrr: {
        // Phase 17 (0017) — lecture gated de mv_mrr (SECURITY DEFINER, is_superadmin()).
        // setof public.mv_mrr -> tableau du Row mv_mrr (revenue_atomic string).
        Args: never
        Returns: {
          month: string | null
          payments_count: number | null
          revenue_atomic: string | null
        }[]
      }
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

// ---------------------------------------------------------------------------
// Alias de convenance (maintenus à la main — réappliquer après chaque
// régénération `supabase gen types`). Source de vérité : les Tables/Views/Enums
// générés ci-dessus. Ces alias stabilisent les imports applicatifs.
// ---------------------------------------------------------------------------

// Enums applicatifs (string-literal unions — pas de pg enum côté DB)
export type Broker = 'oanda' | 'binance'
export type AssetClass = 'crypto' | 'forex' | 'metal' | 'energy'
export type JobRunStatus = 'running' | 'success' | 'error'
export type Timeframe = 'H1' | 'H4' | 'D'
export type QuoteHours = '24/7' | 'fx'
export type CalendarImpact = 'High' | 'Medium' | 'Low'
export type SnapshotStyle = 'day' | 'swing'
export type SnapshotKind = 'technical' | 'fundamental' | 'news' | 'combined'

// Phase 1 — profils / instruments / job_runs
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type InstrumentRow = Database['public']['Tables']['instruments']['Row']
export type InstrumentInsert = Database['public']['Tables']['instruments']['Insert']
export type JobRunRow = Database['public']['Tables']['job_runs']['Row']
export type JobRunInsert = Database['public']['Tables']['job_runs']['Insert']
export type JobRunUpdate = Database['public']['Tables']['job_runs']['Update']

// Phase 2 — ingestion
export type CandleRow = Database['public']['Tables']['candles']['Row']
export type CandleInsert = Database['public']['Tables']['candles']['Insert']
export type NewsRow = Database['public']['Tables']['news']['Row']
export type NewsInsert = Database['public']['Tables']['news']['Insert']
export type MacroSeriesRow = Database['public']['Tables']['macro_series']['Row']
export type MacroSeriesInsert = Database['public']['Tables']['macro_series']['Insert']
export type EconomicCalendarRow = Database['public']['Tables']['economic_calendar']['Row']
export type EconomicCalendarInsert = Database['public']['Tables']['economic_calendar']['Insert']
export type DataFreshnessRow = Database['public']['Views']['v_data_freshness']['Row']

// Phase 3 — moteur déterministe
export type SnapshotRow = Database['public']['Tables']['snapshots']['Row']
export type SnapshotInsert = Database['public']['Tables']['snapshots']['Insert']
export type AssetDriverRow = Database['public']['Tables']['asset_drivers']['Row']
export type AssetDriverInsert = Database['public']['Tables']['asset_drivers']['Insert']

// Phase 4 — moteur IA vétéran & scoring
export type TradeDirection = 'long' | 'short'
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme'
export type Confidence = 'low' | 'moderate' | 'high'
export type SetupStatus = 'active' | 'invalidated' | 'expired'
export type AnalysisRow = Database['public']['Tables']['analyses']['Row']
export type AnalysisInsert = Database['public']['Tables']['analyses']['Insert']
export type TradeSetupRow = Database['public']['Tables']['trade_setups']['Row']
export type TradeSetupInsert = Database['public']['Tables']['trade_setups']['Insert']

// Phase 4 — paiement USDT & abonnement
export type UserRole = 'member' | 'affiliate' | 'superadmin'
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'canceled'
export type SubscriptionPlan = 'discovery' | 'standard'
export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row']
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']
export type ProfileUpdateSafe = Omit<Database['public']['Tables']['profiles']['Update'], 'role'>

// Phase 5 — track record (TRACK-01/02) — issues rejouées + vue agrégée pattern_stats
export type PredictionOutcomeRow = Database['public']['Tables']['prediction_outcomes']['Row']
export type PredictionOutcomeInsert = Database['public']['Tables']['prediction_outcomes']['Insert']
export type PredictionOutcomeUpdate = Database['public']['Tables']['prediction_outcomes']['Update']

// Phase 6 — canal Telegram public (TG-03) — idempotence des publications
export type TelegramPostRow = Database['public']['Tables']['telegram_posts']['Row']
export type TelegramPostInsert = Database['public']['Tables']['telegram_posts']['Insert']
export type TelegramPostUpdate = Database['public']['Tables']['telegram_posts']['Update']

// Phase 7 — affiliation à paliers (AFF-01..05, migration 0016) — alias maison.
// *_atomic typés string (CR-02 : bigint Postgres -> string PostgREST).
export type AffiliateStatus = 'pending' | 'approved' | 'rejected'
export type CommissionStatus = 'due' | 'paid'
export type AffiliateRow = Database['public']['Tables']['affiliates']['Row']
export type AffiliateInsert = Database['public']['Tables']['affiliates']['Insert']
export type AffiliateCodeRow = Database['public']['Tables']['affiliate_codes']['Row']
export type AffiliateCodeInsert = Database['public']['Tables']['affiliate_codes']['Insert']
export type AffiliateApplicationRow = Database['public']['Tables']['affiliate_applications']['Row']
export type AffiliateApplicationInsert = Database['public']['Tables']['affiliate_applications']['Insert']
export type AffiliateApplicationUpdate = Database['public']['Tables']['affiliate_applications']['Update']
export type ReferralRow = Database['public']['Tables']['referrals']['Row']
export type ReferralInsert = Database['public']['Tables']['referrals']['Insert']
export type CommissionRow = Database['public']['Tables']['commissions']['Row']
export type CommissionInsert = Database['public']['Tables']['commissions']['Insert']
export type CommissionUpdate = Database['public']['Tables']['commissions']['Update']
export type PayoutRow = Database['public']['Tables']['payouts']['Row']
export type PayoutInsert = Database['public']['Tables']['payouts']['Insert']
export type AffiliateDashboardRow = Database['public']['Views']['affiliate_dashboard']['Row']

// Phase 17 — fondation DB scalable (0017) — matview de référence MRR « cash encaissé »
// gated via get_mrr() (D-02/SCALE-03). revenue_atomic string (bigint -> PostgREST).
export type MvMrrRow = Database['public']['Views']['mv_mrr']['Row']
