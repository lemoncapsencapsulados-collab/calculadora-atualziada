import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { aviso as toast } from '@/lib/avisos';
import { conferirSenhaAdmin } from '@/lib/senhaAdmin';
import { Loader2 } from 'lucide-react';

/**
 * Apaga o Pedido de Compra de um pedido -- o documento, não a venda.
 *
 * É um diálogo separado do de excluir pedido de propósito. Os dois pedem a
 * mesma senha e ficam no mesmo menu, a um item de distância; se dissessem a
 * mesma coisa, a diferença entre apagar um documento e apagar uma venda
 * dependeria de o usuário lembrar em qual item clicou. Aqui o texto diz, antes
 * da senha, exatamente o que fica e o que vai embora.
 */
export function ConfirmarExclusaoPedidoCompraDialog({
  open,
  onOpenChange,
  numeroPedido,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numeroPedido: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [senha, setSenha] = useState('');

  useEffect(() => {
    if (!open) setSenha('');
  }, [open]);

  const confirmar = async () => {
    if (loading) return;
    if (!(await conferirSenhaAdmin(senha))) {
      toast.error('Senha incorreta');
      setSenha('');
      return;
    }
    await onConfirm();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        // Fechar no meio da gravação deixaria a tela sem saber o que aconteceu.
        if (loading && !o) return;
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar o Pedido de Compra</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Apaga o Pedido de Compra do pedido <strong>{numeroPedido}</strong>. É o
                documento que some — a venda continua na lista, com orçamento, pagamento e
                histórico intactos, e dá para preencher um novo depois.
              </p>
              <p className="text-xs">
                Para apagar a venda inteira, use <strong>Excluir pedido</strong> no mesmo menu.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="senha-apagar-pedido-compra">Senha de administrador</Label>
          <Input
            id="senha-apagar-pedido-compra"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmar();
              }
            }}
            placeholder="Digite a senha"
            autoFocus
            disabled={loading}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={confirmar}
            disabled={senha.length === 0 || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Apagando…
              </>
            ) : (
              'Apagar documento'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
