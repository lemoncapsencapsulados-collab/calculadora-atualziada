import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Lock } from 'lucide-react';
import { conferirSenhaAdmin } from '@/lib/senhaAdmin';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** O que está sendo liberado, para a pessoa saber o que autorizou. */
  descricao?: string;
  onConfirmar: () => void;
}

/**
 * Pede a senha de administrador antes de uma ação.
 *
 * Só chama `onConfirmar` com a senha certa, e é pedida toda vez: o catálogo
 * vale para todos os clientes, e uma fórmula errada lá dentro aparece em
 * orçamento de gente que nunca pediu por ela.
 */
export default function SenhaAdminDialog({ open, onOpenChange, descricao, onConfirmar }: Props) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  useEffect(() => {
    if (open) {
      setSenha('');
      setErro(false);
      setConferindo(false);
    }
  }, [open]);

  const confirmar = async () => {
    setConferindo(true);
    const certa = await conferirSenhaAdmin(senha);
    setConferindo(false);
    if (!certa) {
      setErro(true);
      setSenha('');
      return;
    }
    onOpenChange(false);
    onConfirmar();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Senha de administrador
          </DialogTitle>
          <DialogDescription>
            {descricao || 'Esta ação precisa de autorização.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="senha-admin">Senha</Label>
          <Input
            id="senha-admin"
            type="password"
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            value={senha}
            placeholder="••••••"
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && senha && !conferindo) void confirmar();
            }}
          />
          {erro && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Senha incorreta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={!senha || conferindo}>
            {conferindo ? 'Conferindo…' : 'Liberar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
