import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Calendar, Package, Info } from 'lucide-react';
import { format } from 'date-fns';
import { Formula } from '@/types/formula';

interface GerarPedidoDialogProps {
  formula: Formula;
  onConfirm: (dados: {
    data_pedido: Date;
    data_entrega: Date;
    quantidade_produto: number;
    unidade_produto: string;
    observacoes?: string;
  }) => void;
}

export function GerarPedidoDialog({ formula, onConfirm }: GerarPedidoDialogProps) {
  const [open, setOpen] = useState(false);
  const [dataPedido, setDataPedido] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataEntrega, setDataEntrega] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [unidade, setUnidade] = useState('pote');
  const [observacoes, setObservacoes] = useState('');

  const handleConfirm = () => {
    onConfirm({
      data_pedido: new Date(dataPedido),
      data_entrega: new Date(dataEntrega),
      quantidade_produto: parseFloat(quantidade),
      unidade_produto: unidade,
      observacoes: observacoes.trim() || undefined,
    });
    setOpen(false);
    setDataPedido(format(new Date(), 'yyyy-MM-dd'));
    setDataEntrega('');
    setQuantidade('1');
    setUnidade('pote');
    setObservacoes('');
  };

  const isFormValid = dataPedido && dataEntrega && quantidade && parseFloat(quantidade) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Gerar Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Gerar Ordem de Produção
          </DialogTitle>
          <DialogDescription>
            Transforme a cotação de <span className="font-semibold">{formula.nome_formula}</span> em um pedido de produção
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="data_pedido" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data do Pedido *
            </Label>
            <Input
              id="data_pedido"
              type="date"
              value={dataPedido}
              onChange={(e) => setDataPedido(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_entrega" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Entrega Prevista *
            </Label>
            <Input
              id="data_entrega"
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              min={dataPedido}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 100"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade *</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger id="unidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pote">Pote(s)</SelectItem>
                  <SelectItem value="frasco">Frasco(s)</SelectItem>
                  <SelectItem value="unidade">Unidade(s)</SelectItem>
                  <SelectItem value="caixa">Caixa(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
            <Label htmlFor="observacoes" className="flex items-center gap-2 text-base font-semibold">
              <Info className="h-5 w-5 text-primary" />
              Observações para Produção
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Informações detalhadas para o setor fabril (ex: cor do pote, cor da tampa, instruções especiais)
            </p>
            <Textarea
              id="observacoes"
              placeholder="Exemplo:
• Cor do pote: Branco
• Cor da tampa: Azul
• Rótulo: Aplicar logo centralizado
• Observações: Embalar em caixas de 50 unidades"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={6}
              className="resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isFormValid}>
            <FileText className="h-4 w-4 mr-2" />
            Gerar Pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
