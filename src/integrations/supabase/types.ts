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
      assessments: {
        Row: {
          allowable_level: Database["public"]["Enums"]["risk_level"] | null
          assessment_date: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          complex_id: string
          created_at: string
          created_by: string
          id: string
          judgment_criteria: Json | null
          location: string | null
          method: Database["public"]["Enums"]["assessment_method"]
          status: Database["public"]["Enums"]["assessment_status"]
          updated_at: string
          work_category: Database["public"]["Enums"]["work_category"] | null
          work_name: string
        }
        Insert: {
          allowable_level?: Database["public"]["Enums"]["risk_level"] | null
          assessment_date?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          complex_id: string
          created_at?: string
          created_by: string
          id?: string
          judgment_criteria?: Json | null
          location?: string | null
          method?: Database["public"]["Enums"]["assessment_method"]
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
          work_category?: Database["public"]["Enums"]["work_category"] | null
          work_name: string
        }
        Update: {
          allowable_level?: Database["public"]["Enums"]["risk_level"] | null
          assessment_date?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          complex_id?: string
          created_at?: string
          created_by?: string
          id?: string
          judgment_criteria?: Json | null
          location?: string | null
          method?: Database["public"]["Enums"]["assessment_method"]
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
          work_category?: Database["public"]["Enums"]["work_category"] | null
          work_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      complex_members: {
        Row: {
          complex_id: string
          created_at: string
          id: string
          role_in_complex: string | null
          user_id: string
        }
        Insert: {
          complex_id: string
          created_at?: string
          id?: string
          role_in_complex?: string | null
          user_id: string
        }
        Update: {
          complex_id?: string
          created_at?: string
          id?: string
          role_in_complex?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complex_members_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      complexes: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          household_count: number | null
          id: string
          mgmt_type: Database["public"]["Enums"]["mgmt_type"]
          name: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          household_count?: number | null
          id?: string
          mgmt_type?: Database["public"]["Enums"]["mgmt_type"]
          name: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          household_count?: number | null
          id?: string
          mgmt_type?: Database["public"]["Enums"]["mgmt_type"]
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "complexes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hazard_library: {
        Row: {
          category: Database["public"]["Enums"]["work_category"]
          description: string
          id: string
          sort_order: number
        }
        Insert: {
          category: Database["public"]["Enums"]["work_category"]
          description: string
          id?: string
          sort_order?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["work_category"]
          description?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      hazards: {
        Row: {
          assessment_id: string
          checklist_result: string | null
          created_at: string
          description: string
          exposed_workers: Json | null
          id: string
          level: Database["public"]["Enums"]["risk_level"] | null
          level_standardized: Database["public"]["Enums"]["risk_level"] | null
          likelihood: number | null
          location_detail: string | null
          ops_data: Json | null
          photos: Json | null
          severity: number | null
        }
        Insert: {
          assessment_id: string
          checklist_result?: string | null
          created_at?: string
          description: string
          exposed_workers?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"] | null
          level_standardized?: Database["public"]["Enums"]["risk_level"] | null
          likelihood?: number | null
          location_detail?: string | null
          ops_data?: Json | null
          photos?: Json | null
          severity?: number | null
        }
        Update: {
          assessment_id?: string
          checklist_result?: string | null
          created_at?: string
          description?: string
          exposed_workers?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"] | null
          level_standardized?: Database["public"]["Enums"]["risk_level"] | null
          likelihood?: number | null
          location_detail?: string | null
          ops_data?: Json | null
          photos?: Json | null
          severity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hazards_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      measures: {
        Row: {
          content: string
          created_at: string
          due_date: string | null
          evidence: Json | null
          hazard_id: string
          id: string
          measure_type: Database["public"]["Enums"]["measure_type"]
          residual_level: Database["public"]["Enums"]["risk_level"] | null
          responsible_name: string | null
          status: Database["public"]["Enums"]["measure_status"]
        }
        Insert: {
          content: string
          created_at?: string
          due_date?: string | null
          evidence?: Json | null
          hazard_id: string
          id?: string
          measure_type?: Database["public"]["Enums"]["measure_type"]
          residual_level?: Database["public"]["Enums"]["risk_level"] | null
          responsible_name?: string | null
          status?: Database["public"]["Enums"]["measure_status"]
        }
        Update: {
          content?: string
          created_at?: string
          due_date?: string | null
          evidence?: Json | null
          hazard_id?: string
          id?: string
          measure_type?: Database["public"]["Enums"]["measure_type"]
          residual_level?: Database["public"]["Enums"]["risk_level"] | null
          responsible_name?: string | null
          status?: Database["public"]["Enums"]["measure_status"]
        }
        Relationships: [
          {
            foreignKeyName: "measures_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazards"
            referencedColumns: ["id"]
          },
        ]
      }
      near_miss: {
        Row: {
          assessment_id: string
          cause: string | null
          created_at: string
          id: string
          occurred_at: string | null
          photos: Json | null
          result: string | null
          situation: string | null
        }
        Insert: {
          assessment_id: string
          cause?: string | null
          created_at?: string
          id?: string
          occurred_at?: string | null
          photos?: Json | null
          result?: string | null
          situation?: string | null
        }
        Update: {
          assessment_id?: string
          cause?: string | null
          created_at?: string
          id?: string
          occurred_at?: string | null
          photos?: Json | null
          result?: string | null
          situation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "near_miss_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          name: string
          participation_role: string
          phone: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          name: string
          participation_role?: string
          phone?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          name?: string
          participation_role?: string
          phone?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliation: Database["public"]["Enums"]["affiliation_type"]
          created_at: string
          id: string
          name: string
          org_name: string | null
          phone: string | null
          position: Database["public"]["Enums"]["user_position"]
          primary_company_id: string | null
          primary_complex_id: string | null
        }
        Insert: {
          affiliation?: Database["public"]["Enums"]["affiliation_type"]
          created_at?: string
          id: string
          name?: string
          org_name?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["user_position"]
          primary_company_id?: string | null
          primary_complex_id?: string | null
        }
        Update: {
          affiliation?: Database["public"]["Enums"]["affiliation_type"]
          created_at?: string
          id?: string
          name?: string
          org_name?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["user_position"]
          primary_company_id?: string | null
          primary_complex_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_company_id_fkey"
            columns: ["primary_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_primary_complex_id_fkey"
            columns: ["primary_complex_id"]
            isOneToOne: false
            referencedRelation: "complexes"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          assessment_id: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          ip_address: string | null
          participant_id: string
          signature_image: string | null
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          assessment_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip_address?: string | null
          participant_id: string
          signature_image?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          assessment_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip_address?: string | null
          participant_id?: string
          signature_image?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_assessment: {
        Args: { _assessment_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_complex: {
        Args: { _complex_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_complex_member: {
        Args: { _complex_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      affiliation_type: "자가관리" | "위탁관리" | "본사"
      app_role: "super_admin" | "member"
      assessment_method: "3단계" | "5단계" | "빈도강도" | "체크리스트" | "OPS"
      assessment_status: "작성중" | "협의중" | "완료"
      assessment_type: "최초평가" | "정기평가" | "수시평가"
      measure_status: "대기" | "진행중" | "완료"
      measure_type: "본질적" | "공학적" | "관리적" | "개인보호구"
      mgmt_type: "자가관리" | "위탁관리"
      risk_level: "매우낮음" | "낮음" | "보통" | "높음" | "매우높음"
      user_position:
        | "관리사무소장"
        | "안전보건관리책임자"
        | "관리감독자"
        | "안전관리자"
        | "보건관리자"
        | "본사_안전담당"
        | "기타"
      work_category:
        | "승강기 점검·정비"
        | "기계실·보일러실 작업"
        | "전기실·변전실 작업"
        | "옥상·외벽 작업"
        | "어린이 놀이시설 점검"
        | "지하주차장·환기설비 작업"
        | "소방시설 점검"
        | "조경·외부 작업"
        | "청소·미화·일반 사무"
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
      affiliation_type: ["자가관리", "위탁관리", "본사"],
      app_role: ["super_admin", "member"],
      assessment_method: ["3단계", "5단계", "빈도강도", "체크리스트", "OPS"],
      assessment_status: ["작성중", "협의중", "완료"],
      assessment_type: ["최초평가", "정기평가", "수시평가"],
      measure_status: ["대기", "진행중", "완료"],
      measure_type: ["본질적", "공학적", "관리적", "개인보호구"],
      mgmt_type: ["자가관리", "위탁관리"],
      risk_level: ["매우낮음", "낮음", "보통", "높음", "매우높음"],
      user_position: [
        "관리사무소장",
        "안전보건관리책임자",
        "관리감독자",
        "안전관리자",
        "보건관리자",
        "본사_안전담당",
        "기타",
      ],
      work_category: [
        "승강기 점검·정비",
        "기계실·보일러실 작업",
        "전기실·변전실 작업",
        "옥상·외벽 작업",
        "어린이 놀이시설 점검",
        "지하주차장·환기설비 작업",
        "소방시설 점검",
        "조경·외부 작업",
        "청소·미화·일반 사무",
      ],
    },
  },
} as const
