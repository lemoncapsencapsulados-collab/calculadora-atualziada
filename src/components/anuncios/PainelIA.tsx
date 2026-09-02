import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Download, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mensagemErroEdgeFunction } from '@/lib/erroEdgeFunction';
import type { KpisAnuncios, LinhaConsultorAnuncio } from '@/hooks/useAnunciosDados';

interface Props {
  periodoLabel: string;
  kpis: KpisAnuncios;
  anterior: KpisAnuncios;
  consultores: LinhaConsultorAnuncio[];
}

export default function PainelIA({ periodoLabel, kpis, anterior, consultores }: Props) {
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [completaAberta, setCompletaAberta] = useState(false);
  const [textoCompleto, setTextoCompleto] = useState('');
  const [carregandoCompleta, setCarregandoCompleta] = useState(false);

  const suficiente = kpis.leads >= 10;

  const gerar = async (completa: boolean) => {
    const setL = completa ? setCarregandoCompleta : setCarregando;
    setL(true);
    try {
      const { data, error } = await supabase.functions.invoke('anuncios-insights-ia', {
        body: { periodo: periodoLabel, kpis, anterior, consultores, completa },
      });
      // O corpo da resposta carrega o motivo real da falha; sem lê-lo, toda
      // causa vira o mesmo "non-2xx status code" e o erro fica indiagnosticável.
      if (error) throw new Error(await mensagemErroEdgeFunction(error, 'Não foi possível gerar a análise'));
      if ((data as any)?.error) throw new Error((data as any).error);
      const t = (data as any)?.texto || '';
      if (completa) setTextoCompleto(t);
      else setTexto(t);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar a análise');
    } finally {
      setL(false);
    }
  };

  useEffect(() => {
    if (!suficiente) {
      setTexto('');
      return;
    }
    gerar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoLabel, kpis.invest, kpis.leads, kpis.vendas, consultores.length]);

  const exportar = () => {
    const conteudo = `Análise do período · ${periodoLabel}\n\n${texto}${textoCompleto ? `\n\n--- Análise completa ---\n${textoCompleto}` : ''}`;
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-anuncios-${periodoLabel.replace(/[^\w]+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="surface p-5 anim-rise" style={{ background: 'hsl(var(--muted) / 0.45)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Análise do período · {periodoLabel}</h3>
      </div>

      {!suficiente ? (
        <p className="text-sm text-muted-foreground">Dados insuficientes para análise (mínimo de 10 leads no período).</p>
      ) : carregando ? (
        <div className="space-y-2">
          <div className="h-3 rounded bg-muted animate-pulse w-11/12" />
          <div className="h-3 rounded bg-muted animate-pulse w-10/12" />
          <div className="h-3 rounded bg-muted animate-pulse w-8/12" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{texto || 'Sem análise gerada.'}</p>
      )}

      {suficiente && (
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCompletaAberta(true);
              if (!textoCompleto) gerar(true);
            }}
          >
            Gerar análise completa <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportar} disabled={!texto}>
            <Download className="w-4 h-4 mr-1" /> Exportar insights
          </Button>
        </div>
      )}

      <Dialog open={completaAberta} onOpenChange={setCompletaAberta}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto backdrop-blur">
          <DialogHeader>
            <DialogTitle>Análise completa · {periodoLabel}</DialogTitle>
          </DialogHeader>
          {carregandoCompleta ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Gerando análise...
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{textoCompleto}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
