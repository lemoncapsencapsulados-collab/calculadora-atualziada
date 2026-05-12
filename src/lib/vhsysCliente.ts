import { supabase } from '@/integrations/supabase/client';
import type { Orcamento, DadosCliente, PessoaFisicaResponsavel } from '@/types/orcamento';

export interface CadastrarVhSysParams {
  orcamento: Orcamento;
  tipoPessoa: 'pj' | 'pf';
  dadosCliente: DadosCliente;
  pessoasFisicas: PessoaFisicaResponsavel[];
  responsavelPJ: PessoaFisicaResponsavel;
}

export interface CadastrarVhSysResult {
  success: boolean;
  error?: string;
  payload?: Record<string, any>;
  data?: any;
}

/**
 * Cadastra o cliente do orçamento no VhSys via edge function.
 * Centraliza a lógica usada em PropostaCompletaDialog e AprovacaoOrcamentoDialog.
 */
export async function cadastrarClienteVhSys(
  params: CadastrarVhSysParams,
): Promise<CadastrarVhSysResult> {
  const { orcamento, tipoPessoa, dadosCliente, pessoasFisicas, responsavelPJ } = params;

  const pf = pessoasFisicas[0];
  const contato = tipoPessoa === 'pj'
    ? (responsavelPJ?.nome || pf?.nome || '').trim()
    : (pf?.nome || '').trim();

  const nomeFinal = (
    tipoPessoa === 'pj'
      ? (dadosCliente.razao_social || orcamento.nome_cliente)
      : (pf?.nome || orcamento.nome_cliente)
  )?.trim();

  const cnpjCpf = (
    tipoPessoa === 'pj' ? dadosCliente.cnpj : pf?.cpf
  )?.trim();

  if (!nomeFinal) {
    return { success: false, error: 'Informe o nome (ou razão social) do cliente.' };
  }
  if (!cnpjCpf) {
    return {
      success: false,
      error: tipoPessoa === 'pj' ? 'Informe o CNPJ do cliente.' : 'Informe o CPF do cliente.',
    };
  }

  const email =
    tipoPessoa === 'pj' ? (dadosCliente.email || pf?.email) : (pf?.email || dadosCliente.email);
  const telefone =
    tipoPessoa === 'pj' ? (dadosCliente.telefone || pf?.telefone) : (pf?.telefone || dadosCliente.telefone);
  const cep = tipoPessoa === 'pj' ? (dadosCliente.cep_cnpj || pf?.cep) : (pf?.cep || dadosCliente.cep_cnpj);
  const logradouro =
    tipoPessoa === 'pj' ? (dadosCliente.endereco_cnpj || pf?.endereco) : (pf?.endereco || dadosCliente.endereco_cnpj);
  const cidade = tipoPessoa === 'pj' ? (dadosCliente.cidade || pf?.cidade) : (pf?.cidade || dadosCliente.cidade);
  const uf = tipoPessoa === 'pj' ? (dadosCliente.estado || pf?.estado) : (pf?.estado || dadosCliente.estado);

  const enderecoBruto = (logradouro || '').trim();
  const enderecoPartes = enderecoBruto.split(',').map((parte) => parte.trim()).filter(Boolean);
  const numeroDetectado = enderecoPartes.length > 1 ? enderecoPartes[1] : undefined;
  const logradouroDetectado = enderecoPartes[0] || undefined;
  const bairroDetectado = enderecoBruto.includes(' - ')
    ? enderecoBruto.split(' - ').pop()?.trim()
    : undefined;

  const linhasProdutos = (orcamento.itens_producao || [])
    .map((item) => {
      const nome = (item.nome_produto || '').trim();
      if (!nome) return null;
      const qtd = item.quantidade ?? 0;
      const seg = item.segmento ? ` [${item.segmento}]` : '';
      return `• ${nome}${seg} - Qtd: ${qtd}`;
    })
    .filter(Boolean) as string[];
  const observacaoProdutos = linhasProdutos.length
    ? `Produtos do orçamento ${orcamento.numero_orcamento || ''}:\n${linhasProdutos.join('\n')}`.trim()
    : undefined;

  const payload: Record<string, any> = {
    nome: nomeFinal,
    nome_fantasia: tipoPessoa === 'pj'
      ? (dadosCliente.razao_social || nomeFinal)
      : nomeFinal,
    tipo_pessoa: tipoPessoa === 'pj' ? 'J' : 'F',
    cnpj_cpf: cnpjCpf,
    email: email || undefined,
    telefone: telefone || undefined,
    cep: cep || undefined,
    logradouro: logradouroDetectado || logradouro || undefined,
    numero: numeroDetectado || undefined,
    bairro: bairroDetectado || undefined,
    cidade: cidade || undefined,
    uf: uf || undefined,
    contato: contato || undefined,
    inscricao_estadual: tipoPessoa === 'pj' ? (dadosCliente.inscricao_estadual || undefined) : undefined,
    inscricao_municipal: tipoPessoa === 'pj' ? (dadosCliente.inscricao_municipal || undefined) : undefined,
    observacao: observacaoProdutos,
  };

  try {
    const { data, error } = await supabase.functions.invoke('vhsys-create-cliente', {
      body: payload,
    });

    if (error) {
      const ctx: any = (error as any).context;
      let serverMsg: string | undefined;
      try {
        const parsed = ctx?.body ? JSON.parse(ctx.body) : null;
        serverMsg = parsed?.error || parsed?.message;
      } catch { /* ignore */ }
      return {
        success: false,
        error: serverMsg || error.message || 'Falha ao cadastrar cliente no VhSys.',
        payload,
      };
    }

    if ((data as any)?.error) {
      return { success: false, error: (data as any).error, payload, data };
    }

    return { success: true, payload, data };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Erro inesperado ao cadastrar no VhSys.',
      payload,
    };
  }
}