import { useMemo, useState } from 'react';
import { Loader2, Search, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ContaMeta {
  id: string;
  ad_account_id: string;
  nome?: string | null;
  ativo?: boolean | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contas: ContaMeta[];
}

export default function ContasMetaDialog({ open, onOpenChange, contas }: Props) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [emLote, setEmLote] = useState(false);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return contas;
    return contas.filter(
      (c) => (c.nome || '').toLowerCase().includes(t) || (c.ad_account_id || '').toLowerCase().includes(t)
    );
  }, [contas, busca]);

  const ativas = contas.filter((c) => c.ativo).length;

  const alternar = async (conta: ContaMeta, valor: boolean) => {
    setSalvando(conta.id);
    try {
      const { error } = await supabase
        .from('meta_ad_accounts' as any)
        .update({ ativo: valor } as any)
        .eq('id', conta.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
      toast.success(`${conta.nome || conta.ad_account_id} ${valor ? 'ativada' : 'desativada'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar a conta');
    } finally {
      setSalvando(null);
    }
  };

  const definirTodas = async (valor: boolean) => {
    setEmLote(true);
    try {
      const ids = filtradas.map((c) => c.id);
      const { error } = await supabase
        .from('meta_ad_accounts' as any)
        .update({ ativo: valor } as any)
        .in('id', ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
      toast.success(valor ? 'Contas ativadas' : 'Contas desativadas');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar as contas');
    } finally {
      setEmLote(false);
    }
  };

  const somenteEsta = async (conta: ContaMeta) => {
    setSalvando(conta.id);
    try {
      const { error: e1 } = await supabase
        .from('meta_ad_accounts' as any)
        .update({ ativo: false } as any)
        .neq('id', conta.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('meta_ad_accounts' as any)
        .update({ ativo: true } as any)
        .eq('id', conta.id);
      if (e2) throw e2;
      await queryClient.invalidateQueries({ queryKey: ['meta-ad-accounts'] });
      toast.success(`Somente ${conta.nome || conta.ad_account_id} ativa`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar as contas');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contas de anúncio Meta</DialogTitle>
          <DialogDescription>
            Escolha quais contas alimentam o painel. {ativas} de {contas.length} ativas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou ID"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => definirTodas(true)} disabled={emLote}>
            Ativar todas
          </Button>
          <Button variant="outline" size="sm" onClick={() => definirTodas(false)} disabled={emLote}>
            Desativar todas
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto divide-y rounded-md border">
          {filtradas.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
          )}
          {filtradas.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <Switch
                checked={!!c.ativo}
                disabled={salvando === c.id}
                onCheckedChange={(v) => alternar(c, v)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.nome || c.ad_account_id}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.ad_account_id}
                  {c.last_sync_at ? ` · sync ${new Date(c.last_sync_at).toLocaleString('pt-BR')}` : ''}
                  {c.last_sync_status ? ` · ${c.last_sync_status}` : ''}
                </p>
              </div>
              {salvando === c.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Button variant="ghost" size="sm" onClick={() => somenteEsta(c)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Só esta
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
