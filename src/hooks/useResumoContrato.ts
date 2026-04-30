import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Orcamento, DadosCliente, DetalhamentoFrete, CondicoesPagamento } from '@/types/orcamento';
import { toast } from 'sonner';

export interface ResumoContrato {
  id: string;
  orcamento_id: string;
  cliente_id: string | null;
  numero_orcamento: string;
  nome_cliente: string;
  dados_cliente: DadosCliente;
  detalhamento_frete: DetalhamentoFrete;
  condicoes_pagamento: CondicoesPagamento | null;
  detalhes_producao: Record<string, Record<string, string>>;
  pdf_path: string;
  pdf_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'contratos';

async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) {
    console.error('Erro ao criar signed URL:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Carrega o resumo de contrato de um orçamento, junto com URL temporária do PDF.
 */
export function useResumoContrato(orcamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['resumo-contrato', orcamentoId],
    enabled: !!orcamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resumos_contrato')
        .select('*')
        .eq('orcamento_id', orcamentoId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const signedUrl = await getSignedUrl(data.pdf_path);
      return { resumo: data as unknown as ResumoContrato, signedUrl };
    },
  });
}

/**
 * Lista IDs de orçamentos que possuem resumo de contrato salvo (para mostrar/esconder botão).
 */
export function useResumosContratoExistentes() {
  return useQuery({
    queryKey: ['resumos-contrato-existentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resumos_contrato')
        .select('orcamento_id');
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.orcamento_id as string));
    },
  });
}

interface SalvarResumoArgs {
  orcamento: Orcamento;
  dadosCliente: DadosCliente;
  detalhamentoFrete: DetalhamentoFrete;
  condicoesPagamento: CondicoesPagamento | null;
  detalhesProducao: Record<number, Record<string, string>>;
  clienteId?: string | null;
  pdfBlob: Blob;
}

export function useSalvarResumoContrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: SalvarResumoArgs) => {
      const { orcamento, dadosCliente, detalhamentoFrete, condicoesPagamento, detalhesProducao, clienteId, pdfBlob } = args;

      // 1. Buscar resumo existente para deletar PDF anterior
      const { data: existente } = await supabase
        .from('resumos_contrato')
        .select('id, pdf_path')
        .eq('orcamento_id', orcamento.id)
        .maybeSingle();

      if (existente?.pdf_path) {
        await supabase.storage.from(BUCKET).remove([existente.pdf_path]);
      }

      // 2. Upload do novo PDF
      const newPath = `${orcamento.id}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(newPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      // 3. Upsert na tabela
      const payload = {
        orcamento_id: orcamento.id,
        cliente_id: clienteId ?? orcamento.cliente_id ?? null,
        numero_orcamento: orcamento.numero_orcamento,
        nome_cliente: orcamento.nome_cliente,
        dados_cliente: dadosCliente as any,
        detalhamento_frete: detalhamentoFrete as any,
        condicoes_pagamento: (condicoesPagamento ?? null) as any,
        detalhes_producao: detalhesProducao as any,
        pdf_path: newPath,
        pdf_size_bytes: pdfBlob.size,
      };

      const { data, error } = await supabase
        .from('resumos_contrato')
        .upsert(payload, { onConflict: 'orcamento_id' })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ResumoContrato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumo-contrato', data.orcamento_id] });
      queryClient.invalidateQueries({ queryKey: ['resumos-contrato-existentes'] });
      toast.success('Resumo de contrato salvo. Versão anterior substituída.');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar resumo de contrato: ' + (err?.message || 'erro desconhecido'));
    },
  });
}

/**
 * Faz download de um PDF do bucket via signed URL.
 */
export async function baixarPdfContrato(path: string, fileName: string) {
  const url = await getSignedUrl(path);
  if (!url) {
    toast.error('Não foi possível gerar link de download.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
