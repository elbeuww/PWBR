/**
 * Types Supabase générés à la main depuis le schéma de la migration 0001.
 *
 * DÉVIATION (01-02) : les types devaient être générés via `supabase gen types typescript`
 * ou le MCP Supabase. La session n'a pas accès au projet Supabase (D-02 : setup différé).
 * Ces types reproduisent fidèlement le schéma de la migration 0001_init_profiles_instruments_job_runs.sql.
 * Ils devront être regénérés après le push schéma via :
 *   supabase gen types typescript --linked > packages/supabase/src/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      instruments: {
        Row: {
          id: string
          symbol: string
          broker: 'oanda' | 'binance'
          asset_class: 'crypto' | 'forex' | 'metal' | 'energy'
          display_name: string
          pip_size: number | null
          min_size: number | null
          precision: number | null
          active: boolean
        }
        Insert: {
          id?: string
          symbol: string
          broker: 'oanda' | 'binance'
          asset_class: 'crypto' | 'forex' | 'metal' | 'energy'
          display_name: string
          pip_size?: number | null
          min_size?: number | null
          precision?: number | null
          active?: boolean
        }
        Update: {
          id?: string
          symbol?: string
          broker?: 'oanda' | 'binance'
          asset_class?: 'crypto' | 'forex' | 'metal' | 'energy'
          display_name?: string
          pip_size?: number | null
          min_size?: number | null
          precision?: number | null
          active?: boolean
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          id: string
          job_name: string
          status: 'running' | 'success' | 'error'
          started_at: string
          finished_at: string | null
          error: string | null
          stats: Json | null
        }
        Insert: {
          id?: string
          job_name: string
          status: 'running' | 'success' | 'error'
          started_at?: string
          finished_at?: string | null
          error?: string | null
          stats?: Json | null
        }
        Update: {
          id?: string
          job_name?: string
          status?: 'running' | 'success' | 'error'
          started_at?: string
          finished_at?: string | null
          error?: string | null
          stats?: Json | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Raccourcis pratiques
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type InstrumentRow = Database['public']['Tables']['instruments']['Row']
export type InstrumentInsert = Database['public']['Tables']['instruments']['Insert']
export type JobRunRow = Database['public']['Tables']['job_runs']['Row']
export type JobRunInsert = Database['public']['Tables']['job_runs']['Insert']
export type JobRunUpdate = Database['public']['Tables']['job_runs']['Update']
export type JobRunStatus = 'running' | 'success' | 'error'
