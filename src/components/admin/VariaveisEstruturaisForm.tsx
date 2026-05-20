import { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { useHistoricoConfiguracao } from '@/hooks/useHistoricoConfiguracao';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  calcularCustosPorTipo,
  calcularEnergiaPorTipo,
  TIPOS_PRODUTO_KEYS,
  TIPO_PRODUTO_LABELS,
  type TipoProdutoKey,
} from '@/lib/adminCustos';
import { formatCurrency } from '@/lib/unitConversion';
import { arredondarReais } from '@/lib/utils';
import { toast } from 'sonner';

interface DespesaAdmin {
  id: string;
  nome: string;
  custo_mensal: string;
}

interface FormState {
  taxa_perca: string;
  folha_producao: string;
  energia_eletrica_mensal: string;
  depreciacao_maquinas: string;
  capacidade_encapsulados: string;
  capacidade_soluvel: string;
  capacidade_gummy: string;
  capacidade_liquido: string;
}

const blankForm: FormState = {
  taxa_perca: '20',
  folha_producao: '0',
  energia_eletrica_mensal: '0',
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
    energia_eletrica_mensal: String(c?.energia_eletrica_mensal ?? c?.energia_eletrica_total_mensal ?? ''),
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

function novaDespesa(nome = '', custo = 0): DespesaAdmin {
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()),
    nome,
    custo_mensal: String(custo),
  };
}

export function VariaveisEstruturaisForm() {
  const { configuracaoAtiva, updateConfiguracao } = useConfiguracaoCustos();
  const { registrarHistorico } = useHistoricoConfiguracao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(blankForm);
  const [despesas, setDespesas] = useState<DespesaAdmin[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configuracaoAtiva) return;
    const c: any = configuracaoAtiva;
    // Energia mensal: prefere derivar de energia_por_tipo × capacidade (se houver), senão usa legado × capacidade total
    const ept = (c.energia_por_tipo || {}) as Record<string, number>;
    const capEnc = Number(c.capacidade_encapsulados ?? 0);
    const capSol = Number(c.capacidade_soluvel ?? 0);
    const capGum = Number(c.capacidade_gummy ?? 0);
    const capLiq = Number(c.capacidade_liquido ?? 0);
    let energiaMensal = 0;
    if (ept.encapsulados && capEnc) energiaMensal = ept.encapsulados * capEnc;
    else if (ept.soluvel && capSol) energiaMensal = ept.soluvel * capSol;
    else if (ept.gummy && capGum) energiaMensal = ept.gummy * capGum;
    else if (ept.liquido && capLiq) energiaMensal = ept.liquido * capLiq;
    else energiaMensal = Number(c.energia_eletrica ?? 0) * (capEnc + capSol + capGum + capLiq);
    setForm({ ...toForm(c), energia_eletrica_mensal: String(arredondarReais(energiaMensal)) });

    const lista = Array.isArray(c.despesas_admin_lista) ? c.despesas_admin_lista : [];
    if (lista.length) {
      setDespesas(
        lista.map((d: any) => ({
          id: d.id || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
          nome: String(d.nome ?? ''),
          custo_mensal: String(d.custo_mensal ?? 0),
        }))
      );
    } else if (Number(c.folha_administrativa ?? 0) > 0) {
      setDespesas([novaDespesa('Folha Administrativa', Number(c.folha_administrativa))]);
    } else {
      setDespesas([]);
    }
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

  const totalDespesasMensal = useMemo(
    () => despesas.reduce((acc, d) => acc + num(d.custo_mensal), 0),
    [despesas]
  );

  const custosPorTipo = useMemo(
    () => calcularCustosPorTipo(num(form.folha_producao), totalDespesasMensal, capacidades),
    [form.folha_producao, totalDespesasMensal, capacidades]
  );

  const energiaPorTipo = useMemo(
    () => calcularEnergiaPorTipo(num(form.energia_eletrica_mensal), capacidades),
    [form.energia_eletrica_mensal, capacidades]
  );

  const diluirPorTipo = (custoMensal: number) =>
    TIPOS_PRODUTO_KEYS.reduce((acc, k) => {
      acc[k] = capacidades[k] > 0 ? arredondarReais(custoMensal / capacidades[k]) : 0;
      return acc;
    }, {} as Record<TipoProdutoKey, number>);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const updateDespesa = (id: string, campo: 'nome' | 'custo_mensal', valor: string) =>
    setDespesas((arr) => arr.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));

  const removerDespesa = (id: string) =>
    setDespesas((arr) => arr.filter((d) => d.id !== id));

  const adicionarDespesa = () =>
    setDespesas((arr) => [...arr, novaDespesa()]);

  const handleResetar = () => {
    if (configuracaoAtiva) {
      setForm(toForm(configuracaoAtiva));
      const c: any = configuracaoAtiva;
      const lista = Array.isArray(c.despesas_admin_lista) ? c.despesas_admin_lista : [];
      setDespesas(
        lista.map((d: any) => ({
          id: d.id || (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
          nome: String(d.nome ?? ''),
          custo_mensal: String(d.custo_mensal ?? 0),
        }))
      );
      toast.info('Alterações descartadas');
    }
  };

  const handleSalvar = async () => {
    if (!configuracaoAtiva) return;
    setSaving(true);
    try {
      const folhaProducao = num(form.folha_producao);
      const folhaAdmin = totalDespesasMensal;
      const energiaMensal = num(form.energia_eletrica_mensal);
      const taxaPerca = num(form.taxa_perca);

      const custos = calcularCustosPorTipo(folhaProducao, folhaAdmin, capacidades);
      const energias = calcularEnergiaPorTipo(energiaMensal, capacidades);

      // Cache jsonb por tipo
      const modPorTipo: Record<string, number> = {};
      const adminPorTipo: Record<string, number> = {};
      const energiaPorTipoMap: Record<string, number> = {};
      TIPOS_PRODUTO_KEYS.forEach((k) => {
        modPorTipo[k] = custos[k].mod;
        adminPorTipo[k] = custos[k].admin;
        energiaPorTipoMap[k] = energias[k];
      });

      // Compatibilidade: campos legados recebem média ponderada por capacidade
      const totalCap = Object.values(capacidades).reduce((a, b) => a + b, 0);
      const modLegado = totalCap > 0
        ? arredondarReais(folhaProducao / totalCap)
        : Number(configuracaoAtiva.mao_obra_direta) || 0;
      const adminLegado = totalCap > 0
        ? arredondarReais(folhaAdmin / totalCap)
        : Number(configuracaoAtiva.despesas_administrativas);
      const energiaLegada = totalCap > 0
        ? arredondarReais(energiaMensal / totalCap)
        : Number(configuracaoAtiva.energia_eletrica) || 0;

      const despesasParaSalvar = despesas
        .filter((d) => d.nome.trim() || num(d.custo_mensal) > 0)
        .map((d) => ({
          id: d.id,
          nome: d.nome.trim() || 'Despesa',
          custo_mensal: arredondarReais(num(d.custo_mensal)),
        }));

      const novoSnapshot = {
        taxa_perca: taxaPerca,
        folha_producao: folhaProducao,
        folha_administrativa: folhaAdmin,
        energia_eletrica: energiaLegada,
        depreciacao_maquinas: num(form.depreciacao_maquinas),
        capacidade_encapsulados: capacidades.encapsulados,
        capacidade_soluvel: capacidades.soluvel,
        capacidade_gummy: capacidades.gummy,
        capacidade_liquido: capacidades.liquido,
        mao_obra_direta_por_tipo: modPorTipo,
        despesas_admin_por_tipo: adminPorTipo,
        energia_por_tipo: energiaPorTipoMap,
        despesas_admin_lista: despesasParaSalvar,
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
        energia_por_tipo: (configuracaoAtiva as any).energia_por_tipo ?? {},
        despesas_admin_lista: (configuracaoAtiva as any).despesas_admin_lista ?? [],
        mao_obra_direta: Number(configuracaoAtiva.mao_obra_direta),
        despesas_administrativas: Number(configuracaoAtiva.despesas_administrativas),
      };

      await updateConfiguracao.mutateAsync({
        id: configuracaoAtiva.id,
        ...novoSnapshot,
      } as any);

      const histRow = await registrarHistorico.mutateAsync({
        configuracao_id: configuracaoAtiva.id,
        snapshot: novoSnapshot,
        snapshot_anterior: snapshotAnterior,
      });

      // Cria janela de "Prazo de Preços" de 20 dias
      const dataInicio = new Date();
      const dataFim = new Date(dataInicio.getTime() + 20 * 24 * 60 * 60 * 1000);

      // Encerra prazos ativos anteriores (mantém só o mais recente)
      await supabase
        .from('prazo_precos' as any)
        .update({ aplicado: true, aplicado_em: dataInicio.toISOString() })
        .eq('aplicado', false);

      const { data: novoPrazo, error: prazoErr } = await supabase
        .from('prazo_precos' as any)
        .insert({
          historico_id: (histRow as any)?.id ?? null,
          configuracao_id: configuracaoAtiva.id,
          snapshot: novoSnapshot,
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
        })
        .select()
        .single();

      if (prazoErr) throw prazoErr;
      const prazoId = (novoPrazo as any).id;

      // Marca todos os orçamentos não travados, precificações e fórmulas
      const STATUS_TRAVADOS = ['aprovado', 'pago', 'cancelado'];
      await supabase
        .from('orcamentos')
        .update({ prazo_preco_id: prazoId })
        .not('status', 'in', `(${STATUS_TRAVADOS.map((s) => `"${s}"`).join(',')})`);
      await supabase.from('precificacoes').update({ prazo_preco_id: prazoId }).not('id', 'is', null);
      await supabase.from('formulas').update({ prazo_preco_id: prazoId }).not('id', 'is', null);

      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['precificacoes'] });
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-precos-ativos'] });

      toast.success('Custos atualizados — Prazo de Preços de 20 dias iniciado');
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
