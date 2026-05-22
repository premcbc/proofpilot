export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      // ── Core ──────────────────────────────────────────────────────────────────
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          billing_email: string | null
          plan: string
          is_active: boolean
          settings: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          billing_email?: string | null
          plan?: string
          is_active?: boolean
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          billing_email?: string | null
          plan?: string
          is_active?: boolean
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          timezone: string | null
          locale: string | null
          last_seen_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string | null
          locale?: string | null
          last_seen_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          timezone?: string | null
          locale?: string | null
          last_seen_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          invited_email: string | null
          role: string
          status: string
          invite_token: string | null
          invited_by: string | null
          invited_at: string | null
          accepted_at: string | null
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          invite_token?: string | null
          invited_by?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          invite_token?: string | null
          invited_by?: string | null
          invited_at?: string | null
          accepted_at?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
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
      }
      // ── Reviews ───────────────────────────────────────────────────────────────
      reviews: {
        Row: {
          id: string
          organization_id: string
          review_number: number | null
          review_code: string | null
          external_ref: string | null
          title: string
          description: string | null
          type: string
          status: string
          risk_level: string
          risk_score: number | null
          ai_confidence: number | null
          submitted_by: string | null
          assigned_to: string | null
          assigned_at: string | null
          escalated: boolean
          escalated_at: string | null
          escalated_to: string | null
          escalation_reason: string | null
          decided_at: string | null
          decided_by: string | null
          due_at: string | null
          tags: string[]
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_number?: number | null
          review_code?: string | null
          external_ref?: string | null
          title: string
          description?: string | null
          type: string
          status?: string
          risk_level?: string
          risk_score?: number | null
          ai_confidence?: number | null
          submitted_by?: string | null
          assigned_to?: string | null
          assigned_at?: string | null
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          decided_at?: string | null
          decided_by?: string | null
          due_at?: string | null
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_number?: number | null
          review_code?: string | null
          external_ref?: string | null
          title?: string
          description?: string | null
          type?: string
          status?: string
          risk_level?: string
          risk_score?: number | null
          ai_confidence?: number | null
          submitted_by?: string | null
          assigned_to?: string | null
          assigned_at?: string | null
          escalated?: boolean
          escalated_at?: string | null
          escalated_to?: string | null
          escalation_reason?: string | null
          decided_at?: string | null
          decided_by?: string | null
          due_at?: string | null
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      review_files: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          bucket: string
          storage_path: string
          file_name: string
          mime_type: string | null
          size_bytes: number | null
          checksum_sha256: string | null
          uploaded_by: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          bucket?: string
          storage_path: string
          file_name: string
          mime_type?: string | null
          size_bytes?: number | null
          checksum_sha256?: string | null
          uploaded_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          bucket?: string
          storage_path?: string
          file_name?: string
          mime_type?: string | null
          size_bytes?: number | null
          checksum_sha256?: string | null
          uploaded_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      review_actions: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          actor_id: string | null
          action_type: string
          from_value: string | null
          to_value: string | null
          note: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          actor_id?: string | null
          action_type: string
          from_value?: string | null
          to_value?: string | null
          note?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          actor_id?: string | null
          action_type?: string
          from_value?: string | null
          to_value?: string | null
          note?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      review_assignments: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          assignee_id: string
          assigned_by: string | null
          assigned_at: string
          unassigned_at: string | null
          reason: string | null
          is_current: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          assignee_id: string
          assigned_by?: string | null
          assigned_at?: string
          unassigned_at?: string | null
          reason?: string | null
          is_current?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          assignee_id?: string
          assigned_by?: string | null
          assigned_at?: string
          unassigned_at?: string | null
          reason?: string | null
          is_current?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      review_comments: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          parent_id: string | null
          author_id: string | null
          body: string
          is_internal: boolean
          mentions: string[]
          edited_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          parent_id?: string | null
          author_id?: string | null
          body: string
          is_internal?: boolean
          mentions?: string[]
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          parent_id?: string | null
          author_id?: string | null
          body?: string
          is_internal?: boolean
          mentions?: string[]
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // ── AI / OCR / Fraud ──────────────────────────────────────────────────────
      ai_analysis: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          model_name: string
          model_version: string | null
          prompt_version: string | null
          risk_score: number | null
          confidence: number | null
          recommendation: string | null
          summary: string | null
          findings: Json
          raw_response: Json
          artifact_path: string | null
          tokens_input: number | null
          tokens_output: number | null
          cost_usd: number | null
          processing_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          model_name: string
          model_version?: string | null
          prompt_version?: string | null
          risk_score?: number | null
          confidence?: number | null
          recommendation?: string | null
          summary?: string | null
          findings?: Json
          raw_response?: Json
          artifact_path?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          cost_usd?: number | null
          processing_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          model_name?: string
          model_version?: string | null
          prompt_version?: string | null
          risk_score?: number | null
          confidence?: number | null
          recommendation?: string | null
          summary?: string | null
          findings?: Json
          raw_response?: Json
          artifact_path?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          cost_usd?: number | null
          processing_ms?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      ocr_extractions: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          file_id: string
          engine: string
          engine_version: string | null
          language: string | null
          raw_text: string | null
          structured_data: Json
          confidence: number | null
          processing_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          file_id: string
          engine: string
          engine_version?: string | null
          language?: string | null
          raw_text?: string | null
          structured_data?: Json
          confidence?: number | null
          processing_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          file_id?: string
          engine?: string
          engine_version?: string | null
          language?: string | null
          raw_text?: string | null
          structured_data?: Json
          confidence?: number | null
          processing_ms?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      fraud_signals: {
        Row: {
          id: string
          organization_id: string
          review_id: string
          signal_type: string
          severity: string
          confidence: number | null
          source_engine: string
          source_version: string | null
          description: string | null
          metadata: Json
          resolved: boolean
          resolved_by: string | null
          resolved_at: string | null
          resolution_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id: string
          signal_type: string
          severity?: string
          confidence?: number | null
          source_engine: string
          source_version?: string | null
          description?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string
          signal_type?: string
          severity?: string
          confidence?: number | null
          source_engine?: string
          source_version?: string | null
          description?: string | null
          metadata?: Json
          resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      fraud_alerts: {
        Row: {
          id: string
          organization_id: string
          review_id: string | null
          signal_id: string | null
          title: string
          description: string | null
          severity: string
          status: string
          assigned_to: string | null
          acknowledged_by: string | null
          acknowledged_at: string | null
          resolved_by: string | null
          resolved_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id?: string | null
          signal_id?: string | null
          title: string
          description?: string | null
          severity?: string
          status?: string
          assigned_to?: string | null
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string | null
          signal_id?: string | null
          title?: string
          description?: string | null
          severity?: string
          status?: string
          assigned_to?: string | null
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      // ── Audit / API / Webhooks ────────────────────────────────────────────────
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          actor_id: string | null
          actor_type: string
          actor_label: string | null
          entity_type: string
          entity_id: string | null
          action: string
          before_state: Json | null
          after_state: Json | null
          ip_address: string | null
          user_agent: string | null
          request_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          actor_id?: string | null
          actor_type?: string
          actor_label?: string | null
          entity_type: string
          entity_id?: string | null
          action: string
          before_state?: Json | null
          after_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          request_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          actor_id?: string | null
          actor_type?: string
          actor_label?: string | null
          entity_type?: string
          entity_id?: string | null
          action?: string
          before_state?: Json | null
          after_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          request_id?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          organization_id: string
          name: string
          key_prefix: string
          key_hash: string
          scopes: string[]
          created_by: string | null
          last_used_at: string | null
          last_used_ip: string | null
          expires_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          key_prefix: string
          key_hash: string
          scopes?: string[]
          created_by?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          key_prefix?: string
          key_hash?: string
          scopes?: string[]
          created_by?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      webhook_endpoints: {
        Row: {
          id: string
          organization_id: string
          name: string
          url: string
          secret: string
          events: string[]
          is_active: boolean
          description: string | null
          headers: Json
          failure_count: number
          last_success_at: string | null
          last_failure_at: string | null
          last_error: string | null
          disabled_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          url: string
          secret: string
          events?: string[]
          is_active?: boolean
          description?: string | null
          headers?: Json
          failure_count?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          last_error?: string | null
          disabled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          url?: string
          secret?: string
          events?: string[]
          is_active?: boolean
          description?: string | null
          headers?: Json
          failure_count?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          last_error?: string | null
          disabled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      create_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}

// ── Convenience aliases ───────────────────────────────────────────────────────

export type Organization = Database['public']['Tables']['organizations']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewFile = Database['public']['Tables']['review_files']['Row']
export type ReviewAction = Database['public']['Tables']['review_actions']['Row']
export type ReviewAssignment = Database['public']['Tables']['review_assignments']['Row']
export type ReviewComment = Database['public']['Tables']['review_comments']['Row']
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row']
export type AiAnalysis = Database['public']['Tables']['ai_analysis']['Row']
export type OcrExtraction = Database['public']['Tables']['ocr_extractions']['Row']
export type FraudSignal = Database['public']['Tables']['fraud_signals']['Row']
export type FraudAlert = Database['public']['Tables']['fraud_alerts']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type WebhookEndpoint = Database['public']['Tables']['webhook_endpoints']['Row']
