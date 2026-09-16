import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Lock, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import CondicoesPagamentoForm from '@/components/CondicoesPagamentoForm';
import { CondicoesPagamento } from '@/types/orcamento';

const SENHA_ALTERACAO = '0212';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numeroPedido?: string;
  valorTotal?: number;
  dataPagamentoAtual?: string | null;
  condicoesAtuais?: CondicoesPagamento;
  permitirEditarValor?: boolean;
  onConfirm: (payload: {
    data_pagamento: string | null;
    condicoes_pagamento: CondicoesPagamento;
    valor_total?: number;
  }) => Promise<void> | void;
}

export function AlterarPagamentoDialog({
  open, onOpenChange, numeroPedido, valorTotal = 0, dataPagamentoAtual, condicoesAtuais,
  permitirEditarValor = false, onConfirm,
}: Props) {
  const [senha, setSenha] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [data, setData] = useState<Date | undefined>(undefined);
  const [condicoes, setCondicoes] = useState<CondicoesPagamento>({});
  const [valorEditavel, setValorEditavel] = useState<string>('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setSenha('');
      setAutenticado(false);
      setSalvando(false);
      setData(dataPagamentoAtual ? new Date(dataPagamentoAtual) : undefined);
      setCondicoes(condicoesAtuais ? { ...condicoesAtuais } : {});
      setValorEditavel(String(valorTotal ?? 0));
    }
  }, [open, dataPagamentoAtual, condicoesAtuais, valorTotal]);

  const validarSenha = () => {
    if (senha !== SENHA_ALTERACAO) {
      toast.error('Senha incorreta');
      setSenha('');
      return;
    }
    setAutenticado(true);
  };

  const handleSalvar = async () => {
    if (!data) {
      toast.error('Informe a data de pagamento');
      return;
    }
    if (!condicoes?.metodo_principal) {
      toast.error('Selecione o método de pagamento');
      return;
    }
    let novoValor: number | undefined;
    if (permitirEditarValor) {
      const parsed = Number(String(valorEditavel).replace(',', '.'));
      if (!isFinite(parsed) || parsed <= 0) {
        toast.error('Informe um valor total válido');
        return;
      }
      novoValor = parsed;
    }
    try {
      setSalvando(true);
      await onConfirm({
        data_pagamento: data.toISOString(),
        condicoes_pagamento: condicoes,
        valor_total: novoValor,
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Alterar pagamento {numeroPedido ? `— ${numeroPedido}` : ''}
          </DialogTitle>
          <DialogDescription>
            Esta alteração ficará registrada no histórico do pedido, em Sucesso do Cliente e no Dashboard.
          </DialogDescription>
        </DialogHeader>

        {!autenticado ? (
          <div className="space-y-3 py-2">
            <Label htmlFor="senha-alterar-pagto" className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Senha de administrador
            </Label>
            <Input
              id="senha-alterar-pagto"
              type="password"
              value={senha}
              autoFocus
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validarSenha(); } }}
              placeholder="Digite a senha"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={validarSenha} disabled={!senha}>Continuar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {permitirEditarValor && (
              <div className="space-y-2">
                <Label htmlFor="valor-total-edit">Valor total do pedido (R$)</Label>
                <Input
                  id="valor-total-edit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorEditavel}
                  onChange={(e) => setValorEditavel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Parcelas em % são recalculadas sobre o novo valor. Parcelas com valor fixo permanecem como estão.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Data de pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !data && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <CondicoesPagamentoForm
              value={condicoes}
              onChange={setCondicoes}
              valorTotal={permitirEditarValor ? Number(String(valorEditavel).replace(',', '.')) || valorTotal : valorTotal}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={handleSalvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar alteração'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AlterarPagamentoDialog;