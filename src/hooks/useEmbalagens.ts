import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Embalagem } from '@/types/formula';
import { useToast } from '@/hooks/use-toast';

export function useEmbalagens() {
  const [embalagens, setEmbalagens] = useState<Embalagem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmbalagens();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('embalagens-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'embalagens',
        },
        (payload) => {
          console.log('Embalagem change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setEmbalagens((prev) => [...prev, mapEmbalagemFromDB(payload.new)]);
            toast({
              title: 'Nova embalagem adicionada',
              description: `${payload.new.nome} foi adicionada ao inventário`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setEmbalagens((prev) =>
              prev.map((e) => (e.id === payload.new.id ? mapEmbalagemFromDB(payload.new) : e))
            );
          } else if (payload.eventType === 'DELETE') {
            setEmbalagens((prev) => prev.filter((e) => e.id !== payload.old.id));
            toast({
              title: 'Embalagem removida',
              description: 'Uma embalagem foi removida do inventário',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchEmbalagens = async () => {
    try {
      const { data, error } = await supabase
        .from('embalagens')
        .select('*')
        .order('nome');

      if (error) throw error;

      setEmbalagens(data.map(mapEmbalagemFromDB));
    } catch (error) {
      console.error('Error fetching embalagens:', error);
      toast({
        title: 'Erro ao carregar embalagens',
        description: 'Não foi possível carregar as embalagens do banco de dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addEmbalagem = async (embalagem: Omit<Embalagem, 'id'>) => {
    try {
      const { error } = await supabase.from('embalagens').insert(mapEmbalagemToDB(embalagem));

      if (error) throw error;

      toast({
        title: 'Embalagem adicionada',
        description: `${embalagem.nome} foi adicionada com sucesso`,
      });
    } catch (error: any) {
      console.error('Error adding embalagem:', error);
      
      if (error.code === '23505') {
        toast({
          title: 'Erro',
          description: 'Já existe uma embalagem com este nome',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao adicionar embalagem',
          description: error.message,
          variant: 'destructive',
        });
      }
      throw error;
    }
  };

  const updateEmbalagem = async (id: string, updates: Partial<Embalagem>) => {
    try {
      const { error } = await supabase
        .from('embalagens')
        .update(mapEmbalagemToDB(updates))
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Embalagem atualizada',
        description: 'As alterações foram salvas com sucesso',
      });
    } catch (error: any) {
      console.error('Error updating embalagem:', error);
      toast({
        title: 'Erro ao atualizar embalagem',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteEmbalagem = async (id: string) => {
    try {
      const { error } = await supabase.from('embalagens').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Embalagem excluída',
        description: 'A embalagem foi removida do inventário',
      });
    } catch (error: any) {
      console.error('Error deleting embalagem:', error);
      toast({
        title: 'Erro ao excluir embalagem',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    embalagens,
    loading,
    addEmbalagem,
    updateEmbalagem,
    deleteEmbalagem,
    refreshEmbalagens: fetchEmbalagens,
  };
}

function mapEmbalagemFromDB(dbEmbalagem: any): Embalagem {
  return {
    id: dbEmbalagem.id,
    nome: dbEmbalagem.nome,
    descricao: dbEmbalagem.descricao,
    preco_unitario: Number(dbEmbalagem.preco_unitario),
    categoria: dbEmbalagem.categoria || undefined,
    subcategoria: dbEmbalagem.subcategoria || undefined,
    fornecedor: dbEmbalagem.fornecedor || undefined,
    updated_at: dbEmbalagem.updated_at || undefined,
  };
}

function mapEmbalagemToDB(embalagem: any) {
  return {
    nome: embalagem.nome,
    descricao: embalagem.descricao,
    preco_unitario: embalagem.preco_unitario,
    categoria: embalagem.categoria || null,
    subcategoria: embalagem.subcategoria || null,
    fornecedor: embalagem.fornecedor || null,
  };
}
