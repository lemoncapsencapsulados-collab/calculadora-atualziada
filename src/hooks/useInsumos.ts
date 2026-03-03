import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Insumo } from '@/types/formula';
import { useToast } from '@/hooks/use-toast';

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar insumos iniciais
  useEffect(() => {
    fetchInsumos();
  }, []);

  // Configurar realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('insumos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'insumos',
        },
        (payload) => {
          console.log('Insumo change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setInsumos((prev) => [...prev, mapInsumoFromDB(payload.new)]);
            toast({
              title: 'Novo insumo adicionado',
              description: `${payload.new.nome} foi adicionado ao inventário`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setInsumos((prev) =>
              prev.map((i) => (i.id === payload.new.id ? mapInsumoFromDB(payload.new) : i))
            );
          } else if (payload.eventType === 'DELETE') {
            setInsumos((prev) => prev.filter((i) => i.id !== payload.old.id));
            toast({
              title: 'Insumo removido',
              description: 'Um insumo foi removido do inventário',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchInsumos = async () => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');

      if (error) throw error;

      setInsumos(data.map(mapInsumoFromDB));
    } catch (error) {
      console.error('Error fetching insumos:', error);
      toast({
        title: 'Erro ao carregar insumos',
        description: 'Não foi possível carregar os insumos do banco de dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addInsumo = async (insumo: Omit<Insumo, 'id'>) => {
    try {
      const { error } = await supabase.from('insumos').insert(mapInsumoToDB(insumo));

      if (error) throw error;

      toast({
        title: 'Insumo adicionado',
        description: `${insumo.nome} foi adicionado com sucesso`,
      });
    } catch (error: any) {
      console.error('Error adding insumo:', error);
      
      if (error.code === '23505') {
        toast({
          title: 'Erro',
          description: 'Já existe um insumo com este nome',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao adicionar insumo',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  };

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .update(mapInsumoToDB(updates))
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Insumo atualizado',
        description: 'As alterações foram salvas com sucesso',
      });
    } catch (error: any) {
      console.error('Error updating insumo:', error);
      toast({
        title: 'Erro ao atualizar insumo',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteInsumo = async (id: string) => {
    try {
      const { error } = await supabase.from('insumos').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Insumo excluído',
        description: 'O insumo foi removido do inventário',
      });
    } catch (error: any) {
      console.error('Error deleting insumo:', error);
      toast({
        title: 'Erro ao excluir insumo',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    insumos,
    loading,
    addInsumo,
    updateInsumo,
    deleteInsumo,
    refreshInsumos: fetchInsumos,
  };
}

function mapInsumoFromDB(dbInsumo: any): Insumo {
  return {
    id: dbInsumo.id,
    nome: dbInsumo.nome,
    unidade_compra: dbInsumo.unidade_compra,
    preco_por_unidade_compra: Number(dbInsumo.preco_compra),
    densidade: dbInsumo.densidade ? Number(dbInsumo.densidade) : undefined,
    fornecedor: dbInsumo.fornecedor || undefined,
    categoria: dbInsumo.categoria || undefined,
    observacoes: dbInsumo.observacoes || undefined,
    updated_at: dbInsumo.updated_at || undefined,
  };
}

function mapInsumoToDB(insumo: any) {
  return {
    nome: insumo.nome,
    unidade_compra: insumo.unidade_compra,
    preco_compra: insumo.preco_por_unidade_compra,
    densidade: insumo.densidade || null,
    fornecedor: insumo.fornecedor || null,
    categoria: insumo.categoria || null,
    observacoes: insumo.observacoes || null,
  };
}
