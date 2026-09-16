import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientes } from '@/hooks/useClientes';
import { toast } from 'sonner';
import { Loader2, Tag } from 'lucide-react';

interface AdicionarMarcaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | null;
  razaoSocial: string;
  marcaAtual?: string;
}

export default function AdicionarMarcaDialog({
  open, onOpenChange, clienteId, razaoSocial, marcaAtual,
}: AdicionarMarcaDialogProps) {
  const { atualizarCliente } = useClientes();
  const [marca, setMarca] = useState(marcaAtual || '');

  useEffect(() => {
    if (open) setMarca(marcaAtual || '');
  }, [open, marcaAtual]);

  const handleSalvar = async () => {
    const valor = marca.trim();
    if (!valor) {
      toast.error('Informe o nome da marca');
      return;
    }
    if (!clienteId) {
      toast.error('Cliente não cadastrado — não foi possível vincular a marca.');
      return;
    }
    try {
      await atualizarCliente.mutateAsync({ id: clienteId, marca: valor });
      toast.success('Marca vinculada à razão social');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar marca');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {marcaAtual ? 'Editar marca' : 'Adicionar marca'}
          </DialogTitle>
          <DialogDescription>
            Vincule uma marca à razão social abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Razão Social</Label>
            <Input value={razaoSocial} disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Marca <span className="text-destructive">*</span></Label>
            <Input
              autoFocus
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Nome da marca"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSalvar(); }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={atualizarCliente.isPending}>
            {atualizarCliente.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}