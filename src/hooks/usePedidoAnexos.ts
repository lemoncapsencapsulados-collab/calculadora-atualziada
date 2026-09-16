import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PedidoAnexo {
  id: string;
  pedido_id: string;
  tipo: 'contrato' | 'comprovante';
  arquivo_url: string;
  arquivo_nome: string;
  created_at: string;
  ordem?: number | null;
}

// Limites e tipos aceitos
export const ANEXO_LIMITES = {
  contrato: {
    maxBytes: 15 * 1024 * 1024, // 15 MB
    extensoes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
  },
  comprovante: {
    maxBytes: 8 * 1024 * 1024, // 8 MB
    extensoes: ['pdf', 'jpg', 'jpeg', 'png'],
  },
} as const;

function getExt(nome: string) {
  const m = nome.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validarArquivoAnexo(tipo: 'contrato' | 'comprovante', file: File): string | null {
  const limites = ANEXO_LIMITES[tipo];
  const ext = getExt(file.name);
  if (!limites.extensoes.includes(ext as any)) {
    return `Formato inválido. Aceitos: ${limites.extensoes.join(', ').toUpperCase()}.`;
  }
  if (file.size > limites.maxBytes) {
    return `Arquivo muito grande (${formatBytes(file.size)}). Máximo: ${formatBytes(limites.maxBytes)}.`;
  }
  if (file.size === 0) {
    return 'Arquivo vazio.';
  }
  return null;
}

export function usePedidoAnexos(pedidoIds: string[]) {
  const [anexos, setAnexos] = useState<PedidoAnexo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAnexos = useCallback(async () => {
    if (!pedidoIds.length) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pedido_anexos' as any)
      .select('*')
      .in('pedido_id', pedidoIds);
    if (error) {
      console.error('Erro ao buscar anexos:', error);
    } else {
      setAnexos((data as any[]) || []);
    }
    setLoading(false);
  }, [pedidoIds.join(',')]);

  useEffect(() => { fetchAnexos(); }, [fetchAnexos]);

  const getAnexosPorPedido = useCallback((pedidoId: string, tipo?: 'contrato' | 'comprovante') => {
    return anexos
      .filter(a => a.pedido_id === pedidoId && (!tipo || a.tipo === tipo))
      .sort((a, b) => {
        // ordem manual primeiro (asc); itens sem ordem vão para o fim ordenados por data desc
        const aHas = a.ordem != null;
        const bHas = b.ordem != null;
        if (aHas && bHas) return (a.ordem as number) - (b.ordem as number);
        if (aHas) return -1;
        if (bHas) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [anexos]);

  const uploadAnexo = async (pedidoId: string, tipo: 'contrato' | 'comprovante', file: File) => {
    const erro = validarArquivoAnexo(tipo, file);
    if (erro) {
      toast.error(erro);
      return;
    }
    const filePath = `${pedidoId}/${tipo}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('pedidos-anexos')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Erro ao fazer upload: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('pedidos-anexos')
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase
      .from('pedido_anexos' as any)
      .insert({
        pedido_id: pedidoId,
        tipo,
        arquivo_url: urlData.publicUrl,
        arquivo_nome: file.name,
      });

    if (insertError) {
      toast.error('Erro ao salvar anexo: ' + insertError.message);
      return;
    }

    toast.success(tipo === 'contrato' ? 'Contrato anexado!' : 'Comprovante anexado!');
    await fetchAnexos();
  };

  const reordenarAnexos = async (
    pedidoId: string,
    tipo: 'contrato' | 'comprovante',
    novaOrdemIds: string[],
  ) => {
    // atualização otimista
    setAnexos(prev => prev.map(a => {
      if (a.pedido_id !== pedidoId || a.tipo !== tipo) return a;
      const idx = novaOrdemIds.indexOf(a.id);
      return idx >= 0 ? { ...a, ordem: idx } : a;
    }));
    // persiste
    await Promise.all(
      novaOrdemIds.map((id, idx) =>
        supabase.from('pedido_anexos' as any).update({ ordem: idx }).eq('id', id)
      )
    );
    await fetchAnexos();
  };

  const deleteAnexo = async (anexo: PedidoAnexo) => {
    // Extract storage path from URL
    const urlParts = anexo.arquivo_url.split('/pedidos-anexos/');
    if (urlParts[1]) {
      await supabase.storage.from('pedidos-anexos').remove([decodeURIComponent(urlParts[1])]);
    }

    await supabase.from('pedido_anexos' as any).delete().eq('id', anexo.id);
    toast.success('Anexo removido!');
    await fetchAnexos();
  };

  return { anexos, loading, getAnexosPorPedido, uploadAnexo, deleteAnexo, reordenarAnexos, refetch: fetchAnexos };
}

export async function downloadAnexo(anexo: PedidoAnexo) {
  try {
    const res = await fetch(anexo.arquivo_url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = anexo.arquivo_nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e: any) {
    toast.error('Erro ao baixar arquivo: ' + (e?.message || ''));
  }
}
