import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_PASSWORD = '0212';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function AdminPasswordDialog({
  open,
  onOpenChange,
  title = 'Confirmação de administrador',
  description = 'Esta é uma ação sensível. Digite a senha de administrador para continuar.',
  actionLabel = 'Confirmar',
  onConfirm,
}: Props) {
  const [senha, setSenha] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSenha('');
      setShow(false);
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    if (senha !== ADMIN_PASSWORD) {
      toast.error('Senha incorreta');
      setSenha('');
      return;
    }
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-base">{title}</DialogTitle>
                <DialogDescription className="text-xs">{description}</DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password-input" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Senha do administrador
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="admin-password-input"
                type={show ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••"
                autoFocus
                disabled={loading}
                className="pl-9 pr-10 h-11 tracking-widest font-mono"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                tabIndex={-1}
                aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || senha.length === 0}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</>
              ) : (
                <><ShieldCheck className="w-4 h-4 mr-2" />{actionLabel}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}