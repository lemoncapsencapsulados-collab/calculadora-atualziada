import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useInsumos } from '@/hooks/useInsumos';
import { usePrecificacao } from '@/hooks/usePrecificacao';
import InsumoAutocomplete from '@/components/InsumoAutocomplete';
import { cn } from '@/lib/utils';
import { calcularCustoInsumo, formatCurrency, formatCurrencyPrecise } from '@/lib/unitConversion';
import { calcularPrecificacaoPorPreco, precoParaMargem, validarMargemPorTipo } from '@/lib/precificacaoCalculator';
import type { ConfiguracaoCustos } from '@/types/precificacao';
import type { FormulaItem, Insumo, UnitType } from '@/types/formula';

const UNIDADES: UnitType[] = ['mcg', 'mg', 'g', 'kg', 'mL', 'L', 'UI', 'unidade'];

/** Linha editável da fórmula, com o custo já resolvido (ou o erro de conversão). */
interface Linha {
  chave: string;
  insumoId: string;
  nome: string;
  quantidade: string;
  unidade: UnitType;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  precificacaoId: string;
  formulaId: string;
  nomeFormula: string;
  tipoProduto: string;
  /** Margem que a precificação tinha ao abrir; base da sugestão de preço. */
  margemOriginal?: number;
  /** Embalagem não é editada aqui; entra fixa na conta da margem. */
  custoEmbalagem: number;
  precoVendaAtual: number;
  configuracaoAtiva: ConfiguracaoCustos | null;
  onSalvo?: () => void;
}

export default function EditarFormulaDialog({
  open,
  onOpenChange,
  precificacaoId,
  formulaId,
  nomeFormula,
  tipoProduto,
  margemOriginal,
  custoEmbalagem,
  precoVendaAtual,
  configuracaoAtiva,
  onSalvo,
}: Props) {
  const { insumos } = useInsumos();
  const { atualizarPrecificacao } = usePrecificacao();

  const [nome, setNome] = useState(nomeFormula);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [precoVenda, setPrecoVenda] = useState(String(precoVendaAtual ?? 0));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mpOriginal, setMpOriginal] = useState(0);

  // Carrega a fórmula ao abrir: a lista não traz os itens, só o resumo.
  useEffect(() => {
    if (!open || !formulaId) return;
    let cancelado = false;
    setCarregando(true);
    (async () => {
      const { data, error } = await supabase
        .from('formulas')
        .select('itens, total_mp')
        .eq('id', formulaId)
        .single();
      if (cancelado) return;
      if (error) {
        toast.error('Erro ao carregar a fórmula: ' + error.message);
        setCarregando(false);
        return;
      }
      const itens = ((data?.itens || []) as unknown as FormulaItem[]) || [];
      setLinhas(
        itens.map((i, idx) => ({
          chave: `${i.insumo_id}-${idx}`,
          insumoId: i.insumo_id,
          nome: i.nome_insumo_snapshot,
          quantidade: String(i.qtd_informada ?? ''),
          unidade: (i.unidade_informada || 'mg') as UnitType,
        })),
      );
      setMpOriginal(Number(data?.total_mp) || 0);
      setPrecoVenda(String(precoVendaAtual ?? 0));
      setNome(nomeFormula);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formulaId]);

  const insumosPorId = useMemo(() => {
    const m = new Map<string, Insumo>();
    insumos.forEach((i) => m.set(i.id, i));
    return m;
  }, [insumos]);

  /** Custo de cada linha, recalculado a cada tecla — igual à calculadora. */
  const calculadas = useMemo(
    () =>
      linhas.map((l) => {
        const insumo = insumosPorId.get(l.insumoId);
        const qtd = parseFloat(l.quantidade);
        if (!insumo || !Number.isFinite(qtd) || qtd <= 0) {
          return { linha: l, insumo, custo: 0, erro: insumo ? null : 'Matéria-prima não encontrada' };
        }
        try {
          const item: FormulaItem = {
            insumo_id: l.insumoId,
            nome_insumo_snapshot: l.nome,
            qtd_informada: qtd,
            unidade_informada: l.unidade,
            custo_calculado: 0,
          };
          return { linha: l, insumo, custo: calcularCustoInsumo(item, insumo), erro: null };
        } catch (e: any) {
          return { linha: l, insumo, custo: 0, erro: e.message as string };
        }
      }),
    [linhas, insumosPorId],
  );

  const totalMp = useMemo(
    () => calculadas.reduce((s, c) => s + (c.custo || 0), 0),
    [calculadas],
  );
  const temErro = calculadas.some((c) => c.erro);
  const diferencaMp = totalMp - mpOriginal;

  const resultado = useMemo(() => {
    const preco = parseFloat(precoVenda);
    if (!configuracaoAtiva || !Number.isFinite(preco) || preco <= 0) return null;
    try {
      return calcularPrecificacaoPorPreco(
        { custoMateriaPrima: totalMp, custoEmbalagem: Number(custoEmbalagem) || 0 },
        { maoObraDireta: 0, energia: 0, depreciacao: 0, administrativo: 0 },
        preco,
        configuracaoAtiva,
      );
    } catch {
      return null;
    }
  }, [precoVenda, totalMp, custoEmbalagem, configuracaoAtiva]);

  const validacao = resultado
    ? validarMargemPorTipo(resultado.margemLucroPercentual, tipoProduto)
    : null;

  /**
   * Preco que devolveria a margem que a precificacao tinha ao abrir.
   * So' aparece quando o custo mudou e o preco atual ja' nao entrega essa
   * margem -- sugerir o que ja' esta' na tela seria ruido.
   */
  const sugestao = useMemo(() => {
    if (!margemOriginal || !resultado) return null;
    const alvo = precoParaMargem(resultado.totalCustosProducao, margemOriginal);
    if (alvo === null) return null;
    const precoAtual = parseFloat(precoVenda);
    if (Number.isFinite(precoAtual) && Math.abs(alvo - precoAtual) < 0.01) return null;
    return alvo;
  }, [margemOriginal, resultado, precoVenda]);

  const precoAnterior = Number(precoVendaAtual) || 0;
  const mudouPreco = Math.abs((parseFloat(precoVenda) || 0) - precoAnterior) >= 0.01;

  const atualizarLinha = (chave: string, patch: Partial<Linha>) =>
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));

  const salvar = async () => {
    if (temErro) {
      toast.error('Corrija as matérias-primas com erro antes de salvar.');
      return;
    }
    if (!resultado) {
      toast.error('Informe um preço de venda válido.');
      return;
    }
    const validas = calculadas.filter((c) => c.insumo && c.custo > 0);
    if (validas.length === 0) {
      toast.error('A fórmula precisa de ao menos uma matéria-prima válida.');
      return;
    }

    setSalvando(true);
    try {
      const itens: FormulaItem[] = validas.map((c) => ({
        insumo_id: c.linha.insumoId,
        nome_insumo_snapshot: c.insumo!.nome,
        qtd_informada: parseFloat(c.linha.quantidade),
        unidade_informada: c.linha.unidade,
        custo_calculado: c.custo,
      }));

      // A fórmula e a precificação andam juntas: mudar a matéria-prima sem
      // atualizar a margem deixaria a precificação mentindo.
      const { error: erroFormula } = await supabase
        .from('formulas')
        .update({
          ...(nome.trim() ? { nome_formula: nome.trim() } : {}),
          itens: itens as any,
          total_mp: totalMp,
          custo_total: totalMp + (Number(custoEmbalagem) || 0),
        })
        .eq('id', formulaId);
      if (erroFormula) throw erroFormula;

      await atualizarPrecificacao.mutateAsync({
        id: precificacaoId,
        custo_materia_prima: resultado.custoMateriaPrima,
        custo_embalagem: resultado.custoEmbalagem,
        custo_mao_obra_direta: resultado.custoMaoObraDireta,
        subtotal_custos_diretos: resultado.subtotalCustosDiretos,
        subtotal_custos_indiretos: resultado.subtotalCustosIndiretos,
        total_custos_producao: resultado.totalCustosProducao,
        total_impostos: resultado.totalImpostos,
        preco_venda: resultado.precoVenda,
        markup_bruto: resultado.markupBruto,
        margem_lucro_percentual: resultado.margemLucroPercentual,
        margem_lucro_valor: resultado.margemLucroValor,
      } as any);

      toast.success('Fórmula e precificação atualizadas.');
      onSalvo?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Editar fórmula</DialogTitle>
          <DialogDescription>
            {nomeFormula} — ajuste as matérias-primas e veja a margem se refazer na hora.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          {carregando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando fórmula...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Nome da fórmula</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              {/* Cabecalho uma vez so': repetir rotulo em cada linha inflava a
                  altura e empurrava os insumos do fim para fora da tela. */}
              <div className="grid grid-cols-[1fr_90px_84px_84px_32px] items-center gap-2 px-1 text-[11px] text-muted-foreground">
                <span>Matéria-prima</span>
                <span>Qtd. por dose</span>
                <span>Unidade</span>
                <span className="text-right">Custo</span>
                <span />
              </div>

              <div className="space-y-1">
                {calculadas.map(({ linha, custo, erro }) => (
                  <div key={linha.chave}>
                    <div
                      className={cn(
                        'grid grid-cols-[1fr_90px_84px_84px_32px] items-center gap-2 rounded-md px-1 py-1',
                        erro && 'bg-destructive/5',
                      )}
                    >
                      <InsumoAutocomplete
                        insumos={insumos}
                        value={linha.nome}
                        onSelect={(i) => atualizarLinha(linha.chave, { insumoId: i.id, nome: i.nome })}
                      />
                      <Input
                        type="number"
                        step="any"
                        className="h-9"
                        value={linha.quantidade}
                        onChange={(e) => atualizarLinha(linha.chave, { quantidade: e.target.value })}
                      />
                      <Select
                        value={linha.unidade}
                        onValueChange={(v) => atualizarLinha(linha.chave, { unidade: v as UnitType })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-right text-xs tabular-nums">
                        {formatCurrencyPrecise(custo)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLinhas((prev) => prev.filter((l) => l.chave !== linha.chave))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {erro && (
                      <p className="flex items-center gap-1 px-1 pb-1 text-[11px] text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {erro}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLinhas((prev) => [
                    ...prev,
                    {
                      chave: `nova-${Date.now()}`,
                      insumoId: '',
                      nome: '',
                      quantidade: '',
                      unidade: 'mg',
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar matéria-prima
              </Button>

            </div>
          )}
        </ScrollArea>

        {/* Rodape enxuto: custo, preco e margem numa linha. E' a decisao do
            consultor, entao fica sempre visivel -- mas sem roubar altura da
            lista de insumos, que e' o que ele esta' editando. */}
        <div className="shrink-0 space-y-2 border-t bg-muted/20 px-6 py-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="text-xs text-muted-foreground">
              <span>MP {formatCurrency(totalMp)}</span>
              {Math.abs(diferencaMp) > 0.004 && (
                <span className={cn('ml-1', diferencaMp > 0 ? 'text-destructive' : 'text-green-700 dark:text-green-400')}>
                  ({diferencaMp > 0 ? '+' : '−'}{formatCurrency(Math.abs(diferencaMp))})
                </span>
              )}
              <span className="mx-2 opacity-40">·</span>
              <span>Emb {formatCurrency(Number(custoEmbalagem) || 0)}</span>
              {resultado && (
                <>
                  <span className="mx-2 opacity-40">·</span>
                  <span className="font-medium text-foreground">
                    Custo {formatCurrency(resultado.totalCustosProducao)}
                  </span>
                </>
              )}
            </div>

            <div className="ml-auto flex items-end gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Preço de venda</Label>
                <Input
                  type="number"
                  step="0.00001"
                  className="h-9 w-32"
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                />
              </div>
              {resultado && (
                <div className="pb-1 text-right">
                  <Badge variant="outline" className={cn('text-sm', validacao?.color, validacao?.borderColor)}>
                    {resultado.margemLucroPercentual.toFixed(1)}%
                  </Badge>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatCurrency(resultado.margemLucroValor)} / un.
                  </p>
                </div>
              )}
            </div>
          </div>

          {sugestao !== null && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Manter {margemOriginal!.toFixed(1)}% pede {formatCurrency(sugestao)}
              </span>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setPrecoVenda(sugestao.toFixed(2))}>
                Usar
              </Button>
              {mudouPreco && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPrecoVenda(precoAnterior.toFixed(2))}
                >
                  Voltar a {formatCurrency(precoAnterior)}
                </Button>
              )}
            </div>
          )}

          {validacao?.mensagem && (
            <p className={cn('text-[11px]', validacao.color)}>{validacao.mensagem}</p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || carregando || temErro || !resultado}>
            <Save className="mr-1 h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar fórmula e margem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
