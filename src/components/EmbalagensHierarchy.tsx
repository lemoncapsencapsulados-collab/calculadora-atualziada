import { useMemo } from 'react';
import { Package, Box, Pill, Settings, Tag, Circle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/unitConversion';
import { Embalagem } from '@/types/formula';

interface EmbalagensHierarchyProps {
  embalagens: Embalagem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedCapsulaId?: string | null;
  onCapsulaSelect?: (id: string) => void;
  qtdCapsulas?: number;
  tipoProduto?: string;
}

const getCategoriaIcon = (categoria: string) => {
  const icons: Record<string, JSX.Element> = {
    Frasco: <Package className="w-4 h-4" />,
    Pote: <Box className="w-4 h-4" />,
    Cápsulas: <Pill className="w-4 h-4" />,
    Tampa: <Circle className="w-4 h-4" />,
    Acessórios: <Settings className="w-4 h-4" />,
    Sachê: <Tag className="w-4 h-4" />,
    Rótulos: <Tag className="w-4 h-4" />,
    Sílica: <Package className="w-4 h-4" />,
  };
  return icons[categoria] || <Box className="w-4 h-4" />;
};

const CATEGORIA_ORDER: Record<string, number> = {
  'Potes PET': 1,
  'Frascos': 2,
  'Tampa': 3,
  'Acessórios': 4,
  'Cápsulas': 5,
  'Sílica': 6,
  'Sachê': 7,
  'Rótulos': 8,
  'Outros': 99,
};

export default function EmbalagensHierarchy({
  embalagens,
  selectedIds,
  onToggle,
  selectedCapsulaId,
  onCapsulaSelect,
  qtdCapsulas = 0,
  tipoProduto,
}: EmbalagensHierarchyProps) {
  const embalagensPorCategoria = useMemo(() => {
    // Ocultar cápsulas se não for Encapsulados
    const filtered = tipoProduto && tipoProduto !== 'Encapsulados'
      ? embalagens.filter((e) => e.categoria !== 'Cápsulas')
      : embalagens;

    const grouped: Record<string, Embalagem[]> = {};
    filtered.forEach((emb) => {
      const cat = emb.categoria || 'Outros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(emb);
    });

    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => a.nome.localeCompare(b.nome));
    });

    return grouped;
  }, [embalagens, tipoProduto]);

  const categorias = useMemo(() => {
    return Object.keys(embalagensPorCategoria).sort((a, b) => {
      const orderA = CATEGORIA_ORDER[a] ?? 50;
      const orderB = CATEGORIA_ORDER[b] ?? 50;
      return orderA - orderB;
    });
  }, [embalagensPorCategoria]);

  if (categorias.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma embalagem disponível
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full">
      {categorias.map((categoria) => {
        const items = embalagensPorCategoria[categoria];
        const isCapsulas = categoria === 'Cápsulas';
        const selectedCount = isCapsulas
          ? (selectedCapsulaId && items.some((item) => item.id === selectedCapsulaId) ? 1 : 0)
          : items.filter((item) => selectedIds.has(item.id)).length;

        return (
          <AccordionItem key={categoria} value={categoria}>
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <div className="flex items-center gap-2 flex-1">
                {getCategoriaIcon(categoria)}
                <span>{categoria}</span>
                <Badge variant="secondary" className="ml-auto mr-2">
                  {selectedCount > 0 && `${selectedCount}/`}
                  {items.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pl-6">
                {items.map((emb) => {
                  if (isCapsulas) {
                    const isSelected = selectedCapsulaId === emb.id;
                    const custoTotal = emb.preco_unitario * qtdCapsulas;
                    return (
                      <div
                        key={emb.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg transition-colors cursor-pointer border-2 ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-accent'
                        }`}
                        onClick={() => onCapsulaSelect?.(emb.id)}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <Label className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{emb.nome}</span>
                              {emb.subcategoria && (
                                <Badge variant="outline" className="text-xs">
                                  {emb.subcategoria}
                                </Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-primary">
                                {formatCurrency(emb.preco_unitario)} / un
                              </span>
                              {qtdCapsulas > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  × {qtdCapsulas} = {formatCurrency(custoTotal)}
                                </p>
                              )}
                            </div>
                          </div>
                          {emb.descricao && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {emb.descricao}
                            </div>
                          )}
                        </Label>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={emb.id}
                      className="flex items-center space-x-3 p-2 hover:bg-accent rounded-lg transition-colors"
                    >
                      <Checkbox
                        id={emb.id}
                        checked={selectedIds.has(emb.id)}
                        onCheckedChange={() => onToggle(emb.id)}
                      />
                      <Label htmlFor={emb.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{emb.nome}</span>
                            {emb.subcategoria && (
                              <Badge variant="outline" className="text-xs">
                                {emb.subcategoria}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(emb.preco_unitario)}
                          </span>
                        </div>
                        {emb.descricao && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {emb.descricao}
                          </div>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
