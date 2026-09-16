import { useState } from 'react';
import { AcompanhamentoProcessos as AcompanhamentoType, StatusProcesso, StatusProcessoLogistica } from '@/types/formula';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Factory, Truck, Globe, Package, Star, Save, FileBadge, Printer, Barcode } from 'lucide-react';

const DEFAULT_ACOMPANHAMENTO: AcompanhamentoType = {
  criacao_marca: 'pendente',
  producao: 'pendente',
  integracao_logistica: 'pendente',
  pagina_venda: 'pendente',
  envio_produto: 'pendente',
  satisfacao_nota: null,
  satisfacao_observacoes: null,
};

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  entregue: 'bg-green-100 text-green-800 border-green-300',
  nao_necessario: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  acompanhamento?: AcompanhamentoType;
  onUpdate: (data: AcompanhamentoType) => void;
  // Mostra as linhas extras de setup somente quando o pedido contratou cada um deles
  setupCategorias?: {
    registro_inpi?: boolean;
    impressao_rotulos?: boolean;
    codigo_barras?: boolean;
  };
}

const AcompanhamentoProcessos = ({ acompanhamento, onUpdate, setupCategorias }: Props) => {
  const data = acompanhamento || DEFAULT_ACOMPANHAMENTO;
  const [nota, setNota] = useState<number>(data.satisfacao_nota ?? 5);
  const [obs, setObs] = useState(data.satisfacao_observacoes || '');

  const handleChange = (field: keyof AcompanhamentoType, value: string) => {
    onUpdate({ ...data, [field]: value });
  };

  const allDone = (['criacao_marca', 'producao', 'integracao_logistica', 'pagina_venda', 'envio_produto'] as const)
    .every(k => data[k] === 'entregue' || data[k] === 'nao_necessario');

  const saveSatisfacao = () => {
    onUpdate({ ...data, satisfacao_nota: nota, satisfacao_observacoes: obs });
  };

  const groups: {
    label: string;
    icon: React.ElementType;
    field: keyof AcompanhamentoType;
    options: { value: string; label: string }[];
  }[] = [
    {
      label: 'Criação de Marca',
      icon: Palette,
      field: 'criacao_marca',
      options: [
        { value: 'pendente', label: 'Designer Pendente' },
        { value: 'entregue', label: 'Designer Entregue' },
      ],
    },
    {
      label: 'Produção',
      icon: Factory,
      field: 'producao',
      options: [
        { value: 'pendente', label: 'Produto Pendente' },
        { value: 'entregue', label: 'Produto Entregue' },
      ],
    },
    {
      label: 'Integração Logística',
      icon: Truck,
      field: 'integracao_logistica',
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'entregue', label: 'Entregue' },
        { value: 'nao_necessario', label: 'Não Necessário' },
      ],
    },
    {
      label: 'Página de Venda',
      icon: Globe,
      field: 'pagina_venda',
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'entregue', label: 'Entregue' },
      ],
    },
    {
      label: 'Envio do Produto (Estoque)',
      icon: Package,
      field: 'envio_produto',
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'entregue', label: 'Entregue' },
      ],
    },
  ];

  const setupOptions = [
    { value: 'pendente', label: 'Pendente' },
    { value: 'entregue', label: 'Entregue' },
    { value: 'nao_necessario', label: 'Não Necessário' },
  ];
  if (setupCategorias?.registro_inpi) {
    groups.push({ label: 'Registro no INPI', icon: FileBadge, field: 'registro_inpi' as any, options: setupOptions });
  }
  if (setupCategorias?.impressao_rotulos) {
    groups.push({ label: 'Impressão de Rótulos', icon: Printer, field: 'impressao_rotulos' as any, options: setupOptions });
  }
  if (setupCategorias?.codigo_barras) {
    groups.push({ label: 'Código de Barras', icon: Barcode, field: 'codigo_barras' as any, options: setupOptions });
  }

  return (
    <div className="space-y-3">
      {groups.map(({ label, icon: Icon, field, options }) => {
        const currentVal = ((data as any)[field] as string) || 'pendente';
        return (
          <div key={field} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${statusColors[currentVal]} text-[10px] px-1.5 py-0`}>
                {currentVal === 'pendente' ? '⏳' : currentVal === 'entregue' ? '✅' : '—'}
              </Badge>
              <Select value={currentVal} onValueChange={(v) => handleChange(field, v)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      })}

      {allDone && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg border space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold">Avaliação de Satisfação</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nota:</span>
              <span className="text-lg font-bold text-primary">{nota}</span>
            </div>
            <Slider
              value={[nota]}
              onValueChange={([v]) => setNota(v)}
              min={0}
              max={10}
              step={1}
            />
          </div>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observações sobre a satisfação do cliente..."
            className="min-h-[60px] text-sm"
          />
          <Button size="sm" onClick={saveSatisfacao} className="w-full">
            <Save className="h-4 w-4 mr-1" />
            Salvar Avaliação
          </Button>
        </div>
      )}
    </div>
  );
};

export default AcompanhamentoProcessos;
