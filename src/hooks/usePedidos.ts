import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { emitWebhookEvent } from '@/lib/webhookEmitter';
import { toast } from 'sonner';
import { Pedido, AcompanhamentoProcessos, HistoricoVhsysEntry } from '@/types/formula';
import { Orcamento, OrcamentoSnapshot, CondicoesPagamento } from '@/types/orcamento';
import { useEffect, useRef, useCallback } from 'react';
import { formatarPagamentoResumo } from '@/lib/formatarPagamento';

export interface PagamentoAlteracao {
  alterado_em: string;
  alterado_por?: string | null;
  data_pagamento_anterior?: string | null;
  data_pagamento_nova?: string | null;
  condicoes_anteriores?: CondicoesPagamento | null;
  condicoes_novas?: CondicoesPagamento | null;
  resumo_anterior?: string;
  resumo_novo?: string;
}

const buildSnapshotFromOrcamento = (o: any): OrcamentoSnapshot => ({
  id: o.id,
  numero_orcamento: o.numero_orcamento,
  nome_cliente: o.nome_cliente,
  consultor_responsavel: o.consultor_responsavel || undefined,
  tipo_orcamento: o.tipo_orcamento || 'novo_produtor',
  itens_producao: o.itens_producao || [],
  servicos_marca: o.servicos_marca || [],
  dados_cliente: o.dados_cliente || undefined,
  detalhamento_frete: o.detalhamento_frete || undefined,
  condicoes_pagamento: o.condicoes_pagamento || undefined,
  intermediador: o.intermediador || undefined,
  subtotal_producao: Number(o.subtotal_producao) || 0,
  subtotal_servicos: Number(o.subtotal_servicos) || 0,
  valor_total: Number(o.valor_total) || 0,
  data_pagamento: o.data_pagamento || undefined,
  observacoes: o.observacoes || undefined,
  updated_at: o.updated_at || undefined,
});

const getNextPedNumber = async (): Promise<string> => {
  const { data } = await supabase
    .from('pedidos')
    .select('numero_pedido')
    .like('numero_pedido', 'PED-%');

  let maxNum = 0;
  (data || []).forEach(p => {
    const match = p.numero_pedido.match(/PED-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `PED-${(maxNum + 1).toString().padStart(3, '0')}`;
};

const WEBHOOK_URL = 'https://n8n.lemoncaps.com.br/webhook/request-order';

const notifyWebhook = async (snapshot: any) => {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch (error) {
    console.error('Webhook error:', error);
  }
};

const SYNC_KEY = 'pedidos_snapshot_sync_at';
let syncGlobalDone = false;

export const usePedidos = (options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const syncDone = useRef(false);
  const listEnabled = options?.enabled !== false;

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos'],
    enabled: listEnabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('data_pedido', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(p => ({
        id: p.id,
        formula_id: p.formula_id || undefined,
        orcamento_id: p.orcamento_id || undefined,
        numero_pedido: p.numero_pedido,
        data_pedido: new Date(p.data_pedido),
        data_entrega: new Date(p.data_entrega),
        quantidade_produto: Number(p.quantidade_produto),
        unidade_produto: p.unidade_produto,
        observacoes: p.observacoes || undefined,
        status: p.status as Pedido['status'],
        formula_snapshot: p.formula_snapshot as any || undefined,
        orcamento_snapshot: p.orcamento_snapshot as unknown as OrcamentoSnapshot | undefined,
        acompanhamento_processos: (p as any).acompanhamento_processos as AcompanhamentoProcessos | undefined,
        // Pedido de Compra: o mapeamento e' explicito, entao campo novo tem que entrar aqui.
        numero_contrato: (p as any).numero_contrato || undefined,
        cnpj_contratante: (p as any).cnpj_contratante || undefined,
        status_aprovacao: (p as any).status_aprovacao || undefined,
        pedido_compra_dados: (p as any).pedido_compra_dados || undefined,
        pagamento_alteracoes: ((p as any).pagamento_alteracoes as PagamentoAlteracao[]) || [],
        historico_vhsys: (((p as any).historico_vhsys as HistoricoVhsysEntry[]) || []),
        created_at: new Date(p.created_at),
        updated_at: new Date(p.updated_at),
      })) as Pedido[];
    },
  });

  // Realtime: sincroniza qualquer mudança em pedidos entre abas (Pedidos, Sucesso do Cliente, Dashboard)
  useEffect(() => {
    const channel = supabase
      .channel('pedidos-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          queryClient.invalidateQueries({ queryKey: ['pedidos-dashboard'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Sync: garante que orçamentos pagos tenham snapshot atualizado no pedido.
  // Roda no máximo uma vez por sessão do navegador e só grava o que realmente mudou.
  useEffect(() => {
    if (!listEnabled || syncDone.current || isLoading) return;
    syncDone.current = true;
    if (syncGlobalDone) return;
    syncGlobalDone = true;
    try {
      const last = Number(sessionStorage.getItem(SYNC_KEY) || 0);
      if (Date.now() - last < 30 * 60_000) return;
      sessionStorage.setItem(SYNC_KEY, String(Date.now()));
    } catch { /* sessionStorage indisponível */ }

    (async () => {
      try {
        const { data: orcamentosPagos, error: errOrc } = await supabase
          .from('orcamentos')
          .select('*')
          .eq('status', 'pago');
        if (errOrc || !orcamentosPagos?.length) return;

        const { data: allPedidos, error: errPed } = await supabase
          .from('pedidos')
          .select('id, orcamento_id, orcamento_snapshot')
          .not('orcamento_id', 'is', null);
        if (errPed) return;

        const pedidosByOrcId = new Map<string, any>();
        (allPedidos || []).forEach(p => {
          if (p.orcamento_id) pedidosByOrcId.set(p.orcamento_id, p);
        });
        const toUpdate: { id: string; snapshot: any }[] = [];

        for (const orc of orcamentosPagos) {
          const existing = pedidosByOrcId.get(orc.id);
          if (!existing) continue;

          const snapshot = buildSnapshotFromOrcamento(orc);
          // Só grava quando o snapshot realmente mudou (evita writes em massa a cada carregamento)
          if (JSON.stringify(existing.orcamento_snapshot ?? null) === JSON.stringify(snapshot)) continue;
          toUpdate.push({ id: existing.id, snapshot });
        }

        for (const u of toUpdate) {
          await supabase
            .from('pedidos')
            .update({ orcamento_snapshot: u.snapshot as any })
            .eq('id', u.id);
        }

        if (toUpdate.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          queryClient.invalidateQueries({ queryKey: ['pedidos-dashboard'] });
        }
      } catch (err) {
        console.error('Erro no sync de pedidos:', err);
      }
    })();
  }, [isLoading, queryClient, listEnabled]);

  const createPedido = useMutation({
    mutationFn: async (pedido: Omit<Pedido, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('pedidos')
        .insert([{
          formula_id: pedido.formula_id || null,
          numero_pedido: pedido.numero_pedido,
          data_pedido: pedido.data_pedido.toISOString(),
          data_entrega: pedido.data_entrega.toISOString(),
          quantidade_produto: pedido.quantidade_produto,
          unidade_produto: pedido.unidade_produto,
          observacoes: pedido.observacoes || null,
          status: pedido.status,
          formula_snapshot: pedido.formula_snapshot as any || null,
          orcamento_id: (pedido as any).orcamento_id || null,
          orcamento_snapshot: (pedido as any).orcamento_snapshot || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido de produção criado com sucesso!');
      if (data?.orcamento_snapshot) notifyWebhook(data.orcamento_snapshot);
      emitWebhookEvent('pedido.criado', data);
    },
    onError: (error) => {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao criar pedido de produção');
    },
  });

  const createPedidoFromOrcamento = useMutation({
    mutationFn: async (orcamento: Orcamento) => {
      // Check if pedido already exists for this orcamento
      const { data: existing } = await supabase
        .from('pedidos')
        .select('id')
        .eq('orcamento_id', orcamento.id)
        .limit(1);

      const snapshot = buildSnapshotFromOrcamento(orcamento);

      if (existing && existing.length > 0) {
        // Update existing instead of duplicating
        const { data, error } = await supabase
          .from('pedidos')
          .update({ orcamento_snapshot: snapshot as any })
          .eq('id', existing[0].id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      // O numero do Pedido de Compra e' o proprio numero do orcamento quando ele
      // ja' foi renumerado pela sequencia do cliente (400, 400-01...). Orcamentos
      // antigos continuam com ORC-xxx e caem na sequencia PED-xxx de sempre.
      const numeroCliente = (orcamento.numero_orcamento || '').trim();
      const nextNum = /^\d+(-\d+)?$/.test(numeroCliente)
        ? numeroCliente
        : await getNextPedNumber();
      const totalQtd = (orcamento.itens_producao || []).reduce((sum: number, item) => sum + (item.quantidade || 1), 0);

      const { data, error } = await supabase
        .from('pedidos')
        .insert([{
          orcamento_id: orcamento.id,
          orcamento_snapshot: snapshot as any,
          numero_pedido: nextNum,
          data_pedido: new Date().toISOString(),
          data_entrega: orcamento.data_pagamento || new Date().toISOString(),
          quantidade_produto: totalQtd,
          unidade_produto: 'potes',
          status: 'aguardando_producao',
          formula_id: null,
          formula_snapshot: null,
          observacoes: orcamento.observacoes || null,
          ...({ numero_contrato: (orcamento as any).numero_contrato || null } as any),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido criado automaticamente a partir do orçamento pago!');
      if (data?.orcamento_snapshot) notifyWebhook(data.orcamento_snapshot);
      emitWebhookEvent('pedido.criado', data);
    },
    onError: (error) => {
      console.error('Erro ao criar pedido do orçamento:', error);
      toast.error('Erro ao criar pedido a partir do orçamento');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Pedido['status'] }) => {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Status do pedido atualizado!');
      if (data?.orcamento_snapshot) notifyWebhook(data.orcamento_snapshot);
      emitWebhookEvent(data?.status === 'concluido' ? 'pedido.concluido' : 'pedido.atualizado', data);
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const updateObservacoes = useMutation({
    mutationFn: async ({ id, observacoes }: { id: string; observacoes: string }) => {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ observacoes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Observações atualizadas com sucesso!');
      if (data?.orcamento_snapshot) notifyWebhook(data.orcamento_snapshot);
    },
    onError: () => {
      toast.error('Erro ao atualizar observações');
    },
  });

  /**
   * Vincula um Pedido de Compra ao pedido: numero de contrato, numero definitivo
   * (`contrato-sequencial`) e os campos do documento. O pedido entra como
   * pendente de assinatura -- so' o retorno do ZapSign o move para pre-aprovado.
   */
  const vincularPedidoCompra = useMutation({
    mutationFn: async ({
      id,
      numeroContrato,
      numeroPedido,
      cnpjContratante,
      dados,
    }: {
      id: string;
      numeroContrato: string;
      numeroPedido: string;
      cnpjContratante: string;
      dados: unknown;
    }) => {
      const { data, error } = await supabase
        .from('pedidos')
        .update({
          numero_contrato: numeroContrato,
          numero_pedido: numeroPedido,
          cnpj_contratante: cnpjContratante,
          status_aprovacao: 'pendente_assinatura',
          pedido_compra_dados: dados as any,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido de Compra vinculado. Falta a assinatura do cliente e da Lemon.');
    },
    onError: (error: any) => {
      // 42703/PGRST204: as colunas do Pedido de Compra ainda nao existem no banco.
      const semColuna =
        error?.code === '42703' ||
        error?.code === 'PGRST204' ||
        /column .* does not exist/i.test(error?.message || '');
      toast.error(
        semColuna
          ? 'A migração do Pedido de Compra ainda não foi aplicada no banco. O PDF pode ser baixado normalmente, mas o vínculo com o pedido só grava depois dela.'
          : `Erro ao vincular o Pedido de Compra: ${error.message}`,
      );
    },
  });

  const updateAcompanhamento = useMutation({
    mutationFn: async ({ id, acompanhamento, pedidoId }: { id: string; acompanhamento: AcompanhamentoProcessos; pedidoId?: string }) => {
      const fields = ['criacao_marca', 'producao', 'integracao_logistica', 'pagina_venda', 'envio_produto'] as const;
      const allDone = fields.every(k => acompanhamento[k] === 'entregue' || acompanhamento[k] === 'nao_necessario');
      const newStatus = allDone ? 'concluido' : 'aguardando_producao';

      const { data, error } = await supabase
        .from('pedidos')
        .update({ acompanhamento_processos: acompanhamento as any, status: newStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Acompanhamento atualizado!');
      if (data?.orcamento_snapshot) notifyWebhook(data.orcamento_snapshot);
      emitWebhookEvent(data?.status === 'concluido' ? 'pedido.concluido' : 'pedido.atualizado', data);
    },
    onError: () => {
      toast.error('Erro ao atualizar acompanhamento');
    },
  });

  const deletePedido = useMutation({
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['pedidos'] });
      const previousPedidos = queryClient.getQueryData<Pedido[]>(['pedidos']);
      queryClient.setQueryData<Pedido[]>(['pedidos'], (current = []) =>
        current.filter((pedido) => pedido.id !== id)
      );
      return { previousPedidos };
    },
    mutationFn: async (id: string) => {
      // Limpa anexos dependentes (sem FK cascade) antes de excluir o pedido.
      try {
        const { data: anexos } = await supabase
          .from('pedido_anexos')
          .select('id, arquivo_url')
          .eq('pedido_id', id);

        const paths: string[] = [];
        (anexos || []).forEach((a: any) => {
          const url: string = a.arquivo_url || '';
          const marker = '/pedidos-anexos/';
          const idx = url.indexOf(marker);
          if (idx >= 0) paths.push(url.substring(idx + marker.length));
        });
        if (paths.length > 0) {
          await supabase.storage.from('pedidos-anexos').remove(paths);
        }
        await supabase.from('pedido_anexos').delete().eq('pedido_id', id);
      } catch (e) {
        console.warn('Falha ao limpar anexos do pedido (seguindo com exclusão):', e);
      }

      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      toast.success('Pedido excluído com sucesso');
    },
    onError: (error: any, _id, context) => {
      if (context?.previousPedidos) {
        queryClient.setQueryData(['pedidos'], context.previousPedidos);
      }
      console.error('Erro ao excluir pedido:', error);
      const msg = error?.message || error?.details || 'erro desconhecido';
      toast.error(`Erro ao excluir pedido: ${msg}`);
    },
  });

  const alterarPagamento = useMutation({
    mutationFn: async ({
      id,
      data_pagamento,
      condicoes_pagamento,
      valor_total,
    }: {
      id: string;
      data_pagamento: string | null;
      condicoes_pagamento: CondicoesPagamento;
      valor_total?: number;
    }) => {
      const { data: pedidoAtual, error: errFetch } = await supabase
        .from('pedidos')
        .select('id, orcamento_id, orcamento_snapshot, pagamento_alteracoes')
        .eq('id', id)
        .limit(1)
        .maybeSingle();
      if (errFetch || !pedidoAtual) throw errFetch || new Error('Pedido não encontrado');

      const snapAtual: any = pedidoAtual.orcamento_snapshot || {};
      const valorTotalAnterior = Number(snapAtual.valor_total) || 0;
      const valorTotalNovo = typeof valor_total === 'number' && valor_total > 0
        ? valor_total
        : valorTotalAnterior;

      const dataAnterior = snapAtual.data_pagamento || null;
      const condAnteriores: CondicoesPagamento | null = snapAtual.condicoes_pagamento || null;

      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email || null;

      const entrada: PagamentoAlteracao = {
        alterado_em: new Date().toISOString(),
        alterado_por: email,
        data_pagamento_anterior: dataAnterior,
        data_pagamento_nova: data_pagamento,
        condicoes_anteriores: condAnteriores,
        condicoes_novas: condicoes_pagamento,
        resumo_anterior: condAnteriores ? formatarPagamentoResumo(condAnteriores, valorTotalAnterior) : '',
        resumo_novo: formatarPagamentoResumo(condicoes_pagamento, valorTotalNovo),
      };

      const novoSnapshot = {
        ...snapAtual,
        data_pagamento,
        condicoes_pagamento,
        valor_total: valorTotalNovo,
      };
      const historico = [
        ...(((pedidoAtual as any).pagamento_alteracoes as PagamentoAlteracao[]) || []),
        entrada,
      ];

      const { error: errUpd } = await supabase
        .from('pedidos')
        .update({
          orcamento_snapshot: novoSnapshot as any,
          pagamento_alteracoes: historico as any,
        })
        .eq('id', id);
      if (errUpd) throw errUpd;

      // Mantém o orçamento original sincronizado para refletir no Dashboard/relatórios
      if (pedidoAtual.orcamento_id) {
        await supabase
          .from('orcamentos')
          .update({
            data_pagamento,
            condicoes_pagamento: condicoes_pagamento as any,
            valor_total: valorTotalNovo,
          })
          .eq('id', pedidoAtual.orcamento_id);
      }

      return { id, snapshot: novoSnapshot, alteracoes: historico };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success('Pagamento atualizado e registrado no histórico');
    },
    onError: (e: any) => {
      console.error('Erro ao alterar pagamento:', e);
      toast.error('Erro ao alterar pagamento');
    },
  });

  const toggleParcelaPaga = useMutation({
    mutationFn: async ({
      id,
      novasCondicoes,
    }: {
      id: string;
      novasCondicoes: CondicoesPagamento;
    }) => {
      const { data: atual, error: errFetch } = await supabase
        .from('pedidos')
        .select('id, orcamento_id, orcamento_snapshot')
        .eq('id', id)
        .limit(1)
        .maybeSingle();
      if (errFetch || !atual) throw errFetch || new Error('Pedido não encontrado');
      const snap: any = atual.orcamento_snapshot || {};
      const novo = { ...snap, condicoes_pagamento: novasCondicoes };
      const { error: errUpd } = await supabase
        .from('pedidos')
        .update({ orcamento_snapshot: novo as any })
        .eq('id', id);
      if (errUpd) throw errUpd;
      if (atual.orcamento_id) {
        await supabase
          .from('orcamentos')
          .update({ condicoes_pagamento: novasCondicoes as any })
          .eq('id', atual.orcamento_id);
      }
      return novo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success('Status da parcela atualizado');
    },
    onError: (e: any) => {
      console.error('Erro ao atualizar parcela:', e);
      toast.error('Erro ao atualizar parcela');
    },
  });

  const registrarVhsys = useMutation({
    mutationFn: async ({ pedidoId, entry }: { pedidoId: string; entry: HistoricoVhsysEntry }) => {
      const { data: atual, error: errFetch } = await supabase
        .from('pedidos')
        .select('historico_vhsys')
        .eq('id', pedidoId)
        .limit(1)
        .maybeSingle();
      if (errFetch) throw errFetch;
      const historico = [
        ...(((atual as any)?.historico_vhsys as HistoricoVhsysEntry[]) || []),
        entry,
      ];
      const { error: errUpd } = await supabase
        .from('pedidos')
        .update({ historico_vhsys: historico as any })
        .eq('id', pedidoId);
      if (errUpd) throw errUpd;
      return historico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
    onError: (e: any) => {
      console.error('Erro ao registrar histórico VhSys:', e);
    },
  });

  return {
    pedidos,
    loading: isLoading,
    createPedido: createPedido.mutateAsync,
    createPedidoFromOrcamento: createPedidoFromOrcamento.mutateAsync,
    updateStatus: updateStatus.mutate,
    updateObservacoes: updateObservacoes.mutateAsync,
    updateAcompanhamento: updateAcompanhamento.mutate,
    deletePedido: deletePedido.mutate,
    deletePedidoAsync: deletePedido.mutateAsync,
    deletandoPedido: deletePedido.isPending,
    alterarPagamento: alterarPagamento.mutateAsync,
    vincularPedidoCompra: vincularPedidoCompra.mutateAsync,
    toggleParcelaPagaAsync: toggleParcelaPaga.mutateAsync,
    registrarVhsysAsync: registrarVhsys.mutateAsync,
  };
};
