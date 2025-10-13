import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getEmbalagens, addEmbalagem, updateEmbalagem, deleteEmbalagem } from '@/lib/localStorage';
import { Embalagem } from '@/types/formula';
import { formatCurrency } from '@/lib/unitConversion';
import { toast } from 'sonner';

export default function Embalagens() {
  const [embalagens, setEmbalagens] = useState<Embalagem[]>(getEmbalagens());
  const [editingEmbalagem, setEditingEmbalagem] = useState<Embalagem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = (formData: FormData) => {
    const descricao = formData.get('descricao') as string;
    const preco = parseFloat(formData.get('preco') as string);
    const qtd = parseFloat(formData.get('qtd') as string);

    if (!descricao || isNaN(preco) || preco < 0 || isNaN(qtd) || qtd <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    if (editingEmbalagem) {
      updateEmbalagem(editingEmbalagem.id, {
        descricao,
        preco_unitario: preco,
        qtd_por_pote: qtd,
      });
      toast.success('Embalagem atualizada com sucesso');
    } else {
      const newEmbalagem: Embalagem = {
        id: Date.now().toString(),
        descricao,
        preco_unitario: preco,
        qtd_por_pote: qtd,
      };
      addEmbalagem(newEmbalagem);
      toast.success('Embalagem adicionada com sucesso');
    }

    setEmbalagens(getEmbalagens());
    setDialogOpen(false);
    setEditingEmbalagem(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta embalagem?')) {
      deleteEmbalagem(id);
      setEmbalagens(getEmbalagens());
      toast.success('Embalagem excluída com sucesso');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Embalagens</h1>
          <p className="text-muted-foreground mt-1">Gerencie os custos de embalagem</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              onClick={() => setEditingEmbalagem(null)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Embalagem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEmbalagem ? 'Editar Embalagem' : 'Adicionar Nova Embalagem'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  name="descricao"
                  defaultValue={editingEmbalagem?.descricao}
                  placeholder="Ex: Cápsula 0"
                  required
                />
              </div>

              <div>
                <Label htmlFor="preco">Preço Unitário (R$) *</Label>
                <Input
                  id="preco"
                  name="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingEmbalagem?.preco_unitario}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="qtd">Quantidade por Pote *</Label>
                <Input
                  id="qtd"
                  name="qtd"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingEmbalagem?.qtd_por_pote}
                  placeholder="Ex: 60"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">
                  {editingEmbalagem ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {embalagens.map((embalagem) => (
          <Card key={embalagem.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{embalagem.descricao}</CardTitle>
              <CardDescription>
                {embalagem.qtd_por_pote} {embalagem.qtd_por_pote === 1 ? 'unidade' : 'unidades'} por pote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Preço Unitário</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(embalagem.preco_unitario)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {formatCurrency(embalagem.preco_unitario * embalagem.qtd_por_pote)}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setEditingEmbalagem(embalagem);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(embalagem.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {embalagens.length === 0 && (
        <Card className="p-12 text-center shadow-sm">
          <p className="text-muted-foreground">Nenhuma embalagem cadastrada ainda</p>
        </Card>
      )}
    </div>
  );
}
