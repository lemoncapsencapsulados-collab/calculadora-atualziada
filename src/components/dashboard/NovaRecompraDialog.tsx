import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { RecompraProduto } from '@/types/dashboard';

interface NovaRecompraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvar: (dados: {
    nome_cliente: string;
    consultor_responsavel: string;
    data_recompra: string;
    produtos: RecompraProduto[];
    quantidade_total: number;
    valor_total: number;
    observacao?: string;
  }) => void;
  consultoresDisponiveis: string[];
  clientesDisponiveis: string[];
}

export function NovaRecompraDialog({
  open,
  onOpenChange,
  onSalvar,
  consultoresDisponiveis,
  clientesDisponiveis
}: NovaRecompraDialogProps) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [consultorResponsavel, setConsultorResponsavel] = useState('');
  const [dataRecompra, setDataRecompra] = useState(new Date().toISOString().split('T')[0]);
  const [produtos, setProdutos] = useState<RecompraProduto[]>([
    { nome: '', quantidade: 0, valorUnitario: 0 }
  ]);
  const [observacao, setObservacao] = useState('');

  const handleAddProduto = () => {
    setProdutos([...produtos, { nome: '', quantidade: 0, valorUnitario: 0 }]);
  };

  const handleRemoveProduto = (index: number) => {
    if (produtos.length > 1) {
      setProdutos(produtos.filter((_, i) => i !== index));
    }
  };

  const handleProdutoChange = (index: number, field: keyof RecompraProduto, value: string | number) => {
    const novos = [...produtos];
    if (field === 'nome') {
      novos[index].nome = value as string;
    } else {
      novos[index][field] = Number(value) || 0;
    }
    setProdutos(novos);
  };

  const calcularTotal = () => {
    return produtos.reduce((acc, p) => acc + (p.quantidade * p.valorUnitario), 0);
  };

  const calcularQuantidadeTotal = () => {
    return produtos.reduce((acc, p) => acc + p.quantidade, 0);
  };

  const handleSalvar = () => {
    if (!nomeCliente.trim() || !consultorResponsavel || !dataRecompra) {
      return;
    }

    const produtosValidos = produtos.filter(p => p.nome.trim() && p.quantidade > 0);
    if (produtosValidos.length === 0) {
      return;
    }

    onSalvar({
      nome_cliente: nomeCliente.trim(),
      consultor_responsavel: consultorResponsavel,
      data_recompra: dataRecompra,
      produtos: produtosValidos,
      quantidade_total: calcularQuantidadeTotal(),
      valor_total: calcularTotal(),
      observacao: observacao.trim() || undefined
    });

    // Reset form
    setNomeCliente('');
    setConsultorResponsavel('');
    setDataRecompra(new Date().toISOString().split('T')[0]);
    setProdutos([{ nome: '', quantidade: 0, valorUnitario: 0 }]);
    setObservacao('');
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nova Recompra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="cliente">Nome do Cliente *</Label>
              <Input
                id="cliente"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Digite ou selecione..."
                list="clientes-list"
              />
              <datalist id="clientes-list">
                {clientesDisponiveis.map(cliente => (
                  <option key={cliente} value={cliente} />
                ))}
              </datalist>
            </div>

            {/* Consultor */}
            <div className="space-y-2">
              <Label>Consultor Responsável *</Label>
              <Select value={consultorResponsavel} onValueChange={setConsultorResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {consultoresDisponiveis.map(consultor => (
                    <SelectItem key={consultor} value={consultor}>
                      {consultor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data">Data da Recompra *</Label>
            <Input
              id="data"
              type="date"
              value={dataRecompra}
              onChange={(e) => setDataRecompra(e.target.value)}
            />
          </div>

          {/* Produtos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Produtos *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduto}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            
            <div className="space-y-2">
              {produtos.map((produto, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nome do produto"
                    value={produto.nome}
                    onChange={(e) => handleProdutoChange(index, 'nome', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Qtd"
                    value={produto.quantidade || ''}
                    onChange={(e) => handleProdutoChange(index, 'quantidade', e.target.value)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Valor un."
                    value={produto.valorUnitario || ''}
                    onChange={(e) => handleProdutoChange(index, 'valorUnitario', e.target.value)}
                    className="w-28"
                    step="0.01"
                  />
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {formatCurrency(produto.quantidade * produto.valorUnitario)}
                  </span>
                  {produtos.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProduto(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          {/* Totais */}
          <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
            <div>
              <span className="text-sm text-muted-foreground">Quantidade Total: </span>
              <span className="font-medium">{calcularQuantidadeTotal()} unidades</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Valor Total: </span>
              <span className="text-lg font-bold text-purple-600">{formatCurrency(calcularTotal())}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvar}
            disabled={!nomeCliente.trim() || !consultorResponsavel || !dataRecompra || calcularTotal() <= 0}
          >
            Salvar Recompra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
