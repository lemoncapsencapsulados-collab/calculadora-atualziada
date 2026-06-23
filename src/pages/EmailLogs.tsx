import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

type EmailRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
};

type Range = '24h' | '7d' | '30d' | 'custom';

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; className?: string }> = {
  sent: { label: 'Enviado', variant: 'default', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20' },
  pending: { label: 'Pendente', variant: 'outline', icon: Clock, className: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
  dlq: { label: 'Esgotou tentativas', variant: 'destructive', icon: AlertTriangle },
  bounced: { label: 'Devolvido', variant: 'destructive', icon: XCircle },
  complained: { label: 'Reclamação', variant: 'destructive', icon: AlertTriangle },
  suppressed: { label: 'Suprimido', variant: 'secondary', icon: Ban, className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, variant: 'outline' as const, icon: Clock };
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={`gap-1 ${meta.className || ''}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

function rangeToDates(range: Range, customStart: string, customEnd: string) {
  const now = new Date();
  if (range === '24h') return { start: subDays(now, 1), end: now };
  if (range === '7d') return { start: startOfDay(subDays(now, 7)), end: now };
  if (range === '30d') return { start: startOfDay(subDays(now, 30)), end: now };
  return {
    start: customStart ? startOfDay(new Date(customStart)) : subDays(now, 7),
    end: customEnd ? endOfDay(new Date(customEnd)) : now,
  };
}

export default function EmailLogs() {
  const [range, setRange] = useState<Range>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [template, setTemplate] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<EmailRow | null>(null);

  const { start, end } = useMemo(() => rangeToDates(range, customStart, customEnd), [range, customStart, customEnd]);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['email-send-log', start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('email_send_log')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as EmailRow[];
    },
    refetchInterval: 15000,
  });

  // Dedup por message_id mantendo a última versão (rows já vem em ordem desc)
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const out: EmailRow[] = [];
    for (const r of rows) {
      const key = r.message_id || r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [rows]);

  const templates = useMemo(() => Array.from(new Set(deduped.map((r) => r.template_name))).sort(), [deduped]);

  const filtered = useMemo(() => {
    return deduped.filter((r) => {
      if (template !== 'all' && r.template_name !== template) return false;
      if (status !== 'all' && r.status !== status) return false;
      return true;
    });
  }, [deduped, template, status]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of filtered) {
      if (r.status === 'sent') s.sent++;
      else if (r.status === 'dlq' || r.status === 'failed' || r.status === 'bounced' || r.status === 'complained') s.failed++;
      else if (r.status === 'suppressed') s.suppressed++;
      else if (r.status === 'pending') s.pending++;
    }
    return s;
  }, [filtered]);

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Tentativas por message_id (linhas brutas)
  const attemptsByMessage = useMemo(() => {
    const map = new Map<string, EmailRow[]>();
    for (const r of rows) {
      const key = r.message_id || r.id;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [rows]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Logs de Email</h1>
            <p className="text-sm text-muted-foreground">Auditoria de disparos: sucesso, erros e tentativas</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1">
              {(['24h', '7d', '30d', 'custom'] as Range[]).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={range === r ? 'default' : 'outline'}
                  onClick={() => { setRange(r); setPage(0); }}
                >
                  {r === '24h' ? 'Últimas 24h' : r === '7d' ? '7 dias' : r === '30d' ? '30 dias' : 'Personalizado'}
                </Button>
              ))}
            </div>
            {range === 'custom' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select value={template} onValueChange={(v) => { setTemplate(v); setPage(0); }}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os templates</SelectItem>
                  {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="dlq">Esgotou tentativas</SelectItem>
                  <SelectItem value="bounced">Devolvido</SelectItem>
                  <SelectItem value="complained">Reclamação</SelectItem>
                  <SelectItem value="suppressed">Suprimido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Enviados</div><div className="text-2xl font-bold text-emerald-600">{stats.sent}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-bold text-amber-600">{stats.pending}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Falhas</div><div className="text-2xl font-bold text-destructive">{stats.failed}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Suprimidos</div><div className="text-2xl font-bold text-yellow-600">{stats.suppressed}</div></CardContent></Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de envios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">Nenhum envio no período/filtros selecionados.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quando</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => {
                      const key = r.message_id || r.id;
                      const attempts = attemptsByMessage.get(key)?.length || 1;
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(r)}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.template_name}</TableCell>
                          <TableCell className="text-xs">{r.recipient_email}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell className="text-xs text-center">{attempts}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-xs truncate" title={r.error_message || ''}>
                            {r.error_message || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Página {page + 1} de {totalPages} — {filtered.length} envios
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detalhe */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do envio</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Template</div><div className="font-mono">{detail.template_name}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><StatusBadge status={detail.status} /></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Destinatário</div><div>{detail.recipient_email}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">message_id</div><div className="font-mono text-xs break-all">{detail.message_id || '—'}</div></div>
              </div>
              {detail.error_message && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Erro</div>
                  <pre className="bg-destructive/10 text-destructive p-3 rounded text-xs whitespace-pre-wrap">{detail.error_message}</pre>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Histórico de tentativas</div>
                <div className="space-y-2">
                  {(attemptsByMessage.get(detail.message_id || detail.id) || [detail])
                    .slice()
                    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
                    .map((a, i) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs border rounded p-2">
                        <span className="text-muted-foreground w-6">#{i + 1}</span>
                        <span className="w-44">{format(new Date(a.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</span>
                        <StatusBadge status={a.status} />
                        {a.error_message && <span className="text-destructive truncate">{a.error_message}</span>}
                      </div>
                    ))}
                </div>
              </div>
              {detail.metadata && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Metadata</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(detail.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}