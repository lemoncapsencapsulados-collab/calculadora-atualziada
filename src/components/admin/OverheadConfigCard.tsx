import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useConfiguracaoCustos } from '@/hooks/useConfiguracaoCustos';
import { toast } from 'sonner';

export function OverheadConfigCard() {
  const { configuracaoAtiva, updateConfiguracao } = useConfiguracaoCustos();
  const [valor, setValor] = useState<string>('3');

  useEffect(() => {
    const atual = Number((configuracaoAtiva as any)?.overhead_unitario);
    if (Number.isFinite(atual) && atual > 0) setValor(atual.toString());
  }, [configuracaoAtiva]);

  const handleSalvar = async () => {
    if (!configuracaoAtiva) return;
    const num = parseFloat(valor.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      toast.error('Informe um valor válido em reais.');
      return;
    }
    try {
      await updateConfiguracao.mutateAsync({
        id: configuracaoAtiva.id,
        overhead_unitario: num,
      } as any);
    } catch (e) {
      // toast já tratado no hook
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Overhead de produção (por unidade)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="space-y-2 flex-1 max-w-xs">
          <Label>Valor em R$ (padrão R$ 3,00)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Somado a matéria-prima e embalagem em toda precificação nova.
          </p>
        </div>
        <Button onClick={handleSalvar} disabled={updateConfiguracao.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
