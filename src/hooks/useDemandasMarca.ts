import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ArquivoDemanda, DemandaMarca, DemandaMarcaInput, DemandaStatus } from '@/types/demandaMarca';

const BUCKET = 'demandas-marca';

export const useDemandasMarca = (pedidoId?: string | null) => {
  const queryClient = useQueryClient();

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas_marca', pedidoId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('demandas_marca').select('*').order('created_at', { ascending: false });
      if (pedidoId) query = query.eq('pedido_id', pedidoId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DemandaMarca[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['demandas_marca'] });
  };

  // Realtime: mantém as demandas sincronizadas entre abas/usuários
  useEffect(() => {
    const channel = supabase
      .channel(`demandas-marca-rt-${pedidoId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'demandas_marca' },
        () => queryClient.invalidateQueries({ queryKey: ['demandas_marca'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId, queryClient]);

  const criar = useMutation({
    mutationFn: async (input: DemandaMarcaInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('demandas_marca')
        .insert({
          ...input,
          arquivos: input.arquivos ?? [],
          created_by: userData?.user?.id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DemandaMarca;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Demanda criada com sucesso');
    },
    onError: (e: any) => toast.error('Erro ao criar demanda: ' + (e?.message || String(e))),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DemandaMarcaInput> & { status?: DemandaStatus }) => {
      const { data, error } = await supabase
        .from('demandas_marca')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DemandaMarca;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Demanda atualizada');
    },
    onError: (e: any) => toast.error('Erro ao atualizar demanda: ' + (e?.message || String(e))),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('demandas_marca').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Demanda removida');
    },
    onError: (e: any) => toast.error('Erro ao remover demanda: ' + (e?.message || String(e))),
  });

  /** Atualização em segundo plano (sincronização automática), sem toast */
  const atualizarSilencioso = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from('demandas_marca').update(patch as any).eq('id', id);
    if (error) {
      console.error('Erro ao sincronizar demanda:', error);
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ['demandas_marca'] });
    return true;
  };

  return {
    demandas,
    isLoading,
    criarDemanda: criar.mutateAsync,
    atualizarDemanda: atualizar.mutateAsync,
    removerDemanda: remover.mutateAsync,
    atualizarDemandaSilencioso: atualizarSilencioso,
    salvando: criar.isPending || atualizar.isPending,
  };
};

export async function uploadArquivoDemanda(
  pedidoId: string,
  categoria: ArquivoDemanda['categoria'],
  file: File,
): Promise<ArquivoDemanda> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${pedidoId}/${categoria}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, nome: file.name, categoria };
}

export async function getUrlArquivoDemanda(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function baixarArquivoDemanda(arquivo: ArquivoDemanda) {
  const url = await getUrlArquivoDemanda(arquivo.path);
  if (!url) {
    toast.error('Não foi possível gerar o link do arquivo.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.nome;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function removerArquivoDemanda(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
