export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          name: string;
          school_id: string;
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
          assessment_id: string;
          granted_at?: string;
          granted_by?: string | null;
          granted_by_name?: string | null;
          id?: string;
          reason?: string | null;
          revoked_at?: string | null;
          school_id: string;
          teacher_id: string;
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
            foreignKeyName: "assessment_edit_grants_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_edit_grants_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
          locked: boolean;
          rejection_reason: string | null;
          school_id: string;
          status: Database["public"]["Enums"]["assessment_status"];
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
          locked?: boolean;
          rejection_reason?: string | null;
          school_id: string;
          status?: Database["public"]["Enums"]["assessment_status"];
          student_id: string;
          subject_id: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          summative?: number | null;
          teacher_initials?: string | null;
          term_id: string;
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
          locked?: boolean;
          rejection_reason?: string | null;
          school_id?: string;
          status?: Database["public"]["Enums"]["assessment_status"];
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
          attendance_date: string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id: string;
          status?: string;
          student_id: string;
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
        };
        Insert: {
          days_absent?: number;
          days_present?: number;
          id?: string;
          school_id: string;
          student_id: string;
          term_id: string;
        };
        Update: {
          days_absent?: number;
          days_present?: number;
          id?: string;
          school_id?: string;
          student_id?: string;
          term_id?: string;
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
          action: string;
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
          name: string;
          school_id: string;
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
            foreignKeyName: "classes_class_teacher_id_fkey";
            columns: ["class_teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
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
          school_id: string;
          student_id: string;
          term_id: string;
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
          module: string;
          school_id: string;
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
      grading_scales: {
        Row: {
          created_at: string;
          descriptor: string;
          education_level: string;
          grade: string;
          id: string;
          identifier: number;
          max_score: number;
          min_score: number;
          points: number | null;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          descriptor: string;
          education_level?: string;
          grade: string;
          id?: string;
          identifier?: number;
          max_score: number;
          min_score: number;
          points?: number | null;
          school_id: string;
        };
        Update: {
          created_at?: string;
          descriptor?: string;
          education_level?: string;
          grade?: string;
          id?: string;
          identifier?: number;
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
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          school_id?: string | null;
          title: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          school_id?: string | null;
          title?: string;
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
      profiles: {
        Row: {
          created_at: string;
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
          email?: string | null;
          full_name?: string;
          id: string;
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
          school_id: string;
          student_id: string;
          term_id: string;
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
      report_comment_rules: {
        Row: {
          comment: string;
          comment_role: string;
          created_at: string;
          descriptor: string;
          id: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          comment: string;
          comment_role: string;
          created_at?: string;
          descriptor: string;
          id?: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          comment_role?: string;
          created_at?: string;
          descriptor?: string;
          id?: string;
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
          school_id: string;
          start_date: string;
          term_id?: string | null;
          title: string;
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
          report_payment_reference_type: string;
          signatories: Json;
          stamp_url: string | null;
          status: Database["public"]["Enums"]["school_status"];
          subscription_plan: string;
          summative_weight: number;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          code: string;
          created_at?: string;
          email?: string | null;
          formative_weight?: number;
          id?: string;
          logo_url?: string | null;
          motto?: string | null;
          name: string;
          phone?: string | null;
          report_account_number?: string | null;
          report_header?: string | null;
          report_next_term_begins_on?: string | null;
          report_payment_reference_type?: string;
          signatories?: Json;
          stamp_url?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
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
          report_payment_reference_type?: string;
          signatories?: Json;
          stamp_url?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
          subscription_plan?: string;
          summative_weight?: number;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
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
          class_id: string;
          created_at?: string;
          id?: string;
          name: string;
          school_id: string;
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
            foreignKeyName: "streams_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "streams_stream_teacher_id_fkey";
            columns: ["stream_teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "streams_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
          full_name: string;
          id?: string;
          is_emergency?: boolean;
          occupation?: string | null;
          phone?: string | null;
          relationship?: string | null;
          school_id: string;
          student_id: string;
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
          event_type: string;
          id?: string;
          performed_by?: string | null;
          school_id: string;
          student_id: string;
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
          outcome: string;
          performed_by?: string | null;
          school_id: string;
          student_id: string;
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
          school_id: string;
          student_id: string;
          subject_id: string;
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
          status: Database["public"]["Enums"]["student_status"];
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
          full_name: string;
          gender?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          house?: string | null;
          id?: string;
          lin?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          photo_url?: string | null;
          school_id: string;
          schpay_code?: string | null;
          status?: Database["public"]["Enums"]["student_status"];
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
          status?: Database["public"]["Enums"]["student_status"];
          stream_id?: string | null;
          student_number?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
      subjects: {
        Row: {
          category: string;
          code: string | null;
          created_at: string;
          id: string;
          name: string;
          position: number;
          school_id: string;
        };
        Insert: {
          category?: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          position?: number;
          school_id: string;
        };
        Update: {
          category?: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
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
      teacher_allocation_history: {
        Row: {
          action: string;
          class_id: string | null;
          id: string;
          performed_at: string;
          performed_by: string | null;
          school_id: string;
          stream_id: string | null;
          subject_id: string | null;
          teacher_id: string;
        };
        Insert: {
          action: string;
          class_id?: string | null;
          id?: string;
          performed_at?: string;
          performed_by?: string | null;
          school_id: string;
          stream_id?: string | null;
          subject_id?: string | null;
          teacher_id: string;
        };
        Update: {
          action?: string;
          class_id?: string | null;
          id?: string;
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
          school_id: string;
          stream_id: string | null;
          subject_id: string;
          teacher_id: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          school_id: string;
          stream_id?: string | null;
          subject_id: string;
          teacher_id: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          school_id?: string;
          stream_id?: string | null;
          subject_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_allocations_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
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
            foreignKeyName: "teacher_allocations_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          attendance_date: string;
          created_at?: string;
          id?: string;
          recorded_by?: string | null;
          school_id: string;
          status?: string;
          teacher_id: string;
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
          academic_year_id: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          name: string;
          school_id: string;
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
            foreignKeyName: "terms_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
          class_id: string;
          classroom?: string | null;
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          is_published?: boolean;
          period: number;
          school_id: string;
          start_time: string;
          stream_id?: string | null;
          subject_id: string;
          teacher_id: string;
          term_id: string;
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
            foreignKeyName: "timetable_entries_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
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
            foreignKeyName: "timetable_entries_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
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
          {
            foreignKeyName: "timetable_entries_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
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
      can_manage_academics: { Args: never; Returns: boolean };
      can_manage_school: { Args: never; Returns: boolean };
      can_view_all_students: { Args: never; Returns: boolean };
      current_school_id: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
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
        | "subject_teacher";
      assessment_status: "draft" | "submitted" | "approved" | "rejected";
      school_status: "active" | "suspended";
      student_status: "pending" | "active" | "inactive";
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
      ],
      assessment_status: ["draft", "submitted", "approved", "rejected"],
      school_status: ["active", "suspended"],
      student_status: ["pending", "active", "inactive"],
    },
  },
} as const;
