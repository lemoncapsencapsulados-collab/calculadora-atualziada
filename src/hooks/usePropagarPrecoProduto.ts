import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type ItemParaRecalculo,
  type PrecificacaoAtual,
  custosDaPrecificacao,
  motivosDaMudanca,
  recalcularItens,
} from '@/lib/recalculoPreco';
import {
  type OrcamentoParaPropagar,
  type PedidoParaPropagar,
  registroDaPropagacao,
  selecionarOrcamentos,
  selecionarPedidos,
} from '@/lib/propagacaoPreco';
import { invalidarCachesDaFormula } from '@/lib/cachesDaFormula';
import {
  type InsumoSnapshot,
  atualizarComposicao,
  atualizarInsumosDosItens,
  atualizarQuantidadePorFrasco,
  composicaoDosInsumos,
  insumosDaFormula,
  quantidadePorFrasco,
} from '@/lib/propagacaoFormula';

/**
 * Leva o preço novo de um produto precificado aos documentos em negociação.
 *
 * Roda depois de salvar o produto, sozinho. Antes, mudar uma matéria-prima
 * atualizava a precificação e parava ali: todo orçamento aberto seguia com o
 * preço antigo até alguém abrir cada um e apertar RECALCULAR. Quem não
 * lembrasse mandava ao cliente um preço que o sistema já não sustentava.
 *
 * Alcança só o que está em aberto. Orçamento pago, pedido aprovado e contrato
 * assinado ficam como estão -- a regra de quem pode mora em `propagacaoPreco`,
 * isolada e testada, porque é a fronteira entre atualizar e adulterar.
 *
 * Silencioso por decisão do Wesley: não interrompe quem está editando. O que
 * mudou fica no histórico de cada documento, com valor antes, valor depois e o
 * motivo -- é o que o consultor precisa ter na mão se o cliente perguntar.
 *
 * Falhar aqui NÃO derruba o salvamento do produto. A edição da fórmula e da
 * precificação já está gravada e é o que o usuário pediu; a propagação é
 * consequência, e o RECALCULAR manual continua de pé como rede.
 */

interface Resultado {
  orcamentosAtualizados: number;
  pedidosAtualizados: number;
  /** Usam o produto mas estão fechados. Não foram tocados. */
  travados: number;
}

/**
 * A fórmula de hoje deste produto, no formato que os documentos carregam.
 *
 * Sem isto, mudar uma dosagem de 149 mcg para 49 mcg atualizava o preço em
 * todos os documentos e deixava a dose antiga em todos eles -- o preço vem da
 * precificação, que é relida; a composição vem de um instantâneo que ninguém
 * relia.
 */
async function insumosAtuais(
  precificacaoId: string,
): Promise<{ insumos: InsumoSnapshot[]; quantidadePorFrasco: string } | null> {
  const { data: prec, error } = await supabase
    .from('precificacoes')
    .select('formula_id')
    .eq('id', precificacaoId)
    .maybeSingle();
  if (error || !prec?.formula_id) return null;

  const { data: formula, error: erroFormula } = await supabase
    .from('formulas')
    .select('itens, tipo_produto, quantidade_por_pote, unidade_soluvel')
    .eq('id', prec.formula_id)
    .maybeSingle();
  if (erroFormula || !formula) return null;
  return {
    insumos: insumosDaFormula(formula.itens),
    // "60 capsulas", "30 gummies", "30 ml", "300 g": a linha "Quantidade por
    // frasco" do Pedido de Compra. Vinha do snapshot do orcamento e, uma vez
    // gravado o documento, nunca mais era relida.
    quantidadePorFrasco: quantidadePorFrasco(
      (formula as { quantidade_por_pote?: unknown }).quantidade_por_pote,
      String((formula as { tipo_produto?: string }).tipo_produto ?? ''),
      (formula as { unidade_soluvel?: string | null }).unidade_soluvel,
    ),
  };
}

/** Lê as precificações que os itens usam, para saber o preço de hoje. */
async function precificacoesDosItens(itens: ItemParaRecalculo[]): Promise<PrecificacaoAtual[]> {
  const ids = Array.from(
    new Set(itens.map((i) => i.precificacao_id).filter((id): id is string => !!id)),
  );
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('precificacoes')
    .select(
      'id, preco_venda, custo_materia_prima, custo_embalagem, total_impostos, custo_mao_obra_direta, margem_lucro_percentual',
    )
    .in('id', ids);
  if (error) throw error;
  return (data || []) as PrecificacaoAtual[];
}

/** Reprecifica os itens e devolve a lista nova mais o total de produção. */
function reprecificar(itens: ItemParaRecalculo[], precificacoes: PrecificacaoAtual[]) {
  const porId = new Map(precificacoes.map((p) => [p.id, p]));
  const novos = itens.map((item) => {
    const atual = item.precificacao_id ? porId.get(item.precificacao_id) : null;
    // Sem precificação correspondente o item fica como está. Zerar o preço de
    // um item cuja precificação sumiu transformaria um dado faltando num
    // desconto total.
    if (!atual) return item;
    const preco = Number(atual.preco_venda) || 0;
    return {
      ...item,
      preco_unitario: preco,
      subtotal: preco * (Number(item.quantidade) || 0),
      custos_no_orcamento: custosDaPrecificacao(atual),
    };
  });
  const subtotal = novos.reduce(
    (s, i) => s + (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 0),
    0,
  );
  return { novos, subtotal };
}

/** Motivos da mudança do item que veio deste produto. */
function motivosDoProduto(
  itens: ItemParaRecalculo[],
  precificacoes: PrecificacaoAtual[],
  precificacaoId: string,
): string[] {
  const item = itens.find((i) => i.precificacao_id === precificacaoId);
  const atual = precificacoes.find((p) => p.id === precificacaoId);
  if (!item || !atual) return [];
  return motivosDaMudanca(
    (item as { custos_no_orcamento?: never }).custos_no_orcamento,
    custosDaPrecificacao(atual),
  );
}

/**
 * A coluna `historico_edicoes` pode não existir ainda (migração
 * 20261023120000_historico_edicoes.sql). Quando falta, grava o preço mesmo
 * assim e segue sem o histórico.
 *
 * O contrário -- desistir da gravação porque o log não cabe -- deixaria o
 * consultor mandando ao cliente um preço que o sistema já não sustenta, que é
 * exatamente o que esta propagação existe para evitar. O log é importante; o
 * preço certo é mais.
 */
function colunaDeHistoricoFaltando(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  return (
    e?.code === '42703' ||
    e?.code === 'PGRST204' ||
    /historico_edicoes/.test(e?.message || '')
  );
}

export function usePropagarPrecoProduto() {
  const queryClient = useQueryClient();

  /**
   * @param precificacaoId produto que acabou de ser editado
   * @param nomeProduto só para o histórico ficar legível
   */
  const propagar = async (precificacaoId: string, nomeProduto?: string): Promise<Resultado> => {
    const vazio: Resultado = { orcamentosAtualizados: 0, pedidosAtualizados: 0, travados: 0 };
    if (!precificacaoId) return vazio;

    // A composição de hoje. `null` quando a precificação não tem fórmula
    // ligada: aí só o preço se propaga, como antes.
    const daFormula = await insumosAtuais(precificacaoId);
    const insumos = daFormula?.insumos ?? null;
    const composicao = insumos ? composicaoDosInsumos(insumos) : null;
    const qtdFrasco = daFormula?.quantidadePorFrasco ?? '';

    // Traz só o que pode mudar. Filtrar o status no banco em vez de no
    // navegador evita carregar a base inteira a cada edição de produto.
    //
    // A leitura também precisa tolerar a coluna de histórico faltando: pedir
    // uma coluna inexistente faz a PostgREST recusar a consulta inteira, e a
    // propagação morreria antes de gravar qualquer preço. Quando falta, relê
    // sem ela e segue sem histórico.
    const COLUNAS_ORC =
      'id, status, contrato_assinado_em, contrato_enviado_em, itens_producao, subtotal_servicos';
    const COLUNAS_PED = 'id, status, status_aprovacao, orcamento_snapshot, pedido_compra_dados';

    let semHistorico = false;

    const lerOrcamentos = (comHistorico: boolean) =>
      supabase
        .from('orcamentos')
        .select(comHistorico ? `${COLUNAS_ORC}, historico_edicoes` : COLUNAS_ORC)
        .in('status', ['rascunho', 'enviado']);
    const lerPedidos = (comHistorico: boolean) =>
      supabase
        .from('pedidos')
        .select(comHistorico ? `${COLUNAS_PED}, historico_edicoes` : COLUNAS_PED)
        .eq('status_aprovacao', 'pendente_assinatura');

    let [{ data: orcs, error: erroOrc }, { data: peds, error: erroPed }] = await Promise.all([
      lerOrcamentos(true),
      lerPedidos(true),
    ]);
    if (colunaDeHistoricoFaltando(erroOrc) || colunaDeHistoricoFaltando(erroPed)) {
      semHistorico = true;
      [{ data: orcs, error: erroOrc }, { data: peds, error: erroPed }] = await Promise.all([
        lerOrcamentos(false),
        lerPedidos(false),
      ]);
    }
    if (erroOrc) throw erroOrc;
    if (erroPed) throw erroPed;

    const selOrc = selecionarOrcamentos(
      (orcs || []) as unknown as (OrcamentoParaPropagar & { historico_edicoes?: unknown })[],
      precificacaoId,
    );
    const selPed = selecionarPedidos(
      (peds || []) as unknown as (PedidoParaPropagar & { historico_edicoes?: unknown })[],
      precificacaoId,
    );

    let orcamentosAtualizados = 0;
    let pedidosAtualizados = 0;

    for (const o of selOrc.atualizar) {
      const itens = ((o.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      const precificacoes = await precificacoesDosItens(itens);
      const antes = recalcularItens(itens, precificacoes);
      const comInsumos = insumos
        ? atualizarInsumosDosItens(
            itens as unknown as Record<string, unknown>[],
            precificacaoId,
            insumos,
          )
        : itens;
      const formulaMudou = insumos
        ? JSON.stringify(comInsumos) !== JSON.stringify(itens)
        : false;
      // Grava quando o preço OU a formulação mudou. Antes só o preço contava,
      // e trocar uma dosagem sem mexer no custo não atualizava nada.
      if (antes.semMudanca && !formulaMudou) continue;

      const { novos, subtotal } = reprecificar(
        comInsumos as unknown as ItemParaRecalculo[],
        precificacoes,
      );
      const servicos = Number(o.subtotal_servicos) || 0;
      const registro = registroDaPropagacao({
        precificacaoId,
        nomeProduto,
        valorAnterior: antes.totalAntes,
        valorNovo: antes.totalDepois,
        motivos: motivosDoProduto(itens, precificacoes, precificacaoId),
      });

      const campos = {
        itens_producao: novos as never,
        subtotal_producao: subtotal,
        valor_total: subtotal + servicos,
        // Reinicia a janela de 5 dias: o preço de hoje passa a valer de hoje.
        preco_recalculado_em: registro.em,
        preco_anterior_recalculo: antes.totalAntes,
      };
      const historico = {
        historico_edicoes: [
          ...(Array.isArray(o.historico_edicoes) ? o.historico_edicoes : []),
          registro,
        ] as never,
      };

      let { error } = semHistorico
        ? await supabase.from('orcamentos').update(campos).eq('id', o.id)
        : await supabase.from('orcamentos').update({ ...campos, ...historico }).eq('id', o.id);
      if (error && colunaDeHistoricoFaltando(error)) {
        semHistorico = true;
        ({ error } = await supabase.from('orcamentos').update(campos).eq('id', o.id));
      }
      if (error) throw error;
      orcamentosAtualizados++;
    }

    for (const p of selPed.atualizar) {
      const snap = (p.orcamento_snapshot || {}) as Record<string, unknown>;
      const itens = ((snap.itens_producao || []) as ItemParaRecalculo[]) ?? [];
      const precificacoes = await precificacoesDosItens(itens);
      const antes = recalcularItens(itens, precificacoes);
      const comInsumos = insumos
        ? atualizarInsumosDosItens(
            itens as unknown as Record<string, unknown>[],
            precificacaoId,
            insumos,
          )
        : itens;
      const formulaMudou = insumos
        ? JSON.stringify(comInsumos) !== JSON.stringify(itens)
        : false;
      if (antes.semMudanca && !formulaMudou) continue;

      const { novos, subtotal } = reprecificar(
        comInsumos as unknown as ItemParaRecalculo[],
        precificacoes,
      );
      const servicos = Number(snap.subtotal_servicos) || 0;
      const registro = registroDaPropagacao({
        precificacaoId,
        nomeProduto,
        valorAnterior: antes.totalAntes,
        valorNovo: antes.totalDepois,
        motivos: motivosDoProduto(itens, precificacoes, precificacaoId),
      });

      // O Pedido de Compra ja' preenchido nao se corrige sozinho ao reabrir:
      // uma vez gravado, ele vale sobre o autopreenchimento -- e' o que
      // preserva o que o consultor digitou a' mao. Entao a composicao e'
      // reescrita aqui, e SO' ela: material do pote, cor da tampa, lacre e
      // quantidade de rotulo continuam como ele escolheu.
      const doc = (p.pedido_compra_dados || null) as {
        especificacoes?: { produto_nome?: string; composicao?: unknown }[];
      } | null;
      let docAtualizado: typeof doc = null;
      if (doc && composicao && Array.isArray(doc.especificacoes)) {
        const nome = String(
          (itens.find((i) => i.precificacao_id === precificacaoId) as { nome_produto?: string })
            ?.nome_produto ?? '',
        );
        const r = atualizarComposicao(doc.especificacoes as never[], nome, composicao);
        // A quantidade por frasco anda junto: vem da mesma fórmula e ficava
        // congelada pelo mesmo motivo.
        const q = atualizarQuantidadePorFrasco(r.especificacoes as never[], nome, qtdFrasco);
        if (r.alteradas > 0 || q.alteradas > 0) {
          docAtualizado = { ...doc, especificacoes: q.especificacoes };
        }
      }

      const campos = {
        orcamento_snapshot: {
          ...snap,
          itens_producao: novos,
          subtotal_producao: subtotal,
          valor_total: subtotal + servicos,
        } as never,
        ...(docAtualizado ? { pedido_compra_dados: docAtualizado as never } : {}),
      };
      const historico = {
        historico_edicoes: [
          ...(Array.isArray(p.historico_edicoes) ? p.historico_edicoes : []),
          registro,
        ] as never,
      };

      let { error } = semHistorico
        ? await supabase.from('pedidos').update(campos).eq('id', p.id)
        : await supabase.from('pedidos').update({ ...campos, ...historico }).eq('id', p.id);
      if (error && colunaDeHistoricoFaltando(error)) {
        semHistorico = true;
        ({ error } = await supabase.from('pedidos').update(campos).eq('id', p.id));
      }
      if (error) throw error;
      pedidosAtualizados++;
    }

    if (orcamentosAtualizados || pedidosAtualizados) {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      invalidarCachesDaFormula(queryClient);
    }

    return {
      orcamentosAtualizados,
      pedidosAtualizados,
      travados: selOrc.travados.length + selPed.travados.length,
    };
  };

  return { propagar };
}
