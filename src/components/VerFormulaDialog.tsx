import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Copy, Check, Edit, Download, Save, X, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { Formula, FormulaItem, UnitType } from '@/types/formula';
import html2canvas from 'html2canvas';

interface VerFormulaDialogProps {
  formula: Formula;
  onUpdateFormula: (formula: Formula) => void;
}

// Converter para mg
const convertToMg = (value: number, unit: UnitType): { value: number; display: string } => {
  switch (unit) {
    case 'mcg':
      return { value: value / 1000, display: `${(value / 1000).toFixed(3)} mg` };
    case 'mg':
      return { value, display: `${value} mg` };
    case 'g':
      return { value: value * 1000, display: `${value * 1000} mg` };
    case 'kg':
      return { value: value * 1000000, display: `${value * 1000000} mg` };
    case 'mL':
    case 'L':
    case 'UI':
    case 'unidade':
      return { value, display: `${value} ${unit}` };
    default:
      return { value, display: `${value} ${unit}` };
  }
};

export function VerFormulaDialog({ formula, onUpdateFormula }: VerFormulaDialogProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<FormulaItem[]>([...formula.itens]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      toast.success('Copiado!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const handleEditItem = (index: number, field: 'nome_insumo_snapshot' | 'qtd_informada', value: string | number) => {
    const newItems = [...editedItems];
    if (field === 'nome_insumo_snapshot') {
      newItems[index] = { ...newItems[index], [field]: value as string };
    } else {
      newItems[index] = { ...newItems[index], [field]: Number(value) };
    }
    setEditedItems(newItems);
  };

  const handleSaveEdits = () => {
    const updatedFormula: Formula = {
      ...formula,
      itens: editedItems,
    };
    onUpdateFormula(updatedFormula);
    setIsEditing(false);
    toast.success('Fórmula atualizada!');
  };

  const handleCancelEdit = () => {
    setEditedItems([...formula.itens]);
    setIsEditing(false);
  };

  const handleDownloadPng = async () => {
    if (!contentRef.current) return;

    try {
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `formula_${formula.cliente}_${formula.nome_formula}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('PNG baixado!');
    } catch (err) {
      toast.error('Erro ao gerar PNG');
    }
  };

  const handleCopyFullFormula = async () => {
    const formulaText = formula.itens
      .map(item => {
        const converted = convertToMg(item.qtd_informada, item.unidade_informada);
        return `${item.nome_insumo_snapshot} - ${converted.display}`;
      })
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(formulaText);
      toast.success('Fórmula completa copiada!');
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const displayItems = isEditing ? editedItems : formula.itens;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Ver Fórmula
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            📋 Fórmula: {formula.nome_formula}
          </DialogTitle>
          <p className="text-muted-foreground">Cliente: {formula.cliente}</p>
        </DialogHeader>

        <div ref={contentRef} className="bg-white p-6 rounded-lg space-y-4">
          {/* Cabeçalho para PNG */}
          <div className="border-b pb-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900">{formula.nome_formula}</h2>
            <p className="text-gray-600">Cliente: {formula.cliente}</p>
            <p className="text-gray-500 text-sm">
              {formula.tipo_produto} • {formula.quantidade_por_pote} {
                formula.tipo_produto === 'Encapsulados' ? 'cápsulas' :
                formula.tipo_produto === 'Gummy' ? 'gummies' :
                formula.tipo_produto === 'Líquido' ? 'mL' : 'g'
              }
            </p>
          </div>

          {/* Lista de Matérias Primas */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 border-b pb-2">MATÉRIAS PRIMAS</h3>
            <div className="space-y-2">
              {displayItems.map((item, idx) => {
                const converted = convertToMg(item.qtd_informada, item.unidade_informada);
                const nameId = `name-${idx}`;
                const doseId = `dose-${idx}`;

                return (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 border border-gray-100"
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editedItems[idx].nome_insumo_snapshot}
                          onChange={(e) => handleEditItem(idx, 'nome_insumo_snapshot', e.target.value)}
                          className="flex-1 mr-2"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editedItems[idx].qtd_informada}
                            onChange={(e) => handleEditItem(idx, 'qtd_informada', e.target.value)}
                            className="w-24"
                          />
                          <span className="text-gray-500 text-sm w-12">{item.unidade_informada}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCopy(item.nome_insumo_snapshot, nameId)}
                          className="flex items-center gap-2 text-left hover:text-primary transition-colors group flex-1"
                        >
                          {copiedIndex === nameId ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                          )}
                          <span className="font-medium text-gray-900">{item.nome_insumo_snapshot}</span>
                        </button>

                        <button
                          onClick={() => handleCopy(converted.display, doseId)}
                          className="flex items-center gap-2 hover:text-primary transition-colors group"
                        >
                          {copiedIndex === doseId ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-400 group-hover:text-primary" />
                          )}
                          <span className="font-semibold text-primary">{converted.display}</span>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button onClick={handleSaveEdits} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleCopyFullFormula} className="flex-1">
                <ClipboardList className="h-4 w-4 mr-2" />
                Copiar Fórmula
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button onClick={handleDownloadPng} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Baixar PNG
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
