/**
 * Preenchimento automatico do Pedido de Compra v3.
 *
 * Puxa o maximo possivel do cadastro do cliente (CNPJ) e do orcamento que deu
 * origem ao pedido. O que nao der para deduzir fica vazio de proposito, para
 * `listarCamposFaltantes` cobrar do consultor antes de gerar o documento --
 * o financeiro recusa um Pedido de Compra com lacuna.
 */

import type { DadosCliente, ItemProducao, OrcamentoSnapshot, ServicoMarca } from '@/types/orcamento';
import type {
  AtivoFormula,
  DadosPedidoCompra,
  EmbalagemPedidoCompra,
  EspecificacaoProduto,
  ParcelaPedidoCompra,
  PlanoMarca,
  ProdutoPedidoCompra,
} from '@/types/pedidoCompra';
import { PADROES_PEDIDO_COMPRA } from '@/types/pedidoCompra';
import { formatarCondicoesParaContrato } from '@/lib/formatarPagamento';

const txt = (v: unknown): string => String(v ?? '').trim();

/** Monta "Rua X, 123, Bairro - Cidade/UF, CEP" com o que existir. */
function montarEndereco(dc: DadosCliente | undefined): string {
  if (!dc) return '';
  const logradouro = [txt(dc.endereco_cnpj), txt(dc.numero_cnpj)].filter(Boolean).join(', ');
  const cidadeUf = [txt(dc.cidade), txt(dc.estado)].filter(Boolean).join('/');
  const cep = txt(dc.cep_cnpj);
  return [logradouro, txt(dc.bairro_cnpj), cidadeUf, cep && `CEP ${cep}`]
    .filter(Boolean)
    .join(' - ');
}

/** O representante legal e' o responsavel PJ ou, numa PF, a primeira pessoa. */
function acharRepresentante(dc: DadosCliente | undefined) {
  if (!dc) return { nome: '', cpf: '' };
  const pessoa = dc.responsavel_pj || dc.pessoas_fisicas?.[0];
  return {
    nome: txt(pessoa?.nome) || txt(dc.nome_completo),
    cpf: txt(pessoa?.cpf) || txt(dc.cpf),
  };
}

/** "Encapsulados - 60 cápsulas" a partir do que o item de producao carrega. */
function descreverApresentacao(item: ItemProducao): string {
  const tipo = txt(item.tipo_produto) || txt(item.segmento);
  const porPote =
    item.quantidade_por_pote != null
      ? `${item.quantidade_por_pote} ${txt(item.unidade_por_pote) || 'un'}`
      : '';
  return [tipo, porPote].filter(Boolean).join(' - ');
}

/**
 * Ativos da formula em linhas de insumo + dose.
 *
 * A quantidade vem como esta' na formula, que ja' e' por dose. Nao multiplico
 * por nada: inventar um fator aqui mudaria a dosagem impressa no documento que
 * vai para a fabrica.
 */
function descreverComposicao(item: ItemProducao | undefined): AtivoFormula[] {
  const insumos = item?.insumos_formula || [];
  return insumos
    .filter((i) => txt(i.nome))
    .map((i) => {
      const qtd = Number(i.quantidade);
      const medida = Number.isFinite(qtd)
        ? `${String(qtd).replace('.', ',')} ${txt(i.unidade)}`.trim()
        : '';
      return { insumo: txt(i.nome), dose: medida };
    });
}

/** O plano de marca vem do nome do servico contratado no setup. */
function deduzirPlanoMarca(servicos: ServicoMarca[]): PlanoMarca {
  const nomes = servicos.map((s) => txt(s.nome_plano).toLowerCase()).join(' ');
  if (!nomes) return 'nao_contratado';
  if (nomes.includes('premium')) return 'premium';
  if (nomes.includes('branding')) return 'branding';
  if (nomes.includes('start')) return 'start';
  if (nomes.includes('faça você mesmo') || nomes.includes('faca voce mesmo')) return 'faca_voce_mesmo';
  return 'nao_contratado';
}

function listarEntregaveis(servicos: ServicoMarca[]): string[] {
  const nomes = new Set<string>();
  servicos.forEach((s) => {
    (s.entregaveis || []).forEach((e) => {
      if (e?.incluso && txt(e.nome)) nomes.add(txt(e.nome));
    });
  });
  return Array.from(nomes);
}

/**
 * As parcelas do documento saem das condicoes de pagamento do orcamento. Quando
 * a estrutura nao traz parcela a parcela, cai para uma linha unica com o total
 * e a descricao textual -- o consultor ajusta na tela.
 */
function montarParcelas(snap: Partial<OrcamentoSnapshot>): ParcelaPedidoCompra[] {
  const cond: any = snap.condicoes_pagamento || {};
  const parcelas = cond.parcelas;

  if (Array.isArray(parcelas) && parcelas.length > 0) {
    return parcelas.map((p: any) => ({
      meio_pagamento: txt(p.forma || p.meio_pagamento || cond.metodo_principal),
      vencimento: txt(p.vencimento || p.data_vencimento),
      valor: Number(p.valor) || 0,
    }));
  }

  const total = Number(snap.valor_total) || 0;
  if (total <= 0) return [];
  return [
    {
      meio_pagamento: txt(formatarCondicoesParaContrato(cond, total)),
      vencimento: '',
      valor: total,
    },
  ];
}

function montarEmbalagem(item: ItemProducao | undefined): EmbalagemPedidoCompra {
  const det = item?.detalhes_producao || {};
  return {
    apresentacao: txt(item?.tipo_produto) || txt(item?.segmento),
    capsula_tipo: '',
    capsula_cor: '',
    // O material do pote vem do que foi fechado no orcamento, quando houver.
    pote_material: txt((item as any)?.embalagem_pote_material),
    pote_capacidade: '',
    pote_cor: txt(det.cor_pote),
    tampa_tipo: '',
    tampa_cor: txt(det.cor_tampa),
    lacre_inducao: false,
    dosador: '',
    rotulo_material: '',
    rotulo_acabamento: '',
    // Regra da fabrica: sempre o dobro de potes, para cobrir perda de aplicacao.
    rotulo_quantidade: item?.quantidade != null ? String(Number(item.quantidade) * 2) : '',
    embalagem_secundaria: '',
    fornecimento_embalagem: '',
  };
}

export interface AutoFillEntrada {
  snapshot: Partial<OrcamentoSnapshot>;
  /** Cadastro do cliente; tem prioridade sobre o snapshot, que pode estar velho. */
  cliente?: { razao_social?: string | null; nome?: string | null; cnpj?: string | null; cpf?: string | null; telefone?: string | null } | null;
}

export function montarDadosPedidoCompra({ snapshot, cliente }: AutoFillEntrada): DadosPedidoCompra {
  const dc = (snapshot.dados_cliente || {}) as DadosCliente;
  const itens = (snapshot.itens_producao || []) as ItemProducao[];
  const servicos = (snapshot.servicos_marca || []) as ServicoMarca[];
  const representante = acharRepresentante(dc);

  const produtos: ProdutoPedidoCompra[] = itens.map((item) => ({
    descricao: txt(item.nome_produto),
    apresentacao: descreverApresentacao(item),
    preco_unitario: Number(item.preco_unitario) || 0,
    quantidade: Number(item.quantidade) || 0,
    linha: item.linha_produto,
  }));

  const contratante =
    txt(cliente?.razao_social) ||
    txt(dc.razao_social) ||
    txt(cliente?.nome) ||
    txt(dc.nome_completo) ||
    txt(snapshot.nome_cliente);

  const documento = txt(cliente?.cnpj) || txt(dc.cnpj) || txt(cliente?.cpf) || txt(dc.cpf);
  const telefone = txt(dc.telefone) || txt(cliente?.telefone);

  return {
    contratante,
    cnpj_cpf: documento,
    // O padrao e' faturar na mesma pessoa do contrato; muda so' quando pedirem.
    faturamento_em: 'Mesma pessoa do contrato',
    data_pedido: new Date().toISOString().slice(0, 10),
    // Canal formal nao esta' em lugar nenhum do cadastro: o consultor informa.
    canal_formal: '',
    produtos,
    plano_marca: deduzirPlanoMarca(servicos),
    entregaveis: listarEntregaveis(servicos),
    valor_setup: Number(snapshot.subtotal_servicos) || 0,
    valor_producao: Number(snapshot.subtotal_producao) || 0,
    prazo_rotulo_primeira_versao: PADROES_PEDIDO_COMPRA.prazo_rotulo_primeira_versao,
    prazo_rotulo_correcao: PADROES_PEDIDO_COMPRA.prazo_rotulo_correcao,
    prazo_producao_dias: PADROES_PEDIDO_COMPRA.prazo_producao_dias,
    prazo_entrega_dias: PADROES_PEDIDO_COMPRA.prazo_entrega_dias,
    entrada_minima_percentual: PADROES_PEDIDO_COMPRA.entrada_minima_percentual,
    // O endereco do cadastro e' o fiscal; a entrega costuma ser outro lugar,
    // entao entra como sugestao e o consultor confirma.
    endereco_entrega: montarEndereco(dc),
    contato_local: [representante.nome, telefone].filter(Boolean).join(' - '),
    parcelas: montarParcelas(snapshot),
    // Uma especificacao por produto: cada um tem sua formula e sua embalagem.
    especificacoes: itens.map(
      (item): EspecificacaoProduto => ({
        produto_nome: txt(item.nome_produto),
        quantidade_por_frasco:
          item.quantidade_por_pote != null
            ? `${item.quantidade_por_pote} ${txt(item.unidade_por_pote) || ''}`.trim()
            : '',
        composicao: descreverComposicao(item),
        embalagem: montarEmbalagem(item),
      }),
    ),
    representante_nome: representante.nome,
    representante_cpf: representante.cpf,
  };
}
