import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PrazoPreco {
  id: string;
  historico_id: string | null;
  configuracao_id: string | null;
  snapshot: Record<string, any>;
  data_inicio: string;
  data_fim: string;
  aplicado: boolean;
  aplicado_em: string | null;
  orcamentos_recalculados: number;
  precificacoes_recalculadas: number;
  created_at: string;
}

export function calcDiasRestantes(dataFim: string): number {
  const fim = new Date(dataFim).getTime();
  const agora = Date.now();
  return Math.ceil((fim - agora) / (1000 * 60 * 60 * 24));
}

export function usePrazoPrecoAtivo(prazoId?: string | null) {
  const { data: prazo } = useQuery({
    queryKey: ['prazo-preco', prazoId],
    enabled: !!prazoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prazo_precos' as any)
        .select('*')
        .eq('id', prazoId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PrazoPreco | null;
    },
  });

  if (!prazo) return { prazo: null, diasRestantes: 0, vencido: false, ativo: false };

  const diasRestantes = calcDiasRestantes(prazo.data_fim);
  const vencido = diasRestantes <= 0;
  const ativo = !prazo.aplicado && !vencido;

  return { prazo, diasRestantes, vencido, ativo };
}

export function usePrazosAtivos() {
  return useQuery({
    queryKey: ['prazos-precos-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prazo_precos' as any)
        .select('*')
        .eq('aplicado', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PrazoPreco[];
    },
    refetchInterval: 60_000,
  });
}
