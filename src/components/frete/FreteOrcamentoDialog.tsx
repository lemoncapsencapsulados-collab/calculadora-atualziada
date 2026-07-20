import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, ImageDown, Loader2 } from 'lucide-react';
import { fetchFreteCotacoesByOrcamento } from '@/hooks/useFreteCotacoes';
import { FreteCotacao } from '@/types/frete';
import { formatBRL } from '@/lib/freteHelpers';
import { exportElementAsPng } from '@/lib/freteImageExport';
import CotacaoExportCard from './CotacaoExportCard';
import { toast } from 'sonner';

interface Props {
  orcamentoId: string;
  produtor: string;
  numeroOrcamento: string;
  onClose: () => void;
}

export default function FreteOrcamentoDialog({ orcamentoId, produtor, numeroOrcamento, onClose }: Props) {
  const [cotacoes, setCotacoes] = useState<FreteCotacao[] | null>(null);
  const [exportando, setExportando] = useState<FreteCotacao | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFreteCotacoesByOrcamento(orcamentoId).then(list => { if (alive) setCotacoes(list); });
    return () => { alive = false; };
  }, [orcamentoId]);

  const baixarPng = async (c: FreteCotacao) => {
    setExportando(c);
    await new Promise(r => requestAnimationFrame(() => r(null)));
    await new Promise(r => setTimeout(r, 60));
    if (!exportRef.current) { setExportando(null); return; }
    const slug = `${numeroOrcamento}_${c.nome_produto || c.tipo_produto || 'produto'}`.replace(/[^\w-]+/g, '_');
    try {
      await exportElementAsPng(exportRef.current, `frete_${slug}.png`);
      toast.success('Imagem gerada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar imagem');
    } finally {
      setExportando(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Cotações de Frete — {produtor}
          </DialogTitle>
          <DialogDescription>
            Orçamento {numeroOrcamento} · Frete vinculado por produto (POD ou Estoque Próprio).
          </DialogDescription>
        </DialogHeader>

        {cotacoes === null ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Carregando cotações...
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm border rounded-lg bg-muted/30">
            Nenhuma cotação de frete vinculada a este orçamento.
          </div>
        ) : (
          <div className="space-y-4">
            {cotacoes.map(c => {
              const isEP = c.tipo === 'estoque_proprio';
              const selecionados = Array.isArray(c.pod_planos_selecionados) ? c.pod_planos_selecionados : [];
              return (
                <div key={c.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.nome_produto || 'Produto'}</span>
                        <Badge variant="outline">{c.tipo_produto || '—'}</Badge>
                        <Badge variant={isEP ? 'secondary' : 'default'}>
                          {isEP ? 'Estoque Próprio' : 'Print on Demand'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isEP
                          ? `Status: ${c.status === 'confirmado' ? 'Confirmado' : 'Pendente'}`
                          : `Quant. Envios Mensais médio: ${c.pod_quantidade_envios_estimada ?? '—'}`}
                        {' · '}Data: {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => baixarPng(c)}>
                      <ImageDown className="w-4 h-4 mr-2" />
                      Baixar PNG
                    </Button>
                  </div>

                  {isEP ? (
                    <p className="text-sm">
                      Valor do frete: <span className="font-semibold">{formatBRL(c.valor_frete)}</span>
                    </p>
                  ) : selecionados.length === 0 ? (
                    <p className="text-xs text-amber-600">Sem planos selecionados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">Plano (frascos)</TableHead>
                          <TableHead className="text-right">Preço / Envio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...selecionados].sort((a, b) => a.plano - b.plano).map(s => (
                          <TableRow key={s.plano}>
                            <TableCell className="text-center font-semibold">{s.plano}</TableCell>
                            <TableCell className="text-right font-semibold">{formatBRL(s.preco_final)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>

        {/* Container escondido para exportar PNG */}
        {exportando && (
          <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
            <CotacaoExportCard
              ref={exportRef}
              cotacao={exportando}
              produtor={produtor}
              numeroOrc={numeroOrcamento}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}