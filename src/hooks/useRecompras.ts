import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Recompra, RecompraProduto, MetricasRecorrencia } from '@/types/dashboard';

interface RecompraInsert {
  nome_cliente: string;
  consultor_responsavel: string;
  data_recompra: string;
  produtos: RecompraProduto[];
  quantidade_total: number;
  valor_total: number;
  observacao?: string;
}

export function useRecompras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recompras = [], isLoading } = useQuery({
    queryKey: ['recompras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recompras')
        .select('*')
        .order('data_recompra', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(r => ({
        ...r,
        produtos: (Array.isArray(r.produtos) ? r.produtos : []) as unknown as RecompraProduto[]
      })) as Recompra[];
    }
  });

  const adicionarRecompra = useMutation({
    mutationFn: async (novaRecompra: RecompraInsert) => {
      const { data, error } = await supabase
        .from('recompras')
        .insert([{
          nome_cliente: novaRecompra.nome_cliente,
          consultor_responsavel: novaRecompra.consultor_responsavel,
          data_recompra: novaRecompra.data_recompra,
          produtos: JSON.parse(JSON.stringify(novaRecompra.produtos)),
          quantidade_total: novaRecompra.quantidade_total,
          valor_total: novaRecompra.valor_total,
          observacao: novaRecompra.observacao
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recompras'] });
      toast({
        title: 'Recompra registrada',
        description: 'A venda recorrente foi registrada com sucesso.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao registrar recompra',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const excluirRecompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recompras')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recompras'] });
      toast({
        title: 'Recompra excluída',
        description: 'O registro foi removido com sucesso.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const calcularMetricas = (faturamentoVendas: number): MetricasRecorrencia => {
    const totalRecompras = recompras.reduce((acc, r) => acc + Number(r.valor_total), 0);
    const clientesUnicos = new Set(recompras.map(r => r.nome_cliente)).size;
    const totalGeral = faturamentoVendas + totalRecompras;
    
    return {
      totalRecompras,
      percentualRecorrente: totalGeral > 0 ? (totalRecompras / totalGeral) * 100 : 0,
      clientesRecorrentes: clientesUnicos,
      ticketMedioRecompra: recompras.length > 0 ? totalRecompras / recompras.length : 0
    };
  };

  const clientesUnicos = Array.from(new Set(recompras.map(r => r.nome_cliente))).sort();
  
  const consultoresUnicos = Array.from(new Set(recompras.map(r => r.consultor_responsavel))).sort();

  return {
    recompras,
    isLoading,
    adicionarRecompra,
    excluirRecompra,
    calcularMetricas,
    clientesUnicos,
    consultoresUnicos
  };
}
