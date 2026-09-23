import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, Download, FileSignature, Pencil, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/unitConversion';
import { numeroContratoDoMes } from '@/lib/numeroOrcamentoCliente';
import { montarDadosPedidoCompra } from '@/lib/pedidoCompraAutoFill';
import { baixarPedidoCompraPDF } from '@/lib/pedidoCompraPdf';
import {
  APRESENTACOES, BULBOS, CAMPO_EMBALAGEM_LABEL, CANULAS, CAPSULA_CORES, CAPSULA_TIPOS,
  CANAIS_FORMAIS, DOSADORES, EMBALAGEM_SECUNDARIA, SIM_NAO, camposDaApresentacao,
  PLANO_MARCA_LABEL, POTE_CORES, ROTULO_ACABAMENTOS, ROTULO_MATERIAIS, TAMPA_CORES, TAMPA_TIPOS,
  listarCamposFaltantes,
  type DadosPedidoCompra,
  type EmbalagemPedidoCompra,
  type EspecificacaoProduto,
  type PlanoMarca,
} from '@/types/pedidoCompra';
import type { OrcamentoSnapshot } from '@/types/orcamento';
import { LINHA_PRODUTO_CURTO, linhaDoCliente, type LinhaProduto } from '@/lib/linhaProduto';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Orçamento aprovado pelo cliente, base do Pedido de Compra. */
  snapshot: Partial<OrcamentoSnapshot>;
  cliente?: {
    razao_social?: string | null;
    nome?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    telefone?: string | null;
  } | null;
  /**
   * Número do Pedido de Compra. É o mesmo número do orçamento: definitivo
   * (400, 400-01) quando já foi pago, ou o provisório ORC-xxx antes disso.
   */
  numeroPedido: string;
  onGerar: (payload: {
    numeroContrato: string;
    numeroPedido: string;
    dados: DadosPedidoCompra;
  }) => Promise<void> | void;
  /** Abre o gerador de orçamento; sem isso o botão de editar não aparece. */
  onEditarOrcamento?: () => void;
  /**
   * Preenchimento já salvo. Quando existe, manda sobre o autopreenchimento --
   * o que o consultor digitou vale mais que o que dá para deduzir.
   */
  dadosSalvos?: DadosPedidoCompra | null;
  /** Número de contrato já salvo junto com os dados. */
  contratoSalvo?: string | null;
  /**
   * Chamado ao fechar, com o estado atual. É o que evita perder o preenchimento
   * quando o consultor fecha o popup sem clicar em salvar.
   */
  onAutoSalvar?: (dados: DadosPedidoCompra, numeroContrato: string) => void;
  /**
   * Contrato já conhecido deste cliente. O número é do produtor, não do pedido:
   * uma vez informado, todos os pedidos de compra dele herdam o mesmo.
   */
  numeroContratoSugerido?: string;
}

/** Uma seção do documento, recolhível para a tela não virar um paredão. */
function Secao({
  titulo,
  aberta,
  children,
}: {
  titulo: string;
  aberta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={aberta} className="rounded-md border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
          <span className="text-sm font-semibold">{titulo}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3 space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  obrigatorio,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  obrigatorio?: boolean;
}) {
  const vazio = obrigatorio && !valor.trim();
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      <Input
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={vazio ? 'border-amber-500' : undefined}
      />
    </div>
  );
}

/** Valor do item de menu; nunca e' gravado -- so' liga o modo digitado. */
const PERSONALIZADO = '__personalizado__';

/**
 * Lista com escape para digitar.
 *
 * A lista padroniza o comum; o campo livre cobre o que a fabrica aceita e a
 * lista nao previu, sem obrigar a cadastrar opcao nova a cada pedido. O que
 * fica gravado e' sempre o texto -- quem le' depois nao sabe de onde veio.
 */
function CampoLista({
  label,
  valor,
  opcoes,
  onChange,
  obrigatorio,
}: {
  label: string;
  valor: string;
  opcoes: readonly string[];
  onChange: (v: string) => void;
  obrigatorio?: boolean;
}) {
  // Valor fora da lista so' pode ter vindo de um preenchimento personalizado.
  const [digitando, setDigitando] = useState(() => !!valor && !opcoes.includes(valor));
  useEffect(() => {
    if (valor && !opcoes.includes(valor)) setDigitando(true);
  }, [valor, opcoes]);

  const vazio = obrigatorio && !valor.trim();

  if (digitando) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">
          {label} {obrigatorio && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={valor}
            placeholder="Digite"
            className={vazio ? 'border-amber-500' : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Voltar para a lista"
            onClick={() => {
              setDigitando(false);
              onChange('');
            }}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      <Select
        value={opcoes.includes(valor) ? valor : ''}
        onValueChange={(v) => {
          if (v === PERSONALIZADO) {
            setDigitando(true);
            onChange('');
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger className={vazio ? 'border-amber-500' : undefined}>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          <SelectItem value={PERSONALIZADO}>Personalizado…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Valor em real: mostra formatado (R$ 12.134,82) e digita so' digitos, tratando
 * os dois ultimos como centavos. Evita a ambiguidade de ponto e virgula.
 */
function CampoMoeda({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <Input
      inputMode="numeric"
      value={formatCurrency(valor || 0)}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '');
        onChange(digitos ? Number(digitos) / 100 : 0);
      }}
    />
  );
}

export default function PedidoDeCompraDialog({
  open,
  onOpenChange,
  snapshot,
  cliente,
  numeroPedido,
  onGerar,
  onEditarOrcamento,
  numeroContratoSugerido,
  dadosSalvos,
  contratoSalvo,
  onAutoSalvar,
}: Props) {
  const [numeroContrato, setNumeroContrato] = useState(
    numeroContratoSugerido || numeroContratoDoMes(),
  );
  const [dados, setDados] = useState<DadosPedidoCompra>(
    () => dadosSalvos ?? montarDadosPedidoCompra({ snapshot, cliente }),
  );
  const [salvando, setSalvando] = useState(false);

  /**
   * Salvamento automatico.
   *
   * `ultimo` guarda o que esta' na tela para poder gravar no desmonte: fechar o
   * dialogo PAI remove este sem passar por `onOpenChange`, e sem isso tudo que
   * foi digitado se perde. A espera evita gravar a cada tecla; `pronto` impede
   * que a montagem inicial grave por cima do que ja' existia.
   */
  const pronto = useRef(false);
  const ultimo = useRef({ dados, numeroContrato });
  ultimo.current = { dados, numeroContrato };
  const salvarRef = useRef(onAutoSalvar);
  salvarRef.current = onAutoSalvar;
  const jaGravou = useRef(false);

  const gravar = () => {
    if (!salvarRef.current) return;
    jaGravou.current = true;
    salvarRef.current(ultimo.current.dados, ultimo.current.numeroContrato);
  };

  useEffect(() => {
    if (!pronto.current) {
      pronto.current = true;
      return;
    }
    if (!onAutoSalvar) return;
    const t = setTimeout(gravar, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, numeroContrato]);

  useEffect(
    () => () => {
      if (pronto.current) gravar();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Reabrir o diálogo para outro produtor tem que recomeçar do zero.
  useEffect(() => {
    if (open) {
      setDados(dadosSalvos ?? montarDadosPedidoCompra({ snapshot, cliente }));
      setNumeroContrato(contratoSalvo || numeroContratoSugerido || numeroContratoDoMes());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, numeroContratoSugerido, contratoSalvo]);

  /**
   * Completa a composicao a partir de "Produtos Criados".
   *
   * O snapshot do orcamento nem sempre carrega `insumos_formula` -- orcamentos
   * antigos nao guardavam. A formula e' a fonte que sempre tem insumo e dose,
   * entao ela preenche o que falta, sem sobrescrever o que ja' veio do que foi
   * efetivamente vendido.
   */
  useEffect(() => {
    if (!open || dadosSalvos) return;
    const itens = (snapshot.itens_producao || []) as any[];
    const ids = itens.map((i) => i.precificacao_id).filter(Boolean);
    if (ids.length === 0) return;

    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('precificacoes')
        .select('id, formulas(itens, cliente)')
        .in('id', ids);
      if (cancelado || error || !data) return;

      const porPrecificacao = new Map<string, { insumo: string; dose: string }[]>();
      // Orcamentos antigos nao gravaram a linha no item; da' para deduzir pelo
      // cliente da formula, que e' o criterio de catalogo do sistema.
      const linhaPorPrecificacao = new Map<string, LinhaProduto>();
      data.forEach((row: any) => {
        linhaPorPrecificacao.set(row.id, linhaDoCliente(row.formulas?.cliente));
        const formulaItens = (row.formulas?.itens || []) as any[];
        porPrecificacao.set(
          row.id,
          formulaItens
            .filter((it) => String(it?.nome_insumo_snapshot || '').trim())
            .map((it) => ({
              insumo: String(it.nome_insumo_snapshot).trim(),
              dose: `${String(it.qtd_informada ?? '').replace('.', ',')} ${it.unidade_informada || ''}`.trim(),
            })),
        );
      });

      setDados((d) => ({
        ...d,
        produtos: d.produtos.map((p, i) =>
          p.linha ? p : { ...p, linha: linhaPorPrecificacao.get(itens[i]?.precificacao_id) },
        ),
        especificacoes: d.especificacoes.map((esp, i) => {
          if (esp.composicao.some((a) => a.insumo.trim())) return esp;
          const daFormula = porPrecificacao.get(itens[i]?.precificacao_id);
          return daFormula?.length ? { ...esp, composicao: daFormula } : esp;
        }),
      }));
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof DadosPedidoCompra>(campo: K, valor: DadosPedidoCompra[K]) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  /** Atualiza uma especificacao de produto pelo indice. */
  const setEspec = (indice: number, patch: Partial<EspecificacaoProduto>) =>
    setDados((d) => ({
      ...d,
      especificacoes: d.especificacoes.map((e, i) => (i === indice ? { ...e, ...patch } : e)),
    }));

  const setEmb = (indice: number, patch: Partial<EmbalagemPedidoCompra>) =>
    setDados((d) => ({
      ...d,
      especificacoes: d.especificacoes.map((e, i) =>
        i === indice ? { ...e, embalagem: { ...e.embalagem, ...patch } } : e,
      ),
    }));

  /** O dobro dos potes daquele produto -- a regra de sobra de rotulo. */
  const sugestaoRotulo = (indice: number): string => {
    const nome = dados.especificacoes[indice]?.produto_nome?.trim().toLowerCase();
    const produto = dados.produtos.find((p) => p.descricao.trim().toLowerCase() === nome)
      ?? dados.produtos[indice];
    const qtd = Number(produto?.quantidade) || 0;
    return qtd > 0 ? String(qtd * 2) : '';
  };

  const faltantes = useMemo(
    () => listarCamposFaltantes(dados, numeroContrato),
    [dados, numeroContrato],
  );
  const completo = faltantes.length === 0;

  const totalProdutos = dados.produtos.reduce(
    (s, p) => s + (p.preco_unitario || 0) * (p.quantidade || 0),
    0,
  );

  const handleBaixar = () => {
    if (!completo) {
      toast.error('Complete os campos pendentes antes de baixar o Pedido de Compra.');
      return;
    }
    baixarPedidoCompraPDF({ numeroPedido, numeroContrato, dados });
  };

  const handleGerar = async () => {
    if (!completo) {
      toast.error('Complete os campos pendentes antes de gerar o pedido.');
      return;
    }
    setSalvando(true);
    try {
      await onGerar({ numeroContrato: numeroContrato.trim(), numeroPedido, dados });
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        // Fechar sem salvar era o que apagava tudo que o consultor preencheu.
        if (!aberto) onAutoSalvar?.(dados, numeroContrato);
        onOpenChange(aberto);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Pedido de Compra
          </DialogTitle>
          <DialogDescription>
            Preenchido a partir do CNPJ do produtor e do orçamento. Confira e complete o que faltar.
          </DialogDescription>
        </DialogHeader>

        {/* Numeração: contrato vem do financeiro, o número do pedido é calculado. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">
              Número do contrato <span className="text-destructive">*</span>
            </Label>
            <Input
              value={numeroContrato}
              onChange={(e) => setNumeroContrato(e.target.value)}
              placeholder="Solicite ao financeiro — ex.: 260922"
              className={!numeroContrato.trim() ? 'border-amber-500' : undefined}
            />
            <p className="text-[11px] text-muted-foreground">
              {numeroContratoSugerido
                ? 'Contrato já cadastrado para este cliente.'
                : `Sugerido pelo mês (${numeroContratoDoMes()}). Substitua pelo número que o financeiro informar.`}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Número do pedido (calculado)</Label>
            <div className="h-10 flex items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold">
              {numeroPedido || '—'}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mesmo número do orçamento que originou este pedido.
            </p>
          </div>
        </div>

        {faltantes.length > 0 && (
          <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Falta preencher para o financeiro aceitar
            </p>
            <ul className="mt-1 text-xs text-amber-800 dark:text-amber-400 list-disc pl-5">
              {faltantes.map((f, i) => (
                <li key={`${f.campo}-${i}`}>{f.label}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Secao titulo="1. Identificação" aberta>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Contratante (razão social / nome)"
                valor={dados.contratante}
                onChange={(v) => set('contratante', v)}
                obrigatorio
              />
              <Campo
                label="CNPJ / CPF"
                valor={dados.cnpj_cpf}
                onChange={(v) => set('cnpj_cpf', v)}
                obrigatorio
              />
              <Campo
                label="Faturamento em"
                valor={dados.faturamento_em}
                onChange={(v) => set('faturamento_em', v)}
              />
              <div className="space-y-1">
                <Label className="text-xs">Data do pedido</Label>
                <Input
                  type="date"
                  value={dados.data_pedido}
                  onChange={(e) => set('data_pedido', e.target.value)}
                />
              </div>
              <CampoLista
                label="Canal formal"
                valor={dados.canal_formal}
                opcoes={CANAIS_FORMAIS}
                onChange={(v) => set('canal_formal', v)}
                obrigatorio
              />
            </div>
          </Secao>

          <Secao titulo={`2. Produtos (${dados.produtos.length})`} aberta>
            {/* Os produtos sao os do orcamento. Preco, quantidade e margem se
                decidem la', no passo de Custos de Producao -- repetir a edicao
                aqui abriria caminho para o documento divergir do orcamento. */}
            <div className="rounded-md border divide-y">
              {dados.produtos.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  O orçamento vinculado não tem produtos.
                </p>
              ) : (
                dados.produtos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{p.descricao}</p>
                        {p.linha && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-5 px-1.5 text-[10px]',
                              p.linha === 'white_label'
                                ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                                : 'border-blue-500 text-blue-700 dark:text-blue-400',
                            )}
                          >
                            {LINHA_PRODUTO_CURTO[p.linha]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.apresentacao}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        {p.quantidade} × {formatCurrency(p.preco_unitario)}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrency((p.preco_unitario || 0) * (p.quantidade || 0))}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between p-3 bg-muted/40">
                <span className="text-sm font-semibold">Valor total do pedido</span>
                <span className="text-sm font-semibold">{formatCurrency(totalProdutos)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Vem do orçamento vinculado. Para trocar produto, preço unitário, quantidade de potes
                ou margem, edite o orçamento.
              </p>
              {onEditarOrcamento && (
                <Button variant="outline" size="sm" onClick={onEditarOrcamento}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar no orçamento
                </Button>
              )}
            </div>
          </Secao>

          <Secao titulo="3. Condições comerciais">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Plano de marca</Label>
                <Select
                  value={dados.plano_marca}
                  onValueChange={(v) => set('plano_marca', v as PlanoMarca)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLANO_MARCA_LABEL).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entregáveis do plano</Label>
                <Input
                  value={dados.entregaveis.join(' | ')}
                  placeholder="ficha técnica | logo | rótulo | mockups"
                  onChange={(e) =>
                    set(
                      'entregaveis',
                      e.target.value
                        .split('|')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor de setup / rótulo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dados.valor_setup}
                  onChange={(e) => set('valor_setup', Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor de produção</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dados.valor_producao}
                  onChange={(e) => set('valor_producao', Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Endereço de entrega <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={dados.endereco_entrega}
                placeholder="Endereço completo, com complemento e ponto de referência"
                onChange={(e) => set('endereco_entrega', e.target.value)}
                className={!dados.endereco_entrega.trim() ? 'border-amber-500' : undefined}
              />
            </div>
            <Campo
              label="Contato no local (nome e telefone)"
              valor={dados.contato_local}
              onChange={(v) => set('contato_local', v)}
              obrigatorio
            />
            <p className="text-[11px] text-muted-foreground">
              Prazos e entrada mínima seguem o padrão do contrato: rótulo {dados.prazo_rotulo_primeira_versao}/
              {dados.prazo_rotulo_correcao} dias úteis, produção {dados.prazo_producao_dias} dias corridos,
              entrega até {dados.prazo_entrega_dias} dias úteis, entrada mínima{' '}
              {dados.entrada_minima_percentual}%.
            </p>
          </Secao>

          <Secao titulo={`4. Condições de pagamento (${dados.parcelas.length})`}>
            <p className="text-[11px] text-muted-foreground">
              Vem das condições fechadas no Contrato Mãe. Ajuste aqui só se o financeiro pedir.
            </p>
            {dados.parcelas.map((parcela, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-4 items-end rounded-md border p-3">
                <Campo
                  label={`Parcela ${i + 1} — meio`}
                  valor={parcela.meio_pagamento}
                  placeholder="PIX / cartão / boleto"
                  onChange={(v) =>
                    set('parcelas', dados.parcelas.map((x, j) => (j === i ? { ...x, meio_pagamento: v } : x)))
                  }
                />
                <div className="space-y-1">
                  <Label className="text-xs">Vencimento</Label>
                  <Input
                    type="date"
                    value={parcela.vencimento}
                    onChange={(e) =>
                      set('parcelas', dados.parcelas.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <CampoMoeda
                    valor={parcela.valor}
                    onChange={(v) =>
                      set('parcelas', dados.parcelas.map((x, j) => (j === i ? { ...x, valor: v } : x)))
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set('parcelas', dados.parcelas.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  set('parcelas', [...dados.parcelas, { meio_pagamento: '', vencimento: '', valor: 0 }])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
              </Button>
              <span className="text-sm font-semibold">
                Total {formatCurrency(dados.parcelas.reduce((s, p) => s + (p.valor || 0), 0))}
              </span>
            </div>
          </Secao>

          {/* Uma secao por produto: composicao e embalagem andam juntas, porque
              e' assim que a fabrica le' -- produto, formula, embalagem. */}
          {dados.especificacoes.map((esp, idx) => (
            <Secao
              key={idx}
              titulo={`5.${idx + 1} ${esp.produto_nome || `Produto ${idx + 1}`} — fórmula e embalagem`}
              aberta={dados.especificacoes.length === 1}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Produto"
                  valor={esp.produto_nome}
                  onChange={(v) => setEspec(idx, { produto_nome: v })}
                  obrigatorio
                />
                <Campo
                  label="Quantidade por frasco"
                  valor={esp.quantidade_por_frasco}
                  onChange={(v) => setEspec(idx, { quantidade_por_frasco: v })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Composição da fórmula</Label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] text-muted-foreground">
                  <span>Insumo</span>
                  <span>Dose diária</span>
                  <span />
                </div>
                {esp.composicao.map((ativo, ai) => (
                  <div key={ai} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={ativo.insumo}
                      placeholder="Ativo"
                      onChange={(e) =>
                        setEspec(idx, {
                          composicao: esp.composicao.map((a, j) =>
                            j === ai ? { ...a, insumo: e.target.value } : a,
                          ),
                        })
                      }
                    />
                    <Input
                      value={ativo.dose}
                      placeholder="500 mg"
                      onChange={(e) =>
                        setEspec(idx, {
                          composicao: esp.composicao.map((a, j) =>
                            j === ai ? { ...a, dose: e.target.value } : a,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEspec(idx, { composicao: esp.composicao.filter((_, j) => j !== ai) })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEspec(idx, { composicao: [...esp.composicao, { insumo: '', dose: '' }] })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar insumo
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <CampoLista
                  label="Apresentação"
                  valor={esp.embalagem.apresentacao}
                  opcoes={APRESENTACOES}
                  onChange={(v) => setEmb(idx, { apresentacao: v })}
                  obrigatorio
                />

                {/* Cada apresentacao pede a sua embalagem: perguntar cor de
                    capsula num liquido so' geraria campo em branco. */}
                {camposDaApresentacao(esp.embalagem.apresentacao).map((campo) => {
                  const rotulo = CAMPO_EMBALAGEM_LABEL[campo];
                  const valor = String((esp.embalagem as any)[campo] ?? '');
                  const lista: Record<string, readonly string[]> = {
                    capsula_tipo: CAPSULA_TIPOS,
                    capsula_cor: CAPSULA_CORES,
                    bulbo: BULBOS,
                    canula: CANULAS,
                    pote_cor: POTE_CORES,
                    tampa_tipo: TAMPA_TIPOS,
                    tampa_cor: TAMPA_CORES,
                    silica: SIM_NAO,
                    dosador: DOSADORES,
                    rotulo_material: ROTULO_MATERIAIS,
                    rotulo_acabamento: ROTULO_ACABAMENTOS,
                    embalagem_secundaria: EMBALAGEM_SECUNDARIA,
                  };

                  if (campo === 'lacre_inducao') {
                    return (
                      <div key={campo} className="flex items-center gap-2 pt-6">
                        <Checkbox
                          id={`lacre-${idx}`}
                          checked={esp.embalagem.lacre_inducao}
                          onCheckedChange={(c) => setEmb(idx, { lacre_inducao: c === true })}
                        />
                        <Label htmlFor={`lacre-${idx}`} className="text-xs">{rotulo}</Label>
                      </div>
                    );
                  }

                  if (campo === 'fornecimento_embalagem') {
                    return (
                      <div key={campo} className="space-y-1">
                        <Label className="text-xs">
                          {rotulo} <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={esp.embalagem.fornecimento_embalagem}
                          onValueChange={(v) =>
                            setEmb(idx, { fornecimento_embalagem: v as 'CONTRATADA' | 'CONTRATANTE' })
                          }
                        >
                          <SelectTrigger className={!valor ? 'border-amber-500' : undefined}>
                            <SelectValue placeholder="Por conta de..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTRATADA">CONTRATADA (Lemoncaps)</SelectItem>
                            <SelectItem value="CONTRATANTE">CONTRATANTE (produtor)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  if (campo === 'rotulo_quantidade') {
                    return (
                      <div key={campo} className="space-y-1">
                        <Label className="text-xs">
                          {rotulo} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={valor}
                          className={!valor ? 'border-amber-500' : undefined}
                          onChange={(e) => setEmb(idx, { rotulo_quantidade: e.target.value })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Sugestão: o dobro dos potes do pedido
                          {sugestaoRotulo(idx) ? ` (${sugestaoRotulo(idx)})` : ''}.
                        </p>
                      </div>
                    );
                  }

                  const opcoes = lista[campo];
                  if (opcoes) {
                    return (
                      <CampoLista
                        key={campo}
                        label={rotulo}
                        valor={valor}
                        opcoes={opcoes}
                        onChange={(v) => setEmb(idx, { [campo]: v } as any)}
                        obrigatorio
                      />
                    );
                  }

                  return (
                    <Campo
                      key={campo}
                      label={rotulo}
                      valor={valor}
                      onChange={(v) => setEmb(idx, { [campo]: v } as any)}
                      obrigatorio
                    />
                  );
                })}
              </div>
            </Secao>
          ))}


          <Secao titulo="Assinatura do contratante">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Nome do representante legal"
                valor={dados.representante_nome}
                onChange={(v) => set('representante_nome', v)}
                obrigatorio
              />
              <Campo
                label="CPF do representante legal"
                valor={dados.representante_cpf}
                onChange={(v) => set('representante_cpf', v)}
                obrigatorio
              />
            </div>
          </Secao>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {onAutoSalvar ? 'O preenchimento é salvo sozinho. ' : ''}
          O envio automático ao ZapSign ainda não está ligado: baixe o PDF e conduza a assinatura
          normalmente.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Badge variant="outline" className={completo ? 'border-green-500 text-green-700' : 'border-amber-500 text-amber-700'}>
            {completo ? 'Pronto para assinatura' : `${faltantes.length} campo(s) pendente(s)`}
          </Badge>
          <div className="flex gap-2">
            {/* O preenchimento ja' e' salvo sozinho; este botao e' so' a
                confirmacao imediata, para quem quer ver que gravou. */}
            {onAutoSalvar && (
              <Button
                variant="outline"
                onClick={() => {
                  onAutoSalvar(dados, numeroContrato);
                  toast.success('Pedido de Compra salvo.');
                }}
                title="O preenchimento já é salvo sozinho; use para confirmar agora"
              >
                <Save className="h-4 w-4 mr-1" /> Salvar agora
              </Button>
            )}
            {!onAutoSalvar && (
              <Button
                variant="outline"
                onClick={handleGerar}
                disabled={!completo || salvando}
                title="Grava o número do contrato no pedido e marca como pendente de assinatura"
              >
                <FileSignature className="h-4 w-4 mr-1" />
                {salvando ? 'Salvando...' : 'Salvar no pedido'}
              </Button>
            )}
            <Button onClick={handleBaixar} disabled={!completo}>
              <Download className="h-4 w-4 mr-1" /> Baixar Pedido de Compra
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
