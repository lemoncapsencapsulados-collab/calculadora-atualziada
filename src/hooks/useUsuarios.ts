import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Usuario {
  id: string;
  nome: string;
  cargo: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsuarioInsert {
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
}

export function useUsuarios(filtroAtivo: boolean = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['usuarios', filtroAtivo],
    queryFn: async () => {
      let q = supabase.from('usuarios' as any).select('*').order('nome');
      if (filtroAtivo) {
        q = q.eq('ativo', true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Usuario[];
    },
  });

  const criar = useMutation({
    mutationFn: async (usuario: UsuarioInsert) => {
      const { data, error } = await supabase
        .from('usuarios' as any)
        .insert(usuario as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Usuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar usuário'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<Usuario> & { id: string }) => {
      const { error } = await supabase
        .from('usuarios' as any)
        .update(dados as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário atualizado com sucesso');
    },
    onError: () => toast.error('Erro ao atualizar usuário'),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('usuarios' as any)
        .update({ ativo } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao alterar status'),
  });

  return { ...query, criar, atualizar, toggleAtivo };
}
