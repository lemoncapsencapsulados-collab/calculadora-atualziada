import { describe, expect, it } from 'vitest';
import {
  orcamentoEstaAberto,
  pedidoEstaAberto,
  registroDaPropagacao,
  selecionarOrcamentos,
  selecionarPedidos,
  usaPrecificacao,
} from './propagacaoPreco';

const P = 'precificacao-creatina';
const OUTRO = 'precificacao-colageno';

const itens = (...ids: string[]) => ids.map((precificacao_id) => ({ precificacao_id }));

const orc = (id: string, status: string, ids: string[] = [P]) => ({
  id,
  status,
  itens_producao: itens(...ids),
});

const ped = (
  id: string,
  extra: Partial<{ status: string; status_aprovacao: string; contrato_assinado_em: string }> = {},
  ids: string[] = [P],
) => ({ id, orcamento_snapshot: { itens_producao: itens(...ids) }, ...extra });

describe('orçamento em negociação se atualiza', () => {
  it('rascunho e enviado entram', () => {
    expect(orcamentoEstaAberto(orc('a', 'rascunho'))).toBe(true);
    expect(orcamentoEstaAberto(orc('b', 'enviado'))).toBe(true);
  });

  it('pago e recusado ficam de fora', () => {
    // Pago virou nota fiscal. Recusado não vai a lugar nenhum.
    expect(orcamentoEstaAberto(orc('c', 'pago'))).toBe(false);
    expect(orcamentoEstaAberto(orc('d', 'recusado'))).toBe(false);
  });

  it('status desconhecido ou ausente não é tratado como aberto', () => {
    // Na dúvida não se mexe: a lista é de quem PODE, não de quem não pode.
    expect(orcamentoEstaAberto({ id: 'e' })).toBe(false);
    expect(orcamentoEstaAberto(orc('f', 'faturado'))).toBe(false);
  });

  it('não depende de caixa nem de espaço em volta', () => {
    expect(orcamentoEstaAberto(orc('g', '  Enviado '))).toBe(true);
  });
});

describe('pedido sem assinatura se atualiza', () => {
  it('pendente de assinatura entra', () => {
    expect(pedidoEstaAberto(ped('a', { status_aprovacao: 'pendente_assinatura' }))).toBe(true);
  });

  it('pré-aprovado e aprovado ficam de fora', () => {
    expect(pedidoEstaAberto(ped('b', { status_aprovacao: 'pre_aprovado' }))).toBe(false);
    expect(pedidoEstaAberto(ped('c', { status_aprovacao: 'aprovado' }))).toBe(false);
  });

  it('contrato assinado tranca mesmo com status pendente', () => {
    // A data existir basta: houve assinatura, e o papel na mão do cliente não
    // muda porque o custo da matéria-prima mudou.
    expect(
      pedidoEstaAberto(
        ped('d', { status_aprovacao: 'pendente_assinatura', contrato_assinado_em: '2026-10-02' }),
      ),
    ).toBe(false);
  });

  it('pago tranca mesmo sem assinatura registrada', () => {
    expect(
      pedidoEstaAberto(ped('e', { status_aprovacao: 'pendente_assinatura', status: 'pago' })),
    ).toBe(false);
  });

  it('pedido antigo, sem status de aprovação, fica de fora', () => {
    // De antes do fluxo de assinatura. Não dá para saber em que pé está, e é
    // uma venda que já existe -- na dúvida, não se mexe no preço.
    expect(pedidoEstaAberto(ped('f'))).toBe(false);
  });
});

describe('só alcança quem usa o produto editado', () => {
  it('reconhece o item pelo precificacao_id', () => {
    expect(usaPrecificacao(itens(OUTRO, P), P)).toBe(true);
    expect(usaPrecificacao(itens(OUTRO), P)).toBe(false);
  });

  it('não quebra com itens ausentes ou de formato inesperado', () => {
    expect(usaPrecificacao(undefined, P)).toBe(false);
    expect(usaPrecificacao(null, P)).toBe(false);
    expect(usaPrecificacao('nada disso', P)).toBe(false);
    expect(usaPrecificacao([null, 'x', 7], P)).toBe(false);
  });

  it('id vazio não casa com tudo', () => {
    // Um id em branco casando por engano reescreveria a base inteira.
    expect(usaPrecificacao(itens(P), '')).toBe(false);
  });
});

describe('a separação que a gravação consome', () => {
  const orcamentos = [
    orc('aberto-1', 'rascunho'),
    orc('aberto-2', 'enviado'),
    orc('pago', 'pago'),
    orc('outro-produto', 'rascunho', [OUTRO]),
  ];

  it('separa quem atualiza de quem fica travado', () => {
    const { atualizar, travados } = selecionarOrcamentos(orcamentos, P);
    expect(atualizar.map((o) => o.id)).toEqual(['aberto-1', 'aberto-2']);
    expect(travados.map((o) => o.id)).toEqual(['pago']);
  });

  it('quem não usa o produto não aparece em nenhuma das duas listas', () => {
    const { atualizar, travados } = selecionarOrcamentos(orcamentos, P);
    const todos = [...atualizar, ...travados].map((o) => o.id);
    expect(todos).not.toContain('outro-produto');
  });

  it('o mesmo vale para pedidos', () => {
    const { atualizar, travados } = selecionarPedidos(
      [
        ped('pendente', { status_aprovacao: 'pendente_assinatura' }),
        ped('assinado', { status_aprovacao: 'aprovado' }),
        ped('outro', { status_aprovacao: 'pendente_assinatura' }, [OUTRO]),
      ],
      P,
    );
    expect(atualizar.map((p) => p.id)).toEqual(['pendente']);
    expect(travados.map((p) => p.id)).toEqual(['assinado']);
  });

  it('nenhum documento fechado escapa para a lista de atualizar', () => {
    // A garantia que importa: o que entra em `atualizar` vai ser reescrito.
    const fechados = [
      orc('x', 'pago'),
      orc('y', 'recusado'),
      orc('z', ''),
      { id: 'w', itens_producao: itens(P) },
    ];
    expect(selecionarOrcamentos(fechados, P).atualizar).toHaveLength(0);
  });
});

describe('o registro que fica no histórico', () => {
  it('guarda de quanto para quanto, e por quê', () => {
    const r = registroDaPropagacao({
      precificacaoId: P,
      nomeProduto: 'Creatina 300g',
      valorAnterior: 28,
      valorNovo: 30,
      motivos: ['Matéria-prima: R$ 9,12 → R$ 10,32'],
    });
    expect(r.origem).toBe('edicao_produto');
    expect(r.valor_anterior).toBe(28);
    expect(r.valor_novo).toBe(30);
    expect(r.motivos).toHaveLength(1);
    expect(Number.isNaN(Date.parse(r.atualizado_em))).toBe(false);
  });

  it('sem motivos, não grava uma lista vazia', () => {
    // Lista vazia no histórico sugere que se tentou explicar e não se achou
    // nada; ausente diz que não havia o que explicar.
    expect(registroDaPropagacao({ precificacaoId: P, valorAnterior: 1, valorNovo: 2 }).motivos)
      .toBeUndefined();
  });
});

describe('contrato tranca o orçamento, mesmo "enviado"', () => {
  it('contrato assinado fica de fora', () => {
    // O orçamento continua "enviado" depois de virar contrato. Sem esta
    // checagem, um contrato já assinado teria o preço reescrito por baixo.
    expect(
      orcamentoEstaAberto({ id: 'a', status: 'enviado', contrato_assinado_em: '2026-10-02' }),
    ).toBe(false);
  });

  it('contrato enviado ao ZapSign fica de fora', () => {
    // Pior caso de todos: reescrever enquanto o cliente assina. Ninguém saberia
    // qual das duas versões foi assinada.
    expect(
      orcamentoEstaAberto({ id: 'b', status: 'enviado', contrato_enviado_em: '2026-10-14' }),
    ).toBe(false);
  });

  it('sem contrato, segue atualizável', () => {
    expect(orcamentoEstaAberto({ id: 'c', status: 'enviado' })).toBe(true);
    expect(
      orcamentoEstaAberto({ id: 'd', status: 'enviado', contrato_assinado_em: null }),
    ).toBe(true);
  });
});
