export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          email: string
          display_name: string | null
          role: string
          avatar_url: string | null
          initials: string | null
          color: string | null
          reviews_count: number
          approvals_count: number
          joined_at: string
          status: string
          created_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          email: string
          display_name?: string | null
          role?: string
          avatar_url?: string | null
          initials?: string | null
          color?: string | null
          reviews_count?: number
          approvals_count?: number
          joined_at?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          email?: string
          display_name?: string | null
          role?: string
          avatar_url?: string | null
          initials?: string | null
          color?: string | null
          reviews_count?: number
          approvals_count?: number
          joined_at?: string
          status?: string
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          organization_id: string
          external_id: string
          status: string
          submitter: string
          submitter_email: string | null
          platform: string | null
          amount: string | null
          campaign_id: string | null
          campaign_name: string | null
          risk_score: number
          confidence: number
          file_type: string | null
          file_size: string | null
          resolution: string | null
          sla_deadline: string | null
          sla_status: string | null
          assigned_to: string | null
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          external_id: string
          status?: string
          submitter: string
          submitter_email?: string | null
          platform?: string | null
          amount?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          risk_score?: number
          confidence?: number
          file_type?: string | null
          file_size?: string | null
          resolution?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          assigned_to?: string | null
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          external_id?: string
          status?: string
          submitter?: string
          submitter_email?: string | null
          platform?: string | null
          amount?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          risk_score?: number
          confidence?: number
          file_type?: string | null
          file_size?: string | null
          resolution?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          assigned_to?: string | null
          submitted_at?: string
          created_at?: string
        }
      }
      review_ocr_fields: {
        Row: {
          id: string
          review_id: string
          label: string
          value: string
          confidence: number
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          label: string
          value: string
          confidence?: number
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          label?: string
          value?: string
          confidence?: number
          created_at?: string
        }
      }
      review_fraud_checks: {
        Row: {
          id: string
          review_id: string
          label: string
          detail: string
          passed: boolean
          severity: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          label: string
          detail: string
          passed?: boolean
          severity?: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          label?: string
          detail?: string
          passed?: boolean
          severity?: string
          created_at?: string
        }
      }
      review_audit_log: {
        Row: {
          id: string
          review_id: string
          organization_id: string
          actor: string
          actor_type: string
          action: string
          detail: string
          action_type: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          organization_id: string
          actor: string
          actor_type?: string
          action: string
          detail: string
          action_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          organization_id?: string
          actor?: string
          actor_type?: string
          action?: string
          detail?: string
          action_type?: string
          created_at?: string
        }
      }
      fraud_alerts: {
        Row: {
          id: string
          organization_id: string
          review_id: string | null
          signal_type: string
          severity: string
          detail: string | null
          description: string | null
          submitter: string | null
          event_count: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id?: string | null
          signal_type: string
          severity: string
          detail?: string | null
          description?: string | null
          submitter?: string | null
          event_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string | null
          signal_type?: string
          severity?: string
          detail?: string | null
          description?: string | null
          submitter?: string | null
          event_count?: number
          created_at?: string
        }
      }
      fraud_rules: {
        Row: {
          id: string
          organization_id: string
          name: string
          model: string | null
          status: string
          detections: number
          accuracy: number | null
          accuracy_display: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          model?: string | null
          status?: string
          detections?: number
          accuracy?: number | null
          accuracy_display?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          model?: string | null
          status?: string
          detections?: number
          accuracy?: number | null
          accuracy_display?: string | null
          created_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          organization_id: string
          review_id: string | null
          review_external_id: string | null
          action: string
          actor: string
          actor_type: string
          initials: string | null
          color: string | null
          detail: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          review_id?: string | null
          review_external_id?: string | null
          action: string
          actor: string
          actor_type?: string
          initials?: string | null
          color?: string | null
          detail?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          review_id?: string | null
          review_external_id?: string | null
          action?: string
          actor?: string
          actor_type?: string
          initials?: string | null
          color?: string | null
          detail?: string | null
          created_at?: string
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

export type Organization = Database['public']['Tables']['organizations']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewOcrField = Database['public']['Tables']['review_ocr_fields']['Row']
export type ReviewFraudCheck = Database['public']['Tables']['review_fraud_checks']['Row']
export type ReviewAuditEntry = Database['public']['Tables']['review_audit_log']['Row']
export type FraudAlert = Database['public']['Tables']['fraud_alerts']['Row']
export type FraudRule = Database['public']['Tables']['fraud_rules']['Row']
export type ActivityEvent = Database['public']['Tables']['activity_log']['Row']
