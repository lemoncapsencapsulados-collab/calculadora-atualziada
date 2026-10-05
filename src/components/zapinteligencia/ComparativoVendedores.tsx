import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  HelpCircle,
  Loader2,
  Minus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import { useDesempenhoVendedores } from '@/hooks/useDesempenhoVendedores';
import {
  INDICADORES_DERIVADOS,
  METRICAS,
  type Metrica,
  type ResultadoMes,
  type Tendencia,
  lerMes,
  nomeDoMes,
  participacaoRecompra,
  taxaConversao,
  ticketMedio,
} from '@/lib/desempenhoVendedor';

/**
 * Comparativo de desempenho dos vendedores.
 *
 * Duas abas porque são duas conversas: a de gestão, que compara um vendedor com
 * o outro no mesmo mês, e a individual, que compara o vendedor com ele mesmo no
 * mês anterior. Uma sozinha mente -- a primeira premia quem já começou bem, a
 * segunda esconde quem melhorou pouco partindo de um patamar ruim.
 */

const valor = (m: Metrica, v: number) =>
  m.formato === 'moeda' ? formatCurrency(v) : String(v);

const CORES: Record<Tendencia, string> = {
  melhorou: 'text-emerald-700 dark:text-emerald-400',
  piorou: 'text-red-700 dark:text-red-400',
  estavel: 'text-muted-foreground',
  sem_base: 'text-muted-foreground',
};

function Seta({ t }: { t: Tendencia }) {
  if (t === 'melhorou') return <ArrowUp className="h-3 w-3" />;
  if (t === 'piorou') return <ArrowDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

/** O glossário fica na tela, não num manual que ninguém abre. */
function Glossario() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs font-medium"
        onClick={() => setAberto((v) => !v)}
      >
        <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
        O que cada número quer dizer
      </Button>
      {aberto && (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {METRICAS.map((m) => (
            <div key={m.chave}>
              <dt className="text-xs font-semibold">{m.nome}</dt>
              <dd className="text-xs text-muted-foreground">{m.explicacao}</dd>
            </div>
          ))}
          {INDICADORES_DERIVADOS.map((i) => (
            <div key={i.sigla}>
              <dt className="text-xs font-semibold">
                {i.nome} <span className="font-normal text-muted-foreground">({i.sigla})</span>
              </dt>
              <dd className="text-xs text-muted-foreground">{i.explicacao}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold">Sem base</dt>
            <dd className="text-xs text-muted-foreground">
              O mês anterior era zero. Não é crescimento de 100% — é o primeiro mês com movimento,
              e porcentagem aqui não quer dizer nada.
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/** Períodos que a conversa de gestão usa. */
const PERIODOS = [
  { meses: 3, rotulo: '3 meses' },
  { meses: 6, rotulo: '6 meses' },
  { meses: 12, rotulo: '12 meses' },
] as const;

export default function ComparativoVendedores() {
  const [periodo, setPeriodo] = useState<number>(6);
  const { data, isLoading } = useDesempenhoVendedores(periodo);
  const [aba, setAba] = useState<'gestao' | 'individual'>('gestao');
  const [vendedorAberto, setVendedorAberto] = useState<string | null>(null);
  /** Pedido explícito: ver só quem recebeu lead. */
  const [soComLeads, setSoComLeads] = useState(true);

  const meses = data?.meses ?? [];
  /** Mês que a tabela mostra. Começa no último, mas dá para voltar. */
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);
  const mesAtual = mesEscolhido && meses.includes(mesEscolhido)
    ? mesEscolhido
    : meses[meses.length - 1] ?? '';
  const indiceMes = meses.indexOf(mesAtual);

  /** O mês de WhatsApp parou antes do mês comercial? Então leads estão furados. */
  const leadsDesatualizados = useMemo(() => {
    if (!data?.ultimoMesComConversa || !mesAtual) return false;
    return data.ultimoMesComConversa < mesAtual;
  }, [data, mesAtual]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Somando os meses…</span>
      </div>
    );
  }

  const todos = data?.vendedores ?? [];

  // Linha totalmente zerada no mês é ruído: o vendedor não trabalhou naquele
  // mês, ou o nome ficou órfão de um cadastro antigo.
  const comMovimento = todos.filter((v) => {
    const r = v.meses[indiceMes];
    if (!r) return false;
    return (
      r.leads > 0 ||
      r.orcamentos > 0 ||
      r.vendasNovas > 0 ||
      r.recompras > 0 ||
      r.valorPrimeirasVendas > 0 ||
      r.valorRecompras > 0
    );
  });

  const comLeads = comMovimento.filter((v) => (v.meses[indiceMes]?.leads ?? 0) > 0);
  const filtroEsvaziou = soComLeads && comLeads.length === 0 && comMovimento.length > 0;
  const vendedores = soComLeads && !filtroEsvaziou ? comLeads : comMovimento;
  const aberto = vendedores.find((v) => v.vendedor === vendedorAberto) ?? vendedores[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Desempenho dos vendedores</h2>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {PERIODOS.map((p) => (
            <Button
              key={p.meses}
              size="sm"
              variant={periodo === p.meses ? 'secondary' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => {
                setPeriodo(p.meses);
                setMesEscolhido(null);
              }}
            >
              {p.rotulo}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            size="sm"
            variant={aba === 'gestao' ? 'default' : 'outline'}
            onClick={() => setAba('gestao')}
          >
            Comparar vendedores
          </Button>
          <Button
            size="sm"
            variant={aba === 'individual' ? 'default' : 'outline'}
            onClick={() => setAba('individual')}
          >
            Vendedor a vendedor
          </Button>
        </div>
      </div>

      {leadsDesatualizados && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-medium">
              Leads parados em {nomeDoMes(data!.ultimoMesComConversa!)}
            </p>
            <p className="text-xs opacity-80">
              Nenhuma conversa de WhatsApp foi gravada depois disso, então a coluna de leads está
              zerada nos meses seguintes — não é que o vendedor não recebeu ninguém. Os números de
              orçamento e venda não dependem do WhatsApp e continuam corretos.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Mês:</span>
        {meses.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={m === mesAtual ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs capitalize"
            onClick={() => setMesEscolhido(m)}
          >
            {nomeDoMes(m).replace(' de ', '/')}
          </Button>
        ))}
        <Button
          size="sm"
          variant={soComLeads ? 'secondary' : 'ghost'}
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => setSoComLeads((v) => !v)}
        >
          {soComLeads ? '✓ ' : ''}Só quem recebeu lead
        </Button>
      </div>

      {filtroEsvaziou && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-medium">
              Ninguém tem lead em {nomeDoMes(mesAtual)} — mostrando todos
            </p>
            <p className="text-xs opacity-80">
              O filtro "Só quem recebeu lead" esconderia a tabela inteira, porque a contagem de
              leads depende da sincronização do WhatsApp, que está parada. Os números de orçamento
              e venda abaixo continuam corretos.
            </p>
          </div>
        </div>
      )}

      <Glossario />

      {vendedores.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento no período.
          </CardContent>
        </Card>
      ) : aba === 'gestao' ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs">
                  <th className="p-2 text-left font-medium">Vendedor</th>
                  {METRICAS.map((m) => (
                    <th key={m.chave} className="p-2 text-right font-medium" title={m.explicacao}>
                      {m.nome}
                    </th>
                  ))}
                  <th className="p-2 text-right font-medium" title={INDICADORES_DERIVADOS[0].explicacao}>
                    TC
                  </th>
                  <th className="p-2 text-right font-medium" title={INDICADORES_DERIVADOS[1].explicacao}>
                    TM
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map((v) => {
                  const r = v.meses[indiceMes] ?? ({} as ResultadoMes);
                  const leitura = lerMes(v.meses, indiceMes);
                  return (
                    <tr key={v.vendedor} className="border-b last:border-0">
                      <td className="p-2 font-medium">{v.vendedor}</td>
                      {METRICAS.map((m) => {
                        const varia = leitura?.variacoes[m.chave];
                        return (
                          <td key={m.chave} className="p-2 text-right tabular-nums">
                            {valor(m, Number(r[m.chave]) || 0)}
                            {varia && varia.tendencia !== 'estavel' && (
                              <span
                                className={cn(
                                  'ml-1 inline-flex items-center text-[11px]',
                                  CORES[varia.tendencia],
                                )}
                              >
                                <Seta t={varia.tendencia} />
                                {varia.percentual != null
                                  ? `${Math.abs(varia.percentual * 100).toFixed(0)}%`
                                  : 'novo'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right tabular-nums">{taxaConversao(r).toFixed(0)}%</td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(ticketMedio(r))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t px-2 py-1.5 text-[11px] text-muted-foreground">
              Números de {nomeDoMes(mesAtual)}. A seta compara com o mês anterior do próprio
              vendedor. Vendedor sem nenhum movimento no mês não aparece.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {vendedores.map((v) => (
              <Button
                key={v.vendedor}
                size="sm"
                variant={aberto?.vendedor === v.vendedor ? 'default' : 'outline'}
                onClick={() => setVendedorAberto(v.vendedor)}
              >
                {v.vendedor}
              </Button>
            ))}
          </div>

          {aberto &&
            [...aberto.meses]
              .map((_, i) => lerMes(aberto.meses, aberto.meses.length - 1 - i))
              .filter(Boolean)
              .map((leitura) => (
                <Card key={leitura!.mes}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium capitalize">{nomeDoMes(leitura!.mes)}</span>
                      <Badge variant="outline" className="text-[11px]">
                        TC {taxaConversao(leitura!.resultado).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        TM {formatCurrency(ticketMedio(leitura!.resultado))}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {participacaoRecompra(leitura!.resultado).toFixed(0)}% recompra
                      </Badge>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {METRICAS.map((m) => {
                        const varia = leitura!.variacoes[m.chave];
                        return (
                          <div key={m.chave} className="rounded-md border p-2">
                            <p className="text-[11px] text-muted-foreground">{m.nome}</p>
                            <p className="font-semibold tabular-nums">
                              {valor(m, Number(leitura!.resultado[m.chave]) || 0)}
                            </p>
                            {varia && (
                              <p className={cn('flex items-center gap-1 text-[11px]', CORES[varia.tendencia])}>
                                <Seta t={varia.tendencia} />
                                {varia.tendencia === 'sem_base'
                                  ? 'primeiro mês com movimento'
                                  : varia.percentual != null
                                    ? `${varia.percentual > 0 ? '+' : '−'}${Math.abs(varia.percentual * 100).toFixed(0)}% vs. mês anterior`
                                    : 'igual ao mês anterior'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(leitura!.melhorou.length > 0 || leitura!.piorou.length > 0) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {leitura!.melhorou.length > 0 && (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-900 dark:bg-emerald-950/20">
                            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              Melhorou
                            </p>
                            <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                              {leitura!.melhorou.join(' · ')}
                            </p>
                          </div>
                        )}
                        {leitura!.piorou.length > 0 && (
                          <div className="rounded-md border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/20">
                            <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                              Piorou
                            </p>
                            <p className="text-xs text-red-900/80 dark:text-red-200/80">
                              {leitura!.piorou.join(' · ')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
        </div>
      )}
    </div>
  );
}
