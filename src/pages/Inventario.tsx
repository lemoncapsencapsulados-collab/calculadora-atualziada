import { useState, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getInsumos, addInsumo, updateInsumo, deleteInsumo } from '@/lib/localStorage';
import { Insumo, UnitType } from '@/types/formula';
import { formatCurrency, formatUnit } from '@/lib/unitConversion';
import { toast } from 'sonner';

export default function Inventario() {
  const [insumos, setInsumos] = useState<Insumo[]>(getInsumos());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(insumos.map(i => i.categoria).filter(Boolean));
    return ['Todos', ...Array.from(cats).sort()];
  }, [insumos]);

  const filteredInsumos = useMemo(() => {
    return insumos
      .filter((insumo) => {
        const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todos' || insumo.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [insumos, searchTerm, selectedCategory]);

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = { 'Todos': insumos.length };
    insumos.forEach(insumo => {
      if (insumo.categoria) {
        counts[insumo.categoria] = (counts[insumo.categoria] || 0) + 1;
      }
    });
    return counts;
  }, [insumos]);

  const handleSave = (formData: FormData) => {
    const nome = formData.get('nome') as string;
    const unidade_compra = formData.get('unidade_compra') as UnitType;
    const preco = parseFloat(formData.get('preco') as string);
    const densidade = formData.get('densidade') ? parseFloat(formData.get('densidade') as string) : undefined;
    const observacoes = formData.get('observacoes') as string;
    const fornecedor = formData.get('fornecedor') as string;
    const categoria = formData.get('categoria') as string;

    if (!nome || !unidade_compra || isNaN(preco) || preco < 0) {
      toast.error('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    // Check for duplicates (case-insensitive)
    const exists = insumos.some(
      (i) => i.nome.toLowerCase() === nome.toLowerCase() && i.id !== editingInsumo?.id
    );
    
    if (exists) {
      toast.error('Já existe um insumo com este nome');
      return;
    }

    if (editingInsumo) {
      updateInsumo(editingInsumo.id, {
        nome,
        unidade_compra,
        preco_por_unidade_compra: preco,
        densidade,
        observacoes,
        fornecedor,
        categoria,
      });
      toast.success('Insumo atualizado com sucesso');
    } else {
      const newInsumo: Insumo = {
        id: Date.now().toString(),
        nome,
        unidade_compra,
        preco_por_unidade_compra: preco,
        densidade,
        observacoes,
        fornecedor,
        categoria,
      };
      addInsumo(newInsumo);
      toast.success('Insumo adicionado com sucesso');
    }

    setInsumos(getInsumos());
    setDialogOpen(false);
    setEditingInsumo(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este insumo?')) {
      deleteInsumo(id);
      setInsumos(getInsumos());
      toast.success('Insumo excluído com sucesso');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventário de Matéria-Prima</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus insumos e preços</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
              onClick={() => setEditingInsumo(null)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingInsumo ? 'Editar Insumo' : 'Adicionar Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nome">Nome do Insumo *</Label>
                  <Input
                    id="nome"
                    name="nome"
                    defaultValue={editingInsumo?.nome}
                    placeholder="Ex: Vitamina C"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="unidade_compra">Unidade de Compra *</Label>
                  <Select name="unidade_compra" defaultValue={editingInsumo?.unidade_compra} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="mg">mg</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="mL">mL</SelectItem>
                      <SelectItem value="UI">UI</SelectItem>
                      <SelectItem value="unidade">unidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="preco">Preço por Unidade (R$) *</Label>
                  <Input
                    id="preco"
                    name="preco"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingInsumo?.preco_por_unidade_compra}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="densidade">Densidade (g/mL)</Label>
                  <Input
                    id="densidade"
                    name="densidade"
                    type="number"
                    step="0.001"
                    min="0"
                    defaultValue={editingInsumo?.densidade}
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    name="fornecedor"
                    defaultValue={editingInsumo?.fornecedor}
                    placeholder="Nome do fornecedor"
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select name="categoria" defaultValue={editingInsumo?.categoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vitaminas">Vitaminas</SelectItem>
                      <SelectItem value="Aminoácidos">Aminoácidos</SelectItem>
                      <SelectItem value="Minerais">Minerais</SelectItem>
                      <SelectItem value="Substâncias Bioativas">Substâncias Bioativas</SelectItem>
                      <SelectItem value="Fibra Alimentar">Fibra Alimentar</SelectItem>
                      <SelectItem value="Ativos Emagrecedores">Ativos Emagrecedores</SelectItem>
                      <SelectItem value="Óleos">Óleos</SelectItem>
                      <SelectItem value="Suplemento Alimentar">Suplemento Alimentar</SelectItem>
                      <SelectItem value="Suplemento Ergogênico">Suplemento Ergogênico</SelectItem>
                      <SelectItem value="Aromas">Aromas</SelectItem>
                      <SelectItem value="Sacarose">Sacarose</SelectItem>
                      <SelectItem value="Enzimas">Enzimas</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    name="observacoes"
                    defaultValue={editingInsumo?.observacoes}
                    placeholder="Informações adicionais..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">
                  {editingInsumo ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Pesquisar Insumos</CardTitle>
          <CardDescription>
            {filteredInsumos.length} de {insumos.length} insumo(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="text-xs"
              >
                {cat}
                <span className="ml-1.5 opacity-70">({categoryCount[cat] || 0})</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredInsumos.length === 0 ? (
          <Card className="p-12 text-center shadow-sm">
            <p className="text-muted-foreground">
              {searchTerm ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado ainda'}
            </p>
          </Card>
        ) : (
          filteredInsumos.map((insumo) => (
            <Card key={insumo.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{insumo.nome}</h3>
                      {insumo.categoria && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                          {insumo.categoria}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Preço</p>
                        <p className="font-medium text-primary">
                          {formatCurrency(insumo.preco_por_unidade_compra)}/{formatUnit(insumo.unidade_compra)}
                        </p>
                      </div>
                      {insumo.densidade && (
                        <div>
                          <p className="text-muted-foreground">Densidade</p>
                          <p className="font-medium">{insumo.densidade} g/mL</p>
                        </div>
                      )}
                      {insumo.fornecedor && (
                        <div>
                          <p className="text-muted-foreground">Fornecedor</p>
                          <p className="font-medium">{insumo.fornecedor}</p>
                        </div>
                      )}
                    </div>
                    {insumo.observacoes && (
                      <p className="text-sm text-muted-foreground mt-2">{insumo.observacoes}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditingInsumo(insumo);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(insumo.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
