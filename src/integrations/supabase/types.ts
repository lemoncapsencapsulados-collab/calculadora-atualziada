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
      clientes: {
        Row: {
          cep: string | null
          cep_cnpj: string | null
          cidade: string | null
          cidade_cnpj: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          dados_extras: Json | null
          email: string | null
          email_cnpj: string | null
          endereco: string | null
          endereco_cnpj: string | null
          estado: string | null
          estado_civil: string | null
          estado_cnpj: string | null
          forma_venda: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome: string
          pessoas_fisicas: Json | null
          razao_social: string | null
          responsavel_pj: Json | null
          rg: string | null
          telefone: string
          telefone_cnpj: string | null
          tipo_pessoa: string
          updated_at: string | null
        }
        Insert: {
          cep?: string | null
          cep_cnpj?: string | null
          cidade?: string | null
          cidade_cnpj?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          email?: string | null
          email_cnpj?: string | null
          endereco?: string | null
          endereco_cnpj?: string | null
          estado?: string | null
          estado_civil?: string | null
          estado_cnpj?: string | null
          forma_venda?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome: string
          pessoas_fisicas?: Json | null
          razao_social?: string | null
          responsavel_pj?: Json | null
          rg?: string | null
          telefone: string
          telefone_cnpj?: string | null
          tipo_pessoa?: string
          updated_at?: string | null
        }
        Update: {
          cep?: string | null
          cep_cnpj?: string | null
          cidade?: string | null
          cidade_cnpj?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          email?: string | null
          email_cnpj?: string | null
          endereco?: string | null
          endereco_cnpj?: string | null
          estado?: string | null
          estado_civil?: string | null
          estado_cnpj?: string | null
          forma_venda?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome?: string
          pessoas_fisicas?: Json | null
          razao_social?: string | null
          responsavel_pj?: Json | null
          rg?: string | null
          telefone?: string
          telefone_cnpj?: string | null
          tipo_pessoa?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracao_custos: {
        Row: {
          ativa: boolean | null
          capacidade_encapsulados: number
          capacidade_gummy: number
          capacidade_liquido: number
          capacidade_soluvel: number
          created_at: string | null
          credito_prodeic: number | null
          depreciacao_maquinas: number | null
          despesas_admin_por_tipo: Json
          despesas_administrativas: number | null
          energia_eletrica: number | null
          folha_administrativa: number
          folha_producao: number
          fundeb_fundes: number | null
          icms_credito_nf: number | null
          icms_saida: number | null
          id: string
          ipi_saida: number | null
          irpj_csll: number | null
          mao_obra_direta: number | null
          mao_obra_direta_por_tipo: Json
          nome: string
          pis_cofins_credito: number | null
          pis_cofins_saida: number | null
          senha_protecao: string
          taxa_perca: number
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          capacidade_encapsulados?: number
          capacidade_gummy?: number
          capacidade_liquido?: number
          capacidade_soluvel?: number
          created_at?: string | null
          credito_prodeic?: number | null
          depreciacao_maquinas?: number | null
          despesas_admin_por_tipo?: Json
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          folha_administrativa?: number
          folha_producao?: number
          fundeb_fundes?: number | null
          icms_credito_nf?: number | null
          icms_saida?: number | null
          id?: string
          ipi_saida?: number | null
          irpj_csll?: number | null
          mao_obra_direta?: number | null
          mao_obra_direta_por_tipo?: Json
          nome: string
          pis_cofins_credito?: number | null
          pis_cofins_saida?: number | null
          senha_protecao?: string
          taxa_perca?: number
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          capacidade_encapsulados?: number
          capacidade_gummy?: number
          capacidade_liquido?: number
          capacidade_soluvel?: number
          created_at?: string | null
          credito_prodeic?: number | null
          depreciacao_maquinas?: number | null
          despesas_admin_por_tipo?: Json
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          folha_administrativa?: number
          folha_producao?: number
          fundeb_fundes?: number | null
          icms_credito_nf?: number | null
          icms_saida?: number | null
          id?: string
          ipi_saida?: number | null
          irpj_csll?: number | null
          mao_obra_direta?: number | null
          mao_obra_direta_por_tipo?: Json
          nome?: string
          pis_cofins_credito?: number | null
          pis_cofins_saida?: number | null
          senha_protecao?: string
          taxa_perca?: number
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
          cliente_id: string | null
          created_at: string | null
          custo_total: number
          embalagens: Json
          id: string
          itens: Json
          nome_formula: string
          prazo_preco_id: string | null
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
          cliente_id?: string | null
          created_at?: string | null
          custo_total: number
          embalagens: Json
          id?: string
          itens: Json
          nome_formula: string
          prazo_preco_id?: string | null
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
          cliente_id?: string | null
          created_at?: string | null
          custo_total?: number
          embalagens?: Json
          id?: string
          itens?: Json
          nome_formula?: string
          prazo_preco_id?: string | null
          quantidade_por_pote?: number
          tipo_produto?: string
          total_embalagem?: number
          total_mp?: number
          unidade_soluvel?: string | null
          unidades_por_dose?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_configuracao_custos: {
        Row: {
          configuracao_id: string | null
          created_at: string
          id: string
          snapshot: Json
          snapshot_anterior: Json
          usuario_email: string | null
        }
        Insert: {
          configuracao_id?: string | null
          created_at?: string
          id?: string
          snapshot?: Json
          snapshot_anterior?: Json
          usuario_email?: string | null
        }
        Update: {
          configuracao_id?: string | null
          created_at?: string
          id?: string
          snapshot?: Json
          snapshot_anterior?: Json
          usuario_email?: string | null
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
          cliente_id: string | null
          condicoes_pagamento: Json | null
          consultor_responsavel: string | null
          created_at: string | null
          dados_cliente: Json | null
          data_envio: string | null
          data_pagamento: string | null
          detalhamento_frete: Json | null
          forma_pagamento: string | null
          historico_contatos: Json
          id: string
          itens_producao: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes: string | null
          observacoes_internas: string | null
          prazo_preco_id: string | null
          preco_anterior_recalculo: number | null
          preco_recalculado_em: string | null
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
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_envio?: string | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          historico_contatos?: Json
          id?: string
          itens_producao?: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes?: string | null
          observacoes_internas?: string | null
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
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
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_envio?: string | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          historico_contatos?: Json
          id?: string
          itens_producao?: Json
          nome_cliente?: string
          numero_orcamento?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
          servicos_marca?: Json
          status?: string
          subtotal_producao?: number
          subtotal_servicos?: number
          tipo_orcamento?: string
          updated_at?: string | null
          validade_dias?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_anexos: {
        Row: {
          arquivo_nome: string
          arquivo_url: string
          created_at: string | null
          id: string
          ordem: number | null
          pedido_id: string
          tipo: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_url: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          pedido_id: string
          tipo: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_url?: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          pedido_id?: string
          tipo?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          acompanhamento_processos: Json | null
          created_at: string | null
          data_entrega: string
          data_pedido: string
          formula_id: string | null
          formula_snapshot: Json | null
          historico_vhsys: Json
          id: string
          numero_pedido: string
          observacoes: string | null
          orcamento_id: string | null
          orcamento_snapshot: Json | null
          pagamento_alteracoes: Json
          quantidade_produto: number
          status: string
          unidade_produto: string
          updated_at: string | null
        }
        Insert: {
          acompanhamento_processos?: Json | null
          created_at?: string | null
          data_entrega: string
          data_pedido: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          historico_vhsys?: Json
          id?: string
          numero_pedido: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          pagamento_alteracoes?: Json
          quantidade_produto: number
          status?: string
          unidade_produto: string
          updated_at?: string | null
        }
        Update: {
          acompanhamento_processos?: Json | null
          created_at?: string | null
          data_entrega?: string
          data_pedido?: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          historico_vhsys?: Json
          id?: string
          numero_pedido?: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          pagamento_alteracoes?: Json
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
      prazo_precos: {
        Row: {
          aplicado: boolean
          aplicado_em: string | null
          configuracao_id: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          historico_id: string | null
          id: string
          orcamentos_recalculados: number
          precificacoes_recalculadas: number
          snapshot: Json
        }
        Insert: {
          aplicado?: boolean
          aplicado_em?: string | null
          configuracao_id?: string | null
          created_at?: string
          data_fim: string
          data_inicio?: string
          historico_id?: string | null
          id?: string
          orcamentos_recalculados?: number
          precificacoes_recalculadas?: number
          snapshot?: Json
        }
        Update: {
          aplicado?: boolean
          aplicado_em?: string | null
          configuracao_id?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          historico_id?: string | null
          id?: string
          orcamentos_recalculados?: number
          precificacoes_recalculadas?: number
          snapshot?: Json
        }
        Relationships: []
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
          prazo_preco_id: string | null
          preco_anterior_recalculo: number | null
          preco_recalculado_em: string | null
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
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
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
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
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
      resumos_contrato: {
        Row: {
          cliente_id: string | null
          condicoes_pagamento: Json | null
          created_at: string
          dados_cliente: Json
          detalhamento_frete: Json
          detalhes_producao: Json
          id: string
          nome_cliente: string
          numero_orcamento: string
          orcamento_id: string
          pdf_path: string
          pdf_size_bytes: number | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          created_at?: string
          dados_cliente?: Json
          detalhamento_frete?: Json
          detalhes_producao?: Json
          id?: string
          nome_cliente: string
          numero_orcamento: string
          orcamento_id: string
          pdf_path: string
          pdf_size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          created_at?: string
          dados_cliente?: Json
          detalhamento_frete?: Json
          detalhes_producao?: Json
          id?: string
          nome_cliente?: string
          numero_orcamento?: string
          orcamento_id?: string
          pdf_path?: string
          pdf_size_bytes?: number | null
          updated_at?: string
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
