import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, RefreshCw, PlayCircle, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AdminPasswordGate } from '@/components/admin/AdminPasswordGate';
import { isAdminUnlocked } from '@/lib/adminConfig';

interface Evento {
  id: string;
  origem: 'webhook' | 'polling' | 'manual';
  tipo_evento: string;
  id_receita_vhsys: number | null;
  orcamento_id: string | null;
  pedido_id: string | null;
  status: 'sucesso' | 'pendente' | 'ignorado' | 'erro';
  mensagem: string | null;
  payload: any;
  resposta_vhsys: any;
  created_at: string;
}

const STATUS_VARIANT: Record<Evento['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sucesso: 'default',
  pendente: 'secondary',
  ignorado: 'outline',
  erro: 'destructive',
};

function VhsysLogsContent() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [reproc, setReproc] = useState<string | null>(null);
  const [executando, setExecutando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vhsys_eventos_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Erro ao carregar logs: ' + error.message);
    setEventos(((data as any) || []) as Evento[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const reprocessar = async (evento: Evento) => {
    if (!evento.id_receita_vhsys) {
      toast.error('Evento sem ID de receita do VhSys');
      return;
    }
    setReproc(evento.id);
    try {
      const { data, error } = await supabase.functions.invoke('vhsys-processar-receita', {
        body: {
          id_receita_vhsys: evento.id_receita_vhsys,
          origem: 'manual',
          tipo_evento: 'reprocessamento.manual',
        },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.status === 'sucesso') toast.success('Reprocessado com sucesso');
      else toast.message(`Resultado: ${r?.status || 'executado'}`, { description: r?.mensagem });
      await carregar();
    } catch (e) {
      toast.error('Erro ao reprocessar: ' + (e as Error).message);
    } finally {
      setReproc(null);
    }
  };

  const executarRotina = async () => {
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke('vhsys-cron-pagamentos', {
        body: { trigger: 'manual' },
      });
      if (error) throw error;
      const r = data as any;
      toast.success(`Rotina concluída: ${r?.processados ?? 0} processados, ${r?.total ?? 0} elegíveis`);
      await carregar();
    } catch (e) {
      toast.error('Erro: ' + (e as Error).message);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs VHSys</h1>
          <p className="text-sm text-muted-foreground">Eventos da integração com VHSys (webhook + rotina horária)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={executarRotina} disabled={executando}>
            <PlayCircle className="w-4 h-4 mr-2" />
            {executando ? 'Executando...' : 'Verificar agora'}
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o vínculo</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            Para que a conversão automática funcione, o financeiro deve incluir o <strong>número do orçamento</strong> (ex.: <code>ORC-2026-0123</code>)
            na <strong>descrição/observação</strong> da conta a receber no VHSys.
          </p>
          <p>
            O sistema valida pelo CNPJ/CPF do cliente + número do orçamento. Quando a conta a receber é liquidada no VHSys,
            o webhook (gatilho principal) ou a rotina horária (fallback) atualiza o orçamento para “Pago” e cria o pedido automaticamente.
          </p>
          <p className="text-xs text-muted-foreground">
            Endpoint do webhook: <code>https://nawhpweyisawxaymmusg.supabase.co/functions/v1/vhsys-webhook</code>
            {' '}— autenticação via header <code>x-vhsys-secret</code> ou query <code>?secret=...</code>.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 200 eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum evento registrado ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>ID Receita</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((e) => {
                    const open = !!expandido[e.id];
                    const podeReprocessar = (e.status === 'erro' || e.status === 'pendente') && !!e.id_receita_vhsys;
                    return (
                      <Fragment key={e.id}>
                        <TableRow className="cursor-pointer" onClick={() => setExpandido(p => ({ ...p, [e.id]: !open }))}>
                          <TableCell>
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{e.origem}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{e.tipo_evento}</TableCell>
                          <TableCell className="text-xs font-mono">{e.id_receita_vhsys ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-md truncate">{e.mensagem}</TableCell>
                          <TableCell className="text-right">
                            {podeReprocessar && (
                              <Button
                                size="sm" variant="outline"
                                onClick={(ev) => { ev.stopPropagation(); reprocessar(e); }}
                                disabled={reproc === e.id}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${reproc === e.id ? 'animate-spin' : ''}`} />
                                Reprocessar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Payload</p>
                                  <pre className="text-[10px] whitespace-pre-wrap break-all bg-background rounded p-2 max-h-72 overflow-auto">
                                    {JSON.stringify(e.payload, null, 2) || '—'}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resposta VhSys</p>
                                  <pre className="text-[10px] whitespace-pre-wrap break-all bg-background rounded p-2 max-h-72 overflow-auto">
                                    {JSON.stringify(e.resposta_vhsys, null, 2) || '—'}
                                  </pre>
                                </div>
                                {(e.orcamento_id || e.pedido_id) && (
                                  <div className="md:col-span-2 flex gap-4 text-xs text-muted-foreground">
                                    {e.orcamento_id && <span>Orçamento: <code>{e.orcamento_id}</code></span>}
                                    {e.pedido_id && <span>Pedido: <code>{e.pedido_id}</code></span>}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VhsysLogs() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  if (!unlocked) return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />;
  return <VhsysLogsContent />;
}