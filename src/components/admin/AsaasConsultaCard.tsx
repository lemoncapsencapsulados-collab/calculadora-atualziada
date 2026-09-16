import { useState, useEffect, useRef, Fragment } from 'react';
import { Loader2, Search, ShoppingBag, TrendingUp, Percent, UserCheck, Save, FileDown, Trash2, History, KeyRound, Database, Calculator, CheckCircle2, ExternalLink, FileText, Receipt, ChevronDown, ChevronRight, Layers, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AsaasConciliacaoPedidos } from './AsaasConciliacaoPedidos';

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
};

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

interface PorCliente { nome: string; quantidade: number; faturamento: number; liquido: number }
interface ItemCobranca {
  id: string;
  cliente: string;
  cliente_email?: string | null;
  cliente_cpf_cnpj?: string | null;
  descricao: string;
  forma: string;
  forma_label?: string;
  data_pagamento: string | null;
  data_credito?: string | null;
  data_confirmacao?: string | null;
  data_pagamento_cliente?: string | null;
  vencimento?: string | null;
  vencimento_original?: string | null;
  valor: number;
  liquido: number;
  desconto?: number;
  multa?: number;
  juros?: number;
  status: string;
  installment_id?: string | null;
  installment_numero?: number | null;
  installment_total?: number | null;
  subscription_id?: string | null;
  invoice_number?: string | null;
  invoice_url?: string | null;
  bank_slip_url?: string | null;
  transaction_receipt_url?: string | null;
  nosso_numero?: string | null;
  external_reference?: string | null;
  cartao_bandeira?: string | null;
  cartao_final?: string | null;
}
interface Resultado {
  mes: string;
  filtro_cliente: string | null;
  total_retornado_api: number;
  quantidade_recebida: number;
  faturamento_total: number;
  liquido_total: number;
  por_cliente: PorCliente[];
  itens: ItemCobranca[];
}

export function AsaasConsultaCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [clienteNome, setClienteNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState(0);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(true);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const etapas = [
    { label: 'Autenticando no Asaas', icon: KeyRound },
    { label: 'Buscando cobranças pagas do período', icon: Database },
    { label: 'Carregando nomes dos clientes', icon: Search },
    { label: 'Calculando totais e valores líquidos', icon: Calculator },
  ];

  useEffect(() => () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  const iniciarProgresso = () => {
    setProgresso(5); setEtapa(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgresso((p) => {
        const next = p + (p < 60 ? 4 : p < 85 ? 1.5 : 0.4);
        const capped = Math.min(next, 92);
        const novaEtapa = capped < 25 ? 0 : capped < 55 ? 1 : capped < 80 ? 2 : 3;
        setEtapa(novaEtapa);
        return capped;
      });
    }, 350);
  };
  const finalizarProgresso = () => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    setProgresso(100); setEtapa(etapas.length - 1);
    setTimeout(() => { setProgresso(0); setEtapa(0); }, 600);
  };

  const [data, setData] = useState<Resultado | null>(null);
  const [consultorId, setConsultorId] = useState<string>('');
  const [percentual, setPercentual] = useState<number>(1);
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: usuarios = [] } = useUsuarios(true);

  const consultorSelecionado = usuarios.find((u) => u.id === consultorId) || null;
  const valorConsultor = data ? (data.liquido_total * (percentual || 0)) / 100 : 0;

  const { data: salvas = [] } = useQuery({
    queryKey: ['asaas-consultas-salvas', consultorId],
    queryFn: async () => {
      let q = supabase.from('asaas_consultas_salvas' as any).select('*').order('created_at', { ascending: false }).limit(50);
      if (consultorId) q = q.eq('consultor_id', consultorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asaas_consultas_salvas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Registro excluído' });
      queryClient.invalidateQueries({ queryKey: ['asaas-consultas-salvas'] });
    },
  });

  const consultar = async () => {
    if (!mes) { toast({ title: 'Informe o mês', variant: 'destructive' }); return; }
    setLoading(true);
    iniciarProgresso();
    try {
      const { data: resp, error } = await supabase.functions.invoke('asaas-consultar-vendas', {
        body: { mes, cliente_nome: clienteNome.trim() || undefined },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      setData(resp as Resultado);
      toast({ title: 'Consulta concluída', description: `${(resp as Resultado).quantidade_recebida} cobrança(s) paga(s) no período.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro na consulta Asaas', description: e?.message || String(e), variant: 'destructive' });
    } finally { finalizarProgresso(); setLoading(false); }
  };

  const salvar = async () => {
    if (!data) return;
    if (!consultorSelecionado) { toast({ title: 'Selecione um consultor antes de salvar', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        consultor_id: consultorSelecionado.id,
        consultor_nome: consultorSelecionado.nome,
        mes: data.mes,
        filtro_cliente: clienteNome.trim() || null,
        quantidade_recebida: data.quantidade_recebida,
        faturamento_total: data.faturamento_total,
        liquido_total: data.liquido_total,
        percentual,
        valor_consultor: valorConsultor,
        por_cliente: data.por_cliente,
        observacao: observacao.trim() || null,
      };
      const { error } = await supabase.from('asaas_consultas_salvas' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Consulta salva', description: `Vinculada a ${consultorSelecionado.nome}.` });
      queryClient.invalidateQueries({ queryKey: ['asaas-consultas-salvas'] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || String(e), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const exportarPdf = (origem?: any) => {
    const d = origem || (data && {
      mes: data.mes,
      quantidade_recebida: data.quantidade_recebida,
      faturamento_total: data.faturamento_total,
      liquido_total: data.liquido_total,
      por_cliente: data.por_cliente,
      percentual, valor_consultor: valorConsultor,
      consultor_nome: consultorSelecionado?.nome || '—',
      filtro_cliente: clienteNome || null,
      observacao: observacao || null,
    });
    if (!d) return;
    const doc = new jsPDF();
    const margemX = 14; let y = 18;
    doc.setFontSize(16); doc.text('Relatório de Cobranças Pagas — Asaas', margemX, y);
    y += 8; doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margemX, y);
    y += 8; doc.setTextColor(0);
    const linhas: [string, string][] = [
      ['Consultor', d.consultor_nome || '—'],
      ['Mês de referência', d.mes],
      ['Filtro cliente', d.filtro_cliente || '—'],
      ['Quantidade recebida', String(d.quantidade_recebida)],
      ['Faturamento bruto', fmtBRL(Number(d.faturamento_total))],
      ['Valor líquido Asaas', fmtBRL(Number(d.liquido_total))],
      ['Percentual do consultor', `${Number(d.percentual).toLocaleString('pt-BR')}%`],
      ['Valor a receber', fmtBRL(Number(d.valor_consultor))],
    ];
    if (d.observacao) linhas.push(['Observação', String(d.observacao)]);
    autoTable(doc, { startY: y, head: [['Campo', 'Valor']], body: linhas, theme: 'striped', headStyles: { fillColor: [34, 197, 94] }, styles: { fontSize: 10 } });
    const porCliente = Array.isArray(d.por_cliente) ? d.por_cliente : [];
    if (porCliente.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Cliente', 'Qtd', 'Bruto', 'Líquido']],
        body: porCliente.map((p: any) => [p.nome, String(p.quantidade), fmtBRL(Number(p.faturamento)), fmtBRL(Number(p.liquido))]),
        theme: 'grid', headStyles: { fillColor: [34, 197, 94] }, styles: { fontSize: 9 },
      });
    }
    const nome = (d.consultor_nome || 'consultor').replace(/\s+/g, '_').toLowerCase();
    doc.save(`asaas_${nome}_${d.mes}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Cobranças pagas — Asaas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Consulta a API do Asaas para apurar todas as cobranças <strong>pagas (RECEIVED)</strong> do mês selecionado. Filtre por nome do cliente (parcial) se quiser restringir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Nome do cliente (contém)</Label>
            <Input placeholder="ex.: João, Empresa..." value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={consultar} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consultando...</> : <><Search className="h-4 w-4 mr-2" />Consultar Asaas</>}
          </Button>
        </div>

        {loading && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span className="text-sm font-semibold">Consultando Asaas…</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
              <ul className="space-y-2">
                {etapas.map((e, i) => {
                  const Icone = e.icon;
                  const concluido = i < etapa || progresso >= 100;
                  const ativo = i === etapa && progresso < 100;
                  return (
                    <li key={e.label} className={`flex items-center gap-2 text-xs transition-colors ${concluido ? 'text-emerald-600' : ativo ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                      {concluido ? <CheckCircle2 className="h-4 w-4" /> : ativo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icone className="h-4 w-4 opacity-60" />}
                      <span>{e.label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                A consulta busca cobranças e depois o nome de cada cliente — pode levar alguns segundos.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Comissão do consultor sobre o líquido Asaas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Consultor</Label>
                    <Select value={consultorId} onValueChange={setConsultorId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um consultor" /></SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}{u.cargo ? ` — ${u.cargo}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Percentual (%)</Label>
                    <Input type="number" step="0.01" min={0} value={percentual}
                      onChange={(e) => setPercentual(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Valor a receber</Label>
                    <div className="h-10 px-3 rounded-md border bg-background flex items-center font-bold text-emerald-600">
                      {fmtBRL(valorConsultor)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Observação (opcional)</Label>
                  <Input placeholder="ex.: fechamento de novembro" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={salvar} disabled={saving || !consultorSelecionado} size="sm">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar vinculado ao consultor
                  </Button>
                  <Button onClick={() => exportarPdf()} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cálculo: <strong>{percentual}%</strong> de {fmtBRL(data.liquido_total)} (líquido recebido no período){consultorSelecionado ? <> · vinculado a <strong>{consultorSelecionado.nome}</strong></> : ''}.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Cobranças pagas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.quantidade_recebida}</div>
                  <div className="text-xs text-muted-foreground">{data.total_retornado_api} retornadas pela API</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Faturamento bruto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{fmtBRL(data.faturamento_total)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Líquido recebido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtBRL(data.liquido_total)}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="resumo" className="w-full">
              <TabsList>
                <TabsTrigger value="resumo">Resumo & detalhes</TabsTrigger>
                <TabsTrigger value="conciliacao">Conciliação com orçamentos</TabsTrigger>
              </TabsList>
              <TabsContent value="resumo" className="space-y-4 pt-3">
            {data.por_cliente.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Por cliente</div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.por_cliente.map((p) => (
                        <TableRow key={p.nome}>
                          <TableCell className="max-w-[420px] truncate" title={p.nome}>{p.nome}</TableCell>
                          <TableCell className="text-right">{p.quantidade}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.faturamento)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.liquido)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {data.itens && data.itens.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Detalhes das cobranças ({data.itens.length})
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setMostrarDetalhes((v) => !v)}>
                    {mostrarDetalhes ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </div>
                {mostrarDetalhes && (
                  <div className="overflow-x-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Data pagto</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Forma</TableHead>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Bruto</TableHead>
                          <TableHead className="text-right">Líquido</TableHead>
                          <TableHead className="text-right">Links</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.itens.map((it) => {
                          const aberto = !!expandidas[it.id];
                          const parcela = it.installment_id
                            ? `${it.installment_numero ?? '?'}/${it.installment_total ?? '?'}`
                            : '—';
                          return (
                            <Fragment key={it.id}>
                              <TableRow className="cursor-pointer" onClick={() => setExpandidas((s) => ({ ...s, [it.id]: !s[it.id] }))}>
                                <TableCell>
                                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{fmtDate(it.data_pagamento)}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate" title={it.cliente}>{it.cliente || '—'}</TableCell>
                                <TableCell className="text-xs max-w-[240px] truncate" title={it.descricao}>{it.descricao || '—'}</TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span>{it.forma_label || it.forma}</span>
                                    {it.installment_id && (
                                      <Badge variant="secondary" className="gap-1 text-[10px]">
                                        <Layers className="h-3 w-3" /> Parcelado
                                      </Badge>
                                    )}
                                    {it.subscription_id && (
                                      <Badge variant="secondary" className="gap-1 text-[10px]">
                                        <Repeat className="h-3 w-3" /> Assinatura
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{parcela}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{fmtDate(it.vencimento)}</TableCell>
                                <TableCell className="text-right text-xs whitespace-nowrap">{fmtBRL(it.valor)}</TableCell>
                                <TableCell className="text-right text-xs whitespace-nowrap font-medium">{fmtBRL(it.liquido)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    {it.invoice_url && (
                                      <a href={it.invoice_url} target="_blank" rel="noreferrer" title="Fatura">
                                        <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                      </a>
                                    )}
                                    {it.bank_slip_url && (
                                      <a href={it.bank_slip_url} target="_blank" rel="noreferrer" title="Boleto">
                                        <Button size="sm" variant="ghost"><FileText className="h-3.5 w-3.5" /></Button>
                                      </a>
                                    )}
                                    {it.transaction_receipt_url && (
                                      <a href={it.transaction_receipt_url} target="_blank" rel="noreferrer" title="Comprovante">
                                        <Button size="sm" variant="ghost"><Receipt className="h-3.5 w-3.5" /></Button>
                                      </a>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {aberto && (
                                <TableRow className="bg-muted/40">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={9}>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs py-2">
                                      <div><span className="text-muted-foreground">ID cobrança:</span> <span className="font-mono">{it.id}</span></div>
                                      <div><span className="text-muted-foreground">Status:</span> {it.status}</div>
                                      <div><span className="text-muted-foreground">Nº fatura:</span> {it.invoice_number || '—'}</div>
                                      <div><span className="text-muted-foreground">Nosso número:</span> {it.nosso_numero || '—'}</div>
                                      <div><span className="text-muted-foreground">Vencimento original:</span> {fmtDate(it.vencimento_original)}</div>
                                      <div><span className="text-muted-foreground">Pago pelo cliente:</span> {fmtDate(it.data_pagamento_cliente)}</div>
                                      <div><span className="text-muted-foreground">Confirmado:</span> {fmtDate(it.data_confirmacao)}</div>
                                      <div><span className="text-muted-foreground">Crédito na conta:</span> {fmtDate(it.data_credito)}</div>
                                      <div><span className="text-muted-foreground">Desconto:</span> {fmtBRL(it.desconto || 0)}</div>
                                      <div><span className="text-muted-foreground">Multa:</span> {fmtBRL(it.multa || 0)}</div>
                                      <div><span className="text-muted-foreground">Juros:</span> {fmtBRL(it.juros || 0)}</div>
                                      <div><span className="text-muted-foreground">Ref. externa:</span> {it.external_reference || '—'}</div>
                                      <div><span className="text-muted-foreground">E-mail cliente:</span> {it.cliente_email || '—'}</div>
                                      <div><span className="text-muted-foreground">CPF/CNPJ:</span> {it.cliente_cpf_cnpj || '—'}</div>
                                      {it.cartao_bandeira && (
                                        <div><span className="text-muted-foreground">Cartão:</span> {it.cartao_bandeira} •••• {it.cartao_final}</div>
                                      )}
                                      {it.installment_id && (
                                        <div><span className="text-muted-foreground">ID parcelamento:</span> <span className="font-mono">{it.installment_id}</span></div>
                                      )}
                                      {it.subscription_id && (
                                        <div><span className="text-muted-foreground">ID assinatura:</span> <span className="font-mono">{it.subscription_id}</span></div>
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
              </div>
            )}
              </TabsContent>
              <TabsContent value="conciliacao" className="pt-3">
                <AsaasConciliacaoPedidos itens={data.itens || []} mes={data.mes} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {salvas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Consultas Asaas salvas{consultorId ? ' deste consultor' : ' (todos os consultores)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Mês</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">A receber</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salvas.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{s.consultor_nome}</TableCell>
                        <TableCell>{s.mes}</TableCell>
                        <TableCell className="text-xs">{s.filtro_cliente || '—'}</TableCell>
                        <TableCell className="text-right">{fmtBRL(Number(s.liquido_total))}</TableCell>
                        <TableCell className="text-right">{Number(s.percentual)}%</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(Number(s.valor_consultor))}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => exportarPdf(s)} title="Exportar PDF">
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => excluir.mutate(s.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

export default AsaasConsultaCard;