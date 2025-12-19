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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      apostas: {
        Row: {
          apelido: string
          bolao_id: string
          celular: string
          created_at: string
          data_registro: string | null
          dezenas: number[]
          id: string
          paid_at: string | null
          paid_marked_by: string | null
          payment_status: string
          receipt_url: string | null
          registrado: boolean
        }
        Insert: {
          apelido: string
          bolao_id: string
          celular: string
          created_at?: string
          data_registro?: string | null
          dezenas: number[]
          id?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_status?: string
          receipt_url?: string | null
          registrado?: boolean
        }
        Update: {
          apelido?: string
          bolao_id?: string
          celular?: string
          created_at?: string
          data_registro?: string | null
          dezenas?: number[]
          id?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_status?: string
          receipt_url?: string | null
          registrado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "apostas_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      boloes: {
        Row: {
          chave_pix: string
          created_at: string
          data_sorteio: string | null
          encerrado: boolean
          gestor_id: string
          id: string
          nome_do_bolao: string
          notificacao_aprovada: boolean | null
          numero_concurso: number | null
          numeros_sorteados: number[] | null
          observacoes: string | null
          resultado_verificado: boolean | null
          tipo_loteria: string
          total_apostas: number
          updated_at: string
          valor_cota: number
        }
        Insert: {
          chave_pix: string
          created_at?: string
          data_sorteio?: string | null
          encerrado?: boolean
          gestor_id: string
          id?: string
          nome_do_bolao: string
          notificacao_aprovada?: boolean | null
          numero_concurso?: number | null
          numeros_sorteados?: number[] | null
          observacoes?: string | null
          resultado_verificado?: boolean | null
          tipo_loteria?: string
          total_apostas?: number
          updated_at?: string
          valor_cota?: number
        }
        Update: {
          chave_pix?: string
          created_at?: string
          data_sorteio?: string | null
          encerrado?: boolean
          gestor_id?: string
          id?: string
          nome_do_bolao?: string
          notificacao_aprovada?: boolean | null
          numero_concurso?: number | null
          numeros_sorteados?: number[] | null
          observacoes?: string | null
          resultado_verificado?: boolean | null
          tipo_loteria?: string
          total_apostas?: number
          updated_at?: string
          valor_cota?: number
        }
        Relationships: [
          {
            foreignKeyName: "boloes_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jogos_selecionados: {
        Row: {
          bolao_id: string
          categoria: string
          created_at: string
          custo: number
          data_registro: string | null
          dezenas: number[]
          id: string
          registrado: boolean
          tipo: string
        }
        Insert: {
          bolao_id: string
          categoria: string
          created_at?: string
          custo: number
          data_registro?: string | null
          dezenas: number[]
          id?: string
          registrado?: boolean
          tipo: string
        }
        Update: {
          bolao_id?: string
          categoria?: string
          created_at?: string
          custo?: number
          data_registro?: string | null
          dezenas?: number[]
          id?: string
          registrado?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jogos_selecionados_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          autor_celular: string | null
          autor_gestor_id: string | null
          autor_nome: string
          bolao_id: string
          conteudo: string
          created_at: string
          id: string
        }
        Insert: {
          autor_celular?: string | null
          autor_gestor_id?: string | null
          autor_nome: string
          bolao_id: string
          conteudo: string
          created_at?: string
          id?: string
        }
        Update: {
          autor_celular?: string | null
          autor_gestor_id?: string | null
          autor_nome?: string
          bolao_id?: string
          conteudo?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_bolao_id_fkey"
            columns: ["bolao_id"]
            isOneToOne: false
            referencedRelation: "boloes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_bolao_for_participation: {
        Args: { bolao_id: string }
        Returns: {
          chave_pix: string
          created_at: string
          gestor_name: string
          id: string
          nome_do_bolao: string
          observacoes: string
          total_apostas: number
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
