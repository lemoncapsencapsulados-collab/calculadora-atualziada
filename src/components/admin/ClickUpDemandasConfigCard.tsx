import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Save, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEMANDA_TIPO_LABELS, DEMANDA_TIPO_SETOR, DemandaTipo } from '@/types/demandaMarca';

interface Membro { id: number; username: string; email?: string; profilePicture?: string | null }
interface Cfg {
  id?: string; tipo: DemandaTipo; ativo: boolean; list_id: string; list_nome: string;
  prefixo_nome: string; assignee_ids: number[];
}

const TIPOS = Object.keys(DEMANDA_TIPO_LABELS) as DemandaTipo[];

const vazio = (tipo: DemandaTipo): Cfg => ({
  tipo, ativo: true, list_id: '', list_nome: '',
  prefixo_nome: `${DEMANDA_TIPO_LABELS[tipo]} - `, assignee_ids: [],
});

export function ClickUpDemandasConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<DemandaTipo | null>(null);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Cfg>>({});
  const [membros, setMembros] = useState<Record<string, Membro[]>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clickup_demandas_config').select('*');
      const base: Record<string, Cfg> = {};
      TIPOS.forEach((t) => { base[t] = vazio(t); });
      (data || []).forEach((row: any) => {
        base[row.tipo] = {
          id: row.id, tipo: row.tipo, ativo: !!row.ativo,
          list_id: row.list_id || '', list_nome: row.list_nome || '',
          prefixo_nome: row.prefixo_nome || `${DEMANDA_TIPO_LABELS[row.tipo as DemandaTipo]} - `,
          assignee_ids: Array.isArray(row.assignee_ids) ? row.assignee_ids.map(Number) : [],
        };
      });
      setConfigs(base);
      setLoading(false);
    })();
  }, []);

  const set = (tipo: DemandaTipo, patch: Partial<Cfg>) =>
    setConfigs((c) => ({ ...c, [tipo]: { ...c[tipo], ...patch } }));

  const carregarMembros = async (tipo: DemandaTipo) => {
    const listId = configs[tipo]?.list_id?.trim();
    if (!listId) { toast.error('Informe o ID da lista primeiro'); return; }
    setLoadingMembros(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-listar-membros`);
      url.searchParams.set('list_id', listId);
      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const data = await resp.json();
      if (!resp.ok) { toast.error(`Falha ao buscar membros: ${data?.error || resp.statusText}`); return; }
      setMembros((m) => ({ ...m, [tipo]: data.members || [] }));
      toast.success(`${(data.members || []).length} membros carregados`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message}`);
    } finally {
      setLoadingMembros(false);
    }
  };

  const salvar = async (tipo: DemandaTipo) => {
    const cfg = configs[tipo];
    if (!cfg.list_id.trim()) { toast.error('Informe o ID da lista do ClickUp'); return; }
    setSaving(tipo);
    try {
      const nomes = (membros[tipo] || []).filter((m) => cfg.assignee_ids.includes(m.id)).map((m) => m.username);
      const payload = {
        tipo, ativo: cfg.ativo, list_id: cfg.list_id.trim(), list_nome: cfg.list_nome.trim() || null,
        prefixo_nome: cfg.prefixo_nome, assignee_ids: cfg.assignee_ids, assignee_nomes: nomes,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('clickup_demandas_config')
        .upsert(payload as any, { onConflict: 'tipo' })
        .select('id')
        .limit(1);
      if (error) throw error;
      if (data?.[0]?.id) set(tipo, { id: data[0].id });
      toast.success('Configuração salva!');
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message}`);
    } finally {
      setSaving(null);
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
          <Sparkles className="w-4 h-4 text-primary" />
          ClickUp — Demandas de Marca
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Defina em qual quadro (lista) do ClickUp cada tipo de demanda deve cair e quem são os responsáveis.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={TIPOS[0]}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-4">
            {TIPOS.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs">{DEMANDA_TIPO_LABELS[t]}</TabsTrigger>
            ))}
          </TabsList>
          {TIPOS.map((tipo) => {
            const cfg = configs[tipo];
            const lista = membros[tipo] || [];
            return (
              <TabsContent key={tipo} value={tipo} className="space-y-4 pt-4">
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <Label className="cursor-pointer">Envio ativo — {DEMANDA_TIPO_SETOR[tipo]}</Label>
                    <p className="text-xs text-muted-foreground">Desative para bloquear o envio deste tipo ao ClickUp</p>
                  </div>
                  <Switch checked={cfg.ativo} onCheckedChange={(v) => set(tipo, { ativo: v })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>ID da lista no ClickUp <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2">
                      <Input
                        value={cfg.list_id}
                        onChange={(e) => set(tipo, { list_id: e.target.value })}
                        placeholder="Ex.: 901234567890"
                        className="font-mono text-xs"
                      />
                      <Button type="button" variant="outline" size="icon" disabled={loadingMembros}
                        onClick={() => carregarMembros(tipo)} title="Carregar membros da lista">
                        {loadingMembros ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Abra a lista no ClickUp; o ID está no final da URL.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Apelido da lista</Label>
                    <Input value={cfg.list_nome} onChange={(e) => set(tipo, { list_nome: e.target.value })} placeholder="Ex.: Design / Rótulos" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Prefixo do nome da task</Label>
                  <Input value={cfg.prefixo_nome} onChange={(e) => set(tipo, { prefixo_nome: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">
                    A task ficará como: <span className="font-mono">{cfg.prefixo_nome}Nome do cliente (PED-000)</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> Responsáveis</Label>
                    <Button type="button" variant="ghost" size="sm" disabled={loadingMembros} onClick={() => carregarMembros(tipo)}>
                      {loadingMembros ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Atualizar lista
                    </Button>
                  </div>
                  {lista.length === 0 ? (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                      Informe o ID da lista e clique em <strong>Atualizar lista</strong> para buscar os membros.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {lista.map((m) => {
                        const checked = cfg.assignee_ids.includes(m.id);
                        return (
                          <label key={m.id} className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${checked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'}`}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => set(tipo, {
                                assignee_ids: checked ? cfg.assignee_ids.filter((x) => x !== m.id) : [...cfg.assignee_ids, m.id],
                              })}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{m.username}</p>
                              {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {cfg.assignee_ids.length > 0 && lista.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {lista.filter((m) => cfg.assignee_ids.includes(m.id)).map((m) => (
                        <Badge key={m.id} variant="secondary">{m.username}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => salvar(tipo)} disabled={saving === tipo}>
                    {saving === tipo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar {DEMANDA_TIPO_LABELS[tipo]}
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
