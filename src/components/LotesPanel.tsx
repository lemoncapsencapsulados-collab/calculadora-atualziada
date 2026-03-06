import { useState } from 'react';
import { Plus, Edit, Trash2, AlertTriangle, Package2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lote } from '@/types/formula';
import { formatCurrency } from '@/lib/unitConversion';
import { differenceInDays, format, parseISO } from 'date-fns';

interface LotesPanelProps {
  itemId: string;
  itemTipo: 'materia_prima' | 'embalagem';
  itemNome: string;
  lotes: Lote[];
  custoMedio: number | null;
  precoManual: number;
  onAddLote: (lote: Omit<Lote, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateLote: (id: string, updates: Partial<Lote>) => Promise<void>;
  onDeleteLote: (id: string) => Promise<void>;
}

function getValidadeAlert(validade?: string): { type: 'red' | 'yellow' | null; label: string } {
  if (!validade) return { type: null, label: '' };
  const days = differenceInDays(parseISO(validade), new Date());
  if (days < 0) return { type: 'red', label: 'VENCIDO' };
  if (days <= 30) return { type: 'yellow', label: `Vence em ${days} dia(s)` };
  return { type: null, label: '' };
}

export default function LotesPanel({
  itemId, itemTipo, itemNome, lotes, custoMedio, precoManual,
  onAddLote, onUpdateLote, onDeleteLote,
}: LotesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);

  const totalEstoque = lotes.reduce((sum, l) => sum + l.quantidade, 0);
  const precoExibido = custoMedio ?? precoManual;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const codigo = fd.get('codigo') as string;
    const quantidade = parseFloat(fd.get('quantidade') as string);
    const custo_unitario = parseFloat(fd.get('custo_unitario') as string);
    const validade = fd.get('validade') as string;
    const fornecedor = fd.get('fornecedor') as string;
    const observacoes = fd.get('observacoes') as string;

    if (isNaN(quantidade) || quantidade < 0 || isNaN(custo_unitario) || custo_unitario < 0) return;

    try {
      if (editingLote) {
        await onUpdateLote(editingLote.id, { codigo: codigo || undefined, quantidade, custo_unitario, validade: validade || undefined, fornecedor: fornecedor || undefined, observacoes: observacoes || undefined });
      } else {
        await onAddLote({ item_id: itemId, item_tipo: itemTipo, codigo: codigo || undefined, quantidade, custo_unitario, validade: validade || undefined, fornecedor: fornecedor || undefined, observacoes: observacoes || undefined });
      }
      setDialogOpen(false);
      setEditingLote(null);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remover este lote?')) await onDeleteLote(id);
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Package2 className="w-4 h-4" />
            <span>{lotes.length} lote(s)</span>
          </div>
          <span className="text-sm text-muted-foreground">
            Estoque total: <span className="font-medium text-foreground">{totalEstoque.toLocaleString('pt-BR')}</span>
          </span>
          {custoMedio !== null && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Custo médio: {formatCurrency(custoMedio)}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setEditingLote(null); setDialogOpen(true); }}
        >
          <Plus className="w-3 h-3 mr-1" /> Lote
        </Button>
      </div>

      {lotes.length > 0 && (
        <div className="space-y-1.5">
          {lotes.map((lote) => {
            const alert = getValidadeAlert(lote.validade);
            return (
              <div
                key={lote.id}
                className={`flex items-center justify-between p-2 rounded-md text-sm ${
                  alert.type === 'red' ? 'bg-destructive/10 border border-destructive/30' :
                  alert.type === 'yellow' ? 'bg-yellow-50 border border-yellow-300' :
                  'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-medium w-20">Qtd: {lote.quantidade.toLocaleString('pt-BR')}</span>
                  <span className="text-muted-foreground w-28">{formatCurrency(lote.custo_unitario)}/un</span>
                  {lote.validade && (
                    <span className="flex items-center gap-1 w-32">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(lote.validade), 'dd/MM/yyyy')}
                    </span>
                  )}
                  {alert.type && (
                    <Badge className={`text-xs ${alert.type === 'red' ? 'bg-destructive text-destructive-foreground' : 'bg-yellow-500 text-white'}`}>
                      <AlertTriangle className="w-3 h-3 mr-1" />{alert.label}
                    </Badge>
                  )}
                  {lote.fornecedor && <span className="text-muted-foreground text-xs truncate max-w-32">{lote.fornecedor}</span>}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingLote(lote); setDialogOpen(true); }}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(lote.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLote ? 'Editar Lote' : 'Novo Lote'} — {itemNome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade *</Label>
                <Input name="quantidade" type="number" step="0.01" min="0" defaultValue={editingLote?.quantidade ?? ''} required />
              </div>
              <div>
                <Label>Custo Unitário (R$) *</Label>
                <Input name="custo_unitario" type="number" step="0.000001" min="0" defaultValue={editingLote?.custo_unitario ?? ''} required />
              </div>
            </div>
            <div>
              <Label>Validade</Label>
              <Input name="validade" type="date" defaultValue={editingLote?.validade ?? ''} />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input name="fornecedor" defaultValue={editingLote?.fornecedor ?? ''} placeholder="Fornecedor do lote" />
            </div>
            <div>
              <Label>Observações</Label>
              <Input name="observacoes" defaultValue={editingLote?.observacoes ?? ''} placeholder="Notas sobre o lote" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingLote ? 'Atualizar' : 'Adicionar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
