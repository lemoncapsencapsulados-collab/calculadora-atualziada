import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Orcamento, OrcamentoInsert, OrcamentoUpdate, OrcamentoSnapshot, ItemProducao, ServicoMarca, DadosCliente, DetalhamentoFrete, CondicoesPagamento, ContatoOrcamento } from '@/types/orcamento';
import { useToast } from '@/hooks/use-toast';

// Helper function to parse JSONB fields
function parseOrcamento(row: any): Orcamento {
  return {
    ...row,
    itens_producao: (row.itens_producao || []) as ItemProducao[],
    servicos_marca: (row.servicos_marca || []) as ServicoMarca[],
    dados_cliente: (row.dados_cliente || {}) as DadosCliente,
    detalhamento_frete: (row.detalhamento_frete || {}) as DetalhamentoFrete,
    condicoes_pagamento: row.condicoes_pagamento as CondicoesPagamento | undefined,
    historico_contatos: (row.historico_contatos || []) as ContatoOrcamento[],
  };
}

export function useOrcamentos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // List all orcamentos
  const { data: orcamentos, isLoading, error } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(parseOrcamento);
    },
  });

  // Get next orcamento number
  const getNextNumeroOrcamento = async (): Promise<string> => {
    const { data } = await supabase
      .from('orcamentos')
      .select('numero_orcamento')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNumber = data[0].numero_orcamento;
      const match = lastNumber.match(/ORC-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `ORC-${nextNum.toString().padStart(3, '0')}`;
      }
    }
    return 'ORC-001';
  };

  // Create orcamento
  const createOrcamento = useMutation({
    mutationFn: async (orcamento: OrcamentoInsert) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .insert([{
          ...orcamento,
          itens_producao: orcamento.itens_producao as any,
          servicos_marca: orcamento.servicos_marca as any,
          dados_cliente: orcamento.dados_cliente as any,
          detalhamento_frete: orcamento.detalhamento_frete as any,
          condicoes_pagamento: orcamento.condicoes_pagamento as any,
          intermediador: (orcamento.intermediador ?? null) as any,
          cliente_id: orcamento.cliente_id,
        }])
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Orçamento criado',
        description: 'O orçamento foi salvo com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update orcamento
  const updateOrcamento = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OrcamentoUpdate }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({
          ...updates,
          ...('intermediador' in updates ? { intermediador: (updates.intermediador ?? null) as any } : {}),
          itens_producao: updates.itens_producao as any,
          servicos_marca: updates.servicos_marca as any,
          dados_cliente: updates.dados_cliente as any,
          detalhamento_frete: updates.detalhamento_frete as any,
          condicoes_pagamento: updates.condicoes_pagamento as any,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedOrcamento = parseOrcamento(data);

      // Propagar alterações para pedidos vinculados
      try {
        const { data: pedidosVinculados } = await supabase
          .from('pedidos')
          .select('id')
          .eq('orcamento_id', id);

        if (pedidosVinculados && pedidosVinculados.length > 0) {
          const snapshot: OrcamentoSnapshot = {
            id: updatedOrcamento.id,
            numero_orcamento: updatedOrcamento.numero_orcamento,
            nome_cliente: updatedOrcamento.nome_cliente,
            consultor_responsavel: updatedOrcamento.consultor_responsavel,
            tipo_orcamento: updatedOrcamento.tipo_orcamento,
            itens_producao: updatedOrcamento.itens_producao,
            servicos_marca: updatedOrcamento.servicos_marca,
            dados_cliente: updatedOrcamento.dados_cliente,
            detalhamento_frete: updatedOrcamento.detalhamento_frete,
            condicoes_pagamento: updatedOrcamento.condicoes_pagamento,
            subtotal_producao: updatedOrcamento.subtotal_producao,
            subtotal_servicos: updatedOrcamento.subtotal_servicos,
            valor_total: updatedOrcamento.valor_total,
            data_pagamento: updatedOrcamento.data_pagamento || undefined,
            observacoes: updatedOrcamento.observacoes,
            updated_at: updatedOrcamento.updated_at,
          };

          for (const pedido of pedidosVinculados) {
            await supabase
              .from('pedidos')
              .update({ orcamento_snapshot: snapshot as any })
              .eq('id', pedido.id);
          }
        }
      } catch (syncError) {
        console.error('Erro ao sincronizar pedidos:', syncError);
      }

      return updatedOrcamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({
        title: 'Orçamento atualizado',
        description: 'As alterações foram salvas e propagadas para os pedidos vinculados.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete orcamento
  const deleteOrcamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('orcamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Orçamento excluído',
        description: 'O orçamento foi removido.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, data_pagamento, data_envio }: { id: string; status: Orcamento['status']; data_pagamento?: string; data_envio?: string | null }) => {
      const updateData: any = { status };
      if (data_pagamento !== undefined) {
        updateData.data_pagamento = data_pagamento;
      }
      if (data_envio !== undefined) {
        updateData.data_envio = data_envio;
      } else if (status === 'enviado') {
        // Auto-set data_envio se não foi setada manualmente
        updateData.data_envio = new Date().toISOString();
      }
      // Quando muda para "enviado", anexa item ao histórico (se ainda não houver envio na mesma data)
      if (status === 'enviado') {
        const { data: atual } = await supabase
          .from('orcamentos')
          .select('historico_contatos')
          .eq('id', id)
          .limit(1)
          .single();
        const hist = ((atual as any)?.historico_contatos || []) as ContatoOrcamento[];
        const novaData = updateData.data_envio || new Date().toISOString();
        const dia = novaData.slice(0, 10);
        const jaTem = hist.some(h => h.tipo === 'envio' && (h.data || '').slice(0, 10) === dia);
        if (!jaTem) {
          updateData.historico_contatos = [
            ...hist,
            { id: crypto.randomUUID(), data: novaData, tipo: 'envio', observacao: '' },
          ] as any;
        }
      }
      const { data, error } = await supabase
        .from('orcamentos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-kanban'] });
      toast({
        title: 'Status atualizado',
        description: 'O status do orçamento foi alterado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update observações internas
  const updateObservacoesInternas = useMutation({
    mutationFn: async ({ id, observacoes_internas }: { id: string; observacoes_internas: string }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ observacoes_internas } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-kanban'] });
      toast({ title: 'Observação salva', description: 'A observação interna foi atualizada.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao salvar observação', description: error.message, variant: 'destructive' });
    },
  });

  // Adicionar item ao histórico de contatos
  const addContato = useMutation({
    mutationFn: async ({ id, contato }: { id: string; contato: Omit<ContatoOrcamento, 'id'> }) => {
      const { data: atual } = await supabase
        .from('orcamentos')
        .select('historico_contatos')
        .eq('id', id)
        .limit(1)
        .single();
      const hist = ((atual as any)?.historico_contatos || []) as ContatoOrcamento[];
      const novo: ContatoOrcamento = { id: crypto.randomUUID(), ...contato };
      const novoHist = [...hist, novo];
      const updateData: any = { historico_contatos: novoHist };
      if (contato.tipo === 'envio') {
        updateData.data_envio = contato.data;
      }
      const { data, error } = await supabase
        .from('orcamentos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-kanban'] });
      toast({ title: 'Contato registrado', description: 'O histórico foi atualizado.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao registrar contato', description: error.message, variant: 'destructive' });
    },
  });

  const removeContato = useMutation({
    mutationFn: async ({ id, contatoId }: { id: string; contatoId: string }) => {
      const { data: atual } = await supabase
        .from('orcamentos')
        .select('historico_contatos')
        .eq('id', id)
        .limit(1)
        .single();
      const hist = ((atual as any)?.historico_contatos || []) as ContatoOrcamento[];
      const novoHist = hist.filter(h => h.id !== contatoId);
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ historico_contatos: novoHist } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos-kanban'] });
      toast({ title: 'Contato removido' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover contato', description: error.message, variant: 'destructive' });
    },
  });

  // Update dados cliente
  const updateDadosCliente = useMutation({
    mutationFn: async ({ id, dados_cliente }: { id: string; dados_cliente: DadosCliente }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ dados_cliente: dados_cliente as any })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Dados do cliente atualizados',
        description: 'As informações foram salvas.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar dados do cliente',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update detalhamento frete
  const updateDetalhamentoFrete = useMutation({
    mutationFn: async ({ id, detalhamento_frete }: { id: string; detalhamento_frete: DetalhamentoFrete }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ detalhamento_frete: detalhamento_frete as any })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Detalhamento de frete atualizado',
        description: 'As informações foram salvas.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar frete',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    orcamentos: orcamentos || [],
    isLoading,
    error,
    createOrcamento,
    updateOrcamento,
    deleteOrcamento,
    updateStatus,
    updateDadosCliente,
    updateDetalhamentoFrete,
    updateObservacoesInternas,
    addContato,
    removeContato,
    getNextNumeroOrcamento,
  };
}
