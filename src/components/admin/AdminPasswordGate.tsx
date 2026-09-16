import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ADMIN_PANEL_PASSWORD, unlockAdmin } from '@/lib/adminConfig';
import { toast } from 'sonner';

interface Props {
  onUnlock: () => void;
}

export function AdminPasswordGate({ onUnlock }: Props) {
  const [senha, setSenha] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (senha === ADMIN_PANEL_PASSWORD) {
      unlockAdmin();
      toast.success('Painel desbloqueado');
      onUnlock();
    } else {
      toast.error('Senha incorreta');
      setSenha('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Painel Administrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Senha de acesso</label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">Desbloquear</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
