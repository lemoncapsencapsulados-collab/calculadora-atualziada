import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, Package, Info } from 'lucide-react';
import type { ProdutoPedido } from '@/types/demandaMarca';

function ofuscar(nome: string) {
  const n = (nome || '').toLowerCase();
  if (n.includes('amido') && n.includes('milho')) return 'Excipiente';
  return nome;
}

export function resumoProdutoTexto(p: ProdutoPedido): string {
  const partes: string[] = [];
  if (p.tipo_produto) partes.push(p.tipo_produto);
  if (p.segmento) partes.push(p.segmento);
  if (p.dose_diaria_sugerida) partes.push(`Dose: ${p.dose_diaria_sugerida}`);
  if (p.quantidade_por_pote) partes.push(`${p.quantidade_por_pote} ${p.unidade_por_pote || 'un'}/pote`);
  if (p.quantidade_doses) partes.push(`${p.quantidade_doses} doses`);
  if (p.cor_pote) partes.push(`Pote ${p.cor_pote}`);
  if (p.cor_tampa) partes.push(`Tampa ${p.cor_tampa}`);
  if (p.quantidade) partes.push(`${p.quantidade} un. contratadas`);
  return partes.join(' • ');
}

/** Linha compacta com os dados do produto, usada dentro dos formulários */
export const ResumoProdutoLinha = ({ produto }: { produto?: ProdutoPedido }) => {
  if (!produto) return null;
  const texto = resumoProdutoTexto(produto);
  if (!texto) return null;
  return <p className="text-[11px] text-muted-foreground leading-relaxed">{texto}</p>;
};

const CampoDetalhe = ({ label, valor }: { label: string; valor?: string | number | null }) => (
  <div>
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{valor === 0 || valor ? valor : '—'}</p>
  </div>
);

interface Props {
  produtos: ProdutoPedido[];
  defaultOpen?: boolean;
}

const ProdutosPedidoResumo = ({ produtos, defaultOpen = true }: Props) => {
  const [aberto, setAberto] = useState(defaultOpen);
  const [detalhe, setDetalhe] = useState<ProdutoPedido | null>(null);

  if (!produtos.length) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Nenhum produto encontrado no orçamento vinculado a este pedido.
      </div>
    );
  }

  return (
    <>
      <Collapsible open={aberto} onOpenChange={setAberto} className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center gap-2 p-3 text-left">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Produtos do pedido ({produtos.length})</span>
            <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {produtos.map((p, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{p.nome_produto}</span>
                      <Badge variant="secondary" className="text-[10px]">{p.tipo_produto}</Badge>
                      {p.segmento && <Badge variant="outline" className="text-[10px]">{p.segmento}</Badge>}
                    </div>
                    <ResumoProdutoLinha produto={p} />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setDetalhe(p)}>
                    <Info className="h-3.5 w-3.5 mr-1" /> Ver detalhes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome_produto}</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <CampoDetalhe label="Tipo de produto" valor={detalhe.tipo_produto} />
                <CampoDetalhe label="Segmento" valor={detalhe.segmento} />
                <CampoDetalhe label="Quantidade contratada" valor={detalhe.quantidade} />
                <CampoDetalhe label="Dose diária sugerida" valor={detalhe.dose_diaria_sugerida} />
                <CampoDetalhe
                  label="Unidades por dose"
                  valor={detalhe.quantidade_por_dose ? `${detalhe.quantidade_por_dose} ${detalhe.unidade_por_dose || ''}`.trim() : undefined}
                />
                <CampoDetalhe
                  label="Unidades por pote"
                  valor={detalhe.quantidade_por_pote ? `${detalhe.quantidade_por_pote} ${detalhe.unidade_por_pote || ''}`.trim() : undefined}
                />
                <CampoDetalhe label="Doses por pote" valor={detalhe.quantidade_doses} />
                <CampoDetalhe label="Cor do pote" valor={detalhe.cor_pote} />
                <CampoDetalhe label="Cor da tampa" valor={detalhe.cor_tampa} />
              </div>

              {!!detalhe.insumos?.length && (
                <div>
                  <p className="text-xs font-semibold mb-1">Composição por dose</p>
                  <div className="rounded-md border divide-y">
                    {detalhe.insumos.map((ins, i) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                        <span>{ofuscar(ins.nome)}</span>
                        <span className="text-muted-foreground">
                          {ins.quantidade ? `${ins.quantidade} ${ins.unidade || ''}`.trim() : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProdutosPedidoResumo;
