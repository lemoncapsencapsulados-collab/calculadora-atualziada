import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'zapvendas' | 'trafego';

/**
 * Verifica se o usuário logado tem um papel.
 *
 * A policy de `user_roles` só deixa cada usuário enxergar as próprias linhas,
 * então esta consulta devolve vazio para quem não tem o papel — sem erro.
 * É uma checagem de INTERFACE (esconder menu, evitar tela quebrada). Quem de
 * fato barra o acesso são o RLS das tabelas e a edge function `zapvendas`.
 */
export function useTemPapel(papel: AppRole) {
  const { data, isLoading } = useQuery({
    queryKey: ['tem-papel', papel],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao?.user?.id;
      if (!userId) return false;

      const { data: linhas, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', papel)
        .limit(1);

      // Na dúvida, negar: um erro aqui não pode virar acesso concedido.
      if (error) return false;
      return (linhas?.length ?? 0) > 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { temPapel: data === true, carregando: isLoading };
}
