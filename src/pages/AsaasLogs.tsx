import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, RefreshCw, Info, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AdminPasswordGate } from '@/components/admin/AdminPasswordGate';
import { isAdminUnlocked } from '@/lib/adminConfig';

interface Evento {
  id: string;
  event: string | null;
  status: string;
  asaas_payment_id: string | null;
  asaas_installment_id: string | null;
  asaas_customer_id: string | null;
  cpf_cnpj: string | null;
  valor: number | null;
  orcamento_id: string | null;
  pedido_id: string | null;
  mensagem: string | null;
  payload: any;
  resposta: any;
  created_at: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sucesso: 'default',
  parcial: 'secondary',
  aguardando_contrato: 'secondary',
  pendente: 'secondary',
  ignorado: 'outline',
  erro: 'destructive',
};

function AsaasLogsContent() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [jsonInput, setJsonInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ultimaResposta, setUltimaResposta] = useState<any>(null);

  const enviarJson = async () => {
    if (!jsonInput.trim()) {
      toast.error('Cole um JSON antes de enviar');
      return;
    }
    let payload: any;
    try {
      payload = JSON.parse(jsonInput);
    } catch (e: any) {
      toast.error('JSON inválido: ' + e.message);
      return;
    }
    setEnviando(true);
    setUltimaResposta(null);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-webhook', {
        body: payload,
      });
      if (error) throw error;
      setUltimaResposta(data);
      toast.success('Webhook processado');
      carregar();
    } catch (e: any) {
      setUltimaResposta({ erro: e.message });
      toast.error('Falha: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('asaas_eventos_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Erro ao carregar logs: ' + error.message);
    setEventos(((data as any) || []) as Evento[]);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('asaas_eventos_log_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asaas_eventos_log' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs Asaas</h1>
          <p className="text-sm text-muted-foreground">Eventos recebidos via webhook do Asaas (pagamentos, parcelas, quitações)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Endpoint configurado no Asaas</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>
            URL: <code>https://nawhpweyisawxaymmusg.supabase.co/functions/v1/asaas-webhook</code>
          </p>
          <p>
            Autenticação via header <code>asaas-access-token</code> (secret <code>ASAAS_WEBHOOK_TOKEN</code>).
            Eventos aceitos: <code>PAYMENT_RECEIVED</code>, <code>PAYMENT_CONFIRMED</code>, <code>PAYMENT_RECEIVED_IN_CASH</code>.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar webhook manualmente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cole aqui um JSON de evento do Asaas (ex.: <code>PAYMENT_RECEIVED</code>) e envie para a edge function <code>asaas-webhook</code>. Útil para reprocessar eventos ou simular pagamentos.
          </p>
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{\n  "event": "PAYMENT_RECEIVED",\n  "payment": {\n    "id": "pay_xxx",\n    "value": 100.00,\n    "customer": "cus_xxx",\n    "status": "RECEIVED"\n  }\n}'
            className="font-mono text-xs min-h-[200px]"
          />
          <div className="flex gap-2 items-center">
            <Button onClick={enviarJson} disabled={enviando}>
              <Send className={`w-4 h-4 mr-2 ${enviando ? 'animate-pulse' : ''}`} />
              {enviando ? 'Enviando...' : 'Enviar para webhook'}
            </Button>
            <Button variant="ghost" onClick={() => { setJsonInput(''); setUltimaResposta(null); }} disabled={enviando}>
              Limpar
            </Button>
          </div>
          {ultimaResposta && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resposta</p>
              <pre className="text-[10px] whitespace-pre-wrap break-all bg-muted rounded p-2 max-h-60 overflow-auto">
                {JSON.stringify(ultimaResposta, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((e) => {
                    const open = !!expandido[e.id];
                    return (
                      <Fragment key={e.id}>
                        <TableRow className="cursor-pointer" onClick={() => setExpandido(p => ({ ...p, [e.id]: !open }))}>
                          <TableCell>
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{e.event || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[e.status] || 'outline'}>{e.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {e.valor != null ? `R$ ${Number(e.valor).toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{e.asaas_payment_id || '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{e.cpf_cnpj || '—'}</TableCell>
                          <TableCell className="text-xs max-w-md truncate">{e.mensagem}</TableCell>
                        </TableRow>
                        {open && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Payload Asaas</p>
                                  <pre className="text-[10px] whitespace-pre-wrap break-all bg-background rounded p-2 max-h-72 overflow-auto">
                                    {JSON.stringify(e.payload, null, 2) || '—'}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resposta</p>
                                  <pre className="text-[10px] whitespace-pre-wrap break-all bg-background rounded p-2 max-h-72 overflow-auto">
                                    {JSON.stringify(e.resposta, null, 2) || '—'}
                                  </pre>
                                </div>
                                {(e.orcamento_id || e.pedido_id || e.asaas_installment_id) && (
                                  <div className="md:col-span-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                    {e.orcamento_id && <span>Orçamento: <code>{e.orcamento_id}</code></span>}
                                    {e.pedido_id && <span>Pedido: <code>{e.pedido_id}</code></span>}
                                    {e.asaas_installment_id && <span>Parcelamento: <code>{e.asaas_installment_id}</code></span>}
                                    {e.asaas_customer_id && <span>Customer: <code>{e.asaas_customer_id}</code></span>}
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

export default function AsaasLogs() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked());
  if (!unlocked) return <AdminPasswordGate onUnlock={() => setUnlocked(true)} />;
  return <AsaasLogsContent />;
}