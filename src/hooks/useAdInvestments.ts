import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdInvestmentConsultor {
  id?: string;
  ad_investment_id?: string;
  consultor_id: string | null;
  consultor_nome_snapshot: string;
  leads_recebidos: number;
  investimento_direcionado: number;
}

export interface AdInvestment {
  id: string;
  canal: string;
  data_inicio: string;
  data_fim: string;
  investimento_total: number;
  objetivo_campanha: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  consultores: AdInvestmentConsultor[];
}

export interface AdInvestmentInput {
  id?: string;
  canal: string;
  data_inicio: string;
  data_fim: string;
  investimento_total: number;
  objetivo_campanha: string;
  observacoes?: string | null;
  consultores: AdInvestmentConsultor[];
}

export function useAdInvestments() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ad_investments'],
    queryFn: async () => {
      const { data: invs, error } = await supabase
        .from('ad_investments' as any)
        .select('*')
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      const ids = ((invs as any[]) || []).map((i) => i.id);
      let consultores: any[] = [];
      if (ids.length > 0) {
        const { data: cons, error: e2 } = await supabase
          .from('ad_investment_consultores' as any)
          .select('*')
          .in('ad_investment_id', ids);
        if (e2) throw e2;
        consultores = cons || [];
      }
      return ((invs as any[]) || []).map((i) => ({
        ...i,
        investimento_total: Number(i.investimento_total) || 0,
        consultores: consultores
          .filter((c) => c.ad_investment_id === i.id)
          .map((c) => ({
            id: c.id,
            ad_investment_id: c.ad_investment_id,
            consultor_id: c.consultor_id,
            consultor_nome_snapshot: c.consultor_nome_snapshot,
            leads_recebidos: Number(c.leads_recebidos) || 0,
            investimento_direcionado: Number(c.investimento_direcionado) || 0,
          })),
      })) as AdInvestment[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: AdInvestmentInput) => {
      const payload = {
        canal: input.canal,
        data_inicio: input.data_inicio,
        data_fim: input.data_fim,
        investimento_total: input.investimento_total,
        objetivo_campanha: input.objetivo_campanha,
        observacoes: input.observacoes || null,
      };
      let id = input.id;
      if (id) {
        const { error } = await supabase
          .from('ad_investments' as any)
          .update(payload as any)
          .eq('id', id);
        if (error) throw error;
        await supabase.from('ad_investment_consultores' as any).delete().eq('ad_investment_id', id);
      } else {
        const { data, error } = await supabase
          .from('ad_investments' as any)
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        id = (data as any).id;
      }
      const rows = input.consultores
        .filter((c) => c.leads_recebidos > 0 || c.investimento_direcionado > 0)
        .map((c) => ({
          ad_investment_id: id,
          consultor_id: c.consultor_id,
          consultor_nome_snapshot: c.consultor_nome_snapshot,
          leads_recebidos: c.leads_recebidos,
          investimento_direcionado: c.investimento_direcionado,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from('ad_investment_consultores' as any).insert(rows as any);
        if (error) throw error;
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ad_investments'] });
      toast.success('Registro salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ad_investments' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ad_investments'] });
      toast.success('Registro excluído');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
  });

  return { ...query, salvar, excluir };
}
