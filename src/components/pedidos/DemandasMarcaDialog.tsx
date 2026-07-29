import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sparkles, Tag, Image, LayoutTemplate, CreditCard, FileDown, Pencil, Trash2, ArrowLeft, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDemandasMarca } from '@/hooks/useDemandasMarca';
import {
  ArquivoDemanda, DemandaMarca, DemandaStatus, DemandaTipo,
  DEMANDA_STATUS_LABELS, DEMANDA_TIPO_LABELS, DEMANDA_TIPO_SETOR,
  ProdutoPedido, SEGMENTOS,
} from '@/types/demandaMarca';
import { gerarBriefingDemandasPDF } from '@/lib/demandasMarcaPdf';
import FormRotulo from './demandas/FormRotulo';
import FormCriativos from './demandas/FormCriativos';
import FormBanner from './demandas/FormBanner';
import FormMonetizze from './demandas/FormMonetizze';
import ProdutosPedidoResumo from './demandas/ProdutosPedidoResumo';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedido: any | null;
  clienteNome: string;
}

const TIPO_ICONS: Record<DemandaTipo, React.ElementType> = {
  rotulo: Tag,
  criativos: Image,
  banner: LayoutTemplate,
  monetizze: CreditCard,
};

const STATUS_CLASSES: Record<DemandaStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  em_andamento: 'bg-blue-100 text-blue-800 border-blue-300',
  concluida: 'bg-green-100 text-green-800 border-green-300',
};

function mapearTipoProduto(item: any): string {
  const raw = `${item?.tipo_produto || ''} ${item?.segmento || ''}`.toLowerCase();
  if (raw.includes('gummy')) return 'Gummy';
  if (raw.includes('sol')) return 'Solúvel';
  if (raw.includes('líquid') || raw.includes('liquid')) return 'Líquido';
  return 'Encapsulado';
}

/** O snapshot às vezes guarda em `segmento` o tipo do produto; só aproveitamos
 *  quando o valor bate com um segmento de marca conhecido. */
function mapearSegmento(item: any): string {
  const bruto = String(item?.segmento || '').trim().toLowerCase();
  if (!bruto) return '';
  const achado = SEGMENTOS.find((s) => s.toLowerCase() === bruto);
  return achado || '';
}

const DemandasMarcaDialog = ({ open, onOpenChange, pedido, clienteNome }: Props) => {
  const pedidoId = pedido?.id ?? null;
  const { demandas, criarDemanda, atualizarDemanda, removerDemanda, salvando } = useDemandasMarca(pedidoId);
  const [criando, setCriando] = useState<DemandaTipo | null>(null);
  const [editando, setEditando] = useState<DemandaMarca | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<DemandaMarca | null>(null);

  const snap = pedido?.orcamento_snapshot;
  const vendedorNome: string = snap?.consultor_responsavel || 'Não informado';
  const numeroPedido: string = pedido?.numero_pedido || '';

  const produtosPedido: ProdutoPedido[] = useMemo(() => {
    const itens = (snap?.itens_producao || []) as any[];
    return itens.map((i) => ({
      nome_produto: i.nome_produto || 'Produto',
      tipo_produto: mapearTipoProduto(i),
      quantidade: Number(i.pod_consumo_quantidade) || Number(i.quantidade) || 0,
      segmento: mapearSegmento(i),
      quantidade_doses: Number(i.quantidade_doses) || undefined,
      quantidade_por_pote: Number(i.quantidade_por_pote) || undefined,
      quantidade_por_dose: Number(i.quantidade_por_dose) || undefined,
      unidade_por_dose: i.unidade_por_dose || undefined,
      unidade_por_pote: i.unidade_por_pote || i.unidade_por_dose || undefined,
      dose_diaria_sugerida: i.dose_diaria_sugerida || undefined,
      cor_pote: i.detalhes_producao?.cor_pote || undefined,
      cor_tampa: i.detalhes_producao?.cor_tampa || undefined,
      preco_unitario: Number(i.preco_unitario) || undefined,
      insumos: Array.isArray(i.insumos_formula)
        ? i.insumos_formula.map((ins: any) => ({
            nome: ins?.nome || '',
            quantidade: Number(ins?.quantidade) || undefined,
            unidade: ins?.unidade || undefined,
          }))
        : undefined,
    }));
  }, [snap]);

  const ctxPdf = { numeroPedido, clienteNome, vendedorNome };

  const fecharFormulario = () => {
    setCriando(null);
    setEditando(null);
  };

  const salvar = async (tipo: DemandaTipo, dados: any, arquivos: ArquivoDemanda[] = []) => {
    if (!pedidoId) return;
    const dadosComProdutos = {
      ...dados,
      produtos_pedido: (editando?.dados?.produtos_pedido?.length ? editando.dados.produtos_pedido : produtosPedido),
    };
    if (editando) {
      await atualizarDemanda({ id: editando.id, dados: dadosComProdutos, arquivos });
    } else {
      await criarDemanda({
        pedido_id: pedidoId,
        tipo,
        cliente_nome: clienteNome,
        vendedor_nome: vendedorNome,
        dados: dadosComProdutos,
        arquivos,
      });
    }
    fecharFormulario();
  };

  const tipoAtivo: DemandaTipo | null = editando?.tipo ?? criando;

  const renderFormulario = () => {
    if (!tipoAtivo || !pedidoId) return null;
    const inicial = editando?.dados;
    if (tipoAtivo === 'rotulo') {
      return (
        <FormRotulo
          pedidoId={pedidoId}
          produtosPedido={produtosPedido}
          valorInicial={inicial}
          arquivosIniciais={editando?.arquivos || []}
          salvando={salvando}
          onCancelar={fecharFormulario}
          onSalvar={(dados, arquivos) => salvar('rotulo', dados, arquivos)}
        />
      );
    }
    if (tipoAtivo === 'criativos') {
      return (
        <FormCriativos
          produtosPedido={produtosPedido}
          valorInicial={inicial}
          salvando={salvando}
          onCancelar={fecharFormulario}
          onSalvar={(dados) => salvar('criativos', dados)}
        />
      );
    }
    if (tipoAtivo === 'banner') {
      return (
        <FormBanner
          produtosPedido={produtosPedido}
          valorInicial={inicial}
          salvando={salvando}
          onCancelar={fecharFormulario}
          onSalvar={(dados) => salvar('banner', dados)}
        />
      );
    }
    return (
      <FormMonetizze
        produtosPedido={produtosPedido}
        vendedorNome={vendedorNome}
        valorInicial={inicial}
        salvando={salvando}
        onCancelar={fecharFormulario}
        onSalvar={(dados) => salvar('monetizze', dados)}
      />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) fecharFormulario(); onOpenChange(o); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Demandas de Marca {numeroPedido ? `— ${numeroPedido}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm grid gap-1 sm:grid-cols-2">
            <p><span className="text-muted-foreground">Cliente:</span> <strong>{clienteNome}</strong></p>
            <p><span className="text-muted-foreground">Vendedor responsável:</span> <strong>{vendedorNome}</strong></p>
          </div>

          {tipoAtivo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={fecharFormulario}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Badge variant="outline">
                  {DEMANDA_TIPO_LABELS[tipoAtivo]} — {DEMANDA_TIPO_SETOR[tipoAtivo]}
                </Badge>
              </div>
              {renderFormulario()}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(DEMANDA_TIPO_LABELS) as DemandaTipo[]).map((tipo) => {
                  const Icon = TIPO_ICONS[tipo];
                  const qtd = demandas.filter((d) => d.tipo === tipo).length;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setCriando(tipo)}
                      className="text-left rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">{DEMANDA_TIPO_LABELS[tipo]}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{DEMANDA_TIPO_SETOR[tipo]}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <Plus className="h-3 w-3" /> Criar demanda
                        {qtd > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{qtd}</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Demandas criadas ({demandas.length})</h3>
                  {demandas.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => gerarBriefingDemandasPDF(demandas, ctxPdf)}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> Baixar todas (PDF)
                    </Button>
                  )}
                </div>

                {demandas.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma demanda criada para este pedido.
                  </p>
                )}

                <div className="space-y-2">
                  {demandas.map((d) => {
                    const Icon = TIPO_ICONS[d.tipo];
                    return (
                      <div key={d.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {DEMANDA_TIPO_LABELS[d.tipo]}
                            <span className="text-xs text-muted-foreground font-normal ml-2">{DEMANDA_TIPO_SETOR[d.tipo]}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criada em {format(new Date(d.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Select
                          value={d.status}
                          onValueChange={(v) => atualizarDemanda({ id: d.id, status: v as DemandaStatus })}
                        >
                          <SelectTrigger className={`h-8 w-[150px] text-xs ${STATUS_CLASSES[d.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(DEMANDA_STATUS_LABELS) as DemandaStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>{DEMANDA_STATUS_LABELS[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="sm" title="Baixar briefing (PDF)"
                            onClick={() => gerarBriefingDemandasPDF([d], ctxPdf, `${d.tipo}-${numeroPedido}`)}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => setEditando(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="text-destructive" title="Remover"
                            onClick={() => setConfirmarExclusao(d)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              A demanda de {confirmarExclusao ? DEMANDA_TIPO_LABELS[confirmarExclusao.tipo] : ''} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmarExclusao) await removerDemanda(confirmarExclusao.id);
                setConfirmarExclusao(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DemandasMarcaDialog;
