import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Copy, Check, Edit, Download, Save, X, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Formula, FormulaItem, EmbalagemItem, UnitType } from '@/types/formula';
import html2canvas from 'html2canvas';
import { formatCurrency } from '@/lib/unitConversion';

interface VerFormulaDialogProps {
  formula: Formula;
  onUpdateFormula?: (formula: Formula) => void;
  readOnly?: boolean;
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
  const [editedEmbalagens, setEditedEmbalagens] = useState<EmbalagemItem[]>([...formula.embalagens]);
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

  const handleAddItem = () => {
    setEditedItems([...editedItems, {
      insumo_id: '',
      nome_insumo_snapshot: '',
      qtd_informada: 0,
      unidade_informada: 'mg' as UnitType,
      custo_calculado: 0,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const handleEditEmbalagem = (index: number, field: 'descricao_snapshot' | 'custo_calculado', value: string | number) => {
    const newEmbs = [...editedEmbalagens];
    if (field === 'descricao_snapshot') {
      newEmbs[index] = { ...newEmbs[index], [field]: value as string };
    } else {
      newEmbs[index] = { ...newEmbs[index], [field]: Number(value) };
    }
    setEditedEmbalagens(newEmbs);
  };

  const handleAddEmbalagem = () => {
    setEditedEmbalagens([...editedEmbalagens, {
      embalagem_id: '',
      descricao_snapshot: '',
      custo_calculado: 0,
    }]);
  };

  const handleRemoveEmbalagem = (index: number) => {
    setEditedEmbalagens(editedEmbalagens.filter((_, i) => i !== index));
  };

  const handleSaveEdits = () => {
    const newTotalMp = editedItems.reduce((sum, item) => sum + item.custo_calculado, 0);
    const newTotalEmbalagem = editedEmbalagens.reduce((sum, item) => sum + item.custo_calculado, 0);

    const updatedFormula: Formula = {
      ...formula,
      itens: editedItems,
      embalagens: editedEmbalagens,
      total_mp: newTotalMp,
      total_embalagem: newTotalEmbalagem,
      custo_total: newTotalMp + newTotalEmbalagem,
    };
    onUpdateFormula(updatedFormula);
    setIsEditing(false);
    toast.success('Fórmula atualizada!');
  };

  const handleCancelEdit = () => {
    setEditedItems([...formula.itens]);
    setEditedEmbalagens([...formula.embalagens]);
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
    let text = `*${formula.nome_formula}*\nCliente: ${formula.cliente}\n\n`;
    text += `*MATÉRIAS PRIMAS*\n`;
    formula.itens.forEach(item => {
      const converted = convertToMg(item.qtd_informada, item.unidade_informada);
      text += `• ${item.nome_insumo_snapshot} - ${converted.display}\n`;
    });
    text += `\n*EMBALAGENS*\n`;
    formula.embalagens.forEach(item => {
      text += `• ${item.descricao_snapshot} - ${formatCurrency(item.custo_calculado)}\n`;
    });
    text += `\n*Custo Total: ${formatCurrency(formula.custo_total)}*`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Fórmula copiada para WhatsApp!');
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const displayItems = isEditing ? editedItems : formula.itens;
  const displayEmbalagens = isEditing ? editedEmbalagens : formula.embalagens;

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 border-b pb-2">MATÉRIAS PRIMAS</h3>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar MP
                </Button>
              )}
            </div>
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
                          value={editedItems[idx]?.nome_insumo_snapshot || ''}
                          onChange={(e) => handleEditItem(idx, 'nome_insumo_snapshot', e.target.value)}
                          className="flex-1 mr-2"
                        />
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editedItems[idx]?.qtd_informada || 0}
                            onChange={(e) => handleEditItem(idx, 'qtd_informada', e.target.value)}
                            className="w-24"
                          />
                          <span className="text-gray-500 text-sm w-12">{item.unidade_informada}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
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

          {/* Lista de Embalagens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 border-b pb-2">EMBALAGENS</h3>
              {isEditing && (
                <Button variant="outline" size="sm" onClick={handleAddEmbalagem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Emb.
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {displayEmbalagens.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 border border-gray-100"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editedEmbalagens[idx]?.descricao_snapshot || ''}
                        onChange={(e) => handleEditEmbalagem(idx, 'descricao_snapshot', e.target.value)}
                        className="flex-1 mr-2"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={editedEmbalagens[idx]?.custo_calculado || 0}
                          onChange={(e) => handleEditEmbalagem(idx, 'custo_calculado', e.target.value)}
                          className="w-24"
                          placeholder="R$"
                        />
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveEmbalagem(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{item.descricao_snapshot}</span>
                      <span className="font-semibold text-primary">{formatCurrency(item.custo_calculado)}</span>
                    </>
                  )}
                </div>
              ))}
              {!isEditing && (
                <div className="flex justify-between font-semibold pt-2 border-t text-sm">
                  <span>Total Embalagem:</span>
                  <span>{formatCurrency(formula.total_embalagem)}</span>
                </div>
              )}
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
                Copiar WhatsApp
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
