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
          allowable_level: string | null
          assessment_date: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          completed_at: string | null
          complex_id: string
          created_at: string | null
          created_by: string | null
          id: string
          judgment_criteria: Json | null
          location: string | null
          method: Database["public"]["Enums"]["assessment_method"]
          shared_at: string | null
          status: Database["public"]["Enums"]["assessment_status"] | null
          updated_at: string | null
          work_category: Database["public"]["Enums"]["work_category"] | null
          work_name: string
        }
        Insert: {
          allowable_level?: string | null
          assessment_date: string
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          completed_at?: string | null
          complex_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          judgment_criteria?: Json | null
          location?: string | null
          method: Database["public"]["Enums"]["assessment_method"]
          shared_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"] | null
          updated_at?: string | null
          work_category?: Database["public"]["Enums"]["work_category"] | null
          work_name: string
        }
        Update: {
          allowable_level?: string | null
          assessment_date?: string
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          completed_at?: string | null
          complex_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          judgment_criteria?: Json | null
          location?: string | null
          method?: Database["public"]["Enums"]["assessment_method"]
          shared_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"] | null
          updated_at?: string | null
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
          {
            foreignKeyName: "assessments_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "v_company_dashboard"
            referencedColumns: ["complex_id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          business_number: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          super_admin_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          super_admin_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_number?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          super_admin_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_super_admin_user_id_fkey"
            columns: ["super_admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      complex_members: {
        Row: {
          complex_id: string
          created_at: string | null
          id: string
          role_in_complex: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Insert: {
          complex_id: string
          created_at?: string | null
          id?: string
          role_in_complex?: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Update: {
          complex_id?: string
          created_at?: string | null
          id?: string
          role_in_complex?: Database["public"]["Enums"]["user_role"] | null
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
          {
            foreignKeyName: "complex_members_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "v_company_dashboard"
            referencedColumns: ["complex_id"]
          },
          {
            foreignKeyName: "complex_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      complexes: {
        Row: {
          address: string
          company_id: string | null
          created_at: string | null
          household_count: number | null
          id: string
          manager_name: string | null
          manager_phone: string | null
          mgmt_type: Database["public"]["Enums"]["mgmt_type"]
          name: string
          updated_at: string | null
        }
        Insert: {
          address: string
          company_id?: string | null
          created_at?: string | null
          household_count?: number | null
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          mgmt_type?: Database["public"]["Enums"]["mgmt_type"]
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          company_id?: string | null
          created_at?: string | null
          household_count?: number | null
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          mgmt_type?: Database["public"]["Enums"]["mgmt_type"]
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complexes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complexes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      hazard_library: {
        Row: {
          category: Database["public"]["Enums"]["work_category"]
          created_at: string | null
          default_likelihood: number | null
          default_severity: number | null
          description: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          suggested_measures: string[] | null
        }
        Insert: {
          category: Database["public"]["Enums"]["work_category"]
          created_at?: string | null
          default_likelihood?: number | null
          default_severity?: number | null
          description: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          suggested_measures?: string[] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["work_category"]
          created_at?: string | null
          default_likelihood?: number | null
          default_severity?: number | null
          description?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          suggested_measures?: string[] | null
        }
        Relationships: []
      }
      hazards: {
        Row: {
          assessment_id: string
          checklist_result: string | null
          created_at: string | null
          description: string
          exposed_workers: Json | null
          id: string
          level: Database["public"]["Enums"]["risk_level"] | null
          level_standardized: Database["public"]["Enums"]["risk_level"] | null
          library_item_id: string | null
          likelihood: number | null
          location_detail: string | null
          ops_data: Json | null
          photos: Json | null
          severity: number | null
          updated_at: string | null
        }
        Insert: {
          assessment_id: string
          checklist_result?: string | null
          created_at?: string | null
          description: string
          exposed_workers?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"] | null
          level_standardized?: Database["public"]["Enums"]["risk_level"] | null
          library_item_id?: string | null
          likelihood?: number | null
          location_detail?: string | null
          ops_data?: Json | null
          photos?: Json | null
          severity?: number | null
          updated_at?: string | null
        }
        Update: {
          assessment_id?: string
          checklist_result?: string | null
          created_at?: string | null
          description?: string
          exposed_workers?: Json | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"] | null
          level_standardized?: Database["public"]["Enums"]["risk_level"] | null
          library_item_id?: string | null
          likelihood?: number | null
          location_detail?: string | null
          ops_data?: Json | null
          photos?: Json | null
          severity?: number | null
          updated_at?: string | null
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
          completed_at: string | null
          content: string
          created_at: string | null
          due_date: string | null
          evidence: Json | null
          hazard_id: string
          id: string
          residual_level: Database["public"]["Enums"]["risk_level"] | null
          responsible_name: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["measure_status"] | null
          type: Database["public"]["Enums"]["measure_type"]
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          content: string
          created_at?: string | null
          due_date?: string | null
          evidence?: Json | null
          hazard_id: string
          id?: string
          residual_level?: Database["public"]["Enums"]["risk_level"] | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["measure_status"] | null
          type: Database["public"]["Enums"]["measure_type"]
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          content?: string
          created_at?: string | null
          due_date?: string | null
          evidence?: Json | null
          hazard_id?: string
          id?: string
          residual_level?: Database["public"]["Enums"]["risk_level"] | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["measure_status"] | null
          type?: Database["public"]["Enums"]["measure_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measures_hazard_id_fkey"
            columns: ["hazard_id"]
            isOneToOne: false
            referencedRelation: "hazards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measures_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      near_miss: {
        Row: {
          assessment_id: string | null
          cause: string | null
          complex_id: string
          created_at: string | null
          id: string
          occurred_at: string
          photos: Json | null
          reported_by: string | null
          result: string | null
          situation: string
        }
        Insert: {
          assessment_id?: string | null
          cause?: string | null
          complex_id: string
          created_at?: string | null
          id?: string
          occurred_at: string
          photos?: Json | null
          reported_by?: string | null
          result?: string | null
          situation: string
        }
        Update: {
          assessment_id?: string | null
          cause?: string | null
          complex_id?: string
          created_at?: string | null
          id?: string
          occurred_at?: string
          photos?: Json | null
          reported_by?: string | null
          result?: string | null
          situation?: string
        }
        Relationships: [
          {
            foreignKeyName: "near_miss_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "near_miss_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "complexes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "near_miss_complex_id_fkey"
            columns: ["complex_id"]
            isOneToOne: false
            referencedRelation: "v_company_dashboard"
            referencedColumns: ["complex_id"]
          },
          {
            foreignKeyName: "near_miss_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          assessment_id: string
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          participation_role: Database["public"]["Enums"]["participation_role"]
          phone: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          assessment_id: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          participation_role: Database["public"]["Enums"]["participation_role"]
          phone?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          assessment_id?: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          participation_role?: Database["public"]["Enums"]["participation_role"]
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
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          assessment_id: string
          created_at: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          ip_address: string | null
          participant_id: string
          signature_image: string
          signed_at: string | null
          user_agent: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip_address?: string | null
          participant_id: string
          signature_image: string
          signed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          ip_address?: string | null
          participant_id?: string
          signature_image?: string
          signed_at?: string | null
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
      users: {
        Row: {
          auth_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          auth_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          auth_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_company_dashboard: {
        Row: {
          address: string | null
          avg_participation_rate: number | null
          company_id: string | null
          company_name: string | null
          complex_id: string | null
          complex_name: string | null
          last_assessment_date: string | null
          this_month_count: number | null
          unresolved_high: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_assessment: {
        Args: { _assessment_id: string }
        Returns: boolean
      }
      create_sample_data_for_user: {
        Args: { p_user_id: string }
        Returns: string
      }
      ensure_current_user_default_complex: {
        Args: never
        Returns: {
          complex_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      assessment_method:
        | "3단계_판단법"
        | "5단계_판단법"
        | "빈도강도법"
        | "체크리스트법"
        | "OPS"
      assessment_status: "작성중" | "협의중" | "완료"
      assessment_type: "최초평가" | "정기평가" | "수시평가"
      measure_status: "대기" | "진행중" | "완료"
      measure_type: "본질적_대책" | "공학적_대책" | "관리적_대책" | "개인보호구"
      mgmt_type: "자가관리" | "위탁관리"
      participation_role: "책임자" | "평가자" | "근로자" | "검토자"
      risk_level:
        | "매우낮음"
        | "낮음"
        | "보통"
        | "높음"
        | "매우높음"
        | "상"
        | "중"
        | "하"
        | "적정"
        | "보완"
      user_role:
        | "관리사무소장"
        | "안전보건관리책임자"
        | "관리감독자"
        | "안전관리자"
        | "보건관리자"
        | "본사_안전담당"
        | "super_admin"
        | "기타"
      work_category:
        | "승강기_점검정비"
        | "기계실_보일러실"
        | "전기실_변전실"
        | "옥상_외벽"
        | "어린이놀이시설"
        | "지하주차장_환기"
        | "소방시설"
        | "조경_외부작업"
        | "청소_미화_사무"
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
      assessment_method: [
        "3단계_판단법",
        "5단계_판단법",
        "빈도강도법",
        "체크리스트법",
        "OPS",
      ],
      assessment_status: ["작성중", "협의중", "완료"],
      assessment_type: ["최초평가", "정기평가", "수시평가"],
      measure_status: ["대기", "진행중", "완료"],
      measure_type: ["본질적_대책", "공학적_대책", "관리적_대책", "개인보호구"],
      mgmt_type: ["자가관리", "위탁관리"],
      participation_role: ["책임자", "평가자", "근로자", "검토자"],
      risk_level: [
        "매우낮음",
        "낮음",
        "보통",
        "높음",
        "매우높음",
        "상",
        "중",
        "하",
        "적정",
        "보완",
      ],
      user_role: [
        "관리사무소장",
        "안전보건관리책임자",
        "관리감독자",
        "안전관리자",
        "보건관리자",
        "본사_안전담당",
        "super_admin",
        "기타",
      ],
      work_category: [
        "승강기_점검정비",
        "기계실_보일러실",
        "전기실_변전실",
        "옥상_외벽",
        "어린이놀이시설",
        "지하주차장_환기",
        "소방시설",
        "조경_외부작업",
        "청소_미화_사무",
      ],
    },
  },
} as const
