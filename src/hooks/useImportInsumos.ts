import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InsumoImport {
  nome: string;
  segmento?: string;
  preco_por_kg: number;
}

export interface ImportResult {
  nome_original: string;
  normalized_name: string;
  acao: 'criado' | 'atualizado' | 'erro';
  id?: string;
  preco_convertido?: number;
  unidade_compra?: string;
  erro?: string;
  alias_aplicado?: string;
}

export interface ImportResponse {
  resultado: ImportResult[];
  resumo: {
    atualizados: number;
    criados: number;
    ignorados: number;
    alertas: string[];
  };
}

export function useImportInsumos() {
  const { toast } = useToast();

  const importInsumos = async (itens: InsumoImport[]): Promise<ImportResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('import-insumos', {
        body: { itens },
      });

      if (error) throw error;

      // Mostrar toast de sucesso
      toast({
        title: 'Importação concluída',
        description: `${data.resumo.criados} criados, ${data.resumo.atualizados} atualizados`,
      });

      return data;
    } catch (error: any) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: error.message || 'Não foi possível importar os insumos',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return { importInsumos };
}
