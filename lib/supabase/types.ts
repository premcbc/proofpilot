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
      ai_analysis: {
        Row: {
          artifact_path: string | null
          confidence: number | null
          cost_usd: number | null
          created_at: string
          findings: Json
          id: string
          model_name: string
          model_version: string | null
          organization_id: string
          processing_ms: number | null
          prompt_version: string | null
          raw_response: Json
          recommendation: Database["public"]["Enums"]["review_status"] | null
          review_id: string
          risk_score: number | null
          summary: string | null
          tokens_input: number | null
          tokens_output: number | null
          updated_at: string
        }
        Insert: {
          artifact_path?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          findings?: Json
          id?: string
          model_name: string
          model_version?: string | null
          organization_id: string
          processing_ms?: number | null
          prompt_version?: string | null
          raw_response?: Json
          recommendation?: Database["public"]["Enums"]["review_status"] | null
          review_id: string
          risk_score?: number | null
          summary?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Update: {
          artifact_path?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          findings?: Json
          id?: string
          model_name?: string
          model_version?: string | null
          organization_id?: string
          processing_ms?: number | null
          prompt_version?: string | null
          raw_response?: Json
          recommendation?: Database["public"]["Enums"]["review_status"] | null
          review_id?: string
          risk_score?: number | null
          summary?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last_used_ip: unknown
          name: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last_used_ip?: unknown
          name: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last_used_ip?: unknown
          name?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          metadata: Json
          organization_id: string
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id: string
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          organization_id?: string
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          review_id: string | null
          severity: Database["public"]["Enums"]["risk_level"]
          signal_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          severity?: Database["public"]["Enums"]["risk_level"]
          signal_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string | null
          severity?: Database["public"]["Enums"]["risk_level"]
          signal_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "fraud_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_signals: {
        Row: {
          confidence: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          organization_id: string
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          severity: Database["public"]["Enums"]["risk_level"]
          signal_type: Database["public"]["Enums"]["fraud_signal_type"]
          source_engine: string
          source_version: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          severity?: Database["public"]["Enums"]["risk_level"]
          signal_type: Database["public"]["Enums"]["fraud_signal_type"]
          source_engine: string
          source_version?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          severity?: Database["public"]["Enums"]["risk_level"]
          signal_type?: Database["public"]["Enums"]["fraud_signal_type"]
          source_engine?: string
          source_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_signals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_signals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          engine: string
          engine_version: string | null
          error_message: string | null
          file_id: string
          id: string
          language: string | null
          organization_id: string
          processing_ms: number | null
          raw_text: string | null
          raw_text_tsv: unknown
          review_id: string
          status: string | null
          structured_data: Json
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          engine: string
          engine_version?: string | null
          error_message?: string | null
          file_id: string
          id?: string
          language?: string | null
          organization_id: string
          processing_ms?: number | null
          raw_text?: string | null
          raw_text_tsv?: unknown
          review_id: string
          status?: string | null
          structured_data?: Json
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          engine?: string
          engine_version?: string | null
          error_message?: string | null
          file_id?: string
          id?: string
          language?: string | null
          organization_id?: string
          processing_ms?: number | null
          raw_text?: string | null
          raw_text_tsv?: unknown
          review_id?: string
          status?: string | null
          structured_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_extractions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "review_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_extractions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          organization_id: string
          priority: number
          review_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          organization_id: string
          priority?: number
          review_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          organization_id?: string
          priority?: number
          review_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_counters: {
        Row: {
          organization_id: string
          review_seq: number
          updated_at: string
        }
        Insert: {
          organization_id: string
          review_seq?: number
          updated_at?: string
        }
        Update: {
          organization_id?: string
          review_seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string | null
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          last_active_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          last_active_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          invited_email?: string | null
          last_active_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          locale: string | null
          metadata: Json
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          locale?: string | null
          metadata?: Json
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          locale?: string | null
          metadata?: Json
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["review_action_type"]
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: string
          metadata: Json
          note: string | null
          organization_id: string
          review_id: string
          to_value: string | null
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["review_action_type"]
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          organization_id: string
          review_id: string
          to_value?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["review_action_type"]
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          organization_id?: string
          review_id?: string
          to_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_actions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignee_id: string
          created_at: string
          id: string
          is_current: boolean
          organization_id: string
          reason: string | null
          review_id: string
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          organization_id: string
          reason?: string | null
          review_id: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          organization_id?: string
          reason?: string | null
          review_id?: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_internal: boolean
          mentions: string[]
          organization_id: string
          parent_id: string | null
          review_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          mentions?: string[]
          organization_id: string
          parent_id?: string | null
          review_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          mentions?: string[]
          organization_id?: string
          parent_id?: string | null
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          review_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          review_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_files: {
        Row: {
          bucket: string
          checksum_sha256: string | null
          created_at: string
          file_hash: string | null
          file_name: string
          id: string
          metadata: Json
          mime_type: string | null
          ocr_storage_path: string | null
          organization_id: string
          review_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          checksum_sha256?: string | null
          created_at?: string
          file_hash?: string | null
          file_name: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          ocr_storage_path?: string | null
          organization_id: string
          review_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          checksum_sha256?: string | null
          created_at?: string
          file_hash?: string | null
          file_name?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          ocr_storage_path?: string | null
          organization_id?: string
          review_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_files_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ai_confidence: number | null
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string | null
          due_at: string | null
          escalated: boolean
          escalated_at: string | null
          escalated_to: string | null
          escalation_reason: string | null
          external_ref: string | null
          id: string
          metadata: Json
          organization_id: string
          review_code: string | null
          review_number: number | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number | null
          status: Database["public"]["Enums"]["review_status"]
          submitted_by: string | null
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["review_type"]
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          due_at?: string | null
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          review_code?: string | null
          review_number?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number | null
          status?: Database["public"]["Enums"]["review_status"]
          submitted_by?: string | null
          tags?: string[]
          title: string
          type: Database["public"]["Enums"]["review_type"]
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          due_at?: string | null
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          review_code?: string | null
          review_number?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number | null
          status?: Database["public"]["Enums"]["review_status"]
          submitted_by?: string | null
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["review_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          disabled_at: string | null
          events: string[]
          failure_count: number
          headers: Json
          id: string
          is_active: boolean
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          name: string
          organization_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          disabled_at?: string | null
          events?: string[]
          failure_count?: number
          headers?: Json
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name: string
          organization_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          disabled_at?: string | null
          events?: string[]
          failure_count?: number
          headers?: Json
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          name?: string
          organization_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      organization_directory: {
        Row: {
          accepted_at: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          invited_email: string | null
          last_active_at: string | null
          membership_id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["member_role"] | null
          status: Database["public"]["Enums"]["member_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_invite_token: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string | null
          invited_at: string | null
          invited_by: string | null
          invited_email: string | null
          last_active_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_user_workspace: {
        Args: { p_full_name?: string; p_org_name: string; p_org_slug: string }
        Returns: string
      }
      create_organization_with_admin: {
        Args: {
          p_billing_email?: string
          p_name: string
          p_plan?: string
          p_settings?: Json
          p_slug: string
        }
        Returns: {
          billing_email: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_profile: {
        Args: {
          p_avatar_url?: string
          p_full_name?: string
          p_locale?: string
          p_timezone?: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          locale: string | null
          metadata: Json
          timezone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_active_membership: { Args: never; Returns: Json }
      has_org_role: {
        Args: {
          allowed: Database["public"]["Enums"]["member_role"][]
          org_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      list_organization_members: {
        Args: { p_org_id: string }
        Returns: {
          accepted_at: string
          avatar_url: string
          email: string
          full_name: string
          invited_email: string
          last_active_at: string
          membership_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_current_organization: {
        Args: { p_billing_email?: string; p_name: string }
        Returns: Json
      }
    }
    Enums: {
      alert_status: "open" | "acknowledged" | "resolved" | "dismissed"
      fraud_signal_type:
        | "duplicate_content"
        | "image_manipulation"
        | "metadata_mismatch"
        | "velocity_anomaly"
        | "identity_mismatch"
        | "ocr_inconsistency"
        | "geo_anomaly"
        | "device_anomaly"
        | "pattern_match"
        | "blocklist_hit"
        | "ai_generated_content"
        | "other"
        | "low_ocr_confidence"
        | "blurry_document"
        | "unreadable_regions"
        | "missing_vendor"
        | "missing_invoice_number"
        | "missing_amount"
        | "missing_date"
        | "invalid_date_format"
        | "impossible_amount"
        | "suspicious_currency_format"
        | "cropped_screenshot"
        | "inconsistent_odds_format"
        | "suspicious_formatting"
        | "excessive_missing_fields"
        | "transaction_pattern"
        | "duplicate_submission"
        | "ocr_text_duplicate"
      member_role: "admin" | "manager" | "reviewer" | "analyst" | "viewer"
      member_status: "invited" | "active" | "inactive" | "suspended"
      review_action_type:
        | "created"
        | "assigned"
        | "reassigned"
        | "commented"
        | "status_changed"
        | "risk_updated"
        | "escalated"
        | "de_escalated"
        | "approved"
        | "rejected"
        | "flagged"
        | "reopened"
        | "archived"
        | "ai_rescored"
        | "evidence_added"
      review_status:
        | "pending"
        | "in_progress"
        | "awaiting_info"
        | "escalated"
        | "approved"
        | "rejected"
        | "flagged"
        | "archived"
      review_type: "screenshot" | "document" | "video" | "mixed"
      risk_level: "none" | "low" | "medium" | "high" | "critical"
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
    Enums: {
      alert_status: ["open", "acknowledged", "resolved", "dismissed"],
      fraud_signal_type: [
        "duplicate_content",
        "image_manipulation",
        "metadata_mismatch",
        "velocity_anomaly",
        "identity_mismatch",
        "ocr_inconsistency",
        "geo_anomaly",
        "device_anomaly",
        "pattern_match",
        "blocklist_hit",
        "ai_generated_content",
        "other",
        "low_ocr_confidence",
        "blurry_document",
        "unreadable_regions",
        "missing_vendor",
        "missing_invoice_number",
        "missing_amount",
        "missing_date",
        "invalid_date_format",
        "impossible_amount",
        "suspicious_currency_format",
        "cropped_screenshot",
        "inconsistent_odds_format",
        "suspicious_formatting",
        "excessive_missing_fields",
        "transaction_pattern",
        "duplicate_submission",
        "ocr_text_duplicate",
      ],
      member_role: ["admin", "manager", "reviewer", "analyst", "viewer"],
      member_status: ["invited", "active", "inactive", "suspended"],
      review_action_type: [
        "created",
        "assigned",
        "reassigned",
        "commented",
        "status_changed",
        "risk_updated",
        "escalated",
        "de_escalated",
        "approved",
        "rejected",
        "flagged",
        "reopened",
        "archived",
        "ai_rescored",
        "evidence_added",
      ],
      review_status: [
        "pending",
        "in_progress",
        "awaiting_info",
        "escalated",
        "approved",
        "rejected",
        "flagged",
        "archived",
      ],
      review_type: ["screenshot", "document", "video", "mixed"],
      risk_level: ["none", "low", "medium", "high", "critical"],
    },
  },
} as const
