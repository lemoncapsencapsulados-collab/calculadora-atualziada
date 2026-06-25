import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FlaskConical, Shield, Lock, LockOpen, Info, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/unitConversion';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';
import { ItemProducao } from '@/types/orcamento';

interface Props {
  itensProducao: ItemProducao[];
  custoEstabilidadeUnit: number;
  custoAnvisaUnit: number;
  onChangeEstabilidade: (v: number) => void;
  onChangeAnvisa: (v: number) => void;
  edicaoLiberada: boolean;
  onLiberarEdicao: () => void;
}

export default function EstabilidadeAnvisaStep({
  itensProducao,
  custoEstabilidadeUnit,
  custoAnvisaUnit,
  onChangeEstabilidade,
  onChangeAnvisa,
  edicaoLiberada,
  onLiberarEdicao,
}: Props) {
  const [askPwd, setAskPwd] = useState(false);
  const qtd = itensProducao.length;
  const totalEstab = custoEstabilidadeUnit * qtd;
  const totalAnvisa = custoAnvisaUnit * qtd;
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
                {itensProducao.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>• {it.nome_produto}</span>
                    <span className="text-muted-foreground">{it.segmento}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <FlaskConical className="w-4 h-4" /> Teste de estabilidade (por produto)
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={custoEstabilidadeUnit}
                onChange={(e) => onChangeEstabilidade(parseFloat(e.target.value) || 0)}
                disabled={!edicaoLiberada}
              />
              <p className="text-xs text-muted-foreground">
                {qtd} × {formatCurrency(custoEstabilidadeUnit)} = <span className="font-medium">{formatCurrency(totalEstab)}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Shield className="w-4 h-4" /> Notificação Anvisa (por fórmula)
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
                {qtd} × {formatCurrency(custoAnvisaUnit)} = <span className="font-medium">{formatCurrency(totalAnvisa)}</span>
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

      <Card className="bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
            <Clock className="w-4 h-4" /> Prazos importantes
          </div>
          <ul className="text-sm text-amber-900/90 dark:text-amber-100/90 space-y-1 list-disc pl-5">
            <li>O produto entra em <strong>teste de estabilidade após 10 dias úteis</strong> (prazo da equipe técnica para desenvolver a ficha técnica).</li>
            <li>O <strong>prazo para começar a vender</strong> é de <strong>3 meses após o início do teste de estabilidade</strong>.</li>
          </ul>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Esta informação será incluída automaticamente na descrição do serviço no orçamento gerado.
          </p>
        </CardContent>
      </Card>

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