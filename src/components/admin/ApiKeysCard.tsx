import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Copy, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { baixarDocApi } from '@/lib/integracoesDocs';

const PERMS = [
  { id: 'pedidos', label: 'Consultar pedidos' },
  { id: 'clientes', label: 'Consultar clientes' },
];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `lc_live_${b64}`;
}

export function ApiKeysCard() {
  const [keys, setKeys] = useState<any[]>([]);
  const [nome, setNome] = useState('');
  const [perms, setPerms] = useState<string[]>(['pedidos', 'clientes']);
  const [novaChave, setNovaChave] = useState<string | null>(null);

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

  async function load() {
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    setKeys(data || []);
  }
  useEffect(() => { load(); }, []);

  async function criar() {
    if (!nome) return toast.error('Informe um nome');
    const key = generateKey();
    const hash = await sha256Hex(key);
    const prefix = key.slice(0, 12);
    const { error } = await supabase.from('api_keys').insert({ nome, key_hash: hash, key_prefix: prefix, permissoes: perms, ativo: true });
    if (error) return toast.error(error.message);
    setNovaChave(key);
    setNome('');
    load();
  }

  async function toggle(id: string, ativo: boolean) {
    await supabase.from('api_keys').update({ ativo }).eq('id', id);
    load();
  }
  async function excluir(id: string) {
    if (!confirm('Revogar chave?')) return;
    await supabase.from('api_keys').delete().eq('id', id);
    load();
  }
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Endpoint público</CardTitle>
          <Button size="sm" variant="outline" onClick={baixarDocApi}>
            <FileDown className="w-4 h-4 mr-2" />Baixar documentação
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted p-2 rounded flex-1 truncate">{endpoint}</code>
            <Button size="sm" variant="outline" onClick={() => copy(endpoint)}><Copy className="w-3 h-3" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie <code className="bg-muted px-1 rounded">x-api-key: SUA_CHAVE</code> nos headers.
            Rotas: <code>/pedidos</code>, <code>/pedidos/&#123;id&#125;</code>, <code>/clientes</code>, <code>/clientes?q=termo</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nova API Key</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: ERP externo" /></div>
          <div>
            <Label>Permissões</Label>
            <div className="flex gap-4 mt-2">
              {PERMS.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={perms.includes(p.id)}
                    onCheckedChange={c => setPerms(c ? [...perms, p.id] : perms.filter(x => x !== p.id))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={criar}><Plus className="w-4 h-4 mr-2" />Gerar chave</Button>

          {novaChave && (
            <div className="border border-amber-500/50 bg-amber-500/10 rounded p-3 space-y-2">
              <p className="text-xs font-medium">Copie agora — a chave completa só é exibida uma única vez:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background p-2 rounded flex-1 break-all">{novaChave}</code>
                <Button size="sm" onClick={() => copy(novaChave)}><Copy className="w-3 h-3" /></Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setNovaChave(null)}>Ok, guardei</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Chaves ativas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chave criada.</p>}
          {keys.map(k => (
            <div key={k.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{k.nome}</div>
                <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(k.permissoes || []).map((p: string) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                </div>
                {k.last_used_at && (
                  <div className="text-[11px] text-muted-foreground mt-1">Último uso: {new Date(k.last_used_at).toLocaleString('pt-BR')}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={k.ativo} onCheckedChange={v => toggle(k.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => excluir(k.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}