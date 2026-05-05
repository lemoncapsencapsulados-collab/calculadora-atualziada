import { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { useHistoricoConfiguracao } from '@/hooks/useHistoricoConfiguracao';
import {
  calcularCustosPorTipo,
  TIPOS_PRODUTO_KEYS,
  TIPO_PRODUTO_LABELS,
  type TipoProdutoKey,
} from '@/lib/adminCustos';
import { formatCurrency } from '@/lib/unitConversion';
import { arredondarReais } from '@/lib/utils';
import { toast } from 'sonner';

interface FormState {
  taxa_perca: string;
  folha_producao: string;
  folha_administrativa: string;
  energia_eletrica: string;
  depreciacao_maquinas: string;
  capacidade_encapsulados: string;
  capacidade_soluvel: string;
  capacidade_gummy: string;
  capacidade_liquido: string;
}

const blankForm: FormState = {
  taxa_perca: '20',
  folha_producao: '0',
  folha_administrativa: '0',
  energia_eletrica: '0',
  depreciacao_maquinas: '0',
  capacidade_encapsulados: '0',
  capacidade_soluvel: '0',
  capacidade_gummy: '0',
  capacidade_liquido: '0',
};

function toForm(c: any): FormState {
  return {
    taxa_perca: String(c?.taxa_perca ?? 20),
    folha_producao: String(c?.folha_producao ?? 0),
    folha_administrativa: String(c?.folha_administrativa ?? 0),
    energia_eletrica: String(c?.energia_eletrica ?? 0),
    depreciacao_maquinas: String(c?.depreciacao_maquinas ?? 0),
    capacidade_encapsulados: String(c?.capacidade_encapsulados ?? 0),
    capacidade_soluvel: String(c?.capacidade_soluvel ?? 0),
    capacidade_gummy: String(c?.capacidade_gummy ?? 0),
    capacidade_liquido: String(c?.capacidade_liquido ?? 0),
  };
}

const num = (v: string) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function VariaveisEstruturaisForm() {
  const { configuracaoAtiva, updateConfiguracao } = useConfiguracaoCustos();
  const { registrarHistorico } = useHistoricoConfiguracao();
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configuracaoAtiva) setForm(toForm(configuracaoAtiva));
  }, [configuracaoAtiva]);

  const capacidades = useMemo(
    () => ({
      encapsulados: num(form.capacidade_encapsulados),
      soluvel: num(form.capacidade_soluvel),
      gummy: num(form.capacidade_gummy),
      liquido: num(form.capacidade_liquido),
    }),
    [form.capacidade_encapsulados, form.capacidade_soluvel, form.capacidade_gummy, form.capacidade_liquido]
  );

  const custosPorTipo = useMemo(
    () => calcularCustosPorTipo(num(form.folha_producao), num(form.folha_administrativa), capacidades),
    [form.folha_producao, form.folha_administrativa, capacidades]
  );

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleResetar = () => {
    if (configuracaoAtiva) {
      setForm(toForm(configuracaoAtiva));
      toast.info('Alterações descartadas');
    }
  };

  const handleSalvar = async () => {
    if (!configuracaoAtiva) return;
    setSaving(true);
    try {
      const folhaProducao = num(form.folha_producao);
      const folhaAdmin = num(form.folha_administrativa);
      const taxaPerca = num(form.taxa_perca);

      const custos = calcularCustosPorTipo(folhaProducao, folhaAdmin, capacidades);

      // Cache jsonb por tipo
      const modPorTipo: Record<string, number> = {};
      const adminPorTipo: Record<string, number> = {};
      TIPOS_PRODUTO_KEYS.forEach((k) => {
        modPorTipo[k] = custos[k].mod;
        adminPorTipo[k] = custos[k].admin;
      });

      // Compatibilidade: campos legados recebem média ponderada por capacidade
      const totalCap = Object.values(capacidades).reduce((a, b) => a + b, 0);
      const modLegado = totalCap > 0
        ? arredondarReais(folhaProducao / totalCap)
        : num(form.energia_eletrica) ? Number(configuracaoAtiva.mao_obra_direta) : 0;
      const adminLegado = totalCap > 0
        ? arredondarReais(folhaAdmin / totalCap)
        : Number(configuracaoAtiva.despesas_administrativas);

      const novoSnapshot = {
        taxa_perca: taxaPerca,
        folha_producao: folhaProducao,
        folha_administrativa: folhaAdmin,
        energia_eletrica: num(form.energia_eletrica),
        depreciacao_maquinas: num(form.depreciacao_maquinas),
        capacidade_encapsulados: capacidades.encapsulados,
        capacidade_soluvel: capacidades.soluvel,
        capacidade_gummy: capacidades.gummy,
        capacidade_liquido: capacidades.liquido,
        mao_obra_direta_por_tipo: modPorTipo,
        despesas_admin_por_tipo: adminPorTipo,
        mao_obra_direta: modLegado,
        despesas_administrativas: adminLegado,
      };

      const snapshotAnterior = {
        taxa_perca: Number((configuracaoAtiva as any).taxa_perca ?? 20),
        folha_producao: Number((configuracaoAtiva as any).folha_producao ?? 0),
        folha_administrativa: Number((configuracaoAtiva as any).folha_administrativa ?? 0),
        energia_eletrica: Number(configuracaoAtiva.energia_eletrica),
        depreciacao_maquinas: Number(configuracaoAtiva.depreciacao_maquinas),
        capacidade_encapsulados: Number((configuracaoAtiva as any).capacidade_encapsulados ?? 0),
        capacidade_soluvel: Number((configuracaoAtiva as any).capacidade_soluvel ?? 0),
        capacidade_gummy: Number((configuracaoAtiva as any).capacidade_gummy ?? 0),
        capacidade_liquido: Number((configuracaoAtiva as any).capacidade_liquido ?? 0),
        mao_obra_direta_por_tipo: (configuracaoAtiva as any).mao_obra_direta_por_tipo ?? {},
        despesas_admin_por_tipo: (configuracaoAtiva as any).despesas_admin_por_tipo ?? {},
        mao_obra_direta: Number(configuracaoAtiva.mao_obra_direta),
        despesas_administrativas: Number(configuracaoAtiva.despesas_administrativas),
      };

      await updateConfiguracao.mutateAsync({
        id: configuracaoAtiva.id,
        ...novoSnapshot,
      } as any);

      await registrarHistorico.mutateAsync({
        configuracao_id: configuracaoAtiva.id,
        snapshot: novoSnapshot,
        snapshot_anterior: snapshotAnterior,
      });

      toast.success('Custos atualizados — novos orçamentos usarão estes valores');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message ?? 'desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const numericProps = {
    type: 'number' as const,
    inputMode: 'decimal' as const,
    step: '0.01',
    min: '0',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Folhas de pagamento mensais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Folha da Produção (R$/mês)</Label>
            <Input {...numericProps} value={form.folha_producao} onChange={set('folha_producao')} />
            <p className="text-xs text-muted-foreground mt-1">Alimenta o cálculo de Mão de Obra Direta.</p>
          </div>
          <div>
            <Label>Folha Administrativa (R$/mês)</Label>
            <Input {...numericProps} value={form.folha_administrativa} onChange={set('folha_administrativa')} />
            <p className="text-xs text-muted-foreground mt-1">Alimenta o cálculo de Despesas Administrativas.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capacidade mensal de produção</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Encapsulados / Cápsula (un/mês)</Label>
            <Input {...numericProps} step="1" value={form.capacidade_encapsulados} onChange={set('capacidade_encapsulados')} />
          </div>
          <div>
            <Label>Solúvel (un/mês)</Label>
            <Input {...numericProps} step="1" value={form.capacidade_soluvel} onChange={set('capacidade_soluvel')} />
          </div>
          <div>
            <Label>Gummy (un/mês)</Label>
            <Input {...numericProps} step="1" value={form.capacidade_gummy} onChange={set('capacidade_gummy')} />
          </div>
          <div>
            <Label>Líquido (un/mês)</Label>
            <Input {...numericProps} step="1" value={form.capacidade_liquido} onChange={set('capacidade_liquido')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custo unitário derivado (Folha ÷ Capacidade)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {TIPOS_PRODUTO_KEYS.map((k: TipoProdutoKey) => (
            <div key={k} className="rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-semibold text-foreground mb-2">{TIPO_PRODUTO_LABELS[k]}</div>
              <div className="text-xs text-muted-foreground">Mão de Obra Direta</div>
              <div className="text-base font-bold text-primary mb-2">{formatCurrency(custosPorTipo[k].mod)}</div>
              <div className="text-xs text-muted-foreground">Despesas Administrativas</div>
              <div className="text-base font-bold text-primary">{formatCurrency(custosPorTipo[k].admin)}</div>
              <Separator className="my-2" />
              <div className="text-xs text-muted-foreground">
                MOD = {formatCurrency(num(form.folha_producao))} ÷ {capacidades[k] || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Admin = {formatCurrency(num(form.folha_administrativa))} ÷ {capacidades[k] || 0}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Outros custos diretos e Taxa de Perca</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Energia Elétrica (R$/un)</Label>
            <Input {...numericProps} value={form.energia_eletrica} onChange={set('energia_eletrica')} />
          </div>
          <div>
            <Label>Depreciação de Máquinas (R$/un)</Label>
            <Input {...numericProps} value={form.depreciacao_maquinas} onChange={set('depreciacao_maquinas')} />
          </div>
          <div>
            <Label>Taxa de Perca (%)</Label>
            <Input {...numericProps} value={form.taxa_perca} onChange={set('taxa_perca')} />
            <p className="text-xs text-muted-foreground mt-1">Aplicada sobre o custo total de produção.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={handleResetar} disabled={saving}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Descartar alterações
        </Button>
        <Button onClick={handleSalvar} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar e aplicar'}
        </Button>
      </div>
    </div>
  );
}
