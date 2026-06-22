import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SetupPlanoPerfil = 'novo_produtor' | 'produtor_experiente';

export interface SetupPlano {
  id: string;
  perfil: SetupPlanoPerfil;
  nome: string;
  preco_fixo: number;
  descricao_curta: string | null;
  entregaveis_md: string;
  ativo: boolean;
  ordem: number;
}

export function useSetupPlanos(perfil?: SetupPlanoPerfil | null) {
  return useQuery({
    queryKey: ['setup_planos', perfil ?? 'all'],
    queryFn: async (): Promise<SetupPlano[]> => {
      let q = supabase
        .from('setup_planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (perfil) q = q.eq('perfil', perfil);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: perfil !== undefined,
  });
}

// Quebra o markdown de entregaveis em linhas de bullets (sem o "- " inicial)
export function parseEntregaveisMd(md: string): string[] {
  if (!md) return [];
  return md
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-*]\s+/, ''));
}
