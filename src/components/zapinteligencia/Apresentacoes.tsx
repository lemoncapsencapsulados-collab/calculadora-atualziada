import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, FileText, Loader2, Presentation, Sparkles, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { mensagemErroEdgeFunction } from '@/lib/erroEdgeFunction';
import { exportarPdf, exportarPptx } from '@/lib/zapApresentacaoExport';
import type { Apresentacao } from '@/lib/zapApresentacaoBlocos';

/**
 * Aba de apresentações: histórico versionado por consultor e período.
 *
 * Gerar de novo cria uma versão nova em vez de reescrever a anterior. Sem essa
 * imutabilidade, comparar julho com agosto seria ficção — bastaria alguém
 * regerar o relatório antigo para o delta mudar.
 *
 * Exportar não chama IA: PDF e PPTX saem do `payload_json` já gravado.
 */

interface Props {
  usuarioId: string | null;
  consultorNome: string | null;
  inicio: Date;
  fim: Date;
  onGerado?: () => void;
}

export default function Apresentacoes({ usuarioId, consultorNome, inicio, fim, onGerado }: Props) {
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['zap-apresentacoes', usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zap_apresentacoes' as any)
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('periodo_inicio', { ascending: false })
        .order('versao', { ascending: false });
      if (error) throw new Error(error.message);
      return ((data || []) as unknown) as Apresentacao[];
    },
  });

  const gerar = async () => {
    if (!usuarioId) return;
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('zap-apresentacao', {
        body: { usuario_id: usuarioId, inicio: inicio.toISOString(), fim: fim.toISOString() },
      });
      if (error) throw new Error(await mensagemErroEdgeFunction(error, 'Falha ao gerar'));
      if ((data as any)?.error) throw new Error((data as any).error);

      const r = data as { versao: number; custo_usd: number; validacao_orfaos: string[] };
      queryClient.invalidateQueries({ queryKey: ['zap-apresentacoes'] });
      onGerado?.();
      // O custo aparece no aviso: quem gera precisa ver o que gastou, não
      // descobrir na fatura.
      toast.success(
        `Versão ${r.versao} gerada · US$ ${r.custo_usd.toFixed(4)}` +
          (r.validacao_orfaos?.length ? ` · ${r.validacao_orfaos.length} número(s) para revisar` : '')
      );
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar apresentação');
    } finally {
      setGerando(false);
    }
  };

  const excluir = async (a: Apresentacao) => {
    // Confirmação porque é irreversível: não há lixeira, e o payload é o que
    // permite reexportar sem gastar IA de novo.
    if (!window.confirm(`Excluir a versão ${a.versao} de ${a.consultor_nome}? Não há como desfazer.`)) return;
    setExcluindo(a.id);
    try {
      const { error } = await supabase.from('zap_apresentacoes' as any).delete().eq('id', a.id);
      if (error) throw new Error(error.message);
      queryClient.invalidateQueries({ queryKey: ['zap-apresentacoes'] });
      toast.success(`Versão ${a.versao} excluída`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao excluir');
    } finally {
      setExcluindo(null);
    }
  };

  const baixar = async (a: Apresentacao, formato: 'pdf' | 'pptx') => {
    setExportando(`${a.id}-${formato}`);
    try {
      if (formato === 'pdf') exportarPdf(a);
      else await exportarPptx(a);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao exportar');
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-medium flex items-center gap-2">
            <Presentation className="w-4 h-4 text-primary" /> Apresentações
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada geração vira uma versão nova. As anteriores ficam intactas, para comparar ciclos.
          </p>
        </div>
        <Button onClick={gerar} disabled={gerando || !usuarioId}>
          {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {gerando ? 'Gerando…' : `Gerar para ${consultorNome ?? 'o consultor'}`}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma apresentação gerada ainda. A geração custa alguns centavos e não relê conversas —
          usa os números já apurados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Versão</th>
                <th className="py-2 pr-3 font-medium">Consultor</th>
                <th className="py-2 pr-3 font-medium">Período</th>
                <th className="py-2 pr-3 font-medium">Gerada em</th>
                <th className="py-2 pr-3 font-medium text-right">Base</th>
                <th className="py-2 pr-3 font-medium text-right">Cobertura</th>
                <th className="py-2 pr-3 font-medium text-right">Score</th>
                <th className="py-2 pr-3 font-medium text-right">Custo</th>
                <th className="py-2 font-medium">Exportar</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <span className="font-medium">v{a.versao}</span>
                    {a.validacao_orfaos?.length > 0 && (
                      <AlertTriangle
                        className="w-3.5 h-3.5 inline ml-1.5 text-warning"
                        // O alerta é sobre confiança no texto, não sobre falha:
                        // números sem origem nas métricas viraram revisão manual.
                        aria-label={`${a.validacao_orfaos.length} número(s) do texto sem origem nas métricas`}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap font-medium">{a.consultor_nome}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {format(new Date(`${a.periodo_inicio}T12:00:00`), 'dd/MM/yy')} a{' '}
                    {format(new Date(`${a.periodo_fim}T12:00:00`), 'dd/MM/yy')}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {format(new Date(a.gerado_em), 'dd/MM HH:mm')}
                  </td>
                  <td className="py-2 pr-3 text-right">{a.base_conversas}</td>
                  <td className="py-2 pr-3 text-right">
                    {a.cobertura_analise_pct == null ? '—' : `${a.cobertura_analise_pct}%`}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">{a.score_geral ?? '—'}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">
                    {(a as any).custo_analise_usd == null
                      ? '—'
                      : `US$ ${Number((a as any).custo_analise_usd).toFixed(4)}`}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => baixar(a, 'pdf')}
                        disabled={exportando === `${a.id}-pdf`}
                      >
                        {exportando === `${a.id}-pdf` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1">PDF</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => baixar(a, 'pptx')}
                        disabled={exportando === `${a.id}-pptx`}
                      >
                        {exportando === `${a.id}-pptx` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1">Slides</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => excluir(a)}
                        disabled={excluindo === a.id}
                        title="Excluir esta versão"
                      >
                        {excluindo === a.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Exportar não consome crédito de IA — PDF e slides saem do relatório já gravado, com números
        idênticos entre os dois.
      </p>
    </div>
  );
}
