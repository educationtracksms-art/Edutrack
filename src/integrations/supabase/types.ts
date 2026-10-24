// Regenerated from supabase/migrations by scripts/generate-supabase-types.mjs.
// To refresh after adding migrations, run: node scripts/generate-supabase-types.mjs
// (When the Supabase CLI is available, prefer: supabase gen types typescript)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string;
          id: string;
          is_current: boolean;
          name: string;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          name : string;
          school_id : string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      account_categories: {
        Row: {
          account_type: string;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          school_id: string;
        };
        Insert: {
          account_type : string;
          code : string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name : string;
          school_id : string;
        };
        Update: {
          account_type?: string;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_categories_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_actions: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          request_id: string;
          school_id: string;
        };
        Insert: {
          action : string;
          actor_id?: string | null;
          actor_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          request_id : string;
          school_id : string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          request_id?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_actions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_actions_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "approval_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_requests: {
        Row: {
          amount: number;
          approvals_recorded: number;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          payload: Json;
          reference: string | null;
          requested_at: string;
          requested_by: string | null;
          required_approvals: number;
          school_id: string;
          status: string;
          summary: string;
        };
        Insert: {
          amount?: number;
          approvals_recorded?: number;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          entity_id?: string | null;
          entity_type : string;
          id?: string;
          payload?: Json;
          reference?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          required_approvals?: number;
          school_id : string;
          status?: string;
          summary : string;
        };
        Update: {
          amount?: number;
          approvals_recorded?: number;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          payload?: Json;
          reference?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          required_approvals?: number;
          school_id?: string;
          status?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_rules: {
        Row: {
          approver_permission: string;
          created_at: string;
          entity_type: string;
          id: string;
          is_active: boolean;
          label: string | null;
          required_approvals: number;
          school_id: string;
          threshold_amount: number;
          updated_at: string;
        };
        Insert: {
          approver_permission?: string;
          created_at?: string;
          entity_type : string;
          id?: string;
          is_active?: boolean;
          label?: string | null;
          required_approvals?: number;
          school_id : string;
          threshold_amount?: number;
          updated_at?: string;
        };
        Update: {
          approver_permission?: string;
          created_at?: string;
          entity_type?: string;
          id?: string;
          is_active?: boolean;
          label?: string | null;
          required_approvals?: number;
          school_id?: string;
          threshold_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_rules_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      approved_invoices: {
        Row: {
          amount: number;
          approval_note: string | null;
          approval_status: string;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          department_name: string | null;
          due_date: string | null;
          id: string;
          invoice_date: string;
          invoice_number: string;
          payment_voucher_id: string | null;
          purchase_order_id: string | null;
          school_id: string;
          status: string;
          supplier_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          approval_note?: string | null;
          approval_status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          department_name?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string;
          invoice_number : string;
          payment_voucher_id?: string | null;
          purchase_order_id?: string | null;
          school_id : string;
          status?: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approval_note?: string | null;
          approval_status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          department_name?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          payment_voucher_id?: string | null;
          purchase_order_id?: string | null;
          school_id?: string;
          status?: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approved_invoices_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approved_invoices_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approved_invoices_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approved_invoices_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_edit_grants: {
        Row: {
          assessment_id: string;
          granted_at: string;
          granted_by: string | null;
          granted_by_name: string | null;
          id: string;
          reason: string | null;
          revoked_at: string | null;
          school_id: string;
          teacher_id: string;
        };
        Insert: {
          assessment_id : string;
          granted_at?: string;
          granted_by?: string | null;
          granted_by_name?: string | null;
          id?: string;
          reason?: string | null;
          revoked_at?: string | null;
          school_id : string;
          teacher_id : string;
        };
        Update: {
          assessment_id?: string;
          granted_at?: string;
          granted_by?: string | null;
          granted_by_name?: string | null;
          id?: string;
          reason?: string | null;
          revoked_at?: string | null;
          school_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_edit_grants_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_edit_grants_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_periods: {
        Row: {
          exam_type: string;
          id: string;
          is_active: boolean;
          is_locked: boolean;
          school_id: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          exam_type : string;
          id?: string;
          is_active?: boolean;
          is_locked?: boolean;
          school_id : string;
          term_id : string;
          updated_at?: string;
        };
        Update: {
          exam_type?: string;
          id?: string;
          is_active?: boolean;
          is_locked?: boolean;
          school_id?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_periods_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_periods_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          approver_name: string | null;
          approver_role: string | null;
          created_at: string;
          exam_type: string;
          formative: number | null;
          grade_descriptor: string | null;
          id: string;
          is_missing: boolean;
          locked: boolean;
          paper_id: string | null;
          rejection_reason: string | null;
          school_id: string;
          status: string;
          student_id: string;
          subject_id: string;
          submitted_at: string | null;
          submitted_by: string | null;
          summative: number | null;
          teacher_initials: string | null;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          approver_name?: string | null;
          approver_role?: string | null;
          created_at?: string;
          exam_type?: string;
          formative?: number | null;
          grade_descriptor?: string | null;
          id?: string;
          is_missing?: boolean;
          locked?: boolean;
          paper_id?: string | null;
          rejection_reason?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          subject_id : string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          summative?: number | null;
          teacher_initials?: string | null;
          term_id : string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          approver_name?: string | null;
          approver_role?: string | null;
          created_at?: string;
          exam_type?: string;
          formative?: number | null;
          grade_descriptor?: string | null;
          id?: string;
          is_missing?: boolean;
          locked?: boolean;
          paper_id?: string | null;
          rejection_reason?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          subject_id?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          summative?: number | null;
          teacher_initials?: string | null;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_absence_alerts: {
        Row: {
          consecutive_days: number;
          created_at: string;
          id: string;
          notified_at: string;
          notified_by: string | null;
          parent_phone: string | null;
          school_id: string;
          sms_communication_id: string | null;
          streak_end_date: string;
          streak_start_date: string;
          student_id: string;
          term_id: string | null;
        };
        Insert: {
          consecutive_days?: number;
          created_at?: string;
          id?: string;
          notified_at?: string;
          notified_by?: string | null;
          parent_phone?: string | null;
          school_id : string;
          sms_communication_id?: string | null;
          streak_end_date : string;
          streak_start_date : string;
          student_id : string;
          term_id?: string | null;
        };
        Update: {
          consecutive_days?: number;
          created_at?: string;
          id?: string;
          notified_at?: string;
          notified_by?: string | null;
          parent_phone?: string | null;
          school_id?: string;
          sms_communication_id?: string | null;
          streak_end_date?: string;
          streak_start_date?: string;
          student_id?: string;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_absence_alerts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_absence_alerts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_absence_alerts_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_absence_alerts_notified_by_fkey";
            columns: ["notified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          attendance_date: string;
          created_at: string;
          id: string;
          recorded_by: string | null;
          school_id: string;
          status: string;
          student_id: string;
          term_id: string | null;
        };
        Insert: {
          attendance_date : string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          term_id?: string | null;
        };
        Update: {
          attendance_date?: string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_summaries: {
        Row: {
          days_absent: number;
          days_present: number;
          id: string;
          school_id: string;
          student_id: string;
          term_id: string;
          total_days: number;
        };
        Insert: {
          days_absent?: number;
          days_present?: number;
          id?: string;
          school_id : string;
          student_id : string;
          term_id : string;
          total_days?: number;
        };
        Update: {
          days_absent?: number;
          days_present?: number;
          id?: string;
          school_id?: string;
          student_id?: string;
          term_id?: string;
          total_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_summaries_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_summaries_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_summaries_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          entity: string | null;
          id: string;
          ip_address: string | null;
          school_id: string | null;
          user_agent: string | null;
          user_id: string | null;
          user_name: string | null;
          user_role: string | null;
        };
        Insert: {
          action : string;
          created_at?: string;
          details?: Json | null;
          entity?: string | null;
          id?: string;
          ip_address?: string | null;
          school_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          user_name?: string | null;
          user_role?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          entity?: string | null;
          id?: string;
          ip_address?: string | null;
          school_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          user_name?: string | null;
          user_role?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs_finance: {
        Row: {
          action: string;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: string;
          module: string;
          new_value: Json | null;
          previous_value: Json | null;
          reason: string | null;
          school_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action : string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          module?: string;
          new_value?: Json | null;
          previous_value?: Json | null;
          reason?: string | null;
          school_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          module?: string;
          new_value?: Json | null;
          previous_value?: Json | null;
          reason?: string | null;
          school_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_finance_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_finance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_lines: {
        Row: {
          account_id: string | null;
          actual_amount: number;
          approved_amount: number;
          budget_category: string;
          budget_id: string;
          committed_amount: number;
          created_at: string;
          id: string;
          notes: string | null;
          period_name: string | null;
          proposed_amount: number;
          revised_amount: number;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          actual_amount?: number;
          approved_amount?: number;
          budget_category : string;
          budget_id : string;
          committed_amount?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          period_name?: string | null;
          proposed_amount?: number;
          revised_amount?: number;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          actual_amount?: number;
          approved_amount?: number;
          budget_category?: string;
          budget_id?: string;
          committed_amount?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          period_name?: string | null;
          proposed_amount?: number;
          revised_amount?: number;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_lines_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_lines_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          department_name: string | null;
          financial_year_id: string;
          id: string;
          school_id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          department_name?: string | null;
          financial_year_id : string;
          id?: string;
          school_id : string;
          status?: string;
          title : string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          department_name?: string | null;
          financial_year_id?: string;
          id?: string;
          school_id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_financial_year_id_fkey";
            columns: ["financial_year_id"];
            isOneToOne: false;
            referencedRelation: "financial_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chart_of_accounts: {
        Row: {
          account_type: string;
          branch_id: string | null;
          category: string;
          category_id: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          fund_id: string | null;
          id: string;
          is_active: boolean;
          is_bank_account: boolean;
          is_control_account: boolean;
          is_locked: boolean;
          is_system_account: boolean;
          name: string;
          normal_balance: string;
          parent_account_id: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          account_type : string;
          branch_id?: string | null;
          category : string;
          category_id?: string | null;
          code : string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fund_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_bank_account?: boolean;
          is_control_account?: boolean;
          is_locked?: boolean;
          is_system_account?: boolean;
          name : string;
          normal_balance?: string;
          parent_account_id?: string | null;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          account_type?: string;
          branch_id?: string | null;
          category?: string;
          category_id?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          fund_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_bank_account?: boolean;
          is_control_account?: boolean;
          is_locked?: boolean;
          is_system_account?: boolean;
          name?: string;
          normal_balance?: string;
          parent_account_id?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey";
            columns: ["parent_account_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          class_teacher_id: string | null;
          created_at: string;
          education_level: string;
          id: string;
          level: number | null;
          name: string;
          school_id: string;
        };
        Insert: {
          class_teacher_id?: string | null;
          created_at?: string;
          education_level?: string;
          id?: string;
          level?: number | null;
          name : string;
          school_id : string;
        };
        Update: {
          class_teacher_id?: string | null;
          created_at?: string;
          education_level?: string;
          id?: string;
          level?: number | null;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      co_curricular: {
        Row: {
          clubs: string | null;
          games: string | null;
          id: string;
          projects: string | null;
          school_id: string;
          student_id: string;
          term_id: string;
        };
        Insert: {
          clubs?: string | null;
          games?: string | null;
          id?: string;
          projects?: string | null;
          school_id : string;
          student_id : string;
          term_id : string;
        };
        Update: {
          clubs?: string | null;
          games?: string | null;
          id?: string;
          projects?: string | null;
          school_id?: string;
          student_id?: string;
          term_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "co_curricular_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "co_curricular_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "co_curricular_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_actions: {
        Row: {
          action_type: string;
          amount_promised: number | null;
          case_id: string;
          channel: string;
          created_at: string;
          follow_up_date: string | null;
          id: string;
          notes: string | null;
          outcome: string | null;
          performed_by: string | null;
          performed_by_name: string | null;
          promised_date: string | null;
          school_id: string;
          student_id: string;
        };
        Insert: {
          action_type : string;
          amount_promised?: number | null;
          case_id : string;
          channel?: string;
          created_at?: string;
          follow_up_date?: string | null;
          id?: string;
          notes?: string | null;
          outcome?: string | null;
          performed_by?: string | null;
          performed_by_name?: string | null;
          promised_date?: string | null;
          school_id : string;
          student_id : string;
        };
        Update: {
          action_type?: string;
          amount_promised?: number | null;
          case_id?: string;
          channel?: string;
          created_at?: string;
          follow_up_date?: string | null;
          id?: string;
          notes?: string | null;
          outcome?: string | null;
          performed_by?: string | null;
          performed_by_name?: string | null;
          promised_date?: string | null;
          school_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_actions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_actions_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "collection_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_actions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_actions_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_cases: {
        Row: {
          age_bucket: string;
          assigned_to: string | null;
          balance_amount: number;
          case_number: string;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          escalation_level: number;
          id: string;
          last_action_at: string | null;
          next_action_at: string | null;
          opened_at: string;
          priority: string;
          resolution_note: string | null;
          resolved_at: string | null;
          school_id: string;
          status: string;
          stream_id: string | null;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          age_bucket?: string;
          assigned_to?: string | null;
          balance_amount?: number;
          case_number : string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          escalation_level?: number;
          id?: string;
          last_action_at?: string | null;
          next_action_at?: string | null;
          opened_at?: string;
          priority?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          school_id : string;
          status?: string;
          stream_id?: string | null;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          age_bucket?: string;
          assigned_to?: string | null;
          balance_amount?: number;
          case_number?: string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          escalation_level?: number;
          id?: string;
          last_action_at?: string | null;
          next_action_at?: string | null;
          opened_at?: string;
          priority?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          school_id?: string;
          status?: string;
          stream_id?: string | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_cases_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_cases_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_cases_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_cases_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_cases_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_cases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          amount: number;
          created_at: string;
          credit_note_number: string;
          id: string;
          invoice_id: string | null;
          issued_by: string | null;
          journal_entry_id: string | null;
          note_date: string;
          reason: string | null;
          school_id: string;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          credit_note_number : string;
          id?: string;
          invoice_id?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          note_date?: string;
          reason?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          credit_note_number?: string;
          id?: string;
          invoice_id?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          note_date?: string;
          reason?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "student_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      debit_notes: {
        Row: {
          amount: number;
          created_at: string;
          debit_note_number: string;
          id: string;
          invoice_id: string | null;
          issued_by: string | null;
          journal_entry_id: string | null;
          note_date: string;
          reason: string | null;
          school_id: string;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          debit_note_number : string;
          id?: string;
          invoice_id?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          note_date?: string;
          reason?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          debit_note_number?: string;
          id?: string;
          invoice_id?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          note_date?: string;
          reason?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debit_notes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debit_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debit_notes_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "student_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debit_notes_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      department_heads: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          department_id: string;
          end_date: string | null;
          id: string;
          is_active: boolean;
          school_id: string;
          start_date: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          department_id : string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          school_id : string;
          start_date?: string;
          teacher_id : string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          department_id?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          school_id?: string;
          start_date?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "department_heads_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_heads_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_heads_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_heads_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          description: string | null;
          hod_user_id: string | null;
          id: string;
          name: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          hod_user_id?: string | null;
          id?: string;
          name : string;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          hod_user_id?: string | null;
          id?: string;
          name?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      donors: {
        Row: {
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          school_id: string;
        };
        Insert: {
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name : string;
          phone?: string | null;
          school_id : string;
        };
        Update: {
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "donors_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_toggles: {
        Row: {
          enabled: boolean;
          id: string;
          module: string;
          school_id: string;
        };
        Insert: {
          enabled?: boolean;
          id?: string;
          module : string;
          school_id : string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          module?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_toggles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_adjustments: {
        Row: {
          academic_year_id: string | null;
          adjustment_type: string;
          amount: number;
          applied_amount: number;
          approval_request_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          award_type: string;
          calculation: string;
          created_at: string;
          donor_id: string | null;
          effective_from: string;
          effective_to: string | null;
          fee_category_id: string | null;
          gl_account_code: string | null;
          id: string;
          invoice_id: string | null;
          journal_entry_id: string | null;
          name: string;
          notes: string | null;
          policy_reference: string | null;
          rate: number | null;
          reason: string | null;
          requested_by: string | null;
          school_id: string;
          sponsor_name: string | null;
          status: string;
          student_id: string;
          term_id: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          adjustment_type : string;
          amount?: number;
          applied_amount?: number;
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          award_type?: string;
          calculation?: string;
          created_at?: string;
          donor_id?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          fee_category_id?: string | null;
          gl_account_code?: string | null;
          id?: string;
          invoice_id?: string | null;
          journal_entry_id?: string | null;
          name : string;
          notes?: string | null;
          policy_reference?: string | null;
          rate?: number | null;
          reason?: string | null;
          requested_by?: string | null;
          school_id : string;
          sponsor_name?: string | null;
          status?: string;
          student_id : string;
          term_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          adjustment_type?: string;
          amount?: number;
          applied_amount?: number;
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          award_type?: string;
          calculation?: string;
          created_at?: string;
          donor_id?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          fee_category_id?: string | null;
          gl_account_code?: string | null;
          id?: string;
          invoice_id?: string | null;
          journal_entry_id?: string | null;
          name?: string;
          notes?: string | null;
          policy_reference?: string | null;
          rate?: number | null;
          reason?: string | null;
          requested_by?: string | null;
          school_id?: string;
          sponsor_name?: string | null;
          status?: string;
          student_id?: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_adjustments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_fee_category_id_fkey";
            columns: ["fee_category_id"];
            isOneToOne: false;
            referencedRelation: "fee_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "student_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_approval_request_id_fkey";
            columns: ["approval_request_id"];
            isOneToOne: false;
            referencedRelation: "approval_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_adjustments_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_categories: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          gl_account_code: string | null;
          id: string;
          is_active: boolean;
          is_optional: boolean;
          is_recurring: boolean;
          is_system: boolean;
          name: string;
          school_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code : string;
          created_at?: string;
          description?: string | null;
          gl_account_code?: string | null;
          id?: string;
          is_active?: boolean;
          is_optional?: boolean;
          is_recurring?: boolean;
          is_system?: boolean;
          name : string;
          school_id : string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          gl_account_code?: string | null;
          id?: string;
          is_active?: boolean;
          is_optional?: boolean;
          is_recurring?: boolean;
          is_system?: boolean;
          name?: string;
          school_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_categories_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_structure_lines: {
        Row: {
          amount: number;
          created_at: string;
          description: string | null;
          fee_category_id: string;
          gl_account_code: string | null;
          id: string;
          is_mandatory: boolean;
          is_optional: boolean;
          name: string;
          pro_rate_allowed: boolean;
          school_id: string;
          sort_order: number;
          structure_id: string;
          tax_rate: number;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          fee_category_id : string;
          gl_account_code?: string | null;
          id?: string;
          is_mandatory?: boolean;
          is_optional?: boolean;
          name : string;
          pro_rate_allowed?: boolean;
          school_id : string;
          sort_order?: number;
          structure_id : string;
          tax_rate?: number;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          fee_category_id?: string;
          gl_account_code?: string | null;
          id?: string;
          is_mandatory?: boolean;
          is_optional?: boolean;
          name?: string;
          pro_rate_allowed?: boolean;
          school_id?: string;
          sort_order?: number;
          structure_id?: string;
          tax_rate?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_structure_lines_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structure_lines_structure_id_fkey";
            columns: ["structure_id"];
            isOneToOne: false;
            referencedRelation: "fee_structures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structure_lines_fee_category_id_fkey";
            columns: ["fee_category_id"];
            isOneToOne: false;
            referencedRelation: "fee_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_structures: {
        Row: {
          academic_year_id: string;
          boarding_status: string;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_date: string | null;
          education_level: string | null;
          effective_from: string;
          id: string;
          installments_allowed: number;
          is_optional: boolean;
          name: string;
          notes: string | null;
          published_at: string | null;
          published_by: string | null;
          school_id: string;
          status: string;
          stream_id: string | null;
          student_category: string;
          term_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          academic_year_id : string;
          boarding_status?: string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          education_level?: string | null;
          effective_from?: string;
          id?: string;
          installments_allowed?: number;
          is_optional?: boolean;
          name : string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          school_id : string;
          status?: string;
          stream_id?: string | null;
          student_category?: string;
          term_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          academic_year_id?: string;
          boarding_status?: string;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          education_level?: string | null;
          effective_from?: string;
          id?: string;
          installments_allowed?: number;
          is_optional?: boolean;
          name?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          school_id?: string;
          status?: string;
          stream_id?: string | null;
          student_category?: string;
          term_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fee_structures_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_structures_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_attachments: {
        Row: {
          category: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          file_name: string;
          file_path: string;
          id: string;
          is_verified: boolean;
          mime_type: string | null;
          notes: string | null;
          school_id: string;
          size_bytes: number | null;
          uploaded_by: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          entity_id : string;
          entity_type : string;
          file_name : string;
          file_path : string;
          id?: string;
          is_verified?: boolean;
          mime_type?: string | null;
          notes?: string | null;
          school_id : string;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          file_name?: string;
          file_path?: string;
          id?: string;
          is_verified?: boolean;
          mime_type?: string | null;
          notes?: string | null;
          school_id?: string;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_attachments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_attachments_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_bank_accounts: {
        Row: {
          account_name: string;
          account_number: string;
          bank_branch: string | null;
          bank_name: string;
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          gl_account_code: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          opening_balance: number;
          opening_balance_date: string | null;
          remarks: string | null;
          school_id: string;
          swift_code: string | null;
          updated_at: string;
        };
        Insert: {
          account_name : string;
          account_number : string;
          bank_branch?: string | null;
          bank_name : string;
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          opening_balance?: number;
          opening_balance_date?: string | null;
          remarks?: string | null;
          school_id : string;
          swift_code?: string | null;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          account_number?: string;
          bank_branch?: string | null;
          bank_name?: string;
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          opening_balance?: number;
          opening_balance_date?: string | null;
          remarks?: string | null;
          school_id?: string;
          swift_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_bank_accounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_accounts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "finance_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_bank_reconciliation_items: {
        Row: {
          bank_transaction_id: string | null;
          created_at: string;
          id: string;
          item_type: string;
          match_status: string;
          matched_at: string | null;
          matched_by: string | null;
          notes: string | null;
          reconciliation_id: string;
          school_id: string;
          statement_amount: number | null;
          statement_date: string | null;
          statement_reference: string | null;
          system_amount: number | null;
          variance: number;
        };
        Insert: {
          bank_transaction_id?: string | null;
          created_at?: string;
          id?: string;
          item_type?: string;
          match_status?: string;
          matched_at?: string | null;
          matched_by?: string | null;
          notes?: string | null;
          reconciliation_id : string;
          school_id : string;
          statement_amount?: number | null;
          statement_date?: string | null;
          statement_reference?: string | null;
          system_amount?: number | null;
          variance?: number;
        };
        Update: {
          bank_transaction_id?: string | null;
          created_at?: string;
          id?: string;
          item_type?: string;
          match_status?: string;
          matched_at?: string | null;
          matched_by?: string | null;
          notes?: string | null;
          reconciliation_id?: string;
          school_id?: string;
          statement_amount?: number | null;
          statement_date?: string | null;
          statement_reference?: string | null;
          system_amount?: number | null;
          variance?: number;
        };
        Relationships: [
          {
            foreignKeyName: "finance_bank_reconciliation_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliation_items_reconciliation_id_fkey";
            columns: ["reconciliation_id"];
            isOneToOne: false;
            referencedRelation: "finance_bank_reconciliations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliation_items_bank_transaction_id_fkey";
            columns: ["bank_transaction_id"];
            isOneToOne: false;
            referencedRelation: "finance_bank_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliation_items_matched_by_fkey";
            columns: ["matched_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_bank_reconciliations: {
        Row: {
          adjustments: number;
          bank_account_id: string;
          book_balance: number;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          difference: number;
          id: string;
          journal_entry_id: string | null;
          outstanding_deposits: number;
          outstanding_withdrawals: number;
          period_end: string | null;
          period_start: string | null;
          prepared_at: string;
          prepared_by: string | null;
          reconciliation_number: string;
          remarks: string | null;
          school_id: string;
          statement_closing_balance: number;
          statement_date: string;
          statement_opening_balance: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          adjustments?: number;
          bank_account_id : string;
          book_balance?: number;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          difference?: number;
          id?: string;
          journal_entry_id?: string | null;
          outstanding_deposits?: number;
          outstanding_withdrawals?: number;
          period_end?: string | null;
          period_start?: string | null;
          prepared_at?: string;
          prepared_by?: string | null;
          reconciliation_number : string;
          remarks?: string | null;
          school_id : string;
          statement_closing_balance?: number;
          statement_date : string;
          statement_opening_balance?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          adjustments?: number;
          bank_account_id?: string;
          book_balance?: number;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          difference?: number;
          id?: string;
          journal_entry_id?: string | null;
          outstanding_deposits?: number;
          outstanding_withdrawals?: number;
          period_end?: string | null;
          period_start?: string | null;
          prepared_at?: string;
          prepared_by?: string | null;
          reconciliation_number?: string;
          remarks?: string | null;
          school_id?: string;
          statement_closing_balance?: number;
          statement_date?: string;
          statement_opening_balance?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_bank_reconciliations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliations_bank_account_id_fkey";
            columns: ["bank_account_id"];
            isOneToOne: false;
            referencedRelation: "finance_bank_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliations_prepared_by_fkey";
            columns: ["prepared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_reconciliations_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_bank_transactions: {
        Row: {
          amount: number;
          bank_account_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          direction: string;
          id: string;
          journal_entry_id: string | null;
          reconciliation_id: string | null;
          reference: string | null;
          school_id: string;
          source_module: string | null;
          source_record_id: string | null;
          statement_reference: string | null;
          status: string;
          transaction_date: string;
          value_date: string | null;
        };
        Insert: {
          amount?: number;
          bank_account_id : string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          reconciliation_id?: string | null;
          reference?: string | null;
          school_id : string;
          source_module?: string | null;
          source_record_id?: string | null;
          statement_reference?: string | null;
          status?: string;
          transaction_date?: string;
          value_date?: string | null;
        };
        Update: {
          amount?: number;
          bank_account_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          reconciliation_id?: string | null;
          reference?: string | null;
          school_id?: string;
          source_module?: string | null;
          source_record_id?: string | null;
          statement_reference?: string | null;
          status?: string;
          transaction_date?: string;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_bank_transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_transactions_bank_account_id_fkey";
            columns: ["bank_account_id"];
            isOneToOne: false;
            referencedRelation: "finance_bank_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_bank_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_branches: {
        Row: {
          address: string | null;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          name: string;
          phone: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          code : string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          name : string;
          phone?: string | null;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          name?: string;
          phone?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_branches_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_cash_accounts: {
        Row: {
          branch_id: string | null;
          cashier_id: string | null;
          collection_point: string | null;
          created_at: string;
          created_by: string | null;
          float_limit: number | null;
          gl_account_code: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
          opening_balance: number;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          cashier_id?: string | null;
          collection_point?: string | null;
          created_at?: string;
          created_by?: string | null;
          float_limit?: number | null;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name : string;
          opening_balance?: number;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          cashier_id?: string | null;
          collection_point?: string | null;
          created_at?: string;
          created_by?: string | null;
          float_limit?: number | null;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          opening_balance?: number;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_cash_accounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cash_accounts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "finance_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cash_accounts_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cash_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_cash_transactions: {
        Row: {
          amount: number;
          cash_account_id: string;
          created_at: string;
          description: string | null;
          direction: string;
          id: string;
          journal_entry_id: string | null;
          recorded_by: string | null;
          reference: string | null;
          school_id: string;
          source_module: string | null;
          source_record_id: string | null;
          status: string;
          transaction_date: string;
        };
        Insert: {
          amount?: number;
          cash_account_id : string;
          created_at?: string;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          school_id : string;
          source_module?: string | null;
          source_record_id?: string | null;
          status?: string;
          transaction_date?: string;
        };
        Update: {
          amount?: number;
          cash_account_id?: string;
          created_at?: string;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          school_id?: string;
          source_module?: string | null;
          source_record_id?: string | null;
          status?: string;
          transaction_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_cash_transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cash_transactions_cash_account_id_fkey";
            columns: ["cash_account_id"];
            isOneToOne: false;
            referencedRelation: "finance_cash_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cash_transactions_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_communications: {
        Row: {
          body: string | null;
          channel: string;
          created_at: string;
          delivered_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          failure_reason: string | null;
          id: string;
          message_type: string;
          recipient_address: string | null;
          recipient_name: string | null;
          recipient_type: string;
          school_id: string;
          sent_at: string | null;
          sent_by: string | null;
          status: string;
          student_id: string | null;
          subject: string | null;
        };
        Insert: {
          body?: string | null;
          channel?: string;
          created_at?: string;
          delivered_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          failure_reason?: string | null;
          id?: string;
          message_type : string;
          recipient_address?: string | null;
          recipient_name?: string | null;
          recipient_type?: string;
          school_id : string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
          student_id?: string | null;
          subject?: string | null;
        };
        Update: {
          body?: string | null;
          channel?: string;
          created_at?: string;
          delivered_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          failure_reason?: string | null;
          id?: string;
          message_type?: string;
          recipient_address?: string | null;
          recipient_name?: string | null;
          recipient_type?: string;
          school_id?: string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: string;
          student_id?: string | null;
          subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_communications_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_communications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_communications_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_cost_centers: {
        Row: {
          code: string;
          created_at: string;
          department_id: string | null;
          id: string;
          is_active: boolean;
          name: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          code : string;
          created_at?: string;
          department_id?: string | null;
          id?: string;
          is_active?: boolean;
          name : string;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          department_id?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_cost_centers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_cost_centers_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_funds: {
        Row: {
          code: string;
          created_at: string;
          donor_id: string | null;
          fund_type: string;
          id: string;
          is_active: boolean;
          name: string;
          restriction_notes: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          code : string;
          created_at?: string;
          donor_id?: string | null;
          fund_type?: string;
          id?: string;
          is_active?: boolean;
          name : string;
          restriction_notes?: string | null;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          donor_id?: string | null;
          fund_type?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          restriction_notes?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_funds_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_mobile_money_accounts: {
        Row: {
          account_name: string;
          created_at: string;
          created_by: string | null;
          gl_account_code: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          merchant_number: string;
          opening_balance: number;
          provider_code: string;
          provider_name: string;
          remarks: string | null;
          school_id: string;
          settlement_account_code: string | null;
          updated_at: string;
        };
        Insert: {
          account_name : string;
          created_at?: string;
          created_by?: string | null;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          merchant_number : string;
          opening_balance?: number;
          provider_code : string;
          provider_name : string;
          remarks?: string | null;
          school_id : string;
          settlement_account_code?: string | null;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          created_at?: string;
          created_by?: string | null;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          merchant_number?: string;
          opening_balance?: number;
          provider_code?: string;
          provider_name?: string;
          remarks?: string | null;
          school_id?: string;
          settlement_account_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_mobile_money_accounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_mobile_money_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_mobile_money_transactions: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          direction: string;
          id: string;
          journal_entry_id: string | null;
          mobile_money_account_id: string;
          payer_name: string | null;
          payer_phone: string | null;
          reconciliation_status: string;
          school_id: string;
          settlement_status: string;
          source_module: string | null;
          source_record_id: string | null;
          student_id: string | null;
          transaction_date: string;
          transaction_reference: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_account_id : string;
          payer_name?: string | null;
          payer_phone?: string | null;
          reconciliation_status?: string;
          school_id : string;
          settlement_status?: string;
          source_module?: string | null;
          source_record_id?: string | null;
          student_id?: string | null;
          transaction_date?: string;
          transaction_reference : string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direction?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_account_id?: string;
          payer_name?: string | null;
          payer_phone?: string | null;
          reconciliation_status?: string;
          school_id?: string;
          settlement_status?: string;
          source_module?: string | null;
          source_record_id?: string | null;
          student_id?: string | null;
          transaction_date?: string;
          transaction_reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_mobile_money_transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_mobile_money_transactions_mobile_money_account_id_fkey";
            columns: ["mobile_money_account_id"];
            isOneToOne: false;
            referencedRelation: "finance_mobile_money_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_mobile_money_transactions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_mobile_money_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_number_sequences: {
        Row: {
          current_value: number;
          document_type: string;
          id: string;
          last_reset_year: number | null;
          pad_width: number;
          prefix: string;
          reset_yearly: boolean;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          current_value?: number;
          document_type : string;
          id?: string;
          last_reset_year?: number | null;
          pad_width?: number;
          prefix : string;
          reset_yearly?: boolean;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          current_value?: number;
          document_type?: string;
          id?: string;
          last_reset_year?: number | null;
          pad_width?: number;
          prefix?: string;
          reset_yearly?: boolean;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_number_sequences_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_payment_methods: {
        Row: {
          bank_account_id: string | null;
          cash_account_id: string | null;
          category: string;
          code: string;
          created_at: string;
          gl_account_code: string | null;
          id: string;
          instructions: string | null;
          is_active: boolean;
          is_mobile_money: boolean;
          is_system: boolean;
          mobile_money_account_id: string | null;
          name: string;
          provider_name: string | null;
          requires_bank_account: boolean;
          requires_instrument_number: boolean;
          requires_reference: boolean;
          school_id: string;
          sort_order: number;
          supports_settlement: boolean;
          updated_at: string;
        };
        Insert: {
          bank_account_id?: string | null;
          cash_account_id?: string | null;
          category?: string;
          code : string;
          created_at?: string;
          gl_account_code?: string | null;
          id?: string;
          instructions?: string | null;
          is_active?: boolean;
          is_mobile_money?: boolean;
          is_system?: boolean;
          mobile_money_account_id?: string | null;
          name : string;
          provider_name?: string | null;
          requires_bank_account?: boolean;
          requires_instrument_number?: boolean;
          requires_reference?: boolean;
          school_id : string;
          sort_order?: number;
          supports_settlement?: boolean;
          updated_at?: string;
        };
        Update: {
          bank_account_id?: string | null;
          cash_account_id?: string | null;
          category?: string;
          code?: string;
          created_at?: string;
          gl_account_code?: string | null;
          id?: string;
          instructions?: string | null;
          is_active?: boolean;
          is_mobile_money?: boolean;
          is_system?: boolean;
          mobile_money_account_id?: string | null;
          name?: string;
          provider_name?: string | null;
          requires_bank_account?: boolean;
          requires_instrument_number?: boolean;
          requires_reference?: boolean;
          school_id?: string;
          sort_order?: number;
          supports_settlement?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_payment_methods_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_permission_catalog: {
        Row: {
          category: string;
          description: string | null;
          is_sensitive: boolean;
          label: string;
          permission_key: string;
        };
        Insert: {
          category : string;
          description?: string | null;
          is_sensitive?: boolean;
          label : string;
          permission_key : string;
        };
        Update: {
          category?: string;
          description?: string | null;
          is_sensitive?: boolean;
          label?: string;
          permission_key?: string;
        };
        Relationships: [];
      };
      finance_petty_cash_accounts: {
        Row: {
          created_at: string;
          created_by: string | null;
          custodian_id: string | null;
          float_amount: number;
          gl_account_code: string;
          id: string;
          is_active: boolean;
          name: string;
          replenish_threshold: number;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          custodian_id?: string | null;
          float_amount?: number;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          name : string;
          replenish_threshold?: number;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          custodian_id?: string | null;
          float_amount?: number;
          gl_account_code?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          replenish_threshold?: number;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_petty_cash_accounts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_petty_cash_accounts_custodian_id_fkey";
            columns: ["custodian_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_petty_cash_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_petty_cash_transactions: {
        Row: {
          amount: number;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          expense_id: string | null;
          id: string;
          journal_entry_id: string | null;
          payee: string | null;
          petty_cash_account_id: string;
          receipt_reference: string | null;
          school_id: string;
          status: string;
          transaction_date: string;
          transaction_type: string;
        };
        Insert: {
          amount?: number;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expense_id?: string | null;
          id?: string;
          journal_entry_id?: string | null;
          payee?: string | null;
          petty_cash_account_id : string;
          receipt_reference?: string | null;
          school_id : string;
          status?: string;
          transaction_date?: string;
          transaction_type?: string;
        };
        Update: {
          amount?: number;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expense_id?: string | null;
          id?: string;
          journal_entry_id?: string | null;
          payee?: string | null;
          petty_cash_account_id?: string;
          receipt_reference?: string | null;
          school_id?: string;
          status?: string;
          transaction_date?: string;
          transaction_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_petty_cash_transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_petty_cash_transactions_petty_cash_account_id_fkey";
            columns: ["petty_cash_account_id"];
            isOneToOne: false;
            referencedRelation: "finance_petty_cash_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_petty_cash_transactions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_petty_cash_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_requests: {
        Row: {
          amount: number;
          attachment_path: string | null;
          created_at: string;
          date_needed: string | null;
          description: string;
          finance_remarks: string | null;
          hod_id: string;
          id: string;
          priority: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          school_id: string;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          attachment_path?: string | null;
          created_at?: string;
          date_needed?: string | null;
          description : string;
          finance_remarks?: string | null;
          hod_id : string;
          id?: string;
          priority?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id : string;
          status?: string;
          subject : string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          attachment_path?: string | null;
          created_at?: string;
          date_needed?: string | null;
          description?: string;
          finance_remarks?: string | null;
          hod_id?: string;
          id?: string;
          priority?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_requests_hod_id_fkey";
            columns: ["hod_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_role_permissions: {
        Row: {
          granted: boolean;
          id: string;
          limit_amount: number | null;
          permission_key: string;
          role: string;
          school_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          granted?: boolean;
          id?: string;
          limit_amount?: number | null;
          permission_key : string;
          role : string;
          school_id : string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          granted?: boolean;
          id?: string;
          limit_amount?: number | null;
          permission_key?: string;
          role?: string;
          school_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_role_permissions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_role_permissions_permission_key_fkey";
            columns: ["permission_key"];
            isOneToOne: false;
            referencedRelation: "finance_permission_catalog";
            referencedColumns: ["permission_key"];
          },
          {
            foreignKeyName: "finance_role_permissions_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_settings: {
        Row: {
          accumulated_depreciation_account_code: string;
          allow_advance_payments: boolean;
          allow_over_budget: boolean;
          approval_threshold_amount: number;
          asset_account_code: string;
          auto_allocate_payments: boolean;
          bank_account_code: string;
          bank_charges_account_code: string;
          cash_account_code: string;
          created_at: string;
          created_by: string | null;
          credit_note_prefix: string;
          currency: string;
          currency_symbol: string;
          debit_note_prefix: string;
          default_fee_due_days: number;
          depreciation_account_code: string;
          discount_account_code: string;
          expense_account_code: string;
          fee_income_account_code: string;
          fiscal_year_start_month: number;
          grant_income_account_code: string;
          id: string;
          invoice_prefix: string;
          journal_prefix: string;
          late_payment_grace_days: number;
          mobile_money_account_code: string;
          number_pad_width: number;
          other_income_account_code: string;
          payable_account_code: string;
          payment_prefix: string;
          payroll_payable_account_code: string;
          petty_cash_float_limit: number;
          receipt_prefix: string;
          receivable_account_code: string;
          reminder_days_before_due: number;
          require_adjustment_approval: boolean;
          require_expense_approval: boolean;
          require_journal_approval: boolean;
          require_refund_approval: boolean;
          reset_numbering_yearly: boolean;
          school_id: string;
          statutory_payable_account_code: string;
          updated_at: string;
        };
        Insert: {
          accumulated_depreciation_account_code?: string;
          allow_advance_payments?: boolean;
          allow_over_budget?: boolean;
          approval_threshold_amount?: number;
          asset_account_code?: string;
          auto_allocate_payments?: boolean;
          bank_account_code?: string;
          bank_charges_account_code?: string;
          cash_account_code?: string;
          created_at?: string;
          created_by?: string | null;
          credit_note_prefix?: string;
          currency?: string;
          currency_symbol?: string;
          debit_note_prefix?: string;
          default_fee_due_days?: number;
          depreciation_account_code?: string;
          discount_account_code?: string;
          expense_account_code?: string;
          fee_income_account_code?: string;
          fiscal_year_start_month?: number;
          grant_income_account_code?: string;
          id?: string;
          invoice_prefix?: string;
          journal_prefix?: string;
          late_payment_grace_days?: number;
          mobile_money_account_code?: string;
          number_pad_width?: number;
          other_income_account_code?: string;
          payable_account_code?: string;
          payment_prefix?: string;
          payroll_payable_account_code?: string;
          petty_cash_float_limit?: number;
          receipt_prefix?: string;
          receivable_account_code?: string;
          reminder_days_before_due?: number;
          require_adjustment_approval?: boolean;
          require_expense_approval?: boolean;
          require_journal_approval?: boolean;
          require_refund_approval?: boolean;
          reset_numbering_yearly?: boolean;
          school_id : string;
          statutory_payable_account_code?: string;
          updated_at?: string;
        };
        Update: {
          accumulated_depreciation_account_code?: string;
          allow_advance_payments?: boolean;
          allow_over_budget?: boolean;
          approval_threshold_amount?: number;
          asset_account_code?: string;
          auto_allocate_payments?: boolean;
          bank_account_code?: string;
          bank_charges_account_code?: string;
          cash_account_code?: string;
          created_at?: string;
          created_by?: string | null;
          credit_note_prefix?: string;
          currency?: string;
          currency_symbol?: string;
          debit_note_prefix?: string;
          default_fee_due_days?: number;
          depreciation_account_code?: string;
          discount_account_code?: string;
          expense_account_code?: string;
          fee_income_account_code?: string;
          fiscal_year_start_month?: number;
          grant_income_account_code?: string;
          id?: string;
          invoice_prefix?: string;
          journal_prefix?: string;
          late_payment_grace_days?: number;
          mobile_money_account_code?: string;
          number_pad_width?: number;
          other_income_account_code?: string;
          payable_account_code?: string;
          payment_prefix?: string;
          payroll_payable_account_code?: string;
          petty_cash_float_limit?: number;
          receipt_prefix?: string;
          receivable_account_code?: string;
          reminder_days_before_due?: number;
          require_adjustment_approval?: boolean;
          require_expense_approval?: boolean;
          require_journal_approval?: boolean;
          require_refund_approval?: boolean;
          reset_numbering_yearly?: boolean;
          school_id?: string;
          statutory_payable_account_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_settings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_settings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_user_permissions: {
        Row: {
          granted: boolean;
          id: string;
          permission_key: string;
          school_id: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          granted?: boolean;
          id?: string;
          permission_key : string;
          school_id : string;
          updated_at?: string;
          updated_by?: string | null;
          user_id : string;
        };
        Update: {
          granted?: boolean;
          id?: string;
          permission_key?: string;
          school_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_user_permissions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_user_permissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_user_permissions_permission_key_fkey";
            columns: ["permission_key"];
            isOneToOne: false;
            referencedRelation: "finance_permission_catalog";
            referencedColumns: ["permission_key"];
          },
          {
            foreignKeyName: "finance_user_permissions_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_aid_awards: {
        Row: {
          amount: number;
          award_name: string;
          created_at: string;
          currency: string;
          id: string;
          notes: string | null;
          reviewed_by: string | null;
          school_id: string;
          sponsor_name: string | null;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          award_name : string;
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          reviewed_by?: string | null;
          school_id : string;
          sponsor_name?: string | null;
          status?: string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          award_name?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          notes?: string | null;
          reviewed_by?: string | null;
          school_id?: string;
          sponsor_name?: string | null;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_aid_awards_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_aid_awards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_aid_awards_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_periods: {
        Row: {
          created_at: string;
          end_date: string;
          financial_year_id: string;
          id: string;
          name: string;
          school_id: string;
          start_date: string;
          status: string;
          term_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date : string;
          financial_year_id : string;
          id?: string;
          name : string;
          school_id : string;
          start_date : string;
          status?: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          financial_year_id?: string;
          id?: string;
          name?: string;
          school_id?: string;
          start_date?: string;
          status?: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_periods_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_periods_financial_year_id_fkey";
            columns: ["financial_year_id"];
            isOneToOne: false;
            referencedRelation: "financial_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_periods_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_years: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          is_current: boolean;
          name: string;
          school_id: string;
          start_date: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date : string;
          id?: string;
          is_current?: boolean;
          name : string;
          school_id : string;
          start_date : string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          is_current?: boolean;
          name?: string;
          school_id?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_years_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_assets: {
        Row: {
          accumulated_depreciation: number;
          asset_code: string;
          book_value: number;
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: string | null;
          name: string;
          purchase_cost: number;
          purchase_date: string;
          school_id: string;
          status: string;
          updated_at: string;
          useful_life_years: number;
        };
        Insert: {
          accumulated_depreciation?: number;
          asset_code : string;
          book_value?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          name : string;
          purchase_cost?: number;
          purchase_date?: string;
          school_id : string;
          status?: string;
          updated_at?: string;
          useful_life_years?: number;
        };
        Update: {
          accumulated_depreciation?: number;
          asset_code?: string;
          book_value?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          purchase_cost?: number;
          purchase_date?: string;
          school_id?: string;
          status?: string;
          updated_at?: string;
          useful_life_years?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_assets_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixed_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      formative_marks: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          id: string;
          is_missing: boolean;
          locked: boolean;
          mark: number;
          paper_id: string | null;
          school_id: string;
          status: string;
          student_id: string;
          subject_id: string;
          submitted_at: string | null;
          submitted_by: string | null;
          teacher_initials: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          is_missing?: boolean;
          locked?: boolean;
          mark : number;
          paper_id?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          subject_id : string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          teacher_initials : string;
          term_id : string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          is_missing?: boolean;
          locked?: boolean;
          mark?: number;
          paper_id?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          subject_id?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          teacher_initials?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "formative_marks_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formative_marks_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formative_marks_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formative_marks_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formative_marks_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formative_marks_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      goods_receipts: {
        Row: {
          created_at: string;
          id: string;
          items_received: number;
          purchase_order_id: string;
          receipt_number: string;
          received_by: string | null;
          received_date: string;
          remarks: string | null;
          school_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          items_received?: number;
          purchase_order_id : string;
          receipt_number : string;
          received_by?: string | null;
          received_date?: string;
          remarks?: string | null;
          school_id : string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          items_received?: number;
          purchase_order_id?: string;
          receipt_number?: string;
          received_by?: string | null;
          received_date?: string;
          remarks?: string | null;
          school_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goods_receipts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goods_receipts_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grading_identifier_scales: {
        Row: {
          created_at: string;
          descriptor: string;
          id: string;
          identifier: number;
          max_score: number;
          min_score: number;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          descriptor : string;
          id?: string;
          identifier : number;
          max_score : number;
          min_score : number;
          school_id : string;
        };
        Update: {
          created_at?: string;
          descriptor?: string;
          id?: string;
          identifier?: number;
          max_score?: number;
          min_score?: number;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grading_identifier_scales_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      grading_scales: {
        Row: {
          created_at: string;
          education_level: string;
          grade: string;
          grade_descriptor: string;
          id: string;
          max_score: number;
          min_score: number;
          points: number | null;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          education_level?: string;
          grade : string;
          grade_descriptor : string;
          id?: string;
          max_score : number;
          min_score : number;
          points?: number | null;
          school_id : string;
        };
        Update: {
          created_at?: string;
          education_level?: string;
          grade?: string;
          grade_descriptor?: string;
          id?: string;
          max_score?: number;
          min_score?: number;
          points?: number | null;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      grants: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          donor_id: string | null;
          donor_name: string | null;
          grant_code: string;
          id: string;
          notes: string | null;
          received_amount: number;
          school_id: string;
          status: string;
          title: string;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          donor_id?: string | null;
          donor_name?: string | null;
          grant_code : string;
          id?: string;
          notes?: string | null;
          received_amount?: number;
          school_id : string;
          status?: string;
          title : string;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          donor_id?: string | null;
          donor_name?: string | null;
          grant_code?: string;
          id?: string;
          notes?: string | null;
          received_amount?: number;
          school_id?: string;
          status?: string;
          title?: string;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grants_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grants_donor_id_fkey";
            columns: ["donor_id"];
            isOneToOne: false;
            referencedRelation: "donors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      identifier_scales: {
        Row: {
          created_at: string;
          descriptor: string;
          id: string;
          identifier: number;
          max_score: number;
          min_score: number;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          descriptor : string;
          id?: string;
          identifier : number;
          max_score : number;
          min_score : number;
          school_id : string;
        };
        Update: {
          created_at?: string;
          descriptor?: string;
          id?: string;
          identifier?: number;
          max_score?: number;
          min_score?: number;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "identifier_scales_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          item_code: string;
          location: string | null;
          name: string;
          quantity: number;
          reorder_level: number;
          school_id: string;
          unit_cost: number;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          item_code : string;
          location?: string | null;
          name : string;
          quantity?: number;
          reorder_level?: number;
          school_id : string;
          unit_cost?: number;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          item_code?: string;
          location?: string | null;
          name?: string;
          quantity?: number;
          reorder_level?: number;
          school_id?: string;
          unit_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          approval_request_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          attachment_url: string | null;
          branch_id: string | null;
          cost_center_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          entry_date: string;
          entry_number: string;
          entry_type: string;
          fund_id: string | null;
          id: string;
          period_id: string | null;
          posted_at: string | null;
          posted_by: string | null;
          reference_number: string | null;
          reversal_of_entry_id: string | null;
          reversal_reason: string | null;
          reversed_by_entry_id: string | null;
          school_id: string;
          source_module: string | null;
          source_record_id: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          total_credit: number;
          total_debit: number;
          transaction_id: string | null;
          updated_at: string;
        };
        Insert: {
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          attachment_url?: string | null;
          branch_id?: string | null;
          cost_center_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          entry_date?: string;
          entry_number : string;
          entry_type?: string;
          fund_id?: string | null;
          id?: string;
          period_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          reference_number?: string | null;
          reversal_of_entry_id?: string | null;
          reversal_reason?: string | null;
          reversed_by_entry_id?: string | null;
          school_id : string;
          source_module?: string | null;
          source_record_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          total_credit?: number;
          total_debit?: number;
          transaction_id?: string | null;
          updated_at?: string;
        };
        Update: {
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          attachment_url?: string | null;
          branch_id?: string | null;
          cost_center_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          entry_date?: string;
          entry_number?: string;
          entry_type?: string;
          fund_id?: string | null;
          id?: string;
          period_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          reference_number?: string | null;
          reversal_of_entry_id?: string | null;
          reversal_reason?: string | null;
          reversed_by_entry_id?: string | null;
          school_id?: string;
          source_module?: string | null;
          source_record_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          total_credit?: number;
          total_debit?: number;
          transaction_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entry_lines: {
        Row: {
          account_id: string;
          branch_id: string | null;
          cost_center_id: string | null;
          created_at: string;
          credit: number;
          debit: number;
          fund_id: string | null;
          id: string;
          journal_entry_id: string;
          line_number: number;
          narration: string | null;
          reference: string | null;
          school_id: string;
          student_id: string | null;
          supplier_id: string | null;
        };
        Insert: {
          account_id : string;
          branch_id?: string | null;
          cost_center_id?: string | null;
          created_at?: string;
          credit?: number;
          debit?: number;
          fund_id?: string | null;
          id?: string;
          journal_entry_id : string;
          line_number?: number;
          narration?: string | null;
          reference?: string | null;
          school_id : string;
          student_id?: string | null;
          supplier_id?: string | null;
        };
        Update: {
          account_id?: string;
          branch_id?: string | null;
          cost_center_id?: string | null;
          created_at?: string;
          credit?: number;
          debit?: number;
          fund_id?: string | null;
          id?: string;
          journal_entry_id?: string;
          line_number?: number;
          narration?: string | null;
          reference?: string | null;
          school_id?: string;
          student_id?: string | null;
          supplier_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey";
            columns: ["journal_entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      library_books: {
        Row: {
          author: string | null;
          available_copies: number;
          category: string | null;
          created_at: string;
          id: string;
          isbn: string | null;
          school_id: string;
          shelf_location: string | null;
          status: string;
          title: string;
          total_copies: number;
          updated_at: string;
        };
        Insert: {
          author?: string | null;
          available_copies?: number;
          category?: string | null;
          created_at?: string;
          id?: string;
          isbn?: string | null;
          school_id : string;
          shelf_location?: string | null;
          status?: string;
          title : string;
          total_copies?: number;
          updated_at?: string;
        };
        Update: {
          author?: string | null;
          available_copies?: number;
          category?: string | null;
          created_at?: string;
          id?: string;
          isbn?: string | null;
          school_id?: string;
          shelf_location?: string | null;
          status?: string;
          title?: string;
          total_copies?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      library_loans: {
        Row: {
          book_id: string;
          borrower_type: string;
          created_at: string;
          due_at: string | null;
          id: string;
          issued_at: string;
          issued_by: string | null;
          notes: string | null;
          returned_at: string | null;
          school_id: string;
          student_id: string | null;
          user_id: string | null;
        };
        Insert: {
          book_id : string;
          borrower_type : string;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          notes?: string | null;
          returned_at?: string | null;
          school_id : string;
          student_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          book_id?: string;
          borrower_type?: string;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          notes?: string | null;
          returned_at?: string | null;
          school_id?: string;
          student_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "library_loans_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_loans_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "library_books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_loans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_loans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_loans_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      login_events: {
        Row: {
          email: string | null;
          id: string;
          ip_address: string | null;
          occurred_at: string;
          school_id: string | null;
          success: boolean;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          email?: string | null;
          id?: string;
          ip_address?: string | null;
          occurred_at?: string;
          school_id?: string | null;
          success?: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          email?: string | null;
          id?: string;
          ip_address?: string | null;
          occurred_at?: string;
          school_id?: string | null;
          success?: boolean;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          school_id: string | null;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          school_id?: string | null;
          title : string;
          type?: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          school_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          allocation_type: string;
          amount: number;
          created_at: string;
          created_by: string | null;
          fee_category_id: string | null;
          id: string;
          installment_id: string | null;
          invoice_id: string | null;
          is_reversed: boolean;
          notes: string | null;
          payment_id: string;
          reversed_at: string | null;
          school_id: string;
        };
        Insert: {
          allocation_type?: string;
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          fee_category_id?: string | null;
          id?: string;
          installment_id?: string | null;
          invoice_id?: string | null;
          is_reversed?: boolean;
          notes?: string | null;
          payment_id : string;
          reversed_at?: string | null;
          school_id : string;
        };
        Update: {
          allocation_type?: string;
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          fee_category_id?: string | null;
          id?: string;
          installment_id?: string | null;
          invoice_id?: string | null;
          is_reversed?: boolean;
          notes?: string | null;
          payment_id?: string;
          reversed_at?: string | null;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "student_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_installment_id_fkey";
            columns: ["installment_id"];
            isOneToOne: false;
            referencedRelation: "payment_plan_installments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_fee_category_id_fkey";
            columns: ["fee_category_id"];
            isOneToOne: false;
            referencedRelation: "fee_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_plan_installments: {
        Row: {
          amount: number;
          amount_paid: number;
          created_at: string;
          due_date: string;
          id: string;
          installment_number: number;
          paid_at: string | null;
          plan_id: string;
          reminder_sent_at: string | null;
          school_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          amount_paid?: number;
          created_at?: string;
          due_date : string;
          id?: string;
          installment_number : number;
          paid_at?: string | null;
          plan_id : string;
          reminder_sent_at?: string | null;
          school_id : string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          amount_paid?: number;
          created_at?: string;
          due_date?: string;
          id?: string;
          installment_number?: number;
          paid_at?: string | null;
          plan_id?: string;
          reminder_sent_at?: string | null;
          school_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plan_installments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "payment_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_plans: {
        Row: {
          academic_year_id: string | null;
          agreement_signed_at: string | null;
          agreement_signed_by: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          frequency: string;
          id: string;
          installment_count: number;
          notes: string | null;
          plan_name: string;
          plan_number: string;
          school_id: string;
          start_date: string;
          status: string;
          student_id: string;
          term_id: string | null;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          agreement_signed_at?: string | null;
          agreement_signed_by?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          frequency?: string;
          id?: string;
          installment_count?: number;
          notes?: string | null;
          plan_name?: string;
          plan_number : string;
          school_id : string;
          start_date?: string;
          status?: string;
          student_id : string;
          term_id?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          agreement_signed_at?: string | null;
          agreement_signed_by?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          frequency?: string;
          id?: string;
          installment_count?: number;
          notes?: string | null;
          plan_name?: string;
          plan_number?: string;
          school_id?: string;
          start_date?: string;
          status?: string;
          student_id?: string;
          term_id?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_plans_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plans_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plans_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_plans_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_promises: {
        Row: {
          case_id: string | null;
          created_at: string;
          id: string;
          kept_amount: number;
          notes: string | null;
          promised_amount: number;
          promised_date: string;
          recorded_by: string | null;
          school_id: string;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          case_id?: string | null;
          created_at?: string;
          id?: string;
          kept_amount?: number;
          notes?: string | null;
          promised_amount?: number;
          promised_date : string;
          recorded_by?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          case_id?: string | null;
          created_at?: string;
          id?: string;
          kept_amount?: number;
          notes?: string | null;
          promised_amount?: number;
          promised_date?: string;
          recorded_by?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_promises_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_promises_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_promises_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "collection_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_promises_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_vouchers: {
        Row: {
          amount: number;
          approved_at: string | null;
          approved_by: string | null;
          approved_invoice_id: string | null;
          created_at: string;
          department_name: string | null;
          id: string;
          payee_name: string;
          payment_method: string;
          prepared_by: string | null;
          remarks: string | null;
          school_id: string;
          status: string;
          updated_at: string;
          voucher_date: string;
          voucher_number: string;
        };
        Insert: {
          amount?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          approved_invoice_id?: string | null;
          created_at?: string;
          department_name?: string | null;
          id?: string;
          payee_name : string;
          payment_method?: string;
          prepared_by?: string | null;
          remarks?: string | null;
          school_id : string;
          status?: string;
          updated_at?: string;
          voucher_date?: string;
          voucher_number : string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          approved_invoice_id?: string | null;
          created_at?: string;
          department_name?: string | null;
          id?: string;
          payee_name?: string;
          payment_method?: string;
          prepared_by?: string | null;
          remarks?: string | null;
          school_id?: string;
          status?: string;
          updated_at?: string;
          voucher_date?: string;
          voucher_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_vouchers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_vouchers_approved_invoice_id_fkey";
            columns: ["approved_invoice_id"];
            isOneToOne: false;
            referencedRelation: "approved_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_vouchers_prepared_by_fkey";
            columns: ["prepared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_vouchers_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          allocated_amount: number;
          amount: number;
          bank_account_id: string | null;
          bank_reference: string | null;
          card_provider: string | null;
          card_reference: string | null;
          card_settlement_status: string | null;
          cash_account_id: string | null;
          cheque_date: string | null;
          cheque_drawer_bank: string | null;
          cheque_number: string | null;
          cheque_status: string | null;
          collection_point: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          journal_entry_id: string | null;
          mobile_money_account_id: string | null;
          mobile_money_provider: string | null;
          mobile_money_settlement_status: string | null;
          mobile_money_transaction_id: string | null;
          narration: string | null;
          payer_name: string | null;
          payer_phone: string | null;
          payer_relationship: string | null;
          payment_date: string;
          payment_method: string;
          payment_method_id: string | null;
          payment_number: string;
          payment_plan_installment_id: string | null;
          receipt_id: string | null;
          received_by: string | null;
          recorded_at: string;
          reference_number: string | null;
          reversal_of_payment_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          school_id: string;
          status: string;
          student_id: string | null;
          supplier_id: string | null;
          transaction_id: string | null;
          unallocated_amount: number;
          updated_at: string;
          value_date: string | null;
        };
        Insert: {
          allocated_amount?: number;
          amount : number;
          bank_account_id?: string | null;
          bank_reference?: string | null;
          card_provider?: string | null;
          card_reference?: string | null;
          card_settlement_status?: string | null;
          cash_account_id?: string | null;
          cheque_date?: string | null;
          cheque_drawer_bank?: string | null;
          cheque_number?: string | null;
          cheque_status?: string | null;
          collection_point?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_account_id?: string | null;
          mobile_money_provider?: string | null;
          mobile_money_settlement_status?: string | null;
          mobile_money_transaction_id?: string | null;
          narration?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          payer_relationship?: string | null;
          payment_date?: string;
          payment_method : string;
          payment_method_id?: string | null;
          payment_number : string;
          payment_plan_installment_id?: string | null;
          receipt_id?: string | null;
          received_by?: string | null;
          recorded_at?: string;
          reference_number?: string | null;
          reversal_of_payment_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          school_id : string;
          status?: string;
          student_id?: string | null;
          supplier_id?: string | null;
          transaction_id?: string | null;
          unallocated_amount?: number;
          updated_at?: string;
          value_date?: string | null;
        };
        Update: {
          allocated_amount?: number;
          amount?: number;
          bank_account_id?: string | null;
          bank_reference?: string | null;
          card_provider?: string | null;
          card_reference?: string | null;
          card_settlement_status?: string | null;
          cash_account_id?: string | null;
          cheque_date?: string | null;
          cheque_drawer_bank?: string | null;
          cheque_number?: string | null;
          cheque_status?: string | null;
          collection_point?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_account_id?: string | null;
          mobile_money_provider?: string | null;
          mobile_money_settlement_status?: string | null;
          mobile_money_transaction_id?: string | null;
          narration?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          payer_relationship?: string | null;
          payment_date?: string;
          payment_method?: string;
          payment_method_id?: string | null;
          payment_number?: string;
          payment_plan_installment_id?: string | null;
          receipt_id?: string | null;
          received_by?: string | null;
          recorded_at?: string;
          reference_number?: string | null;
          reversal_of_payment_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string | null;
          supplier_id?: string | null;
          transaction_id?: string | null;
          unallocated_amount?: number;
          updated_at?: string;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_items: {
        Row: {
          created_at: string;
          deductions: number;
          gross_amount: number;
          id: string;
          net_amount: number;
          notes: string | null;
          payroll_run_id: string;
          role_title: string | null;
          school_id: string;
          staff_name: string;
        };
        Insert: {
          created_at?: string;
          deductions?: number;
          gross_amount?: number;
          id?: string;
          net_amount?: number;
          notes?: string | null;
          payroll_run_id : string;
          role_title?: string | null;
          school_id : string;
          staff_name : string;
        };
        Update: {
          created_at?: string;
          deductions?: number;
          gross_amount?: number;
          id?: string;
          net_amount?: number;
          notes?: string | null;
          payroll_run_id?: string;
          role_title?: string | null;
          school_id?: string;
          staff_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey";
            columns: ["payroll_run_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_runs: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          deductions: number;
          gross_amount: number;
          id: string;
          net_amount: number;
          notes: string | null;
          pay_date: string;
          period_name: string;
          school_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deductions?: number;
          gross_amount?: number;
          id?: string;
          net_amount?: number;
          notes?: string | null;
          pay_date?: string;
          period_name : string;
          school_id : string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deductions?: number;
          gross_amount?: number;
          id?: string;
          net_amount?: number;
          notes?: string | null;
          pay_date?: string;
          period_name?: string;
          school_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_runs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_runs_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_staff: {
        Row: {
          account_name: string | null;
          account_number: string | null;
          allowances: number;
          bank_name: string | null;
          basic_salary: number;
          created_at: string;
          created_by: string | null;
          date_of_employment: string;
          deductions: number;
          employee_number: string;
          employment_type: string;
          full_name: string;
          id: string;
          national_id: string | null;
          notes: string | null;
          school_id: string;
          staff_category: string;
          status: string;
          tax_pin: string | null;
          updated_at: string;
        };
        Insert: {
          account_name?: string | null;
          account_number?: string | null;
          allowances?: number;
          bank_name?: string | null;
          basic_salary?: number;
          created_at?: string;
          created_by?: string | null;
          date_of_employment?: string;
          deductions?: number;
          employee_number : string;
          employment_type?: string;
          full_name : string;
          id?: string;
          national_id?: string | null;
          notes?: string | null;
          school_id : string;
          staff_category : string;
          status?: string;
          tax_pin?: string | null;
          updated_at?: string;
        };
        Update: {
          account_name?: string | null;
          account_number?: string | null;
          allowances?: number;
          bank_name?: string | null;
          basic_salary?: number;
          created_at?: string;
          created_by?: string | null;
          date_of_employment?: string;
          deductions?: number;
          employee_number?: string;
          employment_type?: string;
          full_name?: string;
          id?: string;
          national_id?: string | null;
          notes?: string | null;
          school_id?: string;
          staff_category?: string;
          status?: string;
          tax_pin?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_staff_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_staff_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string | null;
          email: string | null;
          full_name: string;
          id: string;
          initials: string | null;
          is_active: boolean;
          is_locked: boolean;
          last_login_at: string | null;
          must_change_password: boolean;
          phone: string | null;
          photo_url: string | null;
          school_id: string | null;
          signature_url: string | null;
          teacher_number: string | null;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          email?: string | null;
          full_name?: string;
          id : string;
          initials?: string | null;
          is_active?: boolean;
          is_locked?: boolean;
          last_login_at?: string | null;
          must_change_password?: boolean;
          phone?: string | null;
          photo_url?: string | null;
          school_id?: string | null;
          signature_url?: string | null;
          teacher_number?: string | null;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          initials?: string | null;
          is_active?: boolean;
          is_locked?: boolean;
          last_login_at?: string | null;
          must_change_password?: boolean;
          phone?: string | null;
          photo_url?: string | null;
          school_id?: string | null;
          signature_url?: string | null;
          teacher_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          created_at: string;
          department_name: string | null;
          expected_delivery_date: string | null;
          id: string;
          order_date: string;
          order_number: string;
          ordered_by: string | null;
          purchase_request_id: string | null;
          remarks: string | null;
          school_id: string;
          status: string;
          supplier_id: string | null;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_name?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          order_date?: string;
          order_number : string;
          ordered_by?: string | null;
          purchase_request_id?: string | null;
          remarks?: string | null;
          school_id : string;
          status?: string;
          supplier_id?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_name?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          order_date?: string;
          order_number?: string;
          ordered_by?: string | null;
          purchase_request_id?: string | null;
          remarks?: string | null;
          school_id?: string;
          status?: string;
          supplier_id?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey";
            columns: ["purchase_request_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_ordered_by_fkey";
            columns: ["ordered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requests: {
        Row: {
          approval_status: string;
          approved_amount: number;
          budget_id: string | null;
          created_at: string;
          department_name: string | null;
          id: string;
          item_description: string;
          remarks: string | null;
          request_number: string;
          requested_amount: number;
          requested_by: string | null;
          school_id: string;
          status: string;
          supplier_id: string | null;
          updated_at: string;
        };
        Insert: {
          approval_status?: string;
          approved_amount?: number;
          budget_id?: string | null;
          created_at?: string;
          department_name?: string | null;
          id?: string;
          item_description : string;
          remarks?: string | null;
          request_number : string;
          requested_amount?: number;
          requested_by?: string | null;
          school_id : string;
          status?: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Update: {
          approval_status?: string;
          approved_amount?: number;
          budget_id?: string | null;
          created_at?: string;
          department_name?: string | null;
          id?: string;
          item_description?: string;
          remarks?: string | null;
          request_number?: string;
          requested_amount?: number;
          requested_by?: string | null;
          school_id?: string;
          status?: string;
          supplier_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requests_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "budgets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requests_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      receipts: {
        Row: {
          amount: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          id: string;
          issued_at: string;
          issued_by: string | null;
          last_emailed_at: string | null;
          last_printed_at: string | null;
          notes: string | null;
          payment_id: string | null;
          payment_method: string | null;
          printed_count: number;
          qr_payload: string | null;
          receipt_date: string;
          receipt_number: string;
          reference_number: string | null;
          school_id: string;
          status: string;
          student_id: string | null;
          updated_at: string;
          verification_code: string | null;
        };
        Insert: {
          amount?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_emailed_at?: string | null;
          last_printed_at?: string | null;
          notes?: string | null;
          payment_id?: string | null;
          payment_method?: string | null;
          printed_count?: number;
          qr_payload?: string | null;
          receipt_date?: string;
          receipt_number : string;
          reference_number?: string | null;
          school_id : string;
          status?: string;
          student_id?: string | null;
          updated_at?: string;
          verification_code?: string | null;
        };
        Update: {
          amount?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_emailed_at?: string | null;
          last_printed_at?: string | null;
          notes?: string | null;
          payment_id?: string | null;
          payment_method?: string | null;
          printed_count?: number;
          qr_payload?: string | null;
          receipt_date?: string;
          receipt_number?: string;
          reference_number?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string | null;
          updated_at?: string;
          verification_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          approval_request_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          bank_account_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          journal_entry_id: string | null;
          mobile_money_number: string | null;
          mobile_money_provider: string | null;
          paid_at: string | null;
          paid_by: string | null;
          payee_name: string | null;
          payment_id: string | null;
          payment_reference: string | null;
          reason: string;
          receipt_id: string | null;
          refund_method: string;
          refund_number: string;
          refund_type: string;
          rejection_reason: string | null;
          requested_at: string;
          requested_by: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          school_id: string;
          status: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          bank_account_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_number?: string | null;
          mobile_money_provider?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          payee_name?: string | null;
          payment_id?: string | null;
          payment_reference?: string | null;
          reason : string;
          receipt_id?: string | null;
          refund_method?: string;
          refund_number : string;
          refund_type?: string;
          rejection_reason?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id : string;
          status?: string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approval_request_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          bank_account_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          journal_entry_id?: string | null;
          mobile_money_number?: string | null;
          mobile_money_provider?: string | null;
          paid_at?: string | null;
          paid_by?: string | null;
          payee_name?: string | null;
          payment_id?: string | null;
          payment_reference?: string | null;
          reason?: string;
          receipt_id?: string | null;
          refund_method?: string;
          refund_number?: string;
          refund_type?: string;
          rejection_reason?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id?: string;
          status?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_approval_request_id_fkey";
            columns: ["approval_request_id"];
            isOneToOne: false;
            referencedRelation: "approval_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      report_comment_rules: {
        Row: {
          comment: string;
          comment_role: string;
          created_at: string;
          descriptor: string;
          id: string;
          points: number | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          comment : string;
          comment_role : string;
          created_at?: string;
          descriptor : string;
          id?: string;
          points?: number | null;
          school_id : string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          comment_role?: string;
          created_at?: string;
          descriptor?: string;
          id?: string;
          points?: number | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_comment_rules_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      report_comments: {
        Row: {
          class_teacher_comment: string | null;
          head_teacher_comment: string | null;
          id: string;
          school_id: string;
          student_id: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          class_teacher_comment?: string | null;
          head_teacher_comment?: string | null;
          id?: string;
          school_id : string;
          student_id : string;
          term_id : string;
          updated_at?: string;
        };
        Update: {
          class_teacher_comment?: string | null;
          head_teacher_comment?: string | null;
          id?: string;
          school_id?: string;
          student_id?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_comments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_comments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_comments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      school_events: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          description: string | null;
          end_date: string | null;
          event_type: string;
          id: string;
          school_id: string;
          start_date: string;
          term_id: string | null;
          title: string;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          event_type?: string;
          id?: string;
          school_id : string;
          start_date : string;
          term_id?: string | null;
          title : string;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          event_type?: string;
          id?: string;
          school_id?: string;
          start_date?: string;
          term_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_events_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          method: string;
          notes: string | null;
          payment_date: string;
          recorded_by: string | null;
          reference: string | null;
          school_id: string;
          status: string;
          subscription_id: string | null;
        };
        Insert: {
          amount : number;
          created_at?: string;
          currency?: string;
          id?: string;
          method?: string;
          notes?: string | null;
          payment_date?: string;
          recorded_by?: string | null;
          reference?: string | null;
          school_id : string;
          status?: string;
          subscription_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          method?: string;
          notes?: string | null;
          payment_date?: string;
          recorded_by?: string | null;
          reference?: string | null;
          school_id?: string;
          status?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "school_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      school_subscriptions: {
        Row: {
          auto_renew: boolean;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          notes: string | null;
          payment_confirmed_at: string | null;
          payment_confirmed_by: string | null;
          payment_reference: string | null;
          plan_id: string;
          school_id: string;
          starts_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          auto_renew?: boolean;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          payment_confirmed_at?: string | null;
          payment_confirmed_by?: string | null;
          payment_reference?: string | null;
          plan_id : string;
          school_id : string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          auto_renew?: boolean;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          payment_confirmed_at?: string | null;
          payment_confirmed_by?: string | null;
          payment_reference?: string | null;
          plan_id?: string;
          school_id?: string;
          starts_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          address: string | null;
          code: string;
          created_at: string;
          email: string | null;
          formative_weight: number;
          id: string;
          logo_url: string | null;
          motto: string | null;
          name: string;
          phone: string | null;
          report_account_number: string | null;
          report_header: string | null;
          report_next_term_begins_on: string | null;
          report_payment_reference_type: string;
          signatories: Json;
          stamp_url: string | null;
          status: string;
          subscription_plan: string;
          summative_weight: number;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          code : string;
          created_at?: string;
          email?: string | null;
          formative_weight?: number;
          id?: string;
          logo_url?: string | null;
          motto?: string | null;
          name : string;
          phone?: string | null;
          report_account_number?: string | null;
          report_header?: string | null;
          report_next_term_begins_on?: string | null;
          report_payment_reference_type?: string;
          signatories?: Json;
          stamp_url?: string | null;
          status?: string;
          subscription_plan?: string;
          summative_weight?: number;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string;
          email?: string | null;
          formative_weight?: number;
          id?: string;
          logo_url?: string | null;
          motto?: string | null;
          name?: string;
          phone?: string | null;
          report_account_number?: string | null;
          report_header?: string | null;
          report_next_term_begins_on?: string | null;
          report_payment_reference_type?: string;
          signatories?: Json;
          stamp_url?: string | null;
          status?: string;
          subscription_plan?: string;
          summative_weight?: number;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      server_function_rate_limits: {
        Row: {
          request_count: number;
          user_id: string;
          window_started_at: string;
        };
        Insert: {
          request_count : number;
          user_id : string;
          window_started_at : string;
        };
        Update: {
          request_count?: number;
          user_id?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      staff_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          department_id: string | null;
          end_date: string | null;
          id: string;
          is_active: boolean;
          role: string;
          school_id: string;
          start_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          role : string;
          school_id : string;
          start_date?: string;
          updated_at?: string;
          user_id : string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          department_id?: string | null;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          role?: string;
          school_id?: string;
          start_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_assignments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_assignments_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      streams: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          name: string;
          school_id: string;
          stream_teacher_id: string | null;
        };
        Insert: {
          class_id : string;
          created_at?: string;
          id?: string;
          name : string;
          school_id : string;
          stream_teacher_id?: string | null;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          school_id?: string;
          stream_teacher_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "streams_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "streams_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      student_fee_assignments: {
        Row: {
          academic_year_id: string;
          amount_due: number;
          amount_paid: number;
          assigned_by: string | null;
          balance_due: number;
          class_id: string | null;
          created_at: string;
          discount_amount: number;
          due_date: string | null;
          fee_category_id: string | null;
          fee_name: string;
          fee_structure_id: string | null;
          fee_structure_line_id: string | null;
          gross_amount: number;
          id: string;
          is_optional: boolean;
          net_amount: number;
          notes: string | null;
          scholarship_amount: number;
          school_id: string;
          set_by: string | null;
          status: string;
          stream_id: string | null;
          student_id: string;
          term_id: string;
          updated_at: string;
          waived_amount: number;
        };
        Insert: {
          academic_year_id : string;
          amount_due?: number;
          amount_paid?: number;
          assigned_by?: string | null;
          balance_due?: number;
          class_id?: string | null;
          created_at?: string;
          discount_amount?: number;
          due_date?: string | null;
          fee_category_id?: string | null;
          fee_name?: string;
          fee_structure_id?: string | null;
          fee_structure_line_id?: string | null;
          gross_amount?: number;
          id?: string;
          is_optional?: boolean;
          net_amount?: number;
          notes?: string | null;
          scholarship_amount?: number;
          school_id : string;
          set_by?: string | null;
          status?: string;
          stream_id?: string | null;
          student_id : string;
          term_id : string;
          updated_at?: string;
          waived_amount?: number;
        };
        Update: {
          academic_year_id?: string;
          amount_due?: number;
          amount_paid?: number;
          assigned_by?: string | null;
          balance_due?: number;
          class_id?: string | null;
          created_at?: string;
          discount_amount?: number;
          due_date?: string | null;
          fee_category_id?: string | null;
          fee_name?: string;
          fee_structure_id?: string | null;
          fee_structure_line_id?: string | null;
          gross_amount?: number;
          id?: string;
          is_optional?: boolean;
          net_amount?: number;
          notes?: string | null;
          scholarship_amount?: number;
          school_id?: string;
          set_by?: string | null;
          status?: string;
          stream_id?: string | null;
          student_id?: string;
          term_id?: string;
          updated_at?: string;
          waived_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "student_fee_assignments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_fee_assignments_set_by_fkey";
            columns: ["set_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_guardians: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_emergency: boolean;
          occupation: string | null;
          phone: string | null;
          relationship: string | null;
          school_id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          full_name : string;
          id?: string;
          is_emergency?: boolean;
          occupation?: string | null;
          phone?: string | null;
          relationship?: string | null;
          school_id : string;
          student_id : string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_emergency?: boolean;
          occupation?: string | null;
          phone?: string | null;
          relationship?: string | null;
          school_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_guardians_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_history: {
        Row: {
          created_at: string;
          details: Json;
          event_type: string;
          id: string;
          performed_by: string | null;
          school_id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          event_type : string;
          id?: string;
          performed_by?: string | null;
          school_id : string;
          student_id : string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          performed_by?: string | null;
          school_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_history_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_history_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_invoice_items: {
        Row: {
          assignment_id: string | null;
          created_at: string;
          description: string | null;
          discount_amount: number;
          fee_category_id: string | null;
          fee_type: string;
          gl_account_code: string | null;
          gross_amount: number;
          id: string;
          invoice_id: string;
          line_total: number;
          net_amount: number;
          quantity: number;
          scholarship_amount: number;
          school_id: string;
          sort_order: number;
          tax_amount: number;
          unit_amount: number;
          waiver_amount: number;
        };
        Insert: {
          assignment_id?: string | null;
          created_at?: string;
          description?: string | null;
          discount_amount?: number;
          fee_category_id?: string | null;
          fee_type : string;
          gl_account_code?: string | null;
          gross_amount?: number;
          id?: string;
          invoice_id : string;
          line_total?: number;
          net_amount?: number;
          quantity?: number;
          scholarship_amount?: number;
          school_id : string;
          sort_order?: number;
          tax_amount?: number;
          unit_amount?: number;
          waiver_amount?: number;
        };
        Update: {
          assignment_id?: string | null;
          created_at?: string;
          description?: string | null;
          discount_amount?: number;
          fee_category_id?: string | null;
          fee_type?: string;
          gl_account_code?: string | null;
          gross_amount?: number;
          id?: string;
          invoice_id?: string;
          line_total?: number;
          net_amount?: number;
          quantity?: number;
          scholarship_amount?: number;
          school_id?: string;
          sort_order?: number;
          tax_amount?: number;
          unit_amount?: number;
          waiver_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "student_invoice_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "student_invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      student_invoices: {
        Row: {
          academic_year_id: string | null;
          amount_paid: number;
          approval_request_id: string | null;
          balance_due: number;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          discount_amount: number;
          due_date: string | null;
          financial_year_id: string | null;
          gross_amount: number;
          id: string;
          invoice_date: string;
          invoice_number: string;
          invoice_type: string;
          issued_at: string | null;
          issued_by: string | null;
          journal_entry_id: string | null;
          last_emailed_at: string | null;
          notes: string | null;
          previous_balance: number;
          printed_count: number;
          reversal_of_invoice_id: string | null;
          scholarship_amount: number;
          school_id: string;
          source: string;
          status: string;
          stream_id: string | null;
          student_id: string;
          tax_amount: number;
          term_id: string | null;
          terms: string | null;
          total_amount: number;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
          waiver_amount: number;
        };
        Insert: {
          academic_year_id?: string | null;
          amount_paid?: number;
          approval_request_id?: string | null;
          balance_due?: number;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          discount_amount?: number;
          due_date?: string | null;
          financial_year_id?: string | null;
          gross_amount?: number;
          id?: string;
          invoice_date?: string;
          invoice_number : string;
          invoice_type?: string;
          issued_at?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          last_emailed_at?: string | null;
          notes?: string | null;
          previous_balance?: number;
          printed_count?: number;
          reversal_of_invoice_id?: string | null;
          scholarship_amount?: number;
          school_id : string;
          source?: string;
          status?: string;
          stream_id?: string | null;
          student_id : string;
          tax_amount?: number;
          term_id?: string | null;
          terms?: string | null;
          total_amount?: number;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          waiver_amount?: number;
        };
        Update: {
          academic_year_id?: string | null;
          amount_paid?: number;
          approval_request_id?: string | null;
          balance_due?: number;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          discount_amount?: number;
          due_date?: string | null;
          financial_year_id?: string | null;
          gross_amount?: number;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          invoice_type?: string;
          issued_at?: string | null;
          issued_by?: string | null;
          journal_entry_id?: string | null;
          last_emailed_at?: string | null;
          notes?: string | null;
          previous_balance?: number;
          printed_count?: number;
          reversal_of_invoice_id?: string | null;
          scholarship_amount?: number;
          school_id?: string;
          source?: string;
          status?: string;
          stream_id?: string | null;
          student_id?: string;
          tax_amount?: number;
          term_id?: string | null;
          terms?: string | null;
          total_amount?: number;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          waiver_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "student_invoices_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_invoices_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_invoices_financial_year_id_fkey";
            columns: ["financial_year_id"];
            isOneToOne: false;
            referencedRelation: "financial_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_invoices_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_promotions: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          from_class_id: string | null;
          from_stream_id: string | null;
          id: string;
          notes: string | null;
          outcome: string;
          performed_by: string | null;
          school_id: string;
          student_id: string;
          to_class_id: string | null;
          to_stream_id: string | null;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          from_class_id?: string | null;
          from_stream_id?: string | null;
          id?: string;
          notes?: string | null;
          outcome : string;
          performed_by?: string | null;
          school_id : string;
          student_id : string;
          to_class_id?: string | null;
          to_stream_id?: string | null;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          from_class_id?: string | null;
          from_stream_id?: string | null;
          id?: string;
          notes?: string | null;
          outcome?: string;
          performed_by?: string | null;
          school_id?: string;
          student_id?: string;
          to_class_id?: string | null;
          to_stream_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_promotions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_promotions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_subjects: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          school_id: string;
          student_id: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          school_id : string;
          student_id : string;
          subject_id : string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          school_id?: string;
          student_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_subjects_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subjects_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          address: string | null;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          date_of_birth: string | null;
          deleted_at: string | null;
          fees_balance: number;
          full_name: string;
          gender: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          house: string | null;
          id: string;
          lin: string | null;
          parent_name: string | null;
          parent_phone: string | null;
          photo_url: string | null;
          school_id: string;
          schpay_code: string | null;
          status: string;
          stream_id: string | null;
          student_number: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          address?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          fees_balance?: number;
          full_name : string;
          gender?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          house?: string | null;
          id?: string;
          lin?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          photo_url?: string | null;
          school_id : string;
          schpay_code?: string | null;
          status?: string;
          stream_id?: string | null;
          student_number?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          address?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          fees_balance?: number;
          full_name?: string;
          gender?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          house?: string | null;
          id?: string;
          lin?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          photo_url?: string | null;
          school_id?: string;
          schpay_code?: string | null;
          status?: string;
          stream_id?: string | null;
          student_number?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_papers: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          name: string;
          position: number;
          school_id: string;
          subject_id: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          id?: string;
          name : string;
          position?: number;
          school_id : string;
          subject_id : string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          position?: number;
          school_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_papers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_papers_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          category: string;
          code: string | null;
          created_at: string;
          department_id: string;
          education_level: string;
          id: string;
          is_subsidiary: boolean;
          name: string;
          points: number;
          position: number;
          school_id: string;
        };
        Insert: {
          category?: string;
          code?: string | null;
          created_at?: string;
          department_id : string;
          education_level?: string;
          id?: string;
          is_subsidiary?: boolean;
          name : string;
          points?: number;
          position?: number;
          school_id : string;
        };
        Update: {
          category?: string;
          code?: string | null;
          created_at?: string;
          department_id?: string;
          education_level?: string;
          id?: string;
          is_subsidiary?: boolean;
          name?: string;
          points?: number;
          position?: number;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_expiry_notifications: {
        Row: {
          channel: string;
          created_at: string;
          days_before: number;
          id: string;
          scheduled_for: string;
          school_id: string;
          sent_at: string | null;
          subscription_id: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          days_before : number;
          id?: string;
          scheduled_for : string;
          school_id : string;
          sent_at?: string | null;
          subscription_id : string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          days_before?: number;
          id?: string;
          scheduled_for?: string;
          school_id?: string;
          sent_at?: string | null;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_expiry_notifications_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "school_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_expiry_notifications_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          billing_cycle: string;
          created_at: string;
          description: string | null;
          display_order: number;
          duration_days: number | null;
          duration_unit: string;
          duration_value: number;
          id: string;
          is_active: boolean;
          is_platform_only: boolean;
          name: string;
          price: number;
        };
        Insert: {
          billing_cycle?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          duration_days?: number | null;
          duration_unit?: string;
          duration_value?: number;
          id?: string;
          is_active?: boolean;
          is_platform_only?: boolean;
          name : string;
          price?: number;
        };
        Update: {
          billing_cycle?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          duration_days?: number | null;
          duration_unit?: string;
          duration_value?: number;
          id?: string;
          is_active?: boolean;
          is_platform_only?: boolean;
          name?: string;
          price?: number;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          address: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          payment_details: string | null;
          phone: string | null;
          school_id: string;
          status: string;
          supplier_name: string;
          tax_number: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          payment_details?: string | null;
          phone?: string | null;
          school_id : string;
          status?: string;
          supplier_name : string;
          tax_number?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          payment_details?: string | null;
          phone?: string | null;
          school_id?: string;
          status?: string;
          supplier_name?: string;
          tax_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_rates: {
        Row: {
          applies_to: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          rate: number;
          school_id: string;
        };
        Insert: {
          applies_to?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name : string;
          rate?: number;
          school_id : string;
        };
        Update: {
          applies_to?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          rate?: number;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tax_rates_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_allocation_history: {
        Row: {
          action: string;
          class_id: string | null;
          id: string;
          paper_id: string | null;
          performed_at: string;
          performed_by: string | null;
          school_id: string;
          stream_id: string | null;
          subject_id: string | null;
          teacher_id: string;
        };
        Insert: {
          action : string;
          class_id?: string | null;
          id?: string;
          paper_id?: string | null;
          performed_at?: string;
          performed_by?: string | null;
          school_id : string;
          stream_id?: string | null;
          subject_id?: string | null;
          teacher_id : string;
        };
        Update: {
          action?: string;
          class_id?: string | null;
          id?: string;
          paper_id?: string | null;
          performed_at?: string;
          performed_by?: string | null;
          school_id?: string;
          stream_id?: string | null;
          subject_id?: string | null;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_allocation_history_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_allocations: {
        Row: {
          class_id: string | null;
          created_at: string;
          id: string;
          paper_id: string | null;
          school_id: string;
          stream_id: string | null;
          subject_id: string;
          teacher_id: string;
          weekly_periods: number;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          paper_id?: string | null;
          school_id : string;
          stream_id?: string | null;
          subject_id : string;
          teacher_id : string;
          weekly_periods?: number;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          paper_id?: string | null;
          school_id?: string;
          stream_id?: string | null;
          subject_id?: string;
          teacher_id?: string;
          weekly_periods?: number;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_allocations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_attendance: {
        Row: {
          attendance_date: string;
          created_at: string;
          id: string;
          recorded_by: string | null;
          school_id: string;
          status: string;
          teacher_id: string;
        };
        Insert: {
          attendance_date : string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id : string;
          status?: string;
          teacher_id : string;
        };
        Update: {
          attendance_date?: string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id?: string;
          status?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      terms: {
        Row: {
          academic_year_id: string;
          created_at: string;
          end_date: string | null;
          id: string;
          is_current: boolean;
          name: string;
          school_id: string;
          start_date: string | null;
        };
        Insert: {
          academic_year_id : string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          name : string;
          school_id : string;
          start_date?: string | null;
        };
        Update: {
          academic_year_id?: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          name?: string;
          school_id?: string;
          start_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "terms_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_entries: {
        Row: {
          academic_year_id: string | null;
          class_id: string;
          classroom: string | null;
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          is_published: boolean;
          period: number;
          school_id: string;
          start_time: string;
          stream_id: string | null;
          subject_id: string;
          teacher_id: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          class_id : string;
          classroom?: string | null;
          created_at?: string;
          day_of_week : number;
          end_time : string;
          id?: string;
          is_published?: boolean;
          period : number;
          school_id : string;
          start_time : string;
          stream_id?: string | null;
          subject_id : string;
          teacher_id : string;
          term_id : string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          class_id?: string;
          classroom?: string | null;
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          is_published?: boolean;
          period?: number;
          school_id?: string;
          start_time?: string;
          stream_id?: string | null;
          subject_id?: string;
          teacher_id?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_entries_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_periods: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          end_time: string | null;
          id: string;
          is_active: boolean;
          is_break: boolean;
          is_lunch: boolean;
          label: string;
          period_order: number;
          school_id: string;
          start_time: string | null;
          term_id: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          is_active?: boolean;
          is_break?: boolean;
          is_lunch?: boolean;
          label : string;
          period_order : number;
          school_id : string;
          start_time?: string | null;
          term_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          is_active?: boolean;
          is_break?: boolean;
          is_lunch?: boolean;
          label?: string;
          period_order?: number;
          school_id?: string;
          start_time?: string | null;
          term_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_periods_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_periods_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_periods_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_settings: {
        Row: {
          academic_year_id: string | null;
          break_end: string;
          break_start: string;
          created_at: string;
          id: string;
          lunch_end: string;
          lunch_start: string;
          school_day_end: string;
          school_day_start: string;
          school_id: string;
          term_id: string | null;
          total_periods: number;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          break_end?: string;
          break_start?: string;
          created_at?: string;
          id?: string;
          lunch_end?: string;
          lunch_start?: string;
          school_day_end?: string;
          school_day_start?: string;
          school_id : string;
          term_id?: string | null;
          total_periods?: number;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          break_end?: string;
          break_start?: string;
          created_at?: string;
          id?: string;
          lunch_end?: string;
          lunch_start?: string;
          school_day_end?: string;
          school_day_start?: string;
          school_id?: string;
          term_id?: string | null;
          total_periods?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_settings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_settings_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_settings_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          narration: string | null;
          reference_number: string | null;
          school_id: string;
          source_module: string;
          source_record_id: string | null;
          status: string;
          total_amount: number;
          transaction_date: string;
          transaction_number: string;
          transaction_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          narration?: string | null;
          reference_number?: string | null;
          school_id : string;
          source_module : string;
          source_record_id?: string | null;
          status?: string;
          total_amount?: number;
          transaction_date?: string;
          transaction_number : string;
          transaction_type : string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          narration?: string | null;
          reference_number?: string | null;
          school_id?: string;
          source_module?: string;
          source_record_id?: string | null;
          status?: string;
          total_amount?: number;
          transaction_date?: string;
          transaction_number?: string;
          transaction_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          school_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role : string;
          school_id?: string | null;
          user_id : string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          school_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
            can_view_subscription: { Args: never; Returns: boolean };
      consume_server_function_rate_limit: {
        Args: never;
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: string;
        }[];
      };
      change_own_school_subscription: {
        Args: {
          p_plan_id: string;
          p_status: string;
          p_starts_at: string;
          p_ends_at?: string;
          p_auto_renew?: boolean;
        };
        Returns: Database["public"]["Tables"]["school_subscriptions"]["Row"];
      };
      current_school_id: { Args: never; Returns: string };
      can_manage_school: { Args: never; Returns: boolean };
      can_view_all_students: { Args: never; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
      record_school_payment: {
        Args: {
          p_amount: number;
          p_currency: string;
          p_method: string;
          p_notes?: string;
          p_payment_date: string;
          p_reference?: string;
          p_school_id: string;
          p_status?: string;
          p_subscription_id?: string;
        };
        Returns: Database["public"]["Tables"]["school_payments"]["Row"];
      };
      replace_school_subscription: {
        Args: {
          p_auto_renew?: boolean;
          p_ends_at?: string;
          p_notes?: string;
          p_plan_id: string;
          p_school_id: string;
          p_starts_at: string;
          p_status: string;
        };
        Returns: Database["public"]["Tables"]["school_subscriptions"]["Row"];
      };
      platform_school_stats: {
        Args: never;
        Returns: {
          code: string;
          created_at: string;
          logins_30d: number;
          school_id: string;
          school_name: string;
          status: Database["public"]["Enums"]["school_status"];
          student_count: number;
          subscription_plan: string;
          user_count: number;
        }[];
      };
      teacher_scope_matches: {
        Args: { _class_id: string; _stream_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "school_admin"
        | "head_teacher"
        | "deputy_head_teacher"
        | "dos"
        | "class_teacher"
        | "subject_teacher"
        | "bursar"
        | "library"
        | "hod"
        | "librarian";
      assessment_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected";
      school_status:
        | "active"
        | "suspended";
      student_status:
        | "pending"
        | "active"
        | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "school_admin",
        "head_teacher",
        "deputy_head_teacher",
        "dos",
        "class_teacher",
        "subject_teacher",
        "bursar",
        "library",
        "hod",
        "librarian",
      ],
      assessment_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
      ],
      school_status: [
        "active",
        "suspended",
      ],
      student_status: [
        "pending",
        "active",
        "inactive",
      ],
    },
  },
} as const;





