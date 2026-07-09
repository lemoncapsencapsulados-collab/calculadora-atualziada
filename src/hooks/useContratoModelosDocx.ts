import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContratoModeloDocx {
  id: string;
  nome: string;
  descricao: string | null;
  arquivo_url: string;
  arquivo_nome: string | null;
  html_editado: string | null;
  variaveis_detectadas: string[];
  versao: number;
  email_financeiro: string | null;
  nome_financeiro: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = ['contrato-modelos-docx'];
const BUCKET = 'contratos-modelos-docx';

export function useContratoModelosDocx() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contrato_modelos_docx')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContratoModeloDocx[];
    },
  });
}

export function useContratoModeloDocx(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('contrato_modelos_docx')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as ContratoModeloDocx;
    },
  });
}

export async function baixarModeloArquivo(arquivo_url: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(arquivo_url);
  if (error || !data) throw error || new Error('Falha no download');
  return await data.arrayBuffer();
}

export function useCriarModeloDocx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, descricao, file, email_financeiro, nome_financeiro }: { nome: string; descricao?: string; file: File; email_financeiro?: string; nome_financeiro?: string }) => {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      if (up.error) throw up.error;
      const { data, error } = await (supabase as any)
        .from('contrato_modelos_docx')
        .insert({
          nome: nome.trim(),
          descricao: descricao?.trim() || null,
          arquivo_url: path,
          arquivo_nome: file.name,
          variaveis_detectadas: [],
          email_financeiro: email_financeiro?.trim() || null,
          nome_financeiro: nome_financeiro?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ContratoModeloDocx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Modelo enviado!');
    },
    onError: (e: any) => toast.error('Erro ao enviar: ' + (e?.message || 'desconhecido')),
  });
}

export function useAtualizarModeloDocx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ContratoModeloDocx> }) => {
      const { data, error } = await (supabase as any)
        .from('contrato_modelos_docx')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ContratoModeloDocx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + (e?.message || 'desconhecido')),
  });
}

export function useExcluirModeloDocx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: ContratoModeloDocx) => {
      await supabase.storage.from(BUCKET).remove([m.arquivo_url]).catch(() => {});
      const { error } = await (supabase as any).from('contrato_modelos_docx').delete().eq('id', m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Modelo excluído.');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + (e?.message || 'desconhecido')),
  });
}

export function detectarVariaveis(html: string): string[] {
  const re = /\{\{\s*([A-Z0-9_ÁÉÍÓÚÂÊÔÃÕÇ_\- ]+?)\s*\}\}/gi;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    set.add(m[1].trim());
  }
  return Array.from(set);
}