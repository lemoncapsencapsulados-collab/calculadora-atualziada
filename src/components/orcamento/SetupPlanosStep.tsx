import { useMemo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings2, ArrowLeft, Sparkles, Trophy, AlertTriangle, Plus, Minus, Store, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import { useSetupPlanos, SetupPlano, SetupPlanoPerfil, parseEntregaveisMd } from '@/hooks/useSetupPlanos';

export interface PlanoSelecionado {
  plano_id: string;
  nome: string;
  preco_unitario: number;
  quantidade: number;
  descricao: string | null;
  entregaveis_md: string;
  perfil: SetupPlanoPerfil;
}

interface Props {
  perfil: SetupPlanoPerfil | null;
  onPerfilChange: (p: SetupPlanoPerfil | null) => void;
  selecionados: Record<string, number>;
  onSelecionadosChange: (next: Record<string, number>) => void;
  /**
   * Conteúdo customizado para substituir a lista de planos.
   * Usado p/ "Produtor Experiente" onde o pai renderiza a UI legada
   * (custo personalizado com margem/valor fixo).
   */
  renderCustomBody?: ReactNode;
  /** Habilita o card "Revenda Lemon" (só quando todos os itens são do Catálogo) */
  revendaDisponivel?: boolean;
  /** Texto exibido quando o card "Revenda Lemon" está desabilitado */
  revendaMotivoBloqueio?: string;
}

const SetupPlanosStep = ({ perfil, onPerfilChange, selecionados, onSelecionadosChange, renderCustomBody, revendaDisponivel = false, revendaMotivoBloqueio }: Props) => {
  const planosPerfil = perfil === 'revenda_lemon' ? undefined : perfil ?? undefined;
  const { data: planos = [], isLoading } = useSetupPlanos(planosPerfil);

  const totalSetup = useMemo(() => {
    return planos.reduce((acc, p) => acc + (selecionados[p.id] || 0) * p.preco_fixo, 0);
  }, [planos, selecionados]);

  const setQtd = (id: string, qtd: number) => {
    const q = Math.max(0, Math.floor(qtd));
    const next = { ...selecionados };
    if (q === 0) delete next[id];
    else next[id] = q;
    onSelecionadosChange(next);
  };

  // Tela inicial: escolha de perfil
  if (!perfil) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Custo de Setup
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecione o perfil do produtor para ver os planos disponíveis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onPerfilChange('novo_produtor')}
            className="text-left rounded-xl border-2 border-primary/30 bg-card p-6 transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h4 className="text-lg font-bold">NOVO PRODUTOR</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Para clientes que estão iniciando a marca. Planos completos de criação (rótulos, branding, páginas de venda).
            </p>
          </button>

          <button
            type="button"
            onClick={() => onPerfilChange('produtor_experiente')}
            className="text-left rounded-xl border-2 border-amber-400/40 bg-card p-6 transition-all hover:border-amber-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="text-lg font-bold">PRODUTOR EXPERIENTE</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Para clientes com operação rodando. Orçamento mais enxuto, focado em itens pontuais.
            </p>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Obs:</strong> Precisa ter histórico de vendas do(s) produto(s) orçado(s).
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={!revendaDisponivel}
            onClick={() => revendaDisponivel && onPerfilChange('revenda_lemon')}
            className={cn(
              'text-left rounded-xl border-2 p-6 transition-all focus:outline-none focus:ring-2',
              revendaDisponivel
                ? 'border-emerald-400/40 bg-card hover:border-emerald-500 hover:shadow-md focus:ring-emerald-500 cursor-pointer'
                : 'border-muted bg-muted/30 opacity-70 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('rounded-lg p-2.5', revendaDisponivel ? 'bg-emerald-500/10' : 'bg-muted')}>
                {revendaDisponivel ? (
                  <Store className="h-6 w-6 text-emerald-600" />
                ) : (
                  <Lock className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <h4 className="text-lg font-bold">REVENDA LEMON</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Para clientes que apenas revendem produtos Lemon. Sem custo de setup — apenas custo de produção.
            </p>
            {!revendaDisponivel && (
              <div className="flex items-start gap-2 rounded-md bg-muted border p-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {revendaMotivoBloqueio || 'Disponível apenas quando todos os itens são fórmulas do Catálogo.'}
                </p>
              </div>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Seleção de planos
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Custo de Setup —{' '}
          <Badge
            variant={perfil === 'novo_produtor' ? 'default' : 'outline'}
            className={cn(
              perfil === 'produtor_experiente' && 'border-amber-500 text-amber-700',
              perfil === 'revenda_lemon' && 'border-emerald-500 text-emerald-700'
            )}
          >
            {perfil === 'novo_produtor' ? 'Novo Produtor' : perfil === 'produtor_experiente' ? 'Produtor Experiente' : 'Revenda Lemon'}
          </Badge>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onPerfilChange(null);
            onSelecionadosChange({});
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Trocar perfil
        </Button>
      </div>

      {perfil === 'revenda_lemon' ? (
        <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300">
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <h4 className="font-semibold">Revenda Lemon selecionada</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Este orçamento segue <strong>sem custo de setup</strong> — apenas o custo de produção dos itens do Catálogo.
            </p>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total do Setup</span>
              <span className="text-2xl font-bold text-emerald-700">{formatCurrency(0)}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      <p className="text-sm text-muted-foreground">
        {renderCustomBody
          ? 'Configure os itens, custos e margem do setup personalizado abaixo.'
          : 'Selecione um ou mais planos e ajuste a quantidade. Combinações são permitidas (ex.: 1 Start + 1 Branding).'}
      </p>

      {renderCustomBody ? (
        <>{renderCustomBody}</>
      ) : (
        <>
      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando planos...</p>
      )}

      {!isLoading && planos.length === 0 && (
        <div className="py-8 text-center border rounded-lg bg-muted/30">
          <Settings2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nenhum plano cadastrado para este perfil ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre planos em Configurações para começar a usar.</p>
        </div>
      )}

      <div className="space-y-3">
        {planos.map((p) => {
          const qtd = selecionados[p.id] || 0;
          const sel = qtd > 0;
          const bullets = parseEntregaveisMd(p.entregaveis_md);
          return (
            <Card key={p.id} className={cn('transition-all', sel && 'border-primary ring-1 ring-primary/30')}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base">{p.nome}</h4>
                      <span className="text-base font-semibold text-primary">{formatCurrency(p.preco_fixo)}</span>
                    </div>
                    {p.descricao_curta && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.descricao_curta}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQtd(p.id, qtd - 1)}
                      disabled={qtd <= 0}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      className="w-14 h-8 text-center"
                      value={qtd}
                      onChange={(e) => setQtd(p.id, parseInt(e.target.value) || 0)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQtd(p.id, qtd + 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {bullets.length > 0 && (
                  <div className="ml-1 pl-3 border-l-2 border-primary/20 space-y-1">
                    {bullets.map((b, i) => (
                      <p key={i} className="text-xs text-foreground/80 whitespace-pre-wrap">{b}</p>
                    ))}
                  </div>
                )}

                {sel && (
                  <div className="flex justify-end text-sm font-semibold">
                    Subtotal: <span className="ml-2 text-primary">{formatCurrency(p.preco_fixo * qtd)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalSetup > 0 && (
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total do Setup</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalSetup)}</span>
            </div>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Preço fixo: o valor dos planos vai direto para o subtotal de serviços, sem aplicação de margem adicional.
            </p>
          </CardContent>
        </Card>
      )}

      {totalSetup === 0 && planos.length > 0 && (
        <div className="py-4 text-center border rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">Esta seção é opcional. Selecione um plano se houver setup.</p>
        </div>
      )}
        </>
      )}
        </>
      )}
    </div>
  );
};

export default SetupPlanosStep;

// Helpers reaproveitados em GerarOrcamentoDialog
export function buildPlanosSelecionados(
  planos: SetupPlano[],
  selecionados: Record<string, number>
): PlanoSelecionado[] {
  return planos
    .filter((p) => (selecionados[p.id] || 0) > 0)
    .map((p) => ({
      plano_id: p.id,
      nome: p.nome,
      preco_unitario: p.preco_fixo,
      quantidade: selecionados[p.id],
      descricao: p.descricao_curta,
      entregaveis_md: p.entregaveis_md,
      perfil: p.perfil,
    }));
}
