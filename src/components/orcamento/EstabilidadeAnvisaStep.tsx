import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { FlaskConical, Shield, Lock, LockOpen, CheckCircle2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/unitConversion';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';
import { ItemProducao } from '@/types/orcamento';

interface Props {
  itensProducao: ItemProducao[];
  itensEstabilidade?: ItemProducao[];
  itensAnvisa?: ItemProducao[];
  isItemCatalogo?: (it: ItemProducao) => boolean;
  custoEstabilidadeUnit: number;
  custoAnvisaUnit: number;
  onChangeEstabilidade: (v: number) => void;
  onChangeAnvisa: (v: number) => void;
  edicaoLiberada: boolean;
  onLiberarEdicao: () => void;
  estabilidadeAtiva: boolean;
  anvisaAtiva: boolean;
  onToggleEstabilidade: (v: boolean) => void;
  onToggleAnvisa: (v: boolean) => void;
}

export default function EstabilidadeAnvisaStep({
  itensProducao,
  itensEstabilidade,
  itensAnvisa,
  isItemCatalogo,
  custoEstabilidadeUnit,
  custoAnvisaUnit,
  onChangeEstabilidade,
  onChangeAnvisa,
  edicaoLiberada,
  onLiberarEdicao,
  estabilidadeAtiva,
  anvisaAtiva,
  onToggleEstabilidade,
  onToggleAnvisa,
}: Props) {
  const [askPwd, setAskPwd] = useState(false);
  const qtd = itensProducao.length;
  const qtdEstab = estabilidadeAtiva ? (itensEstabilidade ?? itensProducao).length : 0;
  const qtdAnvisa = anvisaAtiva ? (itensAnvisa ?? itensProducao).length : 0;
  const totalEstab = estabilidadeAtiva ? custoEstabilidadeUnit * qtdEstab : 0;
  const totalAnvisa = anvisaAtiva ? custoAnvisaUnit * qtdAnvisa : 0;
  const total = totalEstab + totalAnvisa;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Estabilidade + Notificação Anvisa
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Serviços <strong>opcionais</strong>. Ative apenas os que farão parte deste orçamento — cada um é discriminado no PDF.
          </p>
        </div>
        {edicaoLiberada ? (
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
            <LockOpen className="w-3 h-3" /> Edição liberada
          </Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAskPwd(true)}>
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Editar valores
          </Button>
        )}
      </div>

      {/* Lista de produtos considerados */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Produtos deste orçamento ({qtd})
          </p>
          {qtd === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum produto no Passo 2.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {itensProducao.map((it, i) => {
                const cat = isItemCatalogo ? isItemCatalogo(it) : false;
                return (
                  <li key={i} className="flex justify-between items-center gap-2">
                    <span>• {it.nome_produto}</span>
                    <span className="flex items-center gap-2">
                      {cat ? (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                          Catálogo — isento de estabilidade
                        </Badge>
                      ) : (
                        <Badge variant="outline">Personalizada</Badge>
                      )}
                      <span className="text-muted-foreground">{it.segmento}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bloco Teste de Estabilidade */}
        <Card className={estabilidadeAtiva ? 'border-primary/30' : 'border-muted opacity-80'}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <FlaskConical className="w-4 h-4 text-primary" /> Teste de Estabilidade
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aplica somente a produtos com fórmula personalizada.
                </p>
              </div>
              <Switch
                checked={estabilidadeAtiva}
                onCheckedChange={onToggleEstabilidade}
                aria-label="Ativar Teste de Estabilidade"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custo por produto personalizado</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={custoEstabilidadeUnit}
                onChange={(e) => onChangeEstabilidade(parseFloat(e.target.value) || 0)}
                disabled={!edicaoLiberada || !estabilidadeAtiva}
              />
            </div>

            <Separator />

            {!estabilidadeAtiva ? (
              <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Desativado — não será incluído no orçamento.
              </p>
            ) : qtdEstab === 0 ? (
              <p className="text-xs text-emerald-700 font-medium">
                Fórmulas do Catálogo Lemon — isentas de teste de estabilidade.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {qtdEstab} produto(s) × {formatCurrency(custoEstabilidadeUnit)}
              </p>
            )}

            <div className="flex items-center justify-between bg-primary/5 rounded-md px-3 py-2">
              <span className="text-xs font-medium">Subtotal</span>
              <span className="text-base font-bold text-primary">{formatCurrency(totalEstab)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Bloco Notificação Anvisa */}
        <Card className={anvisaAtiva ? 'border-primary/30' : 'border-muted opacity-80'}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <Shield className="w-4 h-4 text-primary" /> Notificação Anvisa
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aplica a todos os produtos do orçamento.
                </p>
              </div>
              <Switch
                checked={anvisaAtiva}
                onCheckedChange={onToggleAnvisa}
                aria-label="Ativar Notificação Anvisa"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custo por produto</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={custoAnvisaUnit}
                onChange={(e) => onChangeAnvisa(parseFloat(e.target.value) || 0)}
                disabled={!edicaoLiberada || !anvisaAtiva}
              />
            </div>

            <Separator />

            {!anvisaAtiva ? (
              <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Desativado — não será incluído no orçamento.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {qtdAnvisa} produto(s) × {formatCurrency(custoAnvisaUnit)}
              </p>
            )}

            <div className="flex items-center justify-between bg-primary/5 rounded-md px-3 py-2">
              <span className="text-xs font-medium">Subtotal</span>
              <span className="text-base font-bold text-primary">{formatCurrency(totalAnvisa)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total geral discriminado */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Teste de Estabilidade</span>
            <span className={estabilidadeAtiva ? 'font-medium' : 'text-muted-foreground line-through'}>
              {formatCurrency(totalEstab)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Notificação Anvisa</span>
            <span className={anvisaAtiva ? 'font-medium' : 'text-muted-foreground line-through'}>
              {formatCurrency(totalAnvisa)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total a embutir no orçamento</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      {estabilidadeAtiva && qtd > 0 && qtdEstab < qtd && (
        <Card className="bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" /> Fórmulas do Catálogo Lemon — sem custo de estabilidade
            </div>
            <p className="text-sm text-emerald-900/90 dark:text-emerald-100/90">
              Produtos que usam fórmulas do Catálogo Lemon são <strong>isentos do teste de estabilidade</strong>.
              Para esses itens, o único custo aplicado é a <strong>Notificação na Anvisa</strong> por produto.
            </p>
          </CardContent>
        </Card>
      )}

      <AdminPasswordDialog
        open={askPwd}
        onOpenChange={setAskPwd}
        title="Liberar edição dos custos"
        description="Os valores padrão são definidos pela operação. Informe a senha de administrador para editar."
        actionLabel="Liberar edição"
        onConfirm={onLiberarEdicao}
      />
    </div>
  );
}