import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Handshake, Lock, LockOpen, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/unitConversion';
import { AdminPasswordDialog } from '@/components/admin/AdminPasswordDialog';
import { calcularResumoIntermediador } from '@/lib/intermediador';
import { formatTelefone, isTelefoneValido } from '@/lib/whatsapp';

interface Props {
  subtotalProducao: number;
  custoProducao: number;
  subtotalSetup: number;
  custoSetup: number;
  totalEstabilidadeAnvisa: number;
  valorTotal: number;
  tipoOrcamento: 'novo_produtor' | 'recompra';
  ativo: boolean;
  onToggle: (v: boolean) => void;
  nome: string;
  onChangeNome: (v: string) => void;
  whatsapp: string;
  onChangeWhatsapp: (v: string) => void;
  percentualPrimeira: number;
  percentualRecompra: number;
  onChangePercentualPrimeira: (v: number) => void;
  onChangePercentualRecompra: (v: number) => void;
}

export default function ConfirmacaoIntermediadorStep({
  subtotalProducao,
  custoProducao,
  subtotalSetup,
  custoSetup,
  totalEstabilidadeAnvisa,
  valorTotal,
  tipoOrcamento,
  ativo,
  onToggle,
  nome,
  onChangeNome,
  whatsapp,
  onChangeWhatsapp,
  percentualPrimeira,
  percentualRecompra,
  onChangePercentualPrimeira,
  onChangePercentualRecompra,
}: Props) {
  const [askPwd, setAskPwd] = useState(false);
  const [edicaoLiberada, setEdicaoLiberada] = useState(false);

  const isRecompra = tipoOrcamento === 'recompra';
  const percentual = isRecompra ? percentualRecompra : percentualPrimeira;

  const resumo = calcularResumoIntermediador({
    receitaProducao: subtotalProducao,
    custoProducao,
    receitaSetup: subtotalSetup + totalEstabilidadeAnvisa,
    custoSetup,
    percentual: ativo ? percentual : 0,
  });

  const telefoneInvalido = ativo && whatsapp.trim() !== '' && !isTelefoneValido(whatsapp);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Confirmação do Orçamento
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Confira os valores antes de definir as condições de pagamento.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Produção</span>
            <span className="font-medium">{formatCurrency(subtotalProducao)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Setup / Criação de marca</span>
            <span className="font-medium">{formatCurrency(subtotalSetup)}</span>
          </div>
          {totalEstabilidadeAnvisa > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estabilidade + Notificação Anvisa</span>
              <span className="font-medium">{formatCurrency(totalEstabilidadeAnvisa)}</span>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Valor total do orçamento</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(valorTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className={ativo ? 'border-primary/30' : 'border-muted'}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <Handshake className="w-4 h-4 text-primary" /> Adicionar Intermediador
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                A comissão não altera o valor cobrado do cliente e não aparece no PDF do orçamento.
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={onToggle} aria-label="Adicionar intermediador" />
          </div>

          {ativo && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do intermediador</Label>
                  <Input value={nome} onChange={(e) => onChangeNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => onChangeWhatsapp(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                  {telefoneInvalido && (
                    <p className="text-xs text-destructive">Telefone inválido — informe DDD + número.</p>
                  )}
                  {!telefoneInvalido && whatsapp && (
                    <p className="text-xs text-muted-foreground">{formatTelefone(whatsapp)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Percentuais de comissão
                </p>
                {edicaoLiberada ? (
                  <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
                    <LockOpen className="w-3 h-3" /> Edição liberada
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAskPwd(true)}>
                    <Lock className="w-3.5 h-3.5 mr-1.5" /> Editar percentuais
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`space-y-1.5 rounded-md p-3 ${!isRecompra ? 'bg-primary/5 border border-primary/20' : 'opacity-70'}`}>
                  <Label className="text-xs flex items-center gap-2">
                    Primeira compra (%)
                    {!isRecompra && <Badge variant="secondary" className="text-[10px]">Aplicado</Badge>}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    value={percentualPrimeira}
                    onChange={(e) => onChangePercentualPrimeira(parseFloat(e.target.value) || 0)}
                    disabled={!edicaoLiberada}
                  />
                </div>
                <div className={`space-y-1.5 rounded-md p-3 ${isRecompra ? 'bg-primary/5 border border-primary/20' : 'opacity-70'}`}>
                  <Label className="text-xs flex items-center gap-2">
                    Recompra (%)
                    {isRecompra && <Badge variant="secondary" className="text-[10px]">Aplicado</Badge>}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    value={percentualRecompra}
                    onChange={(e) => onChangePercentualRecompra(parseFloat(e.target.value) || 0)}
                    disabled={!edicaoLiberada}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center bg-primary/5 rounded-md px-3 py-2">
                  <span className="text-sm font-medium">
                    Comissão do intermediador ({percentual}% sobre {formatCurrency(resumo.base)})
                  </span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(resumo.comissao)}</span>
                </div>

                <div className="text-sm space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                    Margem Lemon — Produção
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Antes da comissão</span>
                    <span>{formatCurrency(resumo.margemProducaoAntes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissão rateada</span>
                    <span className="text-destructive">- {formatCurrency(resumo.comissaoProducao)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Depois da comissão</span>
                    <span>{formatCurrency(resumo.margemProducaoDepois)}</span>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                    Margem Lemon — Setup
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Antes da comissão</span>
                    <span>{formatCurrency(resumo.margemSetupAntes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissão rateada</span>
                    <span className="text-destructive">- {formatCurrency(resumo.comissaoSetup)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Depois da comissão</span>
                    <span>{formatCurrency(resumo.margemSetupDepois)}</span>
                  </div>
                </div>

                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Margem total Lemon após comissão</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(resumo.margemTotalDepois)}{' '}
                    <span className="text-sm text-muted-foreground">
                      ({resumo.margemTotalDepoisPct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AdminPasswordDialog
        open={askPwd}
        onOpenChange={setAskPwd}
        title="Liberar edição dos percentuais"
        description="Os percentuais padrão são 3% na primeira compra e 1% na recompra. Informe a senha de administrador para editar."
        actionLabel="Liberar edição"
        onConfirm={() => setEdicaoLiberada(true)}
      />
    </div>
  );
}
