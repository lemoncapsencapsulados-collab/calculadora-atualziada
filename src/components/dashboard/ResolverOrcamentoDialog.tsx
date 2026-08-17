import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import type { OrcamentoEmAberto } from '@/types/dashboard';

export interface AlvoResolucao {
  item: OrcamentoEmAberto;
  cliente: string;
  consultor: string;
}

interface Props {
  alvo: AlvoResolucao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (alvo: AlvoResolucao, observacao: string) => void;
  salvando?: boolean;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResolverOrcamentoDialog({ alvo, open, onOpenChange, onConfirmar, salvando }: Props) {
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (open) setObservacao('');
  }, [open, alvo]);

  if (!alvo) return null;

  const podeConfirmar = observacao.trim().length > 0 && !salvando;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar resolução — {alvo.item.numero_orcamento || 'Orçamento'}</DialogTitle>
          <DialogDescription>
            Cliente: {alvo.cliente}
            <br />
            Vendedor: {alvo.consultor} · {brl(alvo.item.valor)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="obs-resolucao">Observação (obrigatória)</Label>
          <Textarea
            id="obs-resolucao"
            rows={4}
            placeholder="Descreva a devolutiva ou o desfecho deste orçamento..."
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!podeConfirmar} onClick={() => onConfirmar(alvo, observacao.trim())}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirmar resolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}