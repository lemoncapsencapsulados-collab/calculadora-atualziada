import { useState, useEffect } from 'react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { Orcamento, DetalhamentoFrete, DetalhamentoEnvio } from '@/types/orcamento';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Truck, PackageCheck } from 'lucide-react';

interface DetalhamentoFreteDialogProps {
  orcamento: Orcamento;
  onClose: () => void;
}

export default function DetalhamentoFreteDialog({
  orcamento,
  onClose,
}: DetalhamentoFreteDialogProps) {
  const { updateDetalhamentoFrete } = useOrcamentos();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detalhamentoEnvio, setDetalhamentoEnvio] = useState<DetalhamentoEnvio>({
    tipo: 'total_produtor',
    descricao_parcial: '',
  });

  useEffect(() => {
    if (orcamento.detalhamento_frete?.detalhamento_envio) {
      setDetalhamentoEnvio(orcamento.detalhamento_frete.detalhamento_envio);
    }
  }, [orcamento]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const detalhamento: DetalhamentoFrete = {
        frete_lemon_caps: detalhamentoEnvio.tipo !== 'total_produtor',
        usa_tabela_tradicional: false,
        planos_customizados: [],
        detalhamento_envio: detalhamentoEnvio,
      };

      await updateDetalhamentoFrete.mutateAsync({
        id: orcamento.id,
        detalhamento_frete: detalhamento,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar detalhamento de frete:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Detalhamento de Frete
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base flex items-center gap-2">
              <PackageCheck className="w-4 h-4" />
              Como será feita a logística?
            </Label>
            <RadioGroup
              value={detalhamentoEnvio.tipo}
              onValueChange={(value) => setDetalhamentoEnvio(prev => ({
                ...prev,
                tipo: value as DetalhamentoEnvio['tipo'],
                descricao_parcial: value !== 'parcial' ? '' : prev.descricao_parcial,
              }))}
              className="space-y-2"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="total_produtor" id="envio-produtor" />
                <Label htmlFor="envio-produtor" className="font-normal cursor-pointer">
                  Enviar produção completa para o Produtor, Lemon Caps fará a logística enviando para cliente final.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total_lemoncaps" id="envio-lemoncaps" />
                <Label htmlFor="envio-lemoncaps" className="font-normal cursor-pointer">
                  Toda logística via Lemon Caps
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parcial" id="envio-parcial" />
                <Label htmlFor="envio-parcial" className="font-normal cursor-pointer">
                  Envio Parcial
                </Label>
              </div>
            </RadioGroup>

            {detalhamentoEnvio.tipo === 'parcial' && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Descreva a divisão:
                </Label>
                <Textarea
                  value={detalhamentoEnvio.descricao_parcial || ''}
                  onChange={(e) => setDetalhamentoEnvio(prev => ({
                    ...prev,
                    descricao_parcial: e.target.value,
                  }))}
                  placeholder="Ex: 50 potes para produtor, 100 potes logística Lemon Caps"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
