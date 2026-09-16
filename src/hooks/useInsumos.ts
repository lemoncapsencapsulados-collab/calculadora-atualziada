import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MateriaPrima } from '@/types/formula';
import { useToast } from '@/hooks/use-toast';

export function useMateriasPrimas() {
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMateriasPrimas();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('materias-primas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materias_primas',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMateriasPrimas((prev) => [...prev, mapFromDB(payload.new)]);
            toast({
              title: 'Nova matéria-prima adicionada',
              description: `${payload.new.nome} foi adicionada ao inventário`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setMateriasPrimas((prev) =>
              prev.map((i) => (i.id === payload.new.id ? mapFromDB(payload.new) : i))
            );
          } else if (payload.eventType === 'DELETE') {
            setMateriasPrimas((prev) => prev.filter((i) => i.id !== payload.old.id));
            toast({
              title: 'Matéria-prima removida',
              description: 'Uma matéria-prima foi removida do inventário',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchMateriasPrimas = async () => {
    try {
      const { data, error } = await supabase
        .from('materias_primas')
        .select('*')
        .order('nome');

      if (error) throw error;

      setMateriasPrimas(data.map(mapFromDB));
    } catch (error) {
      console.error('Error fetching materias primas:', error);
      toast({
        title: 'Erro ao carregar matérias-primas',
        description: 'Não foi possível carregar as matérias-primas do banco de dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addMateriaPrima = async (mp: Omit<MateriaPrima, 'id'>) => {
    try {
      const { error } = await supabase.from('materias_primas').insert(mapToDB(mp));
      if (error) throw error;
      toast({
        title: 'Matéria-prima adicionada',
        description: `${mp.nome} foi adicionada com sucesso`,
      });
    } catch (error: any) {
      console.error('Error adding materia prima:', error);
      if (error.code === '23505') {
        toast({ title: 'Erro', description: 'Já existe uma matéria-prima com este nome', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao adicionar matéria-prima', description: error.message, variant: 'destructive' });
      }
      throw error;
    }
  };

  const updateMateriaPrima = async (id: string, updates: Partial<MateriaPrima>) => {
    try {
      const { error } = await supabase.from('materias_primas').update(mapToDB(updates)).eq('id', id);
      if (error) throw error;
      toast({ title: 'Matéria-prima atualizada', description: 'As alterações foram salvas com sucesso' });
    } catch (error: any) {
      console.error('Error updating materia prima:', error);
      toast({ title: 'Erro ao atualizar matéria-prima', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteMateriaPrima = async (id: string) => {
    try {
      const { error } = await supabase.from('materias_primas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Matéria-prima excluída', description: 'A matéria-prima foi removida do inventário' });
    } catch (error: any) {
      console.error('Error deleting materia prima:', error);
      toast({ title: 'Erro ao excluir matéria-prima', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  return {
    materiasPrimas,
    insumos: materiasPrimas,
    loading,
    addMateriaPrima,
    addInsumo: addMateriaPrima,
    updateMateriaPrima,
    updateInsumo: updateMateriaPrima,
    deleteMateriaPrima,
    deleteInsumo: deleteMateriaPrima,
    refreshMateriasPrimas: fetchMateriasPrimas,
    refreshInsumos: fetchMateriasPrimas,
  };
}

export const useInsumos = useMateriasPrimas;

function mapFromDB(db: any): MateriaPrima {
  return {
    id: db.id,
    nome: db.nome,
    unidade_compra: db.unidade_compra,
    preco_por_unidade_compra: Number(db.preco_compra),
    densidade: db.densidade ? Number(db.densidade) : undefined,
    fornecedor: db.fornecedor || undefined,
    categoria: db.categoria || undefined,
    observacoes: db.observacoes || undefined,
    updated_at: db.updated_at || undefined,
  };
}

function mapToDB(mp: any) {
  return {
    nome: mp.nome,
    unidade_compra: mp.unidade_compra,
    preco_compra: mp.preco_por_unidade_compra,
    densidade: mp.densidade || null,
    fornecedor: mp.fornecedor || null,
    categoria: mp.categoria || null,
    observacoes: mp.observacoes || null,
  };
}
