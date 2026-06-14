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
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
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
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
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
    }
    Views: {
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
    }
    Functions: {
      has_active_subscription: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
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
