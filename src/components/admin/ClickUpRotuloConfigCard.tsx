import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RefreshCw, Save, Tag, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Membro { id: number; username: string; email?: string; profilePicture?: string | null }

export function ClickUpRotuloConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [cfgId, setCfgId] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [listId, setListId] = useState('');
  const [listNome, setListNome] = useState('');
  const [prefixoNome, setPrefixoNome] = useState('Rótulo - ');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('clickup_rotulo_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error(error);
      if (data) {
        setCfgId(data.id);
        setAtivo(!!data.ativo);
        setListId(data.list_id || '');
        setListNome(data.list_nome || '');
        setPrefixoNome(data.prefixo_nome || 'Rótulo - ');
        const ids = Array.isArray(data.assignee_ids) ? (data.assignee_ids as any[]).map(Number) : [];
        setAssigneeIds(ids);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (listId.trim()) carregarMembros(); /* eslint-disable-next-line */ }, []);

  const carregarMembros = async () => {
    if (!listId.trim()) {
      toast.error('Informe o ID da lista primeiro');
      return;
    }
    setLoadingMembros(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-listar-membros`);
      url.searchParams.set('list_id', listId.trim());
      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(`Falha ao buscar membros: ${data?.error || resp.statusText}`);
        return;
      }
      setMembros(data.members || []);
      toast.success(`${(data.members || []).length} membros carregados`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message}`);
    } finally {
      setLoadingMembros(false);
    }
  };

  const toggleAssignee = (id: number) => {
    setAssigneeIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const salvar = async () => {
    if (!listId.trim()) {
      toast.error('Informe o ID da lista de rótulos do ClickUp');
      return;
    }
    setSaving(true);
    try {
      const assignee_nomes = membros.filter((m) => assigneeIds.includes(m.id)).map((m) => m.username);
      const payload = {
        ativo,
        list_id: listId.trim(),
        list_nome: listNome.trim() || null,
        prefixo_nome: prefixoNome || 'Rótulo - ',
        assignee_ids: assigneeIds,
        assignee_nomes,
      };
      if (cfgId) {
        const { error } = await supabase.from('clickup_rotulo_config').update(payload).eq('id', cfgId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('clickup_rotulo_config').insert(payload).select('id').single();
        if (error) throw error;
        setCfgId(data.id);
      }
      toast.success('Configuração salva!');
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card><CardContent className="py-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando configuração...
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          Envio automático para ClickUp — Rótulos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quando o contrato for assinado no ZapSign, uma task será criada automaticamente na lista escolhida e atribuída aos responsáveis selecionados.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <Label className="cursor-pointer">Automação ativa</Label>
            <p className="text-xs text-muted-foreground">Desative para parar de criar tasks automaticamente</p>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>ID da lista no ClickUp <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input value={listId} onChange={(e) => setListId(e.target.value)} placeholder="Ex.: 901234567890" className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={carregarMembros} disabled={loadingMembros} title="Carregar membros da lista">
                {loadingMembros ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Abra a lista no ClickUp; o ID está no final da URL.</p>
          </div>
          <div className="space-y-1">
            <Label>Apelido da lista</Label>
            <Input value={listNome} onChange={(e) => setListNome(e.target.value)} placeholder="Ex.: Rótulos / Design" />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Prefixo do nome da task</Label>
          <Input value={prefixoNome} onChange={(e) => setPrefixoNome(e.target.value)} placeholder="Ex.: Rótulo - " />
          <p className="text-[11px] text-muted-foreground">A task ficará como: <span className="font-mono">{prefixoNome}Nome do cliente (ORC-000)</span></p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> Responsáveis</Label>
            <Button type="button" variant="ghost" size="sm" onClick={carregarMembros} disabled={loadingMembros}>
              {loadingMembros ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar lista
            </Button>
          </div>
          {membros.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              Informe o ID da lista e clique em <strong>Atualizar lista</strong> para buscar os membros.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto border rounded-lg p-2">
              {membros.map((m) => {
                const checked = assigneeIds.includes(m.id);
                return (
                  <label key={m.id} className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${checked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleAssignee(m.id)} />
                    {m.profilePicture ? (
                      <img src={m.profilePicture} alt={m.username} className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">
                        {m.username?.slice(0, 1)?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.username}</p>
                      {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {assigneeIds.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {membros.filter((m) => assigneeIds.includes(m.id)).map((m) => (
                <Badge key={m.id} variant="secondary">{m.username}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}