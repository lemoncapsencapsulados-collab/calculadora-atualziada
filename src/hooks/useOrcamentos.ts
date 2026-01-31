import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Orcamento, OrcamentoInsert, OrcamentoUpdate, ItemProducao, ServicoMarca } from '@/types/orcamento';
import { useToast } from '@/hooks/use-toast';

// Helper function to parse JSONB fields
function parseOrcamento(row: any): Orcamento {
  return {
    ...row,
    itens_producao: (row.itens_producao || []) as ItemProducao[],
    servicos_marca: (row.servicos_marca || []) as ServicoMarca[],
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
          itens_producao: updates.itens_producao as any,
          servicos_marca: updates.servicos_marca as any,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({
        title: 'Orçamento atualizado',
        description: 'As alterações foram salvas.',
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
    mutationFn: async ({ id, status }: { id: string; status: Orcamento['status'] }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return parseOrcamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
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

  return {
    orcamentos: orcamentos || [],
    isLoading,
    error,
    createOrcamento,
    updateOrcamento,
    deleteOrcamento,
    updateStatus,
    getNextNumeroOrcamento,
  };
}
