import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrcamentoPrazoItem {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  status: string;
  valor_total: number;
  preco_anterior_recalculo: number | null;
  updated_at: string;
}

export interface FormulaPrazoItem {
  id: string;
  nome_formula: string;
  cliente: string;
  tipo_produto: string;
  custo_total: number;
  updated_at: string;
}

export interface PrecificacaoPrazoItem {
  id: string;
  formula_id: string | null;
  preco_venda: number;
  preco_anterior_recalculo: number | null;
  updated_at: string;
}

export function usePrazoItens(prazoId?: string | null) {
  return useQuery({
    queryKey: ['prazo-itens', prazoId],
    enabled: !!prazoId,
    queryFn: async () => {
      const [orcRes, formRes, precRes] = await Promise.all([
        supabase
          .from('orcamentos')
          .select('id, numero_orcamento, nome_cliente, status, valor_total, preco_anterior_recalculo, updated_at')
          .eq('prazo_preco_id', prazoId!)
          .order('updated_at', { ascending: false }),
        supabase
          .from('formulas')
          .select('id, nome_formula, cliente, tipo_produto, custo_total, updated_at')
          .eq('prazo_preco_id', prazoId!)
          .order('updated_at', { ascending: false }),
        supabase
          .from('precificacoes')
          .select('id, formula_id, preco_venda, preco_anterior_recalculo, updated_at')
          .eq('prazo_preco_id', prazoId!)
          .order('updated_at', { ascending: false }),
      ]);
      return {
        orcamentos: (orcRes.data || []) as OrcamentoPrazoItem[],
        formulas: (formRes.data || []) as FormulaPrazoItem[],
        precificacoes: (precRes.data || []) as PrecificacaoPrazoItem[],
      };
    },
    refetchInterval: 60_000,
  });
}
