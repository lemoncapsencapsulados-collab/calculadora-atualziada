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
    return anexos.filter(a => a.pedido_id === pedidoId && (!tipo || a.tipo === tipo));
  }, [anexos]);

  const uploadAnexo = async (pedidoId: string, tipo: 'contrato' | 'comprovante', file: File) => {
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

  return { anexos, loading, getAnexosPorPedido, uploadAnexo, deleteAnexo, refetch: fetchAnexos };
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
