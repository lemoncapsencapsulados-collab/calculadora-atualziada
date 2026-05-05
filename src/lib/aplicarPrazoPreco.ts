import { supabase } from '@/integrations/supabase/client';
import { calcularPrecificacaoPorPreco, calcularPrecificacaoPorMarkup } from '@/lib/precificacaoCalculator';
import { getCustosParaTipo } from '@/lib/adminCustos';
import { arredondarReais } from '@/lib/utils';

const STATUS_TRAVADOS = new Set(['aprovado', 'pago', 'cancelado']);

/**
 * Recalcula preços de orçamentos e precificações vinculados a um prazo vencido.
 * Idempotente: só processa registros com prazo_preco_id == prazo.id e que ainda não foram recalculados.
 */
export async function aplicarPrazoPreco(prazoId: string): Promise<{ orcamentos: number; precificacoes: number }> {
  // 1. Carrega prazo
  const { data: prazo, error: prazoErr } = await supabase
    .from('prazo_precos' as any)
    .select('*')
    .eq('id', prazoId)
    .maybeSingle();
  if (prazoErr || !prazo) throw prazoErr || new Error('Prazo não encontrado');
  if ((prazo as any).aplicado) return { orcamentos: 0, precificacoes: 0 };

  // 2. Carrega config ativa atual
  const { data: config, error: configErr } = await supabase
    .from('configuracao_custos')
    .select('*')
    .eq('ativa', true)
    .single();
  if (configErr || !config) throw configErr || new Error('Config não encontrada');

  // 3. Recalcula precificações
  const { data: precs } = await supabase
    .from('precificacoes')
    .select('*')
    .eq('prazo_preco_id', prazoId);

  let precsCount = 0;
  for (const p of precs || []) {
    try {
      const { data: formula } = await supabase
        .from('formulas')
        .select('tipo_produto, total_mp, total_embalagem')
        .eq('id', (p as any).formula_id)
        .maybeSingle();

      const tipo = (formula as any)?.tipo_produto;
      const { mod, admin } = getCustosParaTipo(config, tipo);
      const custosBase = {
        custoMateriaPrima: Number((formula as any)?.total_mp ?? p.custo_materia_prima),
        custoEmbalagem: Number((formula as any)?.total_embalagem ?? p.custo_embalagem),
      };
      const custosIndiretos = {
        maoObraDireta: mod,
        energia: Number(config.energia_eletrica) || 0,
        depreciacao: Number(config.depreciacao_maquinas) || 0,
        administrativo: admin,
      };
      const markup = Number(p.markup_bruto) || 0;
      const recalc = calcularPrecificacaoPorMarkup(custosBase, custosIndiretos, markup, config as any);

      await supabase
        .from('precificacoes')
        .update({
          preco_anterior_recalculo: p.preco_venda,
          preco_recalculado_em: new Date().toISOString(),
          preco_venda: recalc.precoVenda,
          custo_materia_prima: recalc.custoMateriaPrima,
          custo_embalagem: recalc.custoEmbalagem,
          custo_mao_obra_direta: recalc.custoMaoObraDireta,
          custo_energia: recalc.custoEnergia,
          custo_depreciacao: recalc.custoDepreciacao,
          custo_administrativo: recalc.custoAdministrativo,
          subtotal_custos_diretos: recalc.subtotalCustosDiretos,
          subtotal_custos_indiretos: recalc.subtotalCustosIndiretos,
          margem_seguranca: recalc.margemSeguranca,
          total_custos_producao: recalc.totalCustosProducao,
          total_impostos: recalc.totalImpostos,
          margem_lucro_valor: recalc.margemLucroValor,
          margem_lucro_percentual: recalc.margemLucroPercentual,
          markup_bruto: recalc.markupBruto,
          configuracao_custos_id: config.id,
          prazo_preco_id: null,
        })
        .eq('id', p.id);
      precsCount++;
    } catch (e) {
      console.error('Erro recalculando precificação', p.id, e);
    }
  }

  // 4. Recalcula orçamentos não travados
  const { data: orcs } = await supabase
    .from('orcamentos')
    .select('*')
    .eq('prazo_preco_id', prazoId);

  let orcsCount = 0;
  for (const orc of orcs || []) {
    try {
      if (STATUS_TRAVADOS.has(orc.status)) {
        // Apenas remove o vínculo; preço fica congelado
        await supabase.from('orcamentos').update({ prazo_preco_id: null }).eq('id', orc.id);
        continue;
      }

      const itens = Array.isArray(orc.itens_producao) ? [...orc.itens_producao] : [];
      let novoSubtotalProd = 0;

      for (const item of itens) {
        if (item?.tipo === 'precificacao' && item?.precificacao_id) {
          const { data: precUpd } = await supabase
            .from('precificacoes')
            .select('preco_venda')
            .eq('id', item.precificacao_id)
            .maybeSingle();
          if (precUpd?.preco_venda != null) {
            item.preco_unitario = Number(precUpd.preco_venda);
            item.subtotal = arredondarReais((Number(item.quantidade) || 0) * item.preco_unitario);
          }
        }
        novoSubtotalProd += Number(item.subtotal) || 0;
      }
      novoSubtotalProd = arredondarReais(novoSubtotalProd);
      const subtotalServ = Number(orc.subtotal_servicos) || 0;
      const frete = Number((orc as any).detalhamento_frete?.valor_total) || 0;
      const novoTotal = arredondarReais(novoSubtotalProd + subtotalServ + frete);

      await supabase
        .from('orcamentos')
        .update({
          itens_producao: itens,
          subtotal_producao: novoSubtotalProd,
          valor_total: novoTotal,
          preco_anterior_recalculo: orc.valor_total,
          preco_recalculado_em: new Date().toISOString(),
          prazo_preco_id: null,
        })
        .eq('id', orc.id);
      orcsCount++;
    } catch (e) {
      console.error('Erro recalculando orçamento', orc.id, e);
    }
  }

  // 5. Limpa fórmulas e marca prazo como aplicado
  await supabase.from('formulas').update({ prazo_preco_id: null }).eq('prazo_preco_id', prazoId);

  await supabase
    .from('prazo_precos' as any)
    .update({
      aplicado: true,
      aplicado_em: new Date().toISOString(),
      orcamentos_recalculados: orcsCount,
      precificacoes_recalculadas: precsCount,
    })
    .eq('id', prazoId);

  return { orcamentos: orcsCount, precificacoes: precsCount };
}

/**
 * Verifica se há prazos vencidos e aplica todos. Idempotente.
 */
export async function aplicarPrazosVencidos(): Promise<Array<{ id: string; orcamentos: number; precificacoes: number }>> {
  const nowIso = new Date().toISOString();
  const { data: vencidos, error } = await supabase
    .from('prazo_precos' as any)
    .select('id')
    .eq('aplicado', false)
    .lte('data_fim', nowIso);
  if (error) throw error;

  const resultados: Array<{ id: string; orcamentos: number; precificacoes: number }> = [];
  for (const p of vencidos || []) {
    try {
      const r = await aplicarPrazoPreco((p as any).id);
      resultados.push({ id: (p as any).id, ...r });
    } catch (e) {
      console.error('Falha aplicando prazo', (p as any).id, e);
    }
  }
  return resultados;
}
