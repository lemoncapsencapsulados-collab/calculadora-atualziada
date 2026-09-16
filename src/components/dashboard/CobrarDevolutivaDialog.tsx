import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, Check, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClienteEmAberto } from '@/types/dashboard';
import { gerarMensagemCobranca, type RegistroCobranca } from '@/lib/insightsPorCliente';

interface Props {
  cliente: ClienteEmAberto | null;
  registro?: RegistroCobranca;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarcarCobrado: (cliente: ClienteEmAberto, observacao: string) => void;
}

export function CobrarDevolutivaDialog({ cliente, registro, open, onOpenChange, onMarcarCobrado }: Props) {
  const [mensagem, setMensagem] = useState('');
  const [observacao, setObservacao] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (cliente && open) {
      setMensagem(gerarMensagemCobranca(cliente));
      setObservacao(registro?.observacao || '');
      setCopiado(false);
    }
  }, [cliente, open, registro]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
    } catch {
      /* clipboard indisponível */
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!cliente) return null;

  const valor = cliente.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cobrar devolutiva — {cliente.cliente}</DialogTitle>
          <DialogDescription>
            Vendedor: {cliente.consultor}
            <br />
            Último orçamento:{' '}
            {cliente.ultimoOrcamento ? format(parseISO(cliente.ultimoOrcamento), "dd/MMM/yyyy", { locale: ptBR }) : '—'} · {valor}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mensagem-cobranca">Mensagem de cobrança</Label>
            <Textarea
              id="mensagem-cobranca"
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs-cobranca">Observação do gestor</Label>
            <Textarea
              id="obs-cobranca"
              placeholder="O que o consultor respondeu?"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
            />
          </div>

          {registro && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Cobrado em {format(parseISO(registro.cobradoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={copiar}>
              {copiado ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiado ? 'Copiado! ✓' : 'Copiar mensagem'}
            </Button>
            <Button
              onClick={() => {
                onMarcarCobrado(cliente, observacao);
                onOpenChange(false);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como cobrado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}