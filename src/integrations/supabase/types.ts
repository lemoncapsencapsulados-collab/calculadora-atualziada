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
      ad_investment_consultores: {
        Row: {
          ad_investment_id: string
          consultor_id: string | null
          consultor_nome_snapshot: string
          created_at: string
          id: string
          investimento_direcionado: number
          leads_recebidos: number
          updated_at: string
        }
        Insert: {
          ad_investment_id: string
          consultor_id?: string | null
          consultor_nome_snapshot: string
          created_at?: string
          id?: string
          investimento_direcionado?: number
          leads_recebidos?: number
          updated_at?: string
        }
        Update: {
          ad_investment_id?: string
          consultor_id?: string | null
          consultor_nome_snapshot?: string
          created_at?: string
          id?: string
          investimento_direcionado?: number
          leads_recebidos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_investment_consultores_ad_investment_id_fkey"
            columns: ["ad_investment_id"]
            isOneToOne: false
            referencedRelation: "ad_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_investment_consultores_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_investments: {
        Row: {
          canal: string
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          investimento_total: number
          nome_campanha: string
          objetivo_campanha: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          investimento_total: number
          nome_campanha?: string
          objetivo_campanha: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          investimento_total?: number
          nome_campanha?: string
          objetivo_campanha?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          nome: string
          permissoes: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          nome: string
          permissoes?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          nome?: string
          permissoes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      asaas_consultas_salvas: {
        Row: {
          consultor_id: string
          consultor_nome: string
          created_at: string
          faturamento_total: number
          filtro_cliente: string | null
          id: string
          liquido_total: number
          mes: string
          observacao: string | null
          percentual: number
          por_cliente: Json
          quantidade_recebida: number
          updated_at: string
          valor_consultor: number
        }
        Insert: {
          consultor_id: string
          consultor_nome: string
          created_at?: string
          faturamento_total?: number
          filtro_cliente?: string | null
          id?: string
          liquido_total?: number
          mes: string
          observacao?: string | null
          percentual?: number
          por_cliente?: Json
          quantidade_recebida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Update: {
          consultor_id?: string
          consultor_nome?: string
          created_at?: string
          faturamento_total?: number
          filtro_cliente?: string | null
          id?: string
          liquido_total?: number
          mes?: string
          observacao?: string | null
          percentual?: number
          por_cliente?: Json
          quantidade_recebida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Relationships: []
      }
      asaas_eventos_log: {
        Row: {
          asaas_customer_id: string | null
          asaas_installment_id: string | null
          asaas_payment_id: string | null
          cpf_cnpj: string | null
          created_at: string
          event: string | null
          id: string
          mensagem: string | null
          orcamento_id: string | null
          payload: Json | null
          pedido_id: string | null
          resposta: Json | null
          status: string
          valor: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          event?: string | null
          id?: string
          mensagem?: string | null
          orcamento_id?: string | null
          payload?: Json | null
          pedido_id?: string | null
          resposta?: Json | null
          status?: string
          valor?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          event?: string | null
          id?: string
          mensagem?: string | null
          orcamento_id?: string | null
          payload?: Json | null
          pedido_id?: string | null
          resposta?: Json | null
          status?: string
          valor?: number | null
        }
        Relationships: []
      }
      asaas_webhook_pendentes: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          cpf_cnpj: string | null
          created_at: string
          id: string
          motivo: string
          payload: Json
          resolved: boolean
          resolved_orcamento_id: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          motivo: string
          payload: Json
          resolved?: boolean
          resolved_orcamento_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          id?: string
          motivo?: string
          payload?: Json
          resolved?: boolean
          resolved_orcamento_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_pendentes_resolved_orcamento_id_fkey"
            columns: ["resolved_orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      braip_consultas_salvas: {
        Row: {
          comissao_total: number
          consultor_id: string
          consultor_nome: string
          created_at: string
          faturamento_total: number
          filtro_produto_codigo: string | null
          filtro_produto_nome: string | null
          id: string
          mes: string
          observacao: string | null
          percentual: number
          por_produto: Json
          quantidade_vendida: number
          updated_at: string
          valor_consultor: number
        }
        Insert: {
          comissao_total?: number
          consultor_id: string
          consultor_nome: string
          created_at?: string
          faturamento_total?: number
          filtro_produto_codigo?: string | null
          filtro_produto_nome?: string | null
          id?: string
          mes: string
          observacao?: string | null
          percentual?: number
          por_produto?: Json
          quantidade_vendida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Update: {
          comissao_total?: number
          consultor_id?: string
          consultor_nome?: string
          created_at?: string
          faturamento_total?: number
          filtro_produto_codigo?: string | null
          filtro_produto_nome?: string | null
          id?: string
          mes?: string
          observacao?: string | null
          percentual?: number
          por_produto?: Json
          quantidade_vendida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Relationships: []
      }
      clickup_rotulo_config: {
        Row: {
          assignee_ids: Json
          assignee_nomes: Json
          ativo: boolean
          created_at: string
          id: string
          list_id: string
          list_nome: string | null
          prefixo_nome: string
          updated_at: string
        }
        Insert: {
          assignee_ids?: Json
          assignee_nomes?: Json
          ativo?: boolean
          created_at?: string
          id?: string
          list_id: string
          list_nome?: string | null
          prefixo_nome?: string
          updated_at?: string
        }
        Update: {
          assignee_ids?: Json
          assignee_nomes?: Json
          ativo?: boolean
          created_at?: string
          id?: string
          list_id?: string
          list_nome?: string | null
          prefixo_nome?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          marca: string | null
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
          marca?: string | null
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
          marca?: string | null
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
          despesas_admin_lista: Json
          despesas_admin_por_tipo: Json
          despesas_administrativas: number | null
          energia_eletrica: number | null
          energia_por_tipo: Json
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
          overhead_unitario: number
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
          despesas_admin_lista?: Json
          despesas_admin_por_tipo?: Json
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          energia_por_tipo?: Json
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
          overhead_unitario?: number
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
          despesas_admin_lista?: Json
          despesas_admin_por_tipo?: Json
          despesas_administrativas?: number | null
          energia_eletrica?: number | null
          energia_por_tipo?: Json
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
          overhead_unitario?: number
          pis_cofins_credito?: number | null
          pis_cofins_saida?: number | null
          senha_protecao?: string
          taxa_perca?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      contrato_modelos: {
        Row: {
          ambiente: string
          created_at: string
          descricao: string | null
          docx_nome: string | null
          docx_path: string | null
          docx_size_bytes: number | null
          email_envio: string | null
          id: string
          is_padrao: boolean
          nome: string
          nome_envio: string | null
          template_id: string
          updated_at: string
          variaveis: Json | null
        }
        Insert: {
          ambiente?: string
          created_at?: string
          descricao?: string | null
          docx_nome?: string | null
          docx_path?: string | null
          docx_size_bytes?: number | null
          email_envio?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          nome_envio?: string | null
          template_id: string
          updated_at?: string
          variaveis?: Json | null
        }
        Update: {
          ambiente?: string
          created_at?: string
          descricao?: string | null
          docx_nome?: string | null
          docx_path?: string | null
          docx_size_bytes?: number | null
          email_envio?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          nome_envio?: string | null
          template_id?: string
          updated_at?: string
          variaveis?: Json | null
        }
        Relationships: []
      }
      contrato_modelos_docx: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string
          created_at: string
          descricao: string | null
          email_financeiro: string | null
          html_editado: string | null
          id: string
          nome: string
          nome_financeiro: string | null
          updated_at: string
          variaveis_detectadas: Json
          versao: number
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url: string
          created_at?: string
          descricao?: string | null
          email_financeiro?: string | null
          html_editado?: string | null
          id?: string
          nome: string
          nome_financeiro?: string | null
          updated_at?: string
          variaveis_detectadas?: Json
          versao?: number
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string
          created_at?: string
          descricao?: string | null
          email_financeiro?: string | null
          html_editado?: string | null
          id?: string
          nome?: string
          nome_financeiro?: string | null
          updated_at?: string
          variaveis_detectadas?: Json
          versao?: number
        }
        Relationships: []
      }
      contratos_zapsign: {
        Row: {
          ambiente: string
          cliente_id: string | null
          created_at: string
          id: string
          orcamento_id: string | null
          pedido_id: string | null
          signed_at: string | null
          signed_file_path: string | null
          signed_file_url: string | null
          signer_email: string | null
          signer_name: string | null
          signer_phone: string | null
          status: string
          template_id: string | null
          updated_at: string
          webhook_raw: Json | null
          zapsign_open_id: string | null
          zapsign_token: string
        }
        Insert: {
          ambiente?: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          orcamento_id?: string | null
          pedido_id?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signed_file_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          webhook_raw?: Json | null
          zapsign_open_id?: string | null
          zapsign_token: string
        }
        Update: {
          ambiente?: string
          cliente_id?: string | null
          created_at?: string
          id?: string
          orcamento_id?: string | null
          pedido_id?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signed_file_url?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          webhook_raw?: Json | null
          zapsign_open_id?: string | null
          zapsign_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_zapsign_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_zapsign_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_zapsign_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      frete_cotacoes: {
        Row: {
          ativa: boolean
          created_at: string
          created_by: string | null
          id: string
          nome_produto: string | null
          nome_produtor: string | null
          observacoes: string | null
          observacoes_internas: string | null
          orcamento_id: string
          pod_plano: number | null
          pod_preco_editado_manualmente: boolean | null
          pod_preco_por_envio: number | null
          pod_quantidade_envios_estimada: number | null
          quantidade_unidades: number | null
          status: string | null
          tipo: string
          tipo_produto: string | null
          updated_at: string
          valor_frete: number | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome_produto?: string | null
          nome_produtor?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          orcamento_id: string
          pod_plano?: number | null
          pod_preco_editado_manualmente?: boolean | null
          pod_preco_por_envio?: number | null
          pod_quantidade_envios_estimada?: number | null
          quantidade_unidades?: number | null
          status?: string | null
          tipo: string
          tipo_produto?: string | null
          updated_at?: string
          valor_frete?: number | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome_produto?: string | null
          nome_produtor?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          orcamento_id?: string
          pod_plano?: number | null
          pod_preco_editado_manualmente?: boolean | null
          pod_preco_por_envio?: number | null
          pod_quantidade_envios_estimada?: number | null
          quantidade_unidades?: number | null
          status?: string | null
          tipo?: string
          tipo_produto?: string | null
          updated_at?: string
          valor_frete?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "frete_cotacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      frete_pod_precos: {
        Row: {
          ativo: boolean
          created_at: string
          faixa_peso: string | null
          id: string
          plano: number
          preco: number
          taxa_manuseio: number
          tipo_produto: string
          updated_at: string
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          faixa_peso?: string | null
          id?: string
          plano: number
          preco: number
          taxa_manuseio?: number
          tipo_produto: string
          updated_at?: string
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          faixa_peso?: string | null
          id?: string
          plano?: number
          preco?: number
          taxa_manuseio?: number
          tipo_produto?: string
          updated_at?: string
          vigencia_inicio?: string
        }
        Relationships: []
      }
      frete_pod_precos_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          alterado_por_email: string | null
          id: string
          plano: number
          preco_anterior: number | null
          preco_id: string | null
          preco_novo: number
          taxa_manuseio_anterior: number | null
          taxa_manuseio_nova: number | null
          tipo_produto: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_email?: string | null
          id?: string
          plano: number
          preco_anterior?: number | null
          preco_id?: string | null
          preco_novo: number
          taxa_manuseio_anterior?: number | null
          taxa_manuseio_nova?: number | null
          tipo_produto: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_email?: string | null
          id?: string
          plano?: number
          preco_anterior?: number | null
          preco_id?: string | null
          preco_novo?: number
          taxa_manuseio_anterior?: number | null
          taxa_manuseio_nova?: number | null
          tipo_produto?: string
        }
        Relationships: [
          {
            foreignKeyName: "frete_pod_precos_historico_preco_id_fkey"
            columns: ["preco_id"]
            isOneToOne: false
            referencedRelation: "frete_pod_precos"
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
      monetizze_consultas_salvas: {
        Row: {
          comissao_total: number
          consultor_id: string
          consultor_nome: string
          created_at: string
          faturamento_total: number
          filtro_produto_codigo: string | null
          filtro_produto_nome: string | null
          id: string
          mes: string
          observacao: string | null
          percentual: number
          por_produto: Json
          quantidade_vendida: number
          updated_at: string
          valor_consultor: number
        }
        Insert: {
          comissao_total?: number
          consultor_id: string
          consultor_nome: string
          created_at?: string
          faturamento_total?: number
          filtro_produto_codigo?: string | null
          filtro_produto_nome?: string | null
          id?: string
          mes: string
          observacao?: string | null
          percentual?: number
          por_produto?: Json
          quantidade_vendida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Update: {
          comissao_total?: number
          consultor_id?: string
          consultor_nome?: string
          created_at?: string
          faturamento_total?: number
          filtro_produto_codigo?: string | null
          filtro_produto_nome?: string | null
          id?: string
          mes?: string
          observacao?: string | null
          percentual?: number
          por_produto?: Json
          quantidade_vendida?: number
          updated_at?: string
          valor_consultor?: number
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          asaas_installment_id: string | null
          asaas_parcelas_total: number | null
          asaas_payment_id: string | null
          cliente_id: string | null
          condicoes_pagamento: Json | null
          consultor_responsavel: string | null
          contrato_assinado_em: string | null
          contrato_enviado_em: string | null
          created_at: string | null
          dados_cliente: Json | null
          data_envio: string | null
          data_pagamento: string | null
          detalhamento_frete: Json | null
          forma_pagamento: string | null
          historico_contatos: Json
          id: string
          id_receita_vhsys: number | null
          itens_producao: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes: string | null
          observacoes_internas: string | null
          pagamentos_recebidos: Json
          pedido_id_gerado: string | null
          prazo_preco_id: string | null
          preco_anterior_recalculo: number | null
          preco_recalculado_em: string | null
          servicos_marca: Json
          status: string
          status_contrato: string
          subtotal_producao: number
          subtotal_servicos: number
          tipo_orcamento: string
          updated_at: string | null
          validade_dias: number
          valor_total: number
          vhsys_liquidado_em: string | null
          vhsys_valor_pago: number | null
        }
        Insert: {
          asaas_installment_id?: string | null
          asaas_parcelas_total?: number | null
          asaas_payment_id?: string | null
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_envio?: string | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          historico_contatos?: Json
          id?: string
          id_receita_vhsys?: number | null
          itens_producao?: Json
          nome_cliente: string
          numero_orcamento: string
          observacoes?: string | null
          observacoes_internas?: string | null
          pagamentos_recebidos?: Json
          pedido_id_gerado?: string | null
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
          servicos_marca?: Json
          status?: string
          status_contrato?: string
          subtotal_producao?: number
          subtotal_servicos?: number
          tipo_orcamento?: string
          updated_at?: string | null
          validade_dias?: number
          valor_total?: number
          vhsys_liquidado_em?: string | null
          vhsys_valor_pago?: number | null
        }
        Update: {
          asaas_installment_id?: string | null
          asaas_parcelas_total?: number | null
          asaas_payment_id?: string | null
          cliente_id?: string | null
          condicoes_pagamento?: Json | null
          consultor_responsavel?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          data_envio?: string | null
          data_pagamento?: string | null
          detalhamento_frete?: Json | null
          forma_pagamento?: string | null
          historico_contatos?: Json
          id?: string
          id_receita_vhsys?: number | null
          itens_producao?: Json
          nome_cliente?: string
          numero_orcamento?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          pagamentos_recebidos?: Json
          pedido_id_gerado?: string | null
          prazo_preco_id?: string | null
          preco_anterior_recalculo?: number | null
          preco_recalculado_em?: string | null
          servicos_marca?: Json
          status?: string
          status_contrato?: string
          subtotal_producao?: number
          subtotal_servicos?: number
          tipo_orcamento?: string
          updated_at?: string | null
          validade_dias?: number
          valor_total?: number
          vhsys_liquidado_em?: string | null
          vhsys_valor_pago?: number | null
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
      setup_planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao_curta: string | null
          entregaveis_md: string
          id: string
          nome: string
          ordem: number
          perfil: Database["public"]["Enums"]["setup_plano_perfil"]
          preco_fixo: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          entregaveis_md?: string
          id?: string
          nome: string
          ordem?: number
          perfil: Database["public"]["Enums"]["setup_plano_perfil"]
          preco_fixo?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          entregaveis_md?: string
          id?: string
          nome?: string
          ordem?: number
          perfil?: Database["public"]["Enums"]["setup_plano_perfil"]
          preco_fixo?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      vhsys_eventos_log: {
        Row: {
          created_at: string
          id: string
          id_receita_vhsys: number | null
          mensagem: string | null
          orcamento_id: string | null
          origem: string
          payload: Json | null
          pedido_id: string | null
          resposta_vhsys: Json | null
          status: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_receita_vhsys?: number | null
          mensagem?: string | null
          orcamento_id?: string | null
          origem: string
          payload?: Json | null
          pedido_id?: string | null
          resposta_vhsys?: Json | null
          status: string
          tipo_evento: string
        }
        Update: {
          created_at?: string
          id?: string
          id_receita_vhsys?: number | null
          mensagem?: string | null
          orcamento_id?: string | null
          origem?: string
          payload?: Json | null
          pedido_id?: string | null
          resposta_vhsys?: Json | null
          status?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "vhsys_eventos_log_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vhsys_eventos_log_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          id: string
          nome: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          evento: string
          http_status: number | null
          id: string
          payload: Json
          response_body: string | null
          status: string
          tentativas: number
          webhook_config_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          evento: string
          http_status?: number | null
          id?: string
          payload: Json
          response_body?: string | null
          status?: string
          tentativas?: number
          webhook_config_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          evento?: string
          http_status?: number | null
          id?: string
          payload?: Json
          response_body?: string | null
          status?: string
          tentativas?: number
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_insumo_name: { Args: { input_name: string }; Returns: string }
      normalize_mp_name: { Args: { input_name: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      setup_plano_perfil: "novo_produtor" | "produtor_experiente"
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
      setup_plano_perfil: ["novo_produtor", "produtor_experiente"],
    },
  },
} as const
