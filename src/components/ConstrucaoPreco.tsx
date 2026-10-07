import { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import {
  EXPLICACAO_MARGEM,
  EXPLICACAO_MARKUP,
  conferirFechamento,
  construcaoDePreco,
} from '@/lib/construcaoPreco';
import type { PrecificacaoCalculada } from '@/types/precificacao';

/** Lembra se o painel fica aberto. Quem confere margem confere toda vez. */
const CHAVE = 'construcao-preco-aberta';

function lerPreferencia(): boolean {
  try {
    // Aberto por padrão: a conta existe para ser vista, e quem não quiser
    // fecha uma vez e a tela lembra.
    return localStorage.getItem(CHAVE) !== 'fechada';
  } catch {
    return true;
  }
}

/**
 * A conta do preço, aberta na tela.
 *
 * O rodapé mostrava MP, Embalagem e um "Custo" que não era a soma dos dois --
 * faltava o overhead. Imposto e markup não apareciam em lugar nenhum (o markup
 * é gravado no banco desde sempre e nunca foi exibido). Conferir margem assim
 * depende de refazer a conta de cabeça.
 */
export default function ConstrucaoPreco({
  resultado,
  className,
}: {
  resultado: PrecificacaoCalculada;
  className?: string;
}) {
  const [aberta, setAberta] = useState(lerPreferencia);

  const alternar = (v: boolean) => {
    setAberta(v);
    try {
      localStorage.setItem(CHAVE, v ? 'aberta' : 'fechada');
    } catch {
      // Navegador em modo privado: vale para esta sessão e ponto.
    }
  };

  const linhas = construcaoDePreco(resultado);
  const fechamento = conferirFechamento(linhas);
  const margem = Number(resultado.margemLucroPercentual) || 0;
  const markup = Number(resultado.markupBruto) || 0;
  const prejuizo = (Number(resultado.margemLucroValor) || 0) < 0;

  return (
    <Collapsible open={aberta} onOpenChange={alternar} className={className}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !aberta && '-rotate-90')} />
        Como o preço se forma
        {!aberta && (
          <span className="ml-1 normal-case tracking-normal opacity-70">
            custo {formatCurrency(resultado.totalCustosProducao)} · imposto{' '}
            {formatCurrency(resultado.totalImpostos)} · markup {markup.toFixed(1)}%
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-lg border bg-background/60 p-3">
          <dl className="space-y-1 text-xs">
            {linhas.map((l) => {
              const subtotal = l.tipo === 'subtotal';
              const preco = l.tipo === 'preco';
              return (
                <div
                  key={l.rotulo}
                  className={cn(
                    'flex items-baseline justify-between gap-3',
                    // Risco antes do subtotal e antes do preço: é onde a conta
                    // fecha um bloco, e sem a linha os números viram uma pilha.
                    (subtotal || preco) && 'mt-1 border-t pt-1.5',
                    (subtotal || preco) && 'font-medium text-foreground',
                  )}
                >
                  <dt className="min-w-0">
                    <span className={cn(!subtotal && !preco && 'text-muted-foreground')}>
                      {l.rotulo}
                    </span>
                    {l.nota && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground opacity-80">
                        {l.nota}
                      </span>
                    )}
                  </dt>
                  <dd
                    className={cn(
                      'shrink-0 tabular-nums',
                      l.tipo === 'imposto' && 'text-muted-foreground',
                      l.tipo === 'lucro' &&
                        (l.valor < 0
                          ? 'font-medium text-destructive'
                          : 'font-medium text-green-700 dark:text-green-400'),
                    )}
                  >
                    {l.tipo === 'imposto' || (l.tipo === 'lucro' && l.valor < 0) ? '−' : ''}
                    {formatCurrency(Math.abs(l.valor))}
                  </dd>
                </div>
              );
            })}
          </dl>

          {/* Margem e markup lado a lado, cada um com a conta que o define.
              São confundidos o tempo todo porque os dois saem em porcentagem e
              o markup é sempre o maior. */}
          <div className="mt-3 grid gap-2 border-t pt-2.5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Margem</p>
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  prejuizo ? 'text-destructive' : 'text-foreground',
                )}
              >
                {margem.toFixed(1)}%
              </p>
              <p className="text-[10px] leading-snug text-muted-foreground">{EXPLICACAO_MARGEM}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Markup</p>
              <p className="text-sm font-semibold tabular-nums">{markup.toFixed(1)}%</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{EXPLICACAO_MARKUP}</p>
            </div>
          </div>

          {prejuizo && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Este preço não cobre custo e imposto: cada pote vendido dá prejuízo de{' '}
              {formatCurrency(Math.abs(Number(resultado.margemLucroValor) || 0))}.
            </p>
          )}

          {/* Só aparece se a conta não fechar. Nunca deveria aparecer -- mas se
              aparecer, o consultor precisa saber antes de fechar a venda, e não
              descobrir somando de cabeça. */}
          {!fechamento.fecha && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              As parcelas somam {formatCurrency(fechamento.soma)}, e o preço é{' '}
              {formatCurrency(fechamento.preco)}. Confira antes de salvar.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
