import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lote } from '@/types/formula';
import { toast } from 'sonner';

export function useLotes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLotes(data.map(mapLoteFromDB));
    } catch (error) {
      console.error('Error fetching lotes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLotes(); }, [fetchLotes]);

  useEffect(() => {
    const channel = supabase
      .channel('lotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes' }, () => {
        fetchLotes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLotes]);

  const getLotesForItem = useCallback((itemId: string, itemTipo: 'materia_prima' | 'embalagem') => {
    return lotes.filter(l => l.item_id === itemId && l.item_tipo === itemTipo);
  }, [lotes]);

  const getCustoMedioPonderado = useCallback((itemId: string, itemTipo: 'materia_prima' | 'embalagem') => {
    const itemLotes = lotes.filter(l => l.item_id === itemId && l.item_tipo === itemTipo && l.quantidade > 0);
    if (itemLotes.length === 0) return null;
    const totalQtd = itemLotes.reduce((sum, l) => sum + l.quantidade, 0);
    const totalCusto = itemLotes.reduce((sum, l) => sum + l.quantidade * l.custo_unitario, 0);
    return totalCusto / totalQtd;
  }, [lotes]);

  const addLote = async (lote: Omit<Lote, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase.from('lotes').insert({
        item_id: lote.item_id,
        item_tipo: lote.item_tipo,
        codigo: lote.codigo || null,
        quantidade: lote.quantidade,
        validade: lote.validade || null,
        custo_unitario: lote.custo_unitario,
        fornecedor: lote.fornecedor || null,
        observacoes: lote.observacoes || null,
      });
      if (error) throw error;
      toast.success('Lote adicionado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao adicionar lote: ' + error.message);
      throw error;
    }
  };

  const updateLote = async (id: string, updates: Partial<Lote>) => {
    try {
      const dbUpdates: any = {};
      if (updates.codigo !== undefined) dbUpdates.codigo = updates.codigo || null;
      if (updates.quantidade !== undefined) dbUpdates.quantidade = updates.quantidade;
      if (updates.validade !== undefined) dbUpdates.validade = updates.validade || null;
      if (updates.custo_unitario !== undefined) dbUpdates.custo_unitario = updates.custo_unitario;
      if (updates.fornecedor !== undefined) dbUpdates.fornecedor = updates.fornecedor || null;
      if (updates.observacoes !== undefined) dbUpdates.observacoes = updates.observacoes || null;

      const { error } = await supabase.from('lotes').update(dbUpdates).eq('id', id);
      if (error) throw error;
      toast.success('Lote atualizado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao atualizar lote: ' + error.message);
      throw error;
    }
  };

  const deleteLote = async (id: string) => {
    try {
      const { error } = await supabase.from('lotes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Lote removido com sucesso');
    } catch (error: any) {
      toast.error('Erro ao remover lote: ' + error.message);
      throw error;
    }
  };

  return { lotes, loading, getLotesForItem, getCustoMedioPonderado, addLote, updateLote, deleteLote, refreshLotes: fetchLotes };
}

function mapLoteFromDB(db: any): Lote {
  return {
    id: db.id,
    item_id: db.item_id,
    item_tipo: db.item_tipo,
    quantidade: Number(db.quantidade),
    validade: db.validade || undefined,
    custo_unitario: Number(db.custo_unitario),
    fornecedor: db.fornecedor || undefined,
    observacoes: db.observacoes || undefined,
    created_at: db.created_at,
    updated_at: db.updated_at,
  };
}
