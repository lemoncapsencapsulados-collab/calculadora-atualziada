import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Package, FlaskConical, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useInsumos } from "@/hooks/useInsumos";
import { useEmbalagens } from "@/hooks/useEmbalagens";
import { UnitType } from "@/types/formula";
import { formatCurrency, formatUnit } from "@/lib/unitConversion";
import { toast } from "sonner";
import ImportInsumosDialog from "@/components/ImportInsumosDialog";
import ImportInventoryDialog from "@/components/ImportInventoryDialog";
import { differenceInDays, format } from "date-fns";

function getUpdateAlert(updatedAt?: string): { type: 'red' | 'yellow' | null; label: string; daysLeft?: number } {
  if (!updatedAt) return { type: 'red', label: 'AJUSTE DE PREÇO NECESSÁRIO' };
  const days = differenceInDays(new Date(), new Date(updatedAt));
  if (days >= 60) return { type: 'red', label: 'AJUSTE DE PREÇO NECESSÁRIO' };
  if (days >= 53) return { type: 'yellow', label: `Restam ${60 - days} dias para a atualização de preço`, daysLeft: 60 - days };
  return { type: null, label: '' };
}

function formatUpdatedAt(updatedAt?: string): string {
  if (!updatedAt) return '';
  return format(new Date(updatedAt), 'dd/MM/yyyy');
}

export default function Inventario() {
  const { insumos, loading: loadingInsumos, addInsumo, updateInsumo, deleteInsumo } = useInsumos();
  const { embalagens, loading: loadingEmbalagens, addEmbalagem, updateEmbalagem, deleteEmbalagem } = useEmbalagens();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchTermEmbalagens, setSearchTermEmbalagens] = useState("");
  const [selectedCategoryEmbalagens, setSelectedCategoryEmbalagens] = useState<string>("Todos");
  const [editingInsumo, setEditingInsumo] = useState<any | null>(null);
  const [editingEmbalagem, setEditingEmbalagem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [embalagemDialogOpen, setEmbalagemDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"insumos" | "embalagens">("insumos");
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(insumos.map((i) => i.categoria).filter(Boolean));
    return ["Todos", ...Array.from(cats).sort()];
  }, [insumos]);

  const filteredInsumos = useMemo(() => {
    return insumos
      .filter((insumo) => {
        const matchesSearch = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "Todos" || insumo.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [insumos, searchTerm, selectedCategory]);

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = { Todos: insumos.length };
    insumos.forEach((insumo) => {
      if (insumo.categoria) {
        counts[insumo.categoria] = (counts[insumo.categoria] || 0) + 1;
      }
    });
    return counts;
  }, [insumos]);

  const embalagemCategories = useMemo(() => {
    const cats = new Set(embalagens.map((e) => e.categoria).filter(Boolean));
    return ["Todos", ...Array.from(cats).sort()];
  }, [embalagens]);

  const filteredEmbalagens = useMemo(() => {
    return embalagens
      .filter((embalagem) => {
        const matchesSearch = embalagem.nome.toLowerCase().includes(searchTermEmbalagens.toLowerCase());
        const matchesCategory =
          selectedCategoryEmbalagens === "Todos" || embalagem.categoria === selectedCategoryEmbalagens;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.categoria && b.categoria && a.categoria !== b.categoria) {
          return a.categoria.localeCompare(b.categoria);
        }
        return a.nome.localeCompare(b.nome);
      });
  }, [embalagens, searchTermEmbalagens, selectedCategoryEmbalagens]);

  const embalagemCategoryCount = useMemo(() => {
    const counts: Record<string, number> = { Todos: embalagens.length };
    embalagens.forEach((embalagem) => {
      if (embalagem.categoria) {
        counts[embalagem.categoria] = (counts[embalagem.categoria] || 0) + 1;
      }
    });
    return counts;
  }, [embalagens]);

  const handleSaveInsumo = async (formData: FormData) => {
    const nome = formData.get("nome") as string;
    const unidade_compra = formData.get("unidade_compra") as UnitType;
    const preco = parseFloat(formData.get("preco") as string);
    const densidade = formData.get("densidade") ? parseFloat(formData.get("densidade") as string) : undefined;
    const observacoes = formData.get("observacoes") as string;
    const fornecedor = formData.get("fornecedor") as string;
    const categoria = formData.get("categoria") as string;

    if (!nome || !unidade_compra || isNaN(preco) || preco < 0) {
      toast.error("Preencha todos os campos obrigatórios corretamente");
      return;
    }

    if (!fornecedor || fornecedor.trim() === '') {
      toast.error("O campo Fornecedor é obrigatório");
      return;
    }

    try {
      if (editingInsumo) {
        await updateInsumo(editingInsumo.id, {
          nome,
          unidade_compra,
          preco_por_unidade_compra: preco,
          densidade,
          observacoes,
          fornecedor,
          categoria,
        });
      } else {
        await addInsumo({
          nome,
          unidade_compra,
          preco_por_unidade_compra: preco,
          densidade,
          observacoes,
          fornecedor,
          categoria,
        });
      }

      setDialogOpen(false);
      setEditingInsumo(null);
    } catch (error) {
      // Error já foi tratado no hook
    }
  };

  const handleDeleteInsumo = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este insumo?")) {
      await deleteInsumo(id);
    }
  };

  const handleSaveEmbalagem = async (formData: FormData) => {
    const nome = formData.get("nome") as string;
    const descricao = formData.get("descricao") as string;
    const preco = parseFloat(formData.get("preco") as string);
    const categoria = formData.get("categoria") as string;
    const subcategoria = formData.get("subcategoria") as string;
    const fornecedor = formData.get("fornecedor") as string;

    if (!nome || !descricao || isNaN(preco) || preco < 0) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    if (!fornecedor || fornecedor.trim() === '') {
      toast.error("O campo Fornecedor é obrigatório");
      return;
    }

    try {
      if (editingEmbalagem) {
        await updateEmbalagem(editingEmbalagem.id, { nome, descricao, preco_unitario: preco, categoria, subcategoria, fornecedor });
      } else {
        await addEmbalagem({ nome, descricao, preco_unitario: preco, categoria, subcategoria, fornecedor });
      }

      setEmbalagemDialogOpen(false);
      setEditingEmbalagem(null);
    } catch (error) {
      // Error já foi tratado no hook
    }
  };

  const handleDeleteEmbalagem = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta embalagem?")) {
      await deleteEmbalagem(id);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Inventário</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus insumos e embalagens</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "insumos" | "embalagens")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="insumos">
            <Package className="w-4 h-4 mr-2" />
            Insumos ({insumos.length})
          </TabsTrigger>
          <TabsTrigger value="embalagens">
            <FlaskConical className="w-4 h-4 mr-2" />
            Embalagens ({embalagens.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insumos" className="space-y-6 mt-6">
          {loadingInsumos ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Cadastre a matéria-prima com preço por unidade de compra
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setImportInventoryOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Completo
                  </Button>

                  <ImportInsumosDialog />

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
                        <DialogTitle>{editingInsumo ? "Editar Insumo" : "Adicionar Novo Insumo"}</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveInsumo(new FormData(e.currentTarget));
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
                              step="0.000001"
                              min="0"
                              defaultValue={editingInsumo?.preco_por_unidade_compra}
                              placeholder="0.000000"
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
                            <Label htmlFor="fornecedor">Fornecedor *</Label>
                            <Input
                              id="fornecedor"
                              name="fornecedor"
                              defaultValue={editingInsumo?.fornecedor}
                              placeholder="Nome do fornecedor"
                              required
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
                            {editingInsumo ? "Atualizar" : "Adicionar"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
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
                        variant={selectedCategory === cat ? "default" : "outline"}
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
                      {searchTerm ? "Nenhum insumo encontrado" : "Nenhum insumo cadastrado ainda"}
                    </p>
                  </Card>
                ) : (
                  filteredInsumos.map((insumo) => {
                    const alert = getUpdateAlert(insumo.updated_at);
                    return (
                      <Card
                        key={insumo.id}
                        className={`hover:shadow-md transition-shadow ${
                          alert.type === 'red'
                            ? 'border-2 border-red-500 bg-red-50/50'
                            : alert.type === 'yellow'
                            ? 'border-2 border-yellow-500 bg-yellow-50/50'
                            : ''
                        }`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {alert.type && (
                                <Badge
                                  className={`mb-2 ${
                                    alert.type === 'red'
                                      ? 'bg-red-500 hover:bg-red-600 text-white'
                                      : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                  }`}
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {alert.label}
                                </Badge>
                              )}
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
                                {insumo.updated_at && (
                                  <div>
                                    <p className="text-muted-foreground">Atualizado em</p>
                                    <p className="font-medium">{formatUpdatedAt(insumo.updated_at)}</p>
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
                                onClick={() => handleDeleteInsumo(insumo.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="embalagens" className="space-y-6 mt-6">
          {loadingEmbalagens ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Cadastre o custo total do conjunto de embalagem (pote + rótulo + lacre, etc.)
                </p>

                <Dialog open={embalagemDialogOpen} onOpenChange={setEmbalagemDialogOpen}>
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
                      <DialogTitle>{editingEmbalagem ? "Editar Embalagem" : "Adicionar Nova Embalagem"}</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveEmbalagem(new FormData(e.currentTarget));
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <Label htmlFor="nome">Nome da Embalagem *</Label>
                        <Input
                          id="nome"
                          name="nome"
                          defaultValue={editingEmbalagem?.nome}
                          placeholder="Ex: Pote PET 120ml"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="descricao">Descrição *</Label>
                        <Textarea
                          id="descricao"
                          name="descricao"
                          defaultValue={editingEmbalagem?.descricao}
                          placeholder="Ex: Pote transparente + rótulo personalizado + lacre de segurança"
                          rows={3}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="preco">Custo por Embalagem (R$) *</Label>
                        <Input
                          id="preco"
                          name="preco"
                          type="number"
                          step="0.00001"
                          min="0"
                          defaultValue={editingEmbalagem?.preco_unitario}
                          placeholder="0.00000"
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Custo total do conjunto (pote + rótulo + lacre + tampa, etc.)
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="fornecedor">Fornecedor *</Label>
                        <Input
                          id="fornecedor"
                          name="fornecedor"
                          defaultValue={editingEmbalagem?.fornecedor}
                          placeholder="Nome do fornecedor"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="categoria">Categoria</Label>
                        <Select name="categoria" defaultValue={editingEmbalagem?.categoria}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Potes PET">Potes PET</SelectItem>
                            <SelectItem value="Tampas Plásticas">Tampas Plásticas</SelectItem>
                            <SelectItem value="Pote">Pote</SelectItem>
                            <SelectItem value="Tampa">Tampa</SelectItem>
                            <SelectItem value="Sachê">Sachê</SelectItem>
                            <SelectItem value="Frasco">Frasco</SelectItem>
                            <SelectItem value="Sílica">Sílica</SelectItem>
                            <SelectItem value="Acessórios">Acessórios</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="subcategoria">Subcategoria</Label>
                        <Input
                          id="subcategoria"
                          name="subcategoria"
                          defaultValue={editingEmbalagem?.subcategoria}
                          placeholder="Ex: Quadrado 45 FR"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setEmbalagemDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90">
                          {editingEmbalagem ? "Atualizar" : "Adicionar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Pesquisar Embalagens</CardTitle>
                  <CardDescription>
                    {filteredEmbalagens.length} de {embalagens.length} embalagem(ns) encontrada(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome da embalagem..."
                      value={searchTermEmbalagens}
                      onChange={(e) => setSearchTermEmbalagens(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {embalagemCategories.map((cat) => (
                      <Button
                        key={cat}
                        variant={selectedCategoryEmbalagens === cat ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategoryEmbalagens(cat)}
                        className="text-xs"
                      >
                        {cat}
                        <span className="ml-1.5 opacity-70">({embalagemCategoryCount[cat] || 0})</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEmbalagens.length === 0 ? (
                  <Card className="col-span-full p-12 text-center shadow-sm">
                    <p className="text-muted-foreground">
                      {searchTermEmbalagens ? "Nenhuma embalagem encontrada" : "Nenhuma embalagem cadastrada ainda"}
                    </p>
                  </Card>
                ) : (
                  filteredEmbalagens.map((embalagem) => {
                    const alert = getUpdateAlert(embalagem.updated_at);
                    return (
                      <Card
                        key={embalagem.id}
                        className={`hover:shadow-md transition-shadow ${
                          alert.type === 'red'
                            ? 'border-2 border-red-500 bg-red-50/50'
                            : alert.type === 'yellow'
                            ? 'border-2 border-yellow-500 bg-yellow-50/50'
                            : ''
                        }`}
                      >
                        <CardHeader>
                          {alert.type && (
                            <Badge
                              className={`mb-2 w-fit ${
                                alert.type === 'red'
                                  ? 'bg-red-500 hover:bg-red-600 text-white'
                                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {alert.label}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{embalagem.nome}</CardTitle>
                            {embalagem.categoria && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                                {embalagem.categoria}
                              </span>
                            )}
                          </div>
                          {embalagem.subcategoria && (
                            <p className="text-xs text-muted-foreground mt-1">{embalagem.subcategoria}</p>
                          )}
                          <CardDescription className="text-sm line-clamp-2 mt-1">{embalagem.descricao}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div>
                                <p className="text-sm text-muted-foreground">Custo</p>
                                <p className="text-xl font-bold text-primary">{formatCurrency(embalagem.preco_unitario)}</p>
                              </div>
                              {embalagem.fornecedor && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Fornecedor: {embalagem.fornecedor}</p>
                                </div>
                              )}
                              {embalagem.updated_at && (
                                <p className="text-xs text-muted-foreground">
                                  Atualizado em: {formatUpdatedAt(embalagem.updated_at)}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setEditingEmbalagem(embalagem);
                                  setEmbalagemDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDeleteEmbalagem(embalagem.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ImportInventoryDialog open={importInventoryOpen} onOpenChange={setImportInventoryOpen} />
    </div>
  );
}
