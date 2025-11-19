import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConfiguracaoCustos, MargemLucro } from '@/types/precificacao';
import { toast } from 'sonner';

export function useConfiguracaoCustos() {
  const queryClient = useQueryClient();

  // Buscar configuração ativa
  const { data: configuracaoAtiva, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['configuracao-custos-ativa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracao_custos')
        .select('*')
        .eq('ativa', true)
        .single();

      if (error) throw error;
      return data as ConfiguracaoCustos;
    },
  });

  // Buscar todas as configurações
  const { data: configuracoes, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['configuracoes-custos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracao_custos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConfiguracaoCustos[];
    },
  });

  // Buscar margens de lucro
  const { data: margens, isLoading: isLoadingMargens } = useQuery({
    queryKey: ['margens-lucro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('margens_lucro')
        .select('*');

      if (error) throw error;
      return data as MargemLucro[];
    },
  });

  // Atualizar configuração
  const updateConfiguracao = useMutation({
    mutationFn: async (config: Partial<ConfiguracaoCustos> & { id: string }) => {
      const { data, error } = await supabase
        .from('configuracao_custos')
        .update(config)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao-custos-ativa'] });
      queryClient.invalidateQueries({ queryKey: ['configuracoes-custos'] });
      toast.success('Configuração atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configuração: ' + error.message);
    },
  });

  // Criar nova configuração
  const createConfiguracao = useMutation({
    mutationFn: async (config: Omit<ConfiguracaoCustos, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('configuracao_custos')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-custos'] });
      toast.success('Configuração criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar configuração: ' + error.message);
    },
  });

  // Atualizar margem de lucro
  const updateMargem = useMutation({
    mutationFn: async (margem: Partial<MargemLucro> & { id: string }) => {
      const { data, error } = await supabase
        .from('margens_lucro')
        .update(margem)
        .eq('id', margem.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['margens-lucro'] });
      toast.success('Margem atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar margem: ' + error.message);
    },
  });

  // Verificar senha
  const verificarSenha = (senhaInformada: string): boolean => {
    if (!configuracaoAtiva) return false;
    return senhaInformada === configuracaoAtiva.senha_protecao;
  };

  return {
    configuracaoAtiva,
    configuracoes,
    margens,
    isLoading: isLoadingConfig || isLoadingConfigs || isLoadingMargens,
    updateConfiguracao,
    createConfiguracao,
    updateMargem,
    verificarSenha,
  };
}
