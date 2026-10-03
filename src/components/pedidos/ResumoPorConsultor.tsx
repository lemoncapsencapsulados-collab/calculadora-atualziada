import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  type ResumoConsultor,
  participacao,
} from '@/lib/resumoConsultor';

interface Props {
  resumos: ResumoConsultor[];
  total: { pedidos: number; valor: number };
}

/**
 * Quanto cada consultor trouxe, e de quais clientes.
 *
 * Fica recolhido por padrão: quem abre a tela de Pedidos veio atrás de um
 * pedido, não de um relatório. Quem veio atrás do relatório abre uma vez e o
 * painel fica aberto enquanto ele estiver ali.
 *
 * Os números seguem os filtros da tela -- período, busca, consultor --, porque
 * é assim que a conversa acontece: "no mês passado, quanto o Everton trouxe".
 */
export default function ResumoPorConsultor({ resumos, total }: Props) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          {aberto ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <UserRound className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Resumo por consultor</span>
          <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {resumos.length} {resumos.length === 1 ? 'consultor' : 'consultores'}
            </span>
            <span className="opacity-40">·</span>
            <span>
              {total.pedidos} {total.pedidos === 1 ? 'pedido' : 'pedidos'}
            </span>
            <span className="opacity-40">·</span>
            <span className="font-semibold text-foreground">{formatCurrency(total.valor)}</span>
          </span>
        </button>

        {aberto && (
          <div className="mt-3 space-y-1.5">
            {resumos.map((r) => {
              const fatia = participacao(r, total.valor);
              const estaAberto = expandido === r.consultor;
              return (
                <div key={r.consultor} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setExpandido(estaAberto ? null : r.consultor)}
                    className="flex w-full flex-wrap items-center gap-2 p-2.5 text-left"
                  >
                    {estaAberto ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{r.consultor}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {r.clientes.length} {r.clientes.length === 1 ? 'cliente' : 'clientes'}
                    </Badge>
                    <span className="ml-auto flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        {r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'}
                      </span>
                      <span className="font-semibold tabular-nums">{formatCurrency(r.valor)}</span>
                      <span className="w-10 text-right text-muted-foreground tabular-nums">
                        {fatia.toFixed(0)}%
                      </span>
                    </span>
                  </button>

                  {/* Barra da fatia: comparar quatro valores em reais exige
                      conta de cabeça; comparar quatro barras, não. */}
                  <div className="mx-2.5 mb-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.min(100, fatia)}%` }}
                    />
                  </div>

                  {estaAberto && (
                    <div className="border-t px-2.5 py-2">
                      <p className="mb-1 text-[11px] text-muted-foreground">
                        Quanto cada cliente dele gerou
                      </p>
                      <div className="space-y-0.5">
                        {r.clientes.map((c) => (
                          <div
                            key={`${c.cnpj}-${c.nome}`}
                            className="flex flex-wrap items-baseline gap-2 text-xs"
                          >
                            <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                            <span className="text-muted-foreground">
                              {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                            </span>
                            <span
                              className={cn(
                                'w-24 text-right font-medium tabular-nums',
                                c.valor === 0 && 'text-muted-foreground',
                              )}
                            >
                              {formatCurrency(c.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <p className="pt-1 text-[11px] text-muted-foreground">
              Os números seguem os filtros acima. Cada pedido conta para quem o atendeu — se a
              carteira mudou de mãos, o faturamento antigo continua com quem vendeu.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
