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
  cargo?: string;
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
      const payload = { ...usuario, cargo: usuario.cargo?.trim() || 'Consultor' };
      // Verifica duplicidade por nome (case-insensitive) ou telefone
      const nomeNorm = payload.nome.trim().toLowerCase();
      const telNorm = (payload.telefone || '').replace(/\D/g, '');
      const { data: existentes } = await supabase
        .from('usuarios' as any)
        .select('id, nome, telefone');
      const dup = (existentes as any[] | null)?.find((u) => {
        const mesmoNome = u.nome?.trim().toLowerCase() === nomeNorm;
        const mesmoTel = telNorm && (u.telefone || '').replace(/\D/g, '') === telNorm;
        return mesmoNome || mesmoTel;
      });
      if (dup) {
        throw new Error(
          dup.nome?.trim().toLowerCase() === nomeNorm
            ? `Já existe um consultor com o nome "${dup.nome}"`
            : `Já existe um consultor com o telefone "${dup.telefone}" (${dup.nome})`
        );
      }
      const { data, error } = await supabase
        .from('usuarios' as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Usuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário criado com sucesso');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao criar usuário'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<Usuario> & { id: string }) => {
      if (dados.nome || dados.telefone) {
        const nomeNorm = dados.nome?.trim().toLowerCase();
        const telNorm = (dados.telefone || '').replace(/\D/g, '');
        const { data: existentes } = await supabase
          .from('usuarios' as any)
          .select('id, nome, telefone')
          .neq('id', id);
        const dup = (existentes as any[] | null)?.find((u) => {
          const mesmoNome = nomeNorm && u.nome?.trim().toLowerCase() === nomeNorm;
          const mesmoTel = telNorm && (u.telefone || '').replace(/\D/g, '') === telNorm;
          return mesmoNome || mesmoTel;
        });
        if (dup) {
          throw new Error(
            nomeNorm && dup.nome?.trim().toLowerCase() === nomeNorm
              ? `Já existe um consultor com o nome "${dup.nome}"`
              : `Já existe um consultor com o telefone "${dup.telefone}" (${dup.nome})`
          );
        }
      }
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
    onError: (err: any) => toast.error(err?.message || 'Erro ao atualizar usuário'),
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

export interface ConsultorUso {
  orcamentos: number;
  pedidos: number;
  recompras: number;
  total: number;
}

export function useConsultoresUso() {
  return useQuery({
    queryKey: ['consultores-uso'],
    queryFn: async () => {
      const [orc, ped, rec] = await Promise.all([
        supabase.from('orcamentos').select('consultor_responsavel'),
        supabase.from('pedidos').select('orcamento_snapshot'),
        supabase.from('recompras').select('consultor_responsavel'),
      ]);
      const map = new Map<string, ConsultorUso>();
      const bump = (nome: string | null | undefined, key: keyof ConsultorUso) => {
        if (!nome) return;
        const k = nome.trim().toLowerCase();
        if (!k) return;
        const cur = map.get(k) || { orcamentos: 0, pedidos: 0, recompras: 0, total: 0 };
        (cur as any)[key]++;
        cur.total++;
        map.set(k, cur);
      };
      (orc.data || []).forEach((r: any) => bump(r.consultor_responsavel, 'orcamentos'));
      (ped.data || []).forEach((r: any) =>
        bump(r.orcamento_snapshot?.consultor_responsavel, 'pedidos')
      );
      (rec.data || []).forEach((r: any) => bump(r.consultor_responsavel, 'recompras'));
      return map;
    },
  });
}
