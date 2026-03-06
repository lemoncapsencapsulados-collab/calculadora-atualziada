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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      configuracao_custos: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          credito_prodeic: number | null
          depreciacao_maquinas: number | null
          despesas_administrativas: number | null
          energia_eletrica: number | null
          fundeb_fundes: number | null
          icms_credito_nf: number | null
          icms_saida: number | null
          id: string
          ipi_saida: number | null
          irpj_csll: number | null
          mao_obra_direta: number | null
          nome: string
          pis_cofins_credito: number | null
          pis_cofins_saida: number | null
          senha_protecao: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          credito_prodeic?: number | null
          depreciacao_maquinas?: number | null
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          fundeb_fundes?: number | null
          icms_credito_nf?: number | null
          icms_saida?: number | null
          id?: string
          ipi_saida?: number | null
          irpj_csll?: number | null
          mao_obra_direta?: number | null
          nome: string
          pis_cofins_credito?: number | null
          pis_cofins_saida?: number | null
          senha_protecao?: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          credito_prodeic?: number | null
          depreciacao_maquinas?: number | null
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          fundeb_fundes?: number | null
          icms_credito_nf?: number | null
          icms_saida?: number | null
          id?: string
          ipi_saida?: number | null
          irpj_csll?: number | null
          mao_obra_direta?: number | null
          nome?: string
          pis_cofins_credito?: number | null
          pis_cofins_saida?: number | null
          senha_protecao?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      embalagens: {
        Row: {
          categoria: string | null
          created_at: string | null
          descricao: string
          fornecedor: string | null
          id: string
          nome: string
          preco_unitario: number
          subcategoria: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          nome: string
          preco_unitario: number
          subcategoria?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          nome?: string
          preco_unitario?: number
          subcategoria?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      formulas: {
        Row: {
          cliente: string
          created_at: string | null
          custo_total: number
          embalagens: Json
          id: string
          itens: Json
          nome_formula: string
          quantidade_por_pote: number
          tipo_produto: string
          total_embalagem: number
          total_mp: number
          unidade_soluvel: string | null
          unidades_por_dose: number | null
          updated_at: string | null
        }
        Insert: {
          cliente: string
          created_at?: string | null
          custo_total: number
          embalagens: Json
          id?: string
          itens: Json
          nome_formula: string
          quantidade_por_pote: number
          tipo_produto: string
          total_embalagem: number
          total_mp: number
          unidade_soluvel?: string | null
          unidades_por_dose?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente?: string
          created_at?: string | null
          custo_total?: number
          embalagens?: Json
          id?: string
          itens?: Json
          nome_formula?: string
          quantidade_por_pote?: number
          tipo_produto?: string
          total_embalagem?: number
          total_mp?: number
          unidade_soluvel?: string | null
          unidades_por_dose?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lotes: {
        Row: {
          codigo: string | null
          created_at: string | null
          custo_unitario: number
          fornecedor: string | null
          id: string
          item_id: string
          item_tipo: string
          observacoes: string | null
          quantidade: number
          updated_at: string | null
          validade: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          custo_unitario: number
          fornecedor?: string | null
          id?: string
          item_id: string
          item_tipo: string
          observacoes?: string | null
          quantidade?: number
          updated_at?: string | null
          validade?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          custo_unitario?: number
          fornecedor?: string | null
          id?: string
          item_id?: string
          item_tipo?: string
          observacoes?: string | null
          quantidade?: number
          updated_at?: string | null
          validade?: string | null
        }
        Relationships: []
      }
      margens_lucro: {
        Row: {
          created_at: string | null
          id: string
          margem_ideal: number
          margem_minima: number
          tipo_produto: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          margem_ideal: number
          margem_minima: number
          tipo_produto: string
        }
        Update: {
          created_at?: string | null
          id?: string
          margem_ideal?: number
          margem_minima?: number
          tipo_produto?: string
        }
        Relationships: []
      }
      materias_primas: {
        Row: {
          categoria: string | null
          created_at: string | null
          densidade: number | null
          fornecedor: string | null
          id: string
          nome: string
          normalized_name: string | null
          observacoes: string | null
          preco_compra: number
          unidade_compra: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          densidade?: number | null
          fornecedor?: string | null
          id?: string
          nome: string
          normalized_name?: string | null
          observacoes?: string | null
          preco_compra: number
          unidade_compra: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          densidade?: number | null
          fornecedor?: string | null
          id?: string
          nome?: string
          normalized_name?: string | null
          observacoes?: string | null
          preco_compra?: number
          unidade_compra?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          condicoes_pagamento: Json | null
          consultor_responsavel: string | null
          created_at: string | null
          dados_cliente: Json | null
          data_pagamento: string | null
          detalhamento_frete: Json | null
          forma_pagamento: string | null
          id: string
          itens_producao: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes: string | null
          servicos_marca: Json
          status: string
          subtotal_producao: number
          subtotal_servicos: number
          tipo_orcamento: string
          updated_at: string | null
          validade_dias: number
          valor_total: number
        }
        Insert: {
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          id?: string
          itens_producao?: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes?: string | null
          servicos_marca?: Json
          status?: string
          subtotal_producao?: number
          subtotal_servicos?: number
          tipo_orcamento?: string
          updated_at?: string | null
          validade_dias?: number
          valor_total?: number
        }
        Update: {
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          id?: string
          itens_producao?: Json
          nome_cliente?: string
          numero_orcamento?: string
          observacoes?: string | null
          servicos_marca?: Json
          status?: string
          subtotal_producao?: number
          subtotal_servicos?: number
          tipo_orcamento?: string
          updated_at?: string | null
          validade_dias?: number
          valor_total?: number
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          created_at: string | null
          data_entrega: string
          data_pedido: string
          formula_id: string | null
          formula_snapshot: Json | null
          id: string
          numero_pedido: string
          observacoes: string | null
          orcamento_id: string | null
          orcamento_snapshot: Json | null
          quantidade_produto: number
          status: string
          unidade_produto: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_entrega: string
          data_pedido: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          id?: string
          numero_pedido: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          quantidade_produto: number
          status?: string
          unidade_produto: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_entrega?: string
          data_pedido?: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          id?: string
          numero_pedido?: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          quantidade_produto?: number
          status?: string
          unidade_produto?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      precificacoes: {
        Row: {
          base_calculo_irpj_csll: number
          configuracao_custos_id: string | null
          created_at: string | null
          custo_administrativo: number
          custo_depreciacao: number
          custo_embalagem: number
          custo_energia: number
          custo_mao_obra_direta: number
          custo_materia_prima: number
          formula_id: string | null
          fundeb_fundes: number
          icms_credito_nf: number
          icms_credito_prodeic: number
          icms_recolher: number
          icms_saida: number
          id: string
          ipi_valor: number
          irpj_csll_valor: number
          margem_lucro_percentual: number
          margem_lucro_valor: number
          margem_seguranca: number
          markup_bruto: number
          observacoes: string | null
          pis_cofins_credito: number
          pis_cofins_recolher: number
          pis_cofins_saida: number
          preco_venda: number
          subtotal_custos_diretos: number
          subtotal_custos_indiretos: number
          total_custos_producao: number
          total_impostos: number
          updated_at: string | null
        }
        Insert: {
          base_calculo_irpj_csll: number
          configuracao_custos_id?: string | null
          created_at?: string | null
          custo_administrativo: number
          custo_depreciacao: number
          custo_embalagem: number
          custo_energia: number
          custo_mao_obra_direta: number
          custo_materia_prima: number
          formula_id?: string | null
          fundeb_fundes: number
          icms_credito_nf: number
          icms_credito_prodeic: number
          icms_recolher: number
          icms_saida: number
          id?: string
          ipi_valor: number
          irpj_csll_valor: number
          margem_lucro_percentual: number
          margem_lucro_valor: number
          margem_seguranca?: number
          markup_bruto: number
          observacoes?: string | null
          pis_cofins_credito: number
          pis_cofins_recolher: number
          pis_cofins_saida: number
          preco_venda: number
          subtotal_custos_diretos: number
          subtotal_custos_indiretos: number
          total_custos_producao: number
          total_impostos: number
          updated_at?: string | null
        }
        Update: {
          base_calculo_irpj_csll?: number
          configuracao_custos_id?: string | null
          created_at?: string | null
          custo_administrativo?: number
          custo_depreciacao?: number
          custo_embalagem?: number
          custo_energia?: number
          custo_mao_obra_direta?: number
          custo_materia_prima?: number
          formula_id?: string | null
          fundeb_fundes?: number
          icms_credito_nf?: number
          icms_credito_prodeic?: number
          icms_recolher?: number
          icms_saida?: number
          id?: string
          ipi_valor?: number
          irpj_csll_valor?: number
          margem_lucro_percentual?: number
          margem_lucro_valor?: number
          margem_seguranca?: number
          markup_bruto?: number
          observacoes?: string | null
          pis_cofins_credito?: number
          pis_cofins_recolher?: number
          pis_cofins_saida?: number
          preco_venda?: number
          subtotal_custos_diretos?: number
          subtotal_custos_indiretos?: number
          total_custos_producao?: number
          total_impostos?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precificacoes_configuracao_custos_id_fkey"
            columns: ["configuracao_custos_id"]
            isOneToOne: false
            referencedRelation: "configuracao_custos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precificacoes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      recompras: {
        Row: {
          consultor_responsavel: string
          created_at: string | null
          data_recompra: string
          id: string
          nome_cliente: string
          observacao: string | null
          produtos: Json
          quantidade_total: number
          updated_at: string | null
          valor_total: number
        }
        Insert: {
          consultor_responsavel: string
          created_at?: string | null
          data_recompra?: string
          id?: string
          nome_cliente: string
          observacao?: string | null
          produtos?: Json
          quantidade_total?: number
          updated_at?: string | null
          valor_total?: number
        }
        Update: {
          consultor_responsavel?: string
          created_at?: string | null
          data_recompra?: string
          id?: string
          nome_cliente?: string
          observacao?: string | null
          produtos?: Json
          quantidade_total?: number
          updated_at?: string | null
          valor_total?: number
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          cargo: string
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_insumo_name: { Args: { input_name: string }; Returns: string }
      normalize_mp_name: { Args: { input_name: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
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
