import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';

const EVENTOS = [
  { id: 'pedido.criado', label: 'Pedido criado' },
  { id: 'pedido.atualizado', label: 'Pedido atualizado' },
  { id: 'pedido.concluido', label: 'Pedido concluído' },
  { id: 'contrato.enviado', label: 'Contrato enviado' },
  { id: 'contrato.assinado', label: 'Contrato assinado' },
];

interface WebhookCfg {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  secret: string | null;
  ativo: boolean;
}

export function WebhooksConfigCard() {
  const [webhooks, setWebhooks] = useState<WebhookCfg[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [eventos, setEventos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from('webhook_configs').select('*').order('created_at', { ascending: false });
    setWebhooks((data as any) || []);
    const { data: d } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(20);
    setDeliveries(d || []);
  }
  useEffect(() => { load(); }, []);

  async function criar() {
    if (!nome || !url || eventos.length === 0) {
      toast.error('Preencha nome, URL e ao menos um evento');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('webhook_configs').insert({ nome, url, eventos, secret: secret || null, ativo: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Webhook criado');
    setNome(''); setUrl(''); setSecret(''); setEventos([]);
    load();
  }

  async function toggle(id: string, ativo: boolean) {
    await supabase.from('webhook_configs').update({ ativo }).eq('id', id);
    load();
  }
  async function excluir(id: string) {
    if (!confirm('Excluir webhook?')) return;
    await supabase.from('webhook_configs').delete().eq('id', id);
    load();
  }
  async function testar(w: WebhookCfg) {
    toast.loading('Enviando evento de teste...', { id: 'test-wh' });
    await supabase.functions.invoke('emit-webhook-event', {
      body: { evento: w.eventos[0] || 'pedido.criado', payload: { teste: true, webhook: w.nome, timestamp: new Date().toISOString() } },
    });
    toast.success('Evento disparado — veja histórico', { id: 'test-wh' });
    setTimeout(load, 1500);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Novo Webhook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Integração N8N" /></div>
            <div><Label>URL de destino</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div>
            <Label>Segredo HMAC (opcional)</Label>
            <Input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Assina o payload em X-Webhook-Signature" />
          </div>
          <div>
            <Label>Eventos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {EVENTOS.map(ev => (
                <label key={ev.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={eventos.includes(ev.id)}
                    onCheckedChange={c => setEventos(c ? [...eventos, ev.id] : eventos.filter(x => x !== ev.id))}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={criar} disabled={loading}><Plus className="w-4 h-4 mr-2" />Adicionar webhook</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Webhooks configurados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {webhooks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum webhook cadastrado.</p>}
          {webhooks.map(w => (
            <div key={w.id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{w.nome}</div>
                <div className="text-xs text-muted-foreground truncate">{w.url}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {w.eventos.map(e => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={w.ativo} onCheckedChange={v => toggle(w.id, v)} />
                <Button size="sm" variant="outline" onClick={() => testar(w)}><Send className="w-3 h-3 mr-1" />Testar</Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(w.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas entregas</CardTitle></CardHeader>
        <CardContent>
          {deliveries.length === 0 && <p className="text-sm text-muted-foreground">Sem entregas ainda.</p>}
          <div className="space-y-2">
            {deliveries.map(d => (
              <div key={d.id} className="text-xs border rounded p-2 flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono">{d.evento}</div>
                  <div className="text-muted-foreground">{new Date(d.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <Badge variant={d.status === 'success' ? 'default' : 'destructive'}>{d.status} {d.http_status ?? ''}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}