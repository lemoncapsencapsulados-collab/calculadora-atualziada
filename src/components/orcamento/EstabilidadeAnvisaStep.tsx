import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FlaskConical, Shield, Lock, LockOpen, CheckCircle2 } from 'lucide-react';
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
}: Props) {
  const [askPwd, setAskPwd] = useState(false);
  const qtd = itensProducao.length;
  const qtdEstab = (itensEstabilidade ?? itensProducao).length;
  const qtdAnvisa = (itensAnvisa ?? itensProducao).length;
  const totalEstab = custoEstabilidadeUnit * qtdEstab;
  const totalAnvisa = custoAnvisaUnit * qtdAnvisa;
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
            Custos obrigatórios aplicados por produto/fórmula. Embutidos no valor total do orçamento.
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

      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Itens contabilizados ({qtd})
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
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <FlaskConical className="w-4 h-4" /> Teste de estabilidade (por produto personalizado)
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={custoEstabilidadeUnit}
                onChange={(e) => onChangeEstabilidade(parseFloat(e.target.value) || 0)}
                disabled={!edicaoLiberada || qtdEstab === 0}
              />
              {qtdEstab === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">
                  Fórmulas do Catálogo Lemon — isentas de teste de estabilidade.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {qtdEstab} produto(s) personalizado(s) × {formatCurrency(custoEstabilidadeUnit)} = <span className="font-medium">{formatCurrency(totalEstab)}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Shield className="w-4 h-4" /> Notificação Anvisa (por produto)
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={custoAnvisaUnit}
                onChange={(e) => onChangeAnvisa(parseFloat(e.target.value) || 0)}
                disabled={!edicaoLiberada}
              />
              <p className="text-xs text-muted-foreground">
                {qtdAnvisa} produto(s) × {formatCurrency(custoAnvisaUnit)} = <span className="font-medium">{formatCurrency(totalAnvisa)}</span>
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between bg-primary/5 rounded-lg px-4 py-3">
            <span className="text-sm font-medium">Total a embutir no orçamento</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>

      {qtd > 0 && qtdEstab < qtd && (
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