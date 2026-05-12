import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const SENHA_EXCLUSAO = '021200';

interface Props {
  numeroPedido: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfirmarExclusaoPedidoDialog({ numeroPedido, onConfirm, trigger, open: openProp, onOpenChange }: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [senha, setSenha] = useState('');

  useEffect(() => {
    if (!open) setSenha('');
  }, [open]);

  const handleConfirm = () => {
    if (senha !== SENHA_EXCLUSAO) {
      toast.error('Senha incorreta');
      setSenha('');
      return;
    }
    setOpen(false);
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Para excluir o pedido {numeroPedido}, digite a senha de administrador. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="senha-exclusao-pedido">Senha de administrador</Label>
          <Input
            id="senha-exclusao-pedido"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder="Digite a senha"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={senha.length === 0}
          >
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
