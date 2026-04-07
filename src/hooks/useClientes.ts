import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  tipo_pessoa: string;
  razao_social?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  estado_civil?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  endereco_cnpj?: string;
  cep_cnpj?: string;
  cidade_cnpj?: string;
  estado_cnpj?: string;
  telefone_cnpj?: string;
  email_cnpj?: string;
  forma_venda?: string;
  responsavel_pj?: any;
  pessoas_fisicas?: any;
  dados_extras?: any;
  created_at?: string;
  updated_at?: string;
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;
export type ClienteUpdate = Partial<ClienteInsert>;

export function useClientes() {
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const criarCliente = useMutation({
    mutationFn: async (dados: ClienteInsert) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(dados)
        .select()
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao criar cliente: ' + error.message);
    },
  });

  const atualizarCliente = useMutation({
    mutationFn: async ({ id, ...dados }: ClienteUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('clientes')
        .update(dados)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
    },
  });

  const buscarClientes = async (termo: string): Promise<Cliente[]> => {
    if (!termo || termo.length < 2) return [];
    const termoLike = `%${termo}%`;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`nome.ilike.${termoLike},razao_social.ilike.${termoLike},telefone.ilike.${termoLike},cpf.ilike.${termoLike},cnpj.ilike.${termoLike}`)
      .order('nome')
      .limit(10);
    if (error) throw error;
    return data as Cliente[];
  };

  const buscarPorTelefone = async (telefone: string): Promise<Cliente | null> => {
    const telLimpo = telefone.replace(/\D/g, '');
    if (telLimpo.length < 10) return null;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .ilike('telefone', `%${telLimpo}%`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as Cliente | null;
  };

  const buscarPorId = async (id: string): Promise<Cliente | null> => {
    if (!id) return null;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Cliente | null;
  };

  return {
    clientes,
    isLoading,
    criarCliente,
    atualizarCliente,
    buscarClientes,
    buscarPorTelefone,
    buscarPorId,
  };
}
