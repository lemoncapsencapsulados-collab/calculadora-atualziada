import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, Download, FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/unitConversion';
import { numeroContratoDoMes } from '@/lib/numeroOrcamentoCliente';
import { montarDadosPedidoCompra } from '@/lib/pedidoCompraAutoFill';
import { baixarPedidoCompraPDF } from '@/lib/pedidoCompraPdf';
import {
  PLANO_MARCA_LABEL,
  listarCamposFaltantes,
  type DadosPedidoCompra,
  type PlanoMarca,
} from '@/types/pedidoCompra';
import type { OrcamentoSnapshot } from '@/types/orcamento';

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

export default function PedidoDeCompraDialog({
  open,
  onOpenChange,
  snapshot,
  cliente,
  numeroPedido,
  onGerar,
  onEditarOrcamento,
  numeroContratoSugerido,
}: Props) {
  const [numeroContrato, setNumeroContrato] = useState(
    numeroContratoSugerido || numeroContratoDoMes(),
  );
  const [dados, setDados] = useState<DadosPedidoCompra>(() =>
    montarDadosPedidoCompra({ snapshot, cliente }),
  );
  const [salvando, setSalvando] = useState(false);

  // Reabrir o diálogo para outro produtor tem que recomeçar do zero.
  useEffect(() => {
    if (open) {
      setDados(montarDadosPedidoCompra({ snapshot, cliente }));
      setNumeroContrato(numeroContratoSugerido || numeroContratoDoMes());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, numeroContratoSugerido]);

  const set = <K extends keyof DadosPedidoCompra>(campo: K, valor: DadosPedidoCompra[K]) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const setEmbalagem = <K extends keyof DadosPedidoCompra['embalagem']>(
    campo: K,
    valor: DadosPedidoCompra['embalagem'][K],
  ) => setDados((d) => ({ ...d, embalagem: { ...d.embalagem, [campo]: valor } }));

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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Campo
                label="Canal formal"
                valor={dados.canal_formal}
                onChange={(v) => set('canal_formal', v)}
                placeholder="Grupo de WhatsApp ou e-mail"
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
                      <p className="text-sm font-medium">{p.descricao}</p>
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
            {dados.parcelas.map((parcela, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-4 items-end rounded-md border p-3">
                <Campo
                  label={`Parcela ${i + 1} — meio`}
                  valor={parcela.meio_pagamento}
                  placeholder="PIX / cartão / boleto"
                  onChange={(v) =>
                    set(
                      'parcelas',
                      dados.parcelas.map((x, j) => (j === i ? { ...x, meio_pagamento: v } : x)),
                    )
                  }
                />
                <div className="space-y-1">
                  <Label className="text-xs">Vencimento</Label>
                  <Input
                    type="date"
                    value={parcela.vencimento}
                    onChange={(e) =>
                      set(
                        'parcelas',
                        dados.parcelas.map((x, j) =>
                          j === i ? { ...x, vencimento: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parcela.valor}
                    onChange={(e) =>
                      set(
                        'parcelas',
                        dados.parcelas.map((x, j) =>
                          j === i ? { ...x, valor: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    set(
                      'parcelas',
                      dados.parcelas.filter((_, j) => j !== i),
                    )
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
                set('parcelas', [
                  ...dados.parcelas,
                  { meio_pagamento: '', vencimento: '', valor: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
            </Button>
          </Secao>

          <Secao titulo="5. Especificação técnica">
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                label="Produto"
                valor={dados.produto_nome}
                onChange={(v) => set('produto_nome', v)}
                obrigatorio
              />
              <Campo
                label="Quantidade por frasco"
                valor={dados.quantidade_por_frasco}
                onChange={(v) => set('quantidade_por_frasco', v)}
              />
              <Campo
                label="Dose diária sugerida"
                valor={dados.dose_diaria}
                onChange={(v) => set('dose_diaria', v)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Composição da fórmula <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={dados.composicao}
                placeholder="ativo – 500 mg; ativo – 200 mg; excipiente q.s.p."
                onChange={(e) => set('composicao', e.target.value)}
                className={!dados.composicao.trim() ? 'border-amber-500' : undefined}
              />
            </div>
          </Secao>

          <Secao titulo="6. Descrição da embalagem">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Apresentação"
                valor={dados.embalagem.apresentacao}
                placeholder="cápsula / comprimido / gummy / pó / líquido / sachê"
                onChange={(v) => setEmbalagem('apresentacao', v)}
                obrigatorio
              />
              <Campo
                label="Cápsula / comprimido — tipo"
                valor={dados.embalagem.capsula_tipo}
                onChange={(v) => setEmbalagem('capsula_tipo', v)}
              />
              <Campo
                label="Cápsula — cor"
                valor={dados.embalagem.capsula_cor}
                onChange={(v) => setEmbalagem('capsula_cor', v)}
              />
              <Campo
                label="Cápsula — tamanho nº"
                valor={dados.embalagem.capsula_tamanho}
                onChange={(v) => setEmbalagem('capsula_tamanho', v)}
              />
              <Campo
                label="Pote / frasco — material"
                valor={dados.embalagem.pote_material}
                placeholder="PET / PEAD / vidro"
                onChange={(v) => setEmbalagem('pote_material', v)}
              />
              <Campo
                label="Pote — capacidade"
                valor={dados.embalagem.pote_capacidade}
                onChange={(v) => setEmbalagem('pote_capacidade', v)}
              />
              <Campo
                label="Pote — cor"
                valor={dados.embalagem.pote_cor}
                onChange={(v) => setEmbalagem('pote_cor', v)}
              />
              <Campo
                label="Tampa — tipo"
                valor={dados.embalagem.tampa_tipo}
                placeholder="rosca / flip-top / pump"
                onChange={(v) => setEmbalagem('tampa_tipo', v)}
              />
              <Campo
                label="Tampa — cor"
                valor={dados.embalagem.tampa_cor}
                onChange={(v) => setEmbalagem('tampa_cor', v)}
              />
              <Campo
                label="Dosador / acessório"
                valor={dados.embalagem.dosador}
                placeholder="não / dosador N mL / colher medida / conta-gotas / válvula pump"
                onChange={(v) => setEmbalagem('dosador', v)}
              />
              <Campo
                label="Rótulo — material"
                valor={dados.embalagem.rotulo_material}
                onChange={(v) => setEmbalagem('rotulo_material', v)}
              />
              <Campo
                label="Rótulo — acabamento"
                valor={dados.embalagem.rotulo_acabamento}
                onChange={(v) => setEmbalagem('rotulo_acabamento', v)}
              />
              <Campo
                label="Rótulo — quantidade"
                valor={dados.embalagem.rotulo_quantidade}
                onChange={(v) => setEmbalagem('rotulo_quantidade', v)}
              />
              <Campo
                label="Embalagem secundária"
                valor={dados.embalagem.embalagem_secundaria}
                placeholder="não / cartucho / caixa"
                onChange={(v) => setEmbalagem('embalagem_secundaria', v)}
              />
              <div className="space-y-1">
                <Label className="text-xs">
                  Fornecimento da embalagem <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={dados.embalagem.fornecimento_embalagem}
                  onValueChange={(v) =>
                    setEmbalagem('fornecimento_embalagem', v as 'CONTRATADA' | 'CONTRATANTE')
                  }
                >
                  <SelectTrigger
                    className={!dados.embalagem.fornecimento_embalagem ? 'border-amber-500' : undefined}
                  >
                    <SelectValue placeholder="Por conta de..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTRATADA">CONTRATADA (Lemoncaps)</SelectItem>
                    <SelectItem value="CONTRATANTE">CONTRATANTE (produtor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="lacre"
                  checked={dados.embalagem.lacre_inducao}
                  onCheckedChange={(c) => setEmbalagem('lacre_inducao', c === true)}
                />
                <Label htmlFor="lacre" className="text-xs">
                  Lacre de indução
                </Label>
              </div>
            </div>
          </Secao>

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
          O envio automático ao ZapSign ainda não está ligado. Baixe o PDF e conduza a assinatura
          normalmente; depois volte aqui para registrar o pedido.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Badge variant="outline" className={completo ? 'border-green-500 text-green-700' : 'border-amber-500 text-amber-700'}>
            {completo ? 'Pronto para assinatura' : `${faltantes.length} campo(s) pendente(s)`}
          </Badge>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGerar}
              disabled={!completo || salvando}
              title="Grava o número do contrato no pedido e marca como pendente de assinatura"
            >
              <FileSignature className="h-4 w-4 mr-1" />
              {salvando ? 'Salvando...' : 'Salvar no pedido'}
            </Button>
            <Button onClick={handleBaixar} disabled={!completo}>
              <Download className="h-4 w-4 mr-1" /> Baixar Pedido de Compra
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
