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
      clickup_demandas_config: {
        Row: {
          assignee_ids: Json
          assignee_nomes: Json
          ativo: boolean
          created_at: string
          id: string
          list_id: string | null
          list_nome: string | null
          prefixo_nome: string | null
          status_inicial: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assignee_ids?: Json
          assignee_nomes?: Json
          ativo?: boolean
          created_at?: string
          id?: string
          list_id?: string | null
          list_nome?: string | null
          prefixo_nome?: string | null
          status_inicial?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          assignee_ids?: Json
          assignee_nomes?: Json
          ativo?: boolean
          created_at?: string
          id?: string
          list_id?: string | null
          list_nome?: string | null
          prefixo_nome?: string | null
          status_inicial?: string | null
          tipo?: string
          updated_at?: string
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
          numero_contrato: string | null
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
          numero_contrato?: string | null
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
          numero_contrato?: string | null
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
      contrato_publicidade_eventos: {
        Row: {
          contrato_id: string | null
          created_at: string
          id: string
          mensagem: string | null
          pedido_id: string
          status: string
          usuario_email: string | null
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string | null
          pedido_id: string
          status: string
          usuario_email?: string | null
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          id?: string
          mensagem?: string | null
          pedido_id?: string
          status?: string
          usuario_email?: string | null
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
      demandas_marca: {
        Row: {
          arquivos: Json
          clickup_enviado_em: string | null
          clickup_task_id: string | null
          clickup_task_url: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          dados: Json
          id: string
          pedido_id: string
          status: string
          tipo: string
          updated_at: string
          vendedor_nome: string
        }
        Insert: {
          arquivos?: Json
          clickup_enviado_em?: string | null
          clickup_task_id?: string | null
          clickup_task_url?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          dados?: Json
          id?: string
          pedido_id: string
          status?: string
          tipo: string
          updated_at?: string
          vendedor_nome: string
        }
        Update: {
          arquivos?: Json
          clickup_enviado_em?: string | null
          clickup_task_id?: string | null
          clickup_task_url?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          dados?: Json
          id?: string
          pedido_id?: string
          status?: string
          tipo?: string
          updated_at?: string
          vendedor_nome?: string
        }
        Relationships: []
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
          nicho: string | null
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
          nicho?: string | null
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
          nicho?: string | null
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
          imposto_percentual: number
          margem_override: boolean
          margem_percentual: number | null
          nome_produto: string | null
          nome_produtor: string | null
          observacoes: string | null
          observacoes_internas: string | null
          orcamento_id: string
          pod_plano: number | null
          pod_planos_selecionados: Json
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
          imposto_percentual?: number
          margem_override?: boolean
          margem_percentual?: number | null
          nome_produto?: string | null
          nome_produtor?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          orcamento_id: string
          pod_plano?: number | null
          pod_planos_selecionados?: Json
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
          imposto_percentual?: number
          margem_override?: boolean
          margem_percentual?: number | null
          nome_produto?: string | null
          nome_produtor?: string | null
          observacoes?: string | null
          observacoes_internas?: string | null
          orcamento_id?: string
          pod_plano?: number | null
          pod_planos_selecionados?: Json
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
      frete_margem_faixas: {
        Row: {
          ativo: boolean
          created_at: string
          envios_max: number | null
          envios_min: number
          id: string
          margem_percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          envios_max?: number | null
          envios_min: number
          id?: string
          margem_percentual: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          envios_max?: number | null
          envios_min?: number
          id?: string
          margem_percentual?: number
          updated_at?: string
        }
        Relationships: []
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
      insight_resolucoes: {
        Row: {
          cliente: string | null
          consultor: string | null
          created_at: string
          id: string
          numero_orcamento: string | null
          observacao: string
          orcamento_id: string
          resolvido_por: string | null
          resolvido_por_email: string | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          consultor?: string | null
          created_at?: string
          id?: string
          numero_orcamento?: string | null
          observacao: string
          orcamento_id: string
          resolvido_por?: string | null
          resolvido_por_email?: string | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          consultor?: string | null
          created_at?: string
          id?: string
          numero_orcamento?: string | null
          observacao?: string
          orcamento_id?: string
          resolvido_por?: string | null
          resolvido_por_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      intermediadores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          updated_at?: string
          whatsapp?: string
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
      meta_ad_accounts: {
        Row: {
          access_token: string | null
          ad_account_id: string
          ativo: boolean
          coletar_nivel_ad: boolean
          created_at: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          nome: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          ad_account_id: string
          ativo?: boolean
          coletar_nivel_ad?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          nome?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          ad_account_id?: string
          ativo?: boolean
          coletar_nivel_ad?: boolean
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          nome?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_criativos: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_name: string | null
          corpo: string | null
          created_at: string
          cta: string | null
          descricao: string | null
          hash_conteudo: string
          id: string
          image_url: string | null
          object_story_spec: Json | null
          titulo: string | null
          url_destino: string | null
          video_id: string | null
          vigente_ate: string | null
          vigente_desde: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_name?: string | null
          corpo?: string | null
          created_at?: string
          cta?: string | null
          descricao?: string | null
          hash_conteudo: string
          id?: string
          image_url?: string | null
          object_story_spec?: Json | null
          titulo?: string | null
          url_destino?: string | null
          video_id?: string | null
          vigente_ate?: string | null
          vigente_desde: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_name?: string | null
          corpo?: string | null
          created_at?: string
          cta?: string | null
          descricao?: string | null
          hash_conteudo?: string
          id?: string
          image_url?: string | null
          object_story_spec?: Json | null
          titulo?: string | null
          url_destino?: string | null
          video_id?: string | null
          vigente_ate?: string | null
          vigente_desde?: string
        }
        Relationships: []
      }
      meta_insights: {
        Row: {
          ad_account_id: string
          campaign_id: string
          campaign_name: string | null
          clicks: number
          consultor_nome: string | null
          created_at: string
          data: string
          id: string
          impressions: number
          leads: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          campaign_id: string
          campaign_name?: string | null
          clicks?: number
          consultor_nome?: string | null
          created_at?: string
          data: string
          id?: string
          impressions?: number
          leads?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          consultor_nome?: string | null
          created_at?: string
          data?: string
          id?: string
          impressions?: number
          leads?: number
          spend?: number
          updated_at?: string
        }
        Relationships: []
      }
      meta_insights_ad: {
        Row: {
          action_values: Json | null
          actions: Json | null
          ad_account_id: string
          ad_id: string
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          conversas_iniciadas: number
          cost_per_action_type: Json | null
          created_at: string
          data: string
          engajamento: number
          frequency: number
          id: string
          impressions: number
          landing_page_views: number
          leads: number
          leads_formulario: number
          link_clicks: number
          reach: number
          spend: number
          updated_at: string
          video_views: number
        }
        Insert: {
          action_values?: Json | null
          actions?: Json | null
          ad_account_id: string
          ad_id: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          conversas_iniciadas?: number
          cost_per_action_type?: Json | null
          created_at?: string
          data: string
          engajamento?: number
          frequency?: number
          id?: string
          impressions?: number
          landing_page_views?: number
          leads?: number
          leads_formulario?: number
          link_clicks?: number
          reach?: number
          spend?: number
          updated_at?: string
          video_views?: number
        }
        Update: {
          action_values?: Json | null
          actions?: Json | null
          ad_account_id?: string
          ad_id?: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          conversas_iniciadas?: number
          cost_per_action_type?: Json | null
          created_at?: string
          data?: string
          engajamento?: number
          frequency?: number
          id?: string
          impressions?: number
          landing_page_views?: number
          leads?: number
          leads_formulario?: number
          link_clicks?: number
          reach?: number
          spend?: number
          updated_at?: string
          video_views?: number
        }
        Relationships: []
      }
      meta_insights_ad_recorte: {
        Row: {
          actions: Json | null
          ad_account_id: string
          ad_id: string
          chave_1: string
          chave_2: string
          clicks: number
          created_at: string
          data: string
          id: string
          impressions: number
          recorte: string
          spend: number
        }
        Insert: {
          actions?: Json | null
          ad_account_id: string
          ad_id: string
          chave_1?: string
          chave_2?: string
          clicks?: number
          created_at?: string
          data: string
          id?: string
          impressions?: number
          recorte: string
          spend?: number
        }
        Update: {
          actions?: Json | null
          ad_account_id?: string
          ad_id?: string
          chave_1?: string
          chave_2?: string
          clicks?: number
          created_at?: string
          data?: string
          id?: string
          impressions?: number
          recorte?: string
          spend?: number
        }
        Relationships: []
      }
      meta_sync_jobs: {
        Row: {
          ad_account_id: string
          atualizado_em: string
          cursor_paginacao: string | null
          id: string
          janela_fim: string
          janela_inicio: string
          linhas_gravadas: number
          passe: string
          status: string
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          ad_account_id: string
          atualizado_em?: string
          cursor_paginacao?: string | null
          id?: string
          janela_fim: string
          janela_inicio: string
          linhas_gravadas?: number
          passe: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          ad_account_id?: string
          atualizado_em?: string
          cursor_paginacao?: string | null
          id?: string
          janela_fim?: string
          janela_inicio?: string
          linhas_gravadas?: number
          passe?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
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
          intermediador: Json | null
          itens_producao: Json
          modelo_aquisicao: string | null
          nome_cliente: string
          numero_contrato: string | null
          numero_orcamento: string
          observacoes: string | null
          observacoes_internas: string | null
          pagamentos_recebidos: Json
          pedido_compra_dados: Json | null
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
          intermediador?: Json | null
          itens_producao?: Json
          modelo_aquisicao?: string | null
          nome_cliente: string
          numero_contrato?: string | null
          numero_orcamento: string
          observacoes?: string | null
          observacoes_internas?: string | null
          pagamentos_recebidos?: Json
          pedido_compra_dados?: Json | null
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
          intermediador?: Json | null
          itens_producao?: Json
          modelo_aquisicao?: string | null
          nome_cliente?: string
          numero_contrato?: string | null
          numero_orcamento?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          pagamentos_recebidos?: Json
          pedido_compra_dados?: Json | null
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
          cnpj_contratante: string | null
          created_at: string | null
          data_entrega: string
          data_pedido: string
          formula_id: string | null
          formula_snapshot: Json | null
          historico_vhsys: Json
          id: string
          numero_contrato: string | null
          numero_pedido: string
          observacoes: string | null
          orcamento_id: string | null
          orcamento_snapshot: Json | null
          pagamento_alteracoes: Json
          pedido_compra_dados: Json | null
          quantidade_produto: number
          status: string
          status_aprovacao: string | null
          unidade_produto: string
          updated_at: string | null
        }
        Insert: {
          acompanhamento_processos?: Json | null
          cnpj_contratante?: string | null
          created_at?: string | null
          data_entrega: string
          data_pedido: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          historico_vhsys?: Json
          id?: string
          numero_contrato?: string | null
          numero_pedido: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          pagamento_alteracoes?: Json
          pedido_compra_dados?: Json | null
          quantidade_produto: number
          status?: string
          status_aprovacao?: string | null
          unidade_produto: string
          updated_at?: string | null
        }
        Update: {
          acompanhamento_processos?: Json | null
          cnpj_contratante?: string | null
          created_at?: string | null
          data_entrega?: string
          data_pedido?: string
          formula_id?: string | null
          formula_snapshot?: Json | null
          historico_vhsys?: Json
          id?: string
          numero_contrato?: string | null
          numero_pedido?: string
          observacoes?: string | null
          orcamento_id?: string | null
          orcamento_snapshot?: Json | null
          pagamento_alteracoes?: Json
          pedido_compra_dados?: Json | null
          quantidade_produto?: number
          status?: string
          status_aprovacao?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      zap_apresentacoes: {
        Row: {
          base_conversas: number
          cobertura_analise_pct: number | null
          cobertura_transcricao_pct: number | null
          consultor_nome: string
          custo_analise_usd: number | null
          gerado_em: string
          gerado_por: string | null
          id: string
          payload_json: Json
          periodo_fim: string
          periodo_inicio: string
          score_geral: number | null
          status: string
          usuario_id: string
          validacao_orfaos: string[]
          versao: number
          versao_prompt: number
        }
        Insert: {
          base_conversas?: number
          cobertura_analise_pct?: number | null
          cobertura_transcricao_pct?: number | null
          consultor_nome: string
          custo_analise_usd?: number | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          payload_json: Json
          periodo_fim: string
          periodo_inicio: string
          score_geral?: number | null
          status?: string
          usuario_id: string
          validacao_orfaos?: string[]
          versao: number
          versao_prompt?: number
        }
        Update: {
          base_conversas?: number
          cobertura_analise_pct?: number | null
          cobertura_transcricao_pct?: number | null
          consultor_nome?: string
          custo_analise_usd?: number | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          payload_json?: Json
          periodo_fim?: string
          periodo_inicio?: string
          score_geral?: number | null
          status?: string
          usuario_id?: string
          validacao_orfaos?: string[]
          versao?: number
          versao_prompt?: number
        }
        Relationships: [
          {
            foreignKeyName: "zap_apresentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_backfill_jobs: {
        Row: {
          atualizado_em: string
          id: string
          instance_name: string
          mensagens_importadas: number
          remote_jid: string
          status: string
          tentativas: number
          ultima_pagina: number
          ultimo_erro: string | null
        }
        Insert: {
          atualizado_em?: string
          id?: string
          instance_name: string
          mensagens_importadas?: number
          remote_jid: string
          status?: string
          tentativas?: number
          ultima_pagina?: number
          ultimo_erro?: string | null
        }
        Update: {
          atualizado_em?: string
          id?: string
          instance_name?: string
          mensagens_importadas?: number
          remote_jid?: string
          status?: string
          tentativas?: number
          ultima_pagina?: number
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      zap_consultor_parecer: {
        Row: {
          comparativo_time: string | null
          created_at: string
          eficiencia: string | null
          id: string
          metricas: Json | null
          periodo_fim: string
          periodo_inicio: string
          plano_acao: string | null
          plano_acao_itens: Json | null
          pontos_impacto: Json | null
          processo: string | null
          relacionamento: string | null
          usuario_id: string
          versao_prompt: number
        }
        Insert: {
          comparativo_time?: string | null
          created_at?: string
          eficiencia?: string | null
          id?: string
          metricas?: Json | null
          periodo_fim: string
          periodo_inicio: string
          plano_acao?: string | null
          plano_acao_itens?: Json | null
          pontos_impacto?: Json | null
          processo?: string | null
          relacionamento?: string | null
          usuario_id: string
          versao_prompt: number
        }
        Update: {
          comparativo_time?: string | null
          created_at?: string
          eficiencia?: string | null
          id?: string
          metricas?: Json | null
          periodo_fim?: string
          periodo_inicio?: string
          plano_acao?: string | null
          plano_acao_itens?: Json | null
          pontos_impacto?: Json | null
          processo?: string | null
          relacionamento?: string | null
          usuario_id?: string
          versao_prompt?: number
        }
        Relationships: [
          {
            foreignKeyName: "zap_consultor_parecer_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_contato_etiquetas: {
        Row: {
          atualizado_em: string
          id: string
          instance_name: string
          label_id: string
          nome: string | null
          remote_jid: string
        }
        Insert: {
          atualizado_em?: string
          id?: string
          instance_name: string
          label_id: string
          nome?: string | null
          remote_jid: string
        }
        Update: {
          atualizado_em?: string
          id?: string
          instance_name?: string
          label_id?: string
          nome?: string | null
          remote_jid?: string
        }
        Relationships: []
      }
      zap_contatos: {
        Row: {
          classificacao: string
          classificado_por: string | null
          created_at: string
          id: string
          instance_name: string
          nome: string | null
          primeira_mensagem_at: string | null
          remote_jid: string
          telefone: string | null
          total_mensagens: number
          ultima_mensagem_at: string | null
          updated_at: string
        }
        Insert: {
          classificacao?: string
          classificado_por?: string | null
          created_at?: string
          id?: string
          instance_name: string
          nome?: string | null
          primeira_mensagem_at?: string | null
          remote_jid: string
          telefone?: string | null
          total_mensagens?: number
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Update: {
          classificacao?: string
          classificado_por?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          nome?: string | null
          primeira_mensagem_at?: string | null
          remote_jid?: string
          telefone?: string | null
          total_mensagens?: number
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      zap_conversa_analise: {
        Row: {
          analisado_ate: string
          created_at: string
          etapa_funil: string | null
          id: string
          instance_name: string
          objecoes: string[]
          objecoes_superadas: string[]
          remote_jid: string
          resumo: string | null
          sentimento: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
          versao_prompt: number
        }
        Insert: {
          analisado_ate: string
          created_at?: string
          etapa_funil?: string | null
          id?: string
          instance_name: string
          objecoes?: string[]
          objecoes_superadas?: string[]
          remote_jid: string
          resumo?: string | null
          sentimento?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          versao_prompt: number
        }
        Update: {
          analisado_ate?: string
          created_at?: string
          etapa_funil?: string | null
          id?: string
          instance_name?: string
          objecoes?: string[]
          objecoes_superadas?: string[]
          remote_jid?: string
          resumo?: string | null
          sentimento?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          versao_prompt?: number
        }
        Relationships: []
      }
      zap_etiquetas: {
        Row: {
          atualizado_em: string
          cor: string | null
          id: string
          instance_name: string
          label_id: string
          nome: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          id?: string
          instance_name: string
          label_id: string
          nome: string
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          id?: string
          instance_name?: string
          label_id?: string
          nome?: string
        }
        Relationships: []
      }
      zap_instancias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          instance_name: string
          numero: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          instance_name: string
          numero?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          instance_name?: string
          numero?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zap_instancias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_mensagens: {
        Row: {
          created_at: string
          dominios_links: string[]
          duracao_segundos: number | null
          from_me: boolean
          id: string
          instance_name: string
          momento: string
          remote_jid: string
          texto: string | null
          tipo: string
          transcricao_status: string | null
          transcrito_em: string | null
        }
        Insert: {
          created_at?: string
          dominios_links?: string[]
          duracao_segundos?: number | null
          from_me: boolean
          id: string
          instance_name: string
          momento: string
          remote_jid: string
          texto?: string | null
          tipo: string
          transcricao_status?: string | null
          transcrito_em?: string | null
        }
        Update: {
          created_at?: string
          dominios_links?: string[]
          duracao_segundos?: number | null
          from_me?: boolean
          id?: string
          instance_name?: string
          momento?: string
          remote_jid?: string
          texto?: string | null
          tipo?: string
          transcricao_status?: string | null
          transcrito_em?: string | null
        }
        Relationships: []
      }
      zap_turnos_cache: {
        Row: {
          fim: string
          from_me: boolean
          inicio: string
          instance_name: string
          mensagens: number
          remote_jid: string
          turno: number
        }
        Insert: {
          fim: string
          from_me: boolean
          inicio: string
          instance_name: string
          mensagens: number
          remote_jid: string
          turno: number
        }
        Update: {
          fim?: string
          from_me?: boolean
          inicio?: string
          instance_name?: string
          mensagens?: number
          remote_jid?: string
          turno?: number
        }
        Relationships: []
      }
    }
    Views: {
      zap_respostas: {
        Row: {
          e_primeira_resposta: boolean | null
          hora_chegada: number | null
          instance_name: string | null
          remote_jid: string | null
          respondeu_consultor: boolean | null
          respondido_em: string | null
          segundos: number | null
          segundos_desde_inicio: number | null
          turno: number | null
        }
        Relationships: []
      }
      zap_turnos: {
        Row: {
          fim: string | null
          from_me: boolean | null
          inicio: string | null
          instance_name: string | null
          mensagens: number | null
          remote_jid: string | null
          turno: number | null
        }
        Relationships: []
      }
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
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
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
      trafego_agendar: { Args: { p_chave: string }; Returns: string }
      trafego_criativos: {
        Args: { p_conta?: string; p_fim: string; p_inicio: string }
        Returns: {
          ad_id: string
          ad_name: string
          campaign_name: string
          cliques: number
          corpo: string
          cpl: number
          cta: string
          ctr: number
          dias_no_periodo: number
          image_url: string
          impressoes: number
          investimento: number
          leads: number
          no_ar: boolean
          titulo: string
          url_destino: string
          vigente_ate: string
          vigente_desde: string
        }[]
      }
      trafego_eventos: {
        Args: { p_conta?: string; p_fim: string; p_inicio: string }
        Returns: {
          anuncios: number
          custo_por_evento: number
          evento: string
          total: number
        }[]
      }
      trafego_expurgar: { Args: never; Returns: string }
      trafego_hierarquia: {
        Args: {
          p_conta?: string
          p_fim: string
          p_inicio: string
          p_nivel?: string
          p_pai?: string
        }
        Returns: {
          cliques: number
          cliques_link: number
          conversas: number
          cpc: number
          cpl: number
          cpm: number
          ctr: number
          ctr_link: number
          custo_por_conversa: number
          frequencia_media: number
          id: string
          impressoes: number
          investimento: number
          leads: number
          leads_formulario: number
          nome: string
          pai_id: string
          visitas_landing: number
        }[]
      }
      trafego_recorte: {
        Args: {
          p_conta?: string
          p_fim: string
          p_inicio: string
          p_recorte: string
        }
        Returns: {
          chave_1: string
          chave_2: string
          cliques: number
          ctr: number
          impressoes: number
          investimento: number
          participacao: number
        }[]
      }
      trafego_serie_diaria: {
        Args: { p_conta?: string; p_fim: string; p_inicio: string }
        Returns: {
          cliques_link: number
          conversas: number
          cpl: number
          ctr_link: number
          data: string
          impressoes: number
          investimento: number
          leads: number
          leads_formulario: number
        }[]
      }
      trafego_status: {
        Args: { p_conta?: string }
        Returns: {
          ad_account_id: string
          dia_mais_recente: string
          jobs_em_erro: number
          jobs_pendentes: number
          ultima_coleta: string
        }[]
      }
      trafego_visao_geral: {
        Args: { p_conta?: string; p_fim: string; p_inicio: string }
        Returns: {
          anuncios: number
          campanhas: number
          cliques: number
          cliques_link: number
          conversas: number
          cpc: number
          cpl: number
          cpm: number
          ctr: number
          ctr_link: number
          custo_por_conversa: number
          custo_por_visita: number
          engajamento: number
          fim: string
          impressoes: number
          inicio: string
          investimento: number
          leads: number
          leads_formulario: number
          periodo: string
          taxa_chegada_landing: number
          video_views: number
          visitas_landing: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      zap_agendar: { Args: { p_chave: string }; Returns: string }
      zap_analise_consultor: {
        Args: { p_fim: string; p_inicio: string; p_versao?: number }
        Returns: {
          conversas: number
          etapa_funil: string
          sentimento: string
          usuario_id: string
        }[]
      }
      zap_base_por_etiqueta: {
        Args: { p_instance?: string }
        Returns: {
          analisados: number
          atendidos: number
          com_conversa: number
          com_telefone: number
          contatos: number
          cor: string
          etapa_ia_mais_comum: string
          etiqueta: string
          label_id: string
          sem_atendimento: number
          sem_conversa: number
          ultima_atividade: string
        }[]
      }
      zap_categoria_objecao: { Args: { p_texto: string }; Returns: string }
      zap_classificar_automatico: {
        Args: never
        Returns: {
          ja_manuais: number
          marcados: number
        }[]
      }
      zap_contatos_por_etiqueta: {
        Args: { p_instance?: string; p_label_id: string }
        Returns: {
          atendido: boolean
          etapa_ia: string
          instance_name: string
          nome: string
          remote_jid: string
          sentimento: string
          telefone: string
          tem_conversa: boolean
          total_mensagens: number
          ultima_mensagem_at: string
        }[]
      }
      zap_conversas_exemplares: {
        Args: {
          p_fim: string
          p_inicio: string
          p_por_categoria?: number
          p_usuario_id: string
        }
        Returns: {
          categoria: string
          dias_parado: number
          etapa_funil: string
          etiquetas: string[]
          identificacao: string
          instance_name: string
          metrica_rotulo: string
          metrica_valor: string
          nome: string
          objecoes: string[]
          objecoes_superadas: string[]
          remote_jid: string
          resumo: string
          sentimento: string
          tem_nome_real: boolean
          ultima_mensagem_at: string
        }[]
      }
      zap_conversas_para_analisar: {
        Args: {
          p_fim: string
          p_inicio: string
          p_limite?: number
          p_usuario_id?: string
          p_versao?: number
        }
        Returns: {
          instance_name: string
          mensagens: number
          remote_jid: string
          ultima_mensagem: string
        }[]
      }
      zap_conversas_pendentes: {
        Args: {
          p_fim: string
          p_inicio: string
          p_usuario_id?: string
          p_versao?: number
        }
        Returns: number
      }
      zap_cron_status: {
        Args: never
        Returns: {
          ativo: boolean
          jobname: string
          schedule: string
          ultima_execucao: string
          ultimo_status: string
        }[]
      }
      zap_custo_estimado:
        | {
            Args: { p_fim: string; p_inicio: string }
            Returns: {
              audios_expirados: number
              audios_pendentes: number
              conversas_para_analisar: number
              custo_analise_usd: number
              custo_transcricao_usd: number
              minutos_pendentes: number
            }[]
          }
        | {
            Args: { p_fim: string; p_inicio: string; p_usuario_id?: string }
            Returns: {
              audios_expirados: number
              audios_pendentes: number
              conversas_para_analisar: number
              custo_analise_usd: number
              custo_transcricao_usd: number
              minutos_pendentes: number
            }[]
          }
      zap_distribuicao_resposta: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id?: string }
        Returns: {
          faixa: string
          ordem: number
          pct: number
          respostas: number
        }[]
      }
      zap_etiquetas_por_consultor: {
        Args: { p_usuario_id: string }
        Returns: {
          com_conversa: number
          contatos: number
          cor: string
          etapa_ia_mais_comum: string
          etiqueta: string
          label_id: string
          parados_30d: number
          sem_atendimento: number
          sem_conversa: number
        }[]
      }
      zap_fechamento_etiquetado: {
        Args: { p_fim?: string; p_inicio?: string; p_usuario_id: string }
        Returns: {
          contatos_com_alguma_etiqueta: number
          contatos_totais: number
          marcados_pago: number
          marcados_pago_com_conversa: number
          marcados_pedido_enviado: number
        }[]
      }
      zap_fila_atendimento: {
        Args: { p_fim?: string; p_inicio?: string; p_instance?: string }
        Returns: {
          etiquetas: string[]
          horas_esperando: number
          instance_name: string
          nome: string
          primeira_mensagem_at: string
          remote_jid: string
          telefone: string
          total_mensagens: number
          ultima_mensagem_at: string
        }[]
      }
      zap_fila_por_consultor: {
        Args: { p_fim?: string; p_inicio?: string; p_usuario_id: string }
        Returns: {
          etiquetas: string[]
          horas_esperando: number
          identificacao: string
          instance_name: string
          primeira_mensagem_at: string
          remote_jid: string
          telefone: string
          total_mensagens: number
        }[]
      }
      zap_heatmap: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id?: string }
        Returns: {
          dia_semana: number
          hora: number
          mensagens: number
        }[]
      }
      zap_identificacao_contato: {
        Args: { p_nome: string; p_remote_jid: string; p_telefone: string }
        Returns: string
      }
      zap_mes_mais_movimentado: { Args: never; Returns: string }
      zap_metricas_consultor: {
        Args: { p_fim: string; p_incluir_internos?: boolean; p_inicio: string }
        Returns: {
          audios_enviados: number
          consultor: string
          contatos: number
          contatos_cliente_iniciou: number
          contatos_com_link: number
          contatos_com_msg_consultor: number
          contatos_com_resposta_cliente: number
          contatos_com_reuniao: number
          contatos_consultor_iniciou: number
          contatos_internos_excluidos: number
          conversas_analisadas: number
          documentos_enviados: number
          imagens_enviadas: number
          resposta_cliente_mediana_seg: number
          resposta_cliente_p90_seg: number
          resposta_continua_mediana_seg: number
          resposta_continua_p90_seg: number
          resposta_continua_p99_seg: number
          sentimento_negativo: number
          sentimento_neutro: number
          sentimento_positivo: number
          tmr1_media_seg: number
          tmr1_mediana_seg: number
          tmr1_p90_seg: number
          tmr1_p99_seg: number
          usuario_id: string
          vacuo_inicial_pct: number
          videos_enviados: number
        }[]
      }
      zap_objecoes_ranking: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id?: string }
        Returns: {
          categoria: string
          conversas: number
          superadas: number
          total: number
        }[]
      }
      zap_perfil_contato: {
        Args: { p_etapa: string; p_resumo: string }
        Returns: string
      }
      zap_proxima_versao: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id: string }
        Returns: number
      }
      zap_recalcular_turnos: {
        Args: { p_instance: string; p_jid: string }
        Returns: number
      }
      zap_recalcular_turnos_todos: { Args: never; Returns: number }
      zap_relatorio: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id: string }
        Returns: Json
      }
      zap_score: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id: string }
        Returns: Json
      }
      zap_serie_diaria: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id?: string }
        Returns: {
          contatos: number
          contatos_novos: number
          contatos_recorrentes: number
          dia: string
          mensagens: number
          tmr1_novos_seg: number
          tmr1_recorrentes_seg: number
        }[]
      }
      zap_taxas: {
        Args: { p_fim: string; p_inicio: string; p_usuario_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "zapvendas" | "trafego"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "zapvendas", "trafego"],
      setup_plano_perfil: ["novo_produtor", "produtor_experiente"],
    },
  },
} as const
