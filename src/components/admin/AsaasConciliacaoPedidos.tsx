import { useMemo, useState, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Users, ClipboardList, Loader2, ChevronDown, ChevronRight, Save, ExternalLink, Receipt, FileText } from 'lucide-react';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useToast } from '@/hooks/use-toast';

interface ItemCobranca {
  id: string;
  cliente: string;
  valor: number;
  liquido: number;
  installment_id?: string | null;
  installment_numero?: number | null;
  installment_total?: number | null;
  data_pagamento: string | null;
  vencimento?: string | null;
  forma_label?: string;
  forma?: string;
  descricao?: string;
  status?: string;
  invoice_url?: string | null;
  bank_slip_url?: string | null;
  transaction_receipt_url?: string | null;
  invoice_number?: string | null;
  nosso_numero?: string | null;
  cliente_email?: string | null;
  cliente_cpf_cnpj?: string | null;
}

interface Props {
  itens: ItemCobranca[];
  mes: string;
}

const fmtBRL = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
};

function normalize(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function AsaasConciliacaoPedidos({ itens, mes }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: usuarios = [] } = useUsuarios(true);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const [percentual, setPercentual] = useState<number>(1);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const { data: jaConciliadas = [] } = useQuery({
    queryKey: ['asaas-conciliadas', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asaas_consultas_salvas' as any)
        .select('id, mes, filtro_cliente, consultor_id, consultor_nome, valor_consultor, liquido_total')
        .eq('mes', mes);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos-conciliacao-asaas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id, numero_orcamento, nome_cliente, consultor_responsavel, valor_total, asaas_parcelas_total, status, forma_pagamento, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const conciliacao = useMemo(() => {
    // Agrupar itens Asaas por cliente normalizado
    const porCliente = new Map<string, { nome: string; itens: ItemCobranca[] }>();
    for (const it of itens) {
      const key = normalize(it.cliente);
      if (!key) continue;
      const g = porCliente.get(key) || { nome: it.cliente, itens: [] };
      g.itens.push(it);
      porCliente.set(key, g);
    }

    // Indexar orçamentos por nome normalizado
    const orcPorNome = new Map<string, any[]>();
    for (const o of orcamentos as any[]) {
      const key = normalize(o.nome_cliente || '');
      if (!key) continue;
      const arr = orcPorNome.get(key) || [];
      arr.push(o);
      orcPorNome.set(key, arr);
    }

    type Linha = {
      cliente: string;
      consultor: string;
      orcamentos: any[];
      qtdPagas: number;
      totalParcelas: number | null;
      brutoPago: number;
      liquidoPago: number;
      match: boolean;
      primeiroPagto: string | null;
      ultimoPagto: string | null;
      proximoVencimento: string | null;
      formas: string[];
      itens: ItemCobranca[];
    };

    const linhas: Linha[] = [];
    for (const [key, grupo] of porCliente.entries()) {
      const orcs = orcPorNome.get(key) || [];
      const consultor = orcs[0]?.consultor_responsavel || '—';
      const bruto = grupo.itens.reduce((s, i) => s + Number(i.valor || 0), 0);
      const liquido = grupo.itens.reduce((s, i) => s + Number(i.liquido || 0), 0);
      // total esperado de parcelas: prioriza o do orçamento (asaas_parcelas_total), senão o retornado pela API
      const totalOrc = orcs.find((o) => o.asaas_parcelas_total)?.asaas_parcelas_total || null;
      const totalApi = grupo.itens.find((i) => i.installment_total)?.installment_total || null;
      const datasPagto = grupo.itens.map((i) => i.data_pagamento).filter(Boolean) as string[];
      datasPagto.sort();
      const vencs = grupo.itens.map((i) => i.vencimento).filter(Boolean) as string[];
      vencs.sort();
      const hoje = new Date().toISOString().slice(0, 10);
      const proxVenc = vencs.find((v) => v >= hoje) || null;
      const formas = Array.from(new Set(grupo.itens.map((i) => i.forma_label || i.forma || '').filter(Boolean)));
      linhas.push({
        cliente: grupo.nome,
        consultor,
        orcamentos: orcs,
        qtdPagas: grupo.itens.length,
        totalParcelas: totalOrc ?? totalApi,
        brutoPago: bruto,
        liquidoPago: liquido,
        match: orcs.length > 0,
        primeiroPagto: datasPagto[0] || null,
        ultimoPagto: datasPagto[datasPagto.length - 1] || null,
        proximoVencimento: proxVenc,
        formas,
        itens: grupo.itens,
      });
    }
    linhas.sort((a, b) => Number(b.match) - Number(a.match) || b.liquidoPago - a.liquidoPago);

    // Agrupar por consultor (apenas com match)
    const porConsultor = new Map<string, { consultor: string; clientes: number; pedidos: Set<string>; parcelasPagas: number; brutoPago: number; liquidoPago: number }>();
    for (const l of linhas) {
      if (!l.match) continue;
      const c = porConsultor.get(l.consultor) || { consultor: l.consultor, clientes: 0, pedidos: new Set<string>(), parcelasPagas: 0, brutoPago: 0, liquidoPago: 0 };
      c.clientes += 1;
      l.orcamentos.forEach((o) => c.pedidos.add(o.numero_orcamento));
      c.parcelasPagas += l.qtdPagas;
      c.brutoPago += l.brutoPago;
      c.liquidoPago += l.liquidoPago;
      porConsultor.set(l.consultor, c);
    }
    const consultores = Array.from(porConsultor.values())
      .map((c) => ({ ...c, pedidos: c.pedidos.size }))
      .sort((a, b) => b.liquidoPago - a.liquidoPago);

    return { linhas, consultores };
  }, [itens, orcamentos]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando orçamentos para conciliação...
      </div>
    );
  }

  const semMatch = conciliacao.linhas.filter((l) => !l.match).length;

  const conciliarCliente = async (linha: typeof conciliacao.linhas[number]) => {
    if (!linha.match) {
      toast({ title: 'Sem orçamento vinculado', description: 'Não é possível conciliar sem orçamento correspondente.', variant: 'destructive' });
      return;
    }
    const consultorNorm = normalize(linha.consultor);
    const usuario = usuarios.find((u) => normalize(u.nome) === consultorNorm);
    if (!usuario) {
      toast({ title: 'Consultor não cadastrado', description: `Cadastre "${linha.consultor}" em Consultores antes de conciliar.`, variant: 'destructive' });
      return;
    }
    setSalvandoId(linha.cliente);
    try {
      const payload = {
        consultor_id: usuario.id,
        consultor_nome: usuario.nome,
        mes,
        filtro_cliente: linha.cliente,
        quantidade_recebida: linha.qtdPagas,
        faturamento_total: linha.brutoPago,
        liquido_total: linha.liquidoPago,
        percentual,
        valor_consultor: (linha.liquidoPago * (percentual || 0)) / 100,
        por_cliente: [{ nome: linha.cliente, quantidade: linha.qtdPagas, faturamento: linha.brutoPago, liquido: linha.liquidoPago }],
        observacao: `Conciliação Asaas × ${linha.orcamentos.map((o: any) => o.numero_orcamento).join(', ')}`,
      };
      const { error } = await supabase.from('asaas_consultas_salvas' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Pedido conciliado', description: `${linha.cliente} → ${usuario.nome} · ${fmtBRL(payload.valor_consultor)}` });
      queryClient.invalidateQueries({ queryKey: ['asaas-conciliadas'] });
      queryClient.invalidateQueries({ queryKey: ['asaas-consultas-salvas'] });
    } catch (e: any) {
      toast({ title: 'Erro ao conciliar', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSalvandoId(null);
    }
  };

  const jaConciliada = (nome: string) => jaConciliadas.some((c) => (c.filtro_cliente || '').toLowerCase() === nome.toLowerCase());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">% comissão do consultor</Label>
              <Input type="number" step="0.01" min={0} value={percentual}
                onChange={(e) => setPercentual(parseFloat(e.target.value) || 0)} className="w-32" />
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              Ao clicar em <strong>Conciliar</strong>, o valor pago é registrado como comissão do consultor vinculado ao orçamento (aparece em Comissionamento e no Dashboard do vendedor).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Recebido por consultor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conciliacao.consultores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum cliente pagante bateu com orçamento existente.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Orçamentos</TableHead>
                    <TableHead className="text-right">Parcelas pagas</TableHead>
                    <TableHead className="text-right">Bruto pago</TableHead>
                    <TableHead className="text-right">Líquido recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conciliacao.consultores.map((c) => (
                    <TableRow key={c.consultor}>
                      <TableCell className="font-medium">{c.consultor}</TableCell>
                      <TableCell className="text-right">{c.clientes}</TableCell>
                      <TableCell className="text-right">{c.pedidos}</TableCell>
                      <TableCell className="text-right">{c.parcelasPagas}</TableCell>
                      <TableCell className="text-right">{fmtBRL(c.brutoPago)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{fmtBRL(c.liquidoPago)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Conciliação Asaas × Orçamentos ({conciliacao.linhas.length})
          </CardTitle>
          {semMatch > 0 && (
            <p className="text-xs text-amber-600">
              {semMatch} cliente(s) pagante(s) sem orçamento correspondente pelo nome.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente (Asaas)</TableHead>
                  <TableHead>Orçamento(s)</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead>1º pagto</TableHead>
                  <TableHead>Último pagto</TableHead>
                  <TableHead>Próx. venc.</TableHead>
                  <TableHead className="text-right">Bruto pago</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conciliacao.linhas.map((l, idx) => {
                  const aberto = !!expandidas[l.cliente];
                  const conciliado = jaConciliada(l.cliente);
                  return (
                  <Fragment key={idx}>
                  <TableRow>
                    <TableCell>
                      <button onClick={() => setExpandidas((s) => ({ ...s, [l.cliente]: !s[l.cliente] }))} className="p-0">
                        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      {l.match ? (
                        conciliado ? (
                          <Badge className="bg-blue-600 hover:bg-blue-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Conciliado</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/40"><AlertCircle className="h-3 w-3" /> Sem orçamento</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={l.cliente}>{l.cliente}</TableCell>
                    <TableCell className="text-xs">
                      {l.orcamentos.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {l.orcamentos.map((o) => (
                            <Badge key={o.id} variant="secondary" className="text-[10px]">
                              {o.numero_orcamento}
                              {o.valor_total ? ` · ${fmtBRL(Number(o.valor_total))}` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{l.consultor}</TableCell>
                    <TableCell className="text-xs">{l.formas.join(', ') || '—'}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      <span className="font-semibold">{l.qtdPagas}</span>
                      {l.totalParcelas ? <span className="text-muted-foreground"> / {l.totalParcelas}</span> : ''}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.primeiroPagto)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.ultimoPagto)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.proximoVencimento)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{fmtBRL(l.brutoPago)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap font-medium">{fmtBRL(l.liquidoPago)}</TableCell>
                    <TableCell className="text-right">
                      {l.match && !conciliado && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={salvandoId === l.cliente}
                          onClick={() => conciliarCliente(l)}>
                          {salvandoId === l.cliente ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Conciliar
                        </Button>
                      )}
                      {conciliado && <span className="text-[10px] text-blue-600">Já conciliado</span>}
                    </TableCell>
                  </TableRow>
                  {aberto && (
                    <TableRow className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell colSpan={12}>
                        <div className="py-2 space-y-2">
                          {(l.itens[0]?.cliente_email || l.itens[0]?.cliente_cpf_cnpj) && (
                            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                              {l.itens[0]?.cliente_email && <span>E-mail: <strong>{l.itens[0].cliente_email}</strong></span>}
                              {l.itens[0]?.cliente_cpf_cnpj && <span>CPF/CNPJ: <strong>{l.itens[0].cliente_cpf_cnpj}</strong></span>}
                            </div>
                          )}
                          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Pagamentos ({l.itens.length})</div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px]">Data</TableHead>
                                <TableHead className="text-[10px]">Vencimento</TableHead>
                                <TableHead className="text-[10px]">Descrição</TableHead>
                                <TableHead className="text-[10px]">Forma</TableHead>
                                <TableHead className="text-[10px]">Parcela</TableHead>
                                <TableHead className="text-[10px]">Nº fatura</TableHead>
                                <TableHead className="text-[10px] text-right">Bruto</TableHead>
                                <TableHead className="text-[10px] text-right">Líquido</TableHead>
                                <TableHead className="text-[10px] text-right">Links</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {l.itens.map((it) => (
                                <TableRow key={it.id}>
                                  <TableCell className="text-[11px] whitespace-nowrap">{fmtDate(it.data_pagamento)}</TableCell>
                                  <TableCell className="text-[11px] whitespace-nowrap">{fmtDate(it.vencimento)}</TableCell>
                                  <TableCell className="text-[11px] max-w-[240px] truncate" title={it.descricao}>{it.descricao || '—'}</TableCell>
                                  <TableCell className="text-[11px]">{it.forma_label || it.forma}</TableCell>
                                  <TableCell className="text-[11px] whitespace-nowrap">
                                    {it.installment_id ? `${it.installment_numero ?? '?'}/${it.installment_total ?? '?'}` : '—'}
                                  </TableCell>
                                  <TableCell className="text-[11px]">{it.invoice_number || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right whitespace-nowrap">{fmtBRL(it.valor)}</TableCell>
                                  <TableCell className="text-[11px] text-right whitespace-nowrap font-medium">{fmtBRL(it.liquido)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {it.invoice_url && <a href={it.invoice_url} target="_blank" rel="noreferrer" title="Fatura"><Button size="sm" variant="ghost" className="h-6 w-6 p-0"><ExternalLink className="h-3 w-3" /></Button></a>}
                                      {it.bank_slip_url && <a href={it.bank_slip_url} target="_blank" rel="noreferrer" title="Boleto"><Button size="sm" variant="ghost" className="h-6 w-6 p-0"><FileText className="h-3 w-3" /></Button></a>}
                                      {it.transaction_receipt_url && <a href={it.transaction_receipt_url} target="_blank" rel="noreferrer" title="Comprovante"><Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Receipt className="h-3 w-3" /></Button></a>}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );})}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AsaasConciliacaoPedidos;