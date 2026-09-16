import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import {
  OBJECOES, RESULTADO_DESCRICAO, RESULTADO_ESTILO, RESULTADO_LABEL,
} from '@/lib/checkupOrcamento';
import type { ResultadoCheckup } from '@/types/orcamento';

export interface CheckupRegistro {
  resultado: ResultadoCheckup;
  objecao?: string;
  observacao: string;
  proximoPasso?: string;
  data: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  numeroOrcamento: string;
  nomeCliente: string;
  salvando?: boolean;
  onRegistrar: (r: CheckupRegistro) => void | Promise<void>;
}

const ICONE: Record<ResultadoCheckup, typeof CheckCircle2> = {
  positiva: CheckCircle2,
  negativa: XCircle,
  neutra: CircleDashed,
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function RegistrarCheckupDialog({
  open,
  onOpenChange,
  numeroOrcamento,
  nomeCliente,
  salvando,
  onRegistrar,
}: Props) {
  const [resultado, setResultado] = useState<ResultadoCheckup | null>(null);
  const [objecao, setObjecao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [proximoPasso, setProximoPasso] = useState('');
  const [data, setData] = useState(hojeISO());

  useEffect(() => {
    if (open) {
      setResultado(null);
      setObjecao('');
      setObservacao('');
      setProximoPasso('');
      setData(hojeISO());
    }
  }, [open]);

  // Objecao so' faz sentido quando algo travou; numa positiva ela atrapalha.
  const pedeObjecao = resultado === 'negativa' || resultado === 'neutra';
  const podeSalvar = !!resultado && observacao.trim().length > 0 && !salvando;

  const registrar = () => {
    if (!resultado) return;
    // A data vem como dia; guarda com a hora atual para ordenar certo no mesmo dia.
    const agora = new Date();
    const [a, m, d] = data.split('-').map(Number);
    const quando = new Date(a, (m || 1) - 1, d || 1, agora.getHours(), agora.getMinutes());
    onRegistrar({
      resultado,
      objecao: pedeObjecao && objecao ? objecao : undefined,
      observacao: observacao.trim(),
      proximoPasso: proximoPasso.trim() || undefined,
      data: quando.toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar checkup</DialogTitle>
          <DialogDescription>
            {numeroOrcamento} — {nomeCliente}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Como foi a conversa?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(RESULTADO_LABEL) as ResultadoCheckup[]).map((r) => {
                const Icone = ICONE[r];
                const estilo = RESULTADO_ESTILO[r];
                const ativo = resultado === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResultado(r)}
                    className={cn(
                      'rounded-lg border-2 p-3 text-left transition-all',
                      ativo
                        ? cn(estilo.fundo, estilo.borda.replace('border-l-', 'border-'))
                        : 'border-muted hover:border-muted-foreground/30',
                    )}
                  >
                    <span className={cn('flex items-center gap-2 text-sm font-medium', ativo && estilo.texto)}>
                      <Icone className="h-4 w-4" />
                      {RESULTADO_LABEL[r]}
                    </span>
                  </button>
                );
              })}
            </div>
            {resultado && (
              <p className="text-xs text-muted-foreground">{RESULTADO_DESCRICAO[resultado]}</p>
            )}
          </div>

          {pedeObjecao && (
            <div className="space-y-1">
              <Label className="text-xs">Objeção principal</Label>
              <Select value={objecao} onValueChange={setObjecao}>
                <SelectTrigger>
                  <SelectValue placeholder="O que travou a negociação?" />
                </SelectTrigger>
                <SelectContent>
                  {OBJECOES.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">
              O que o cliente disse <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="A devolutiva do cliente, nas palavras dele."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Próximo passo</Label>
            <Input
              value={proximoPasso}
              onChange={(e) => setProximoPasso(e.target.value)}
              placeholder="O que foi combinado — ex.: reenviar com 500un, retomar dia 20"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Data da conversa</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={registrar} disabled={!podeSalvar}>
            {salvando ? 'Registrando...' : 'Registrar checkup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
