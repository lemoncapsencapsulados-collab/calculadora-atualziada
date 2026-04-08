import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pedido, AcompanhamentoProcessos } from '@/types/formula';
import { Orcamento, OrcamentoSnapshot } from '@/types/orcamento';
import { useEffect, useRef, useCallback } from 'react';

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

export const usePedidos = () => {
  const queryClient = useQueryClient();
  const syncDone = useRef(false);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos'],
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
        created_at: new Date(p.created_at),
        updated_at: new Date(p.updated_at),
      })) as Pedido[];
    },
  });

  // Sync: ensure all paid orcamentos have corresponding pedidos with full snapshots
  useEffect(() => {
    if (syncDone.current || isLoading) return;
    syncDone.current = true;

    (async () => {
      try {
        const { data: orcamentosPagos, error: errOrc } = await supabase
          .from('orcamentos')
          .select('*')
          .eq('status', 'pago');
        if (errOrc || !orcamentosPagos?.length) return;

        const { data: allPedidos, error: errPed } = await supabase
          .from('pedidos')
          .select('id, orcamento_id, orcamento_snapshot');
        if (errPed) return;

        const pedidosByOrcId = new Map<string, any>();
        (allPedidos || []).forEach(p => {
          if (p.orcamento_id) pedidosByOrcId.set(p.orcamento_id, p);
        });

        // Get next pedido number (robust: scans all PED-* numbers)
        const nextPedStr = await getNextPedNumber();
        let nextNum = parseInt(nextPedStr.match(/PED-(\d+)/)![1], 10);

        const toInsert: any[] = [];
        const toUpdate: { id: string; snapshot: any }[] = [];

        for (const orc of orcamentosPagos) {
          const snapshot = buildSnapshotFromOrcamento(orc);
          const existing = pedidosByOrcId.get(orc.id);

          if (existing) {
            // Update snapshot with full data
            toUpdate.push({ id: existing.id, snapshot });
          } else {
            // Create new pedido
            const totalQtd = (orc.itens_producao as any[] || []).reduce(
              (sum: number, item: any) => sum + (item.quantidade || 1), 0
            );
            toInsert.push({
              orcamento_id: orc.id,
              orcamento_snapshot: snapshot as any,
              numero_pedido: `PED-${nextNum.toString().padStart(3, '0')}`,
              data_pedido: new Date().toISOString(),
              data_entrega: orc.data_pagamento || new Date().toISOString(),
              quantidade_produto: totalQtd,
              unidade_produto: 'potes',
              status: 'aguardando_producao',
              formula_id: null,
              formula_snapshot: null,
              observacoes: orc.observacoes || null,
            });
            nextNum++;
          }
        }

        // Batch updates
        for (const u of toUpdate) {
          await supabase
            .from('pedidos')
            .update({ orcamento_snapshot: u.snapshot as any })
            .eq('id', u.id);
        }

        // Batch inserts
        if (toInsert.length > 0) {
          await supabase.from('pedidos').insert(toInsert);
        }

        if (toInsert.length > 0 || toUpdate.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          console.log(`Sync: ${toInsert.length} pedidos criados, ${toUpdate.length} atualizados`);
        }
      } catch (err) {
        console.error('Erro no sync de pedidos:', err);
      }
    })();
  }, [isLoading, queryClient]);

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

      const nextNum = await getNextPedNumber();
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

  const deletePedido = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Pedido excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir pedido');
    },
  });

  return {
    pedidos,
    loading: isLoading,
    createPedido: createPedido.mutateAsync,
    createPedidoFromOrcamento: createPedidoFromOrcamento.mutateAsync,
    updateStatus: updateStatus.mutate,
    updateObservacoes: updateObservacoes.mutateAsync,
    deletePedido: deletePedido.mutate,
  };
};
