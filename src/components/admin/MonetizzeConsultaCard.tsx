import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { Loader2, Search, ShoppingBag, TrendingUp, Percent, UserCheck, Save, FileDown, Trash2, History, KeyRound, Database, Calculator, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

interface PorProduto { nome: string; quantidade: number; faturamento: number; comissao: number }
interface Item {
  codigo: string;
  produto: string;
  cliente: string;
  data_finalizacao: string | null;
  valor: number;
  comissao: number;
}
interface Resultado {
  mes: string;
  filtro_produto: string | null;
  total_retornado_api: number;
  quantidade_vendida: number;
  faturamento_total: number;
  comissao_total: number;
  por_produto: PorProduto[];
  itens: Item[];
}

export function MonetizzeConsultaCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [produtoNome, setProdutoNome] = useState('');
  const [produtoCodigo, setProdutoCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const etapas = [
    { label: 'Autenticando na Monetizze', icon: KeyRound },
    { label: 'Buscando vendas finalizadas', icon: Database },
    { label: 'Filtrando por produto', icon: Search },
    { label: 'Calculando comissões e totais', icon: Calculator },
  ];

  useEffect(() => () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
  }, []);

  const iniciarProgresso = () => {
    setProgresso(5);
    setEtapa(0);
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
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgresso(100);
    setEtapa(etapas.length - 1);
    setTimeout(() => {
      setProgresso(0);
      setEtapa(0);
    }, 600);
  };
  const [data, setData] = useState<Resultado | null>(null);
  const [consultorId, setConsultorId] = useState<string>('');
  const [percentual, setPercentual] = useState<number>(1);
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: usuarios = [] } = useUsuarios(true);

  const consultorSelecionado = usuarios.find((u) => u.id === consultorId) || null;
  const valorConsultor = data ? (data.comissao_total * (percentual || 0)) / 100 : 0;

  const { data: salvas = [] } = useQuery({
    queryKey: ['monetizze-consultas-salvas', consultorId],
    queryFn: async () => {
      let q = supabase.from('monetizze_consultas_salvas' as any).select('*').order('created_at', { ascending: false }).limit(50);
      if (consultorId) q = q.eq('consultor_id', consultorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('monetizze_consultas_salvas' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Registro excluído' });
      queryClient.invalidateQueries({ queryKey: ['monetizze-consultas-salvas'] });
    },
  });

  const consultar = async () => {
    if (!mes) {
      toast({ title: 'Informe o mês', variant: 'destructive' });
      return;
    }
    setLoading(true);
    iniciarProgresso();
    try {
      const { data: resp, error } = await supabase.functions.invoke('monetizze-consultar-vendas', {
        body: {
          mes,
          produto_nome: produtoNome.trim() || undefined,
          produto_codigo: produtoCodigo.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      setData(resp as Resultado);
      toast({
        title: 'Consulta concluída',
        description: `${(resp as Resultado).quantidade_vendida} venda(s) no período.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro na consulta Monetizze',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      finalizarProgresso();
      setLoading(false);
    }
  };

  const salvar = async () => {
    if (!data) return;
    if (!consultorSelecionado) {
      toast({ title: 'Selecione um consultor antes de salvar', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        consultor_id: consultorSelecionado.id,
        consultor_nome: consultorSelecionado.nome,
        mes: data.mes,
        filtro_produto_nome: produtoNome.trim() || null,
        filtro_produto_codigo: produtoCodigo.trim() || null,
        quantidade_vendida: data.quantidade_vendida,
        faturamento_total: data.faturamento_total,
        comissao_total: data.comissao_total,
        percentual,
        valor_consultor: valorConsultor,
        por_produto: data.por_produto,
        observacao: observacao.trim() || null,
      };
      const { error } = await supabase.from('monetizze_consultas_salvas' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Consulta salva', description: `Vinculada a ${consultorSelecionado.nome}.` });
      queryClient.invalidateQueries({ queryKey: ['monetizze-consultas-salvas'] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const exportarPdf = (origem?: any) => {
    const d = origem || (data && {
      mes: data.mes,
      quantidade_vendida: data.quantidade_vendida,
      faturamento_total: data.faturamento_total,
      comissao_total: data.comissao_total,
      por_produto: data.por_produto,
      percentual,
      valor_consultor: valorConsultor,
      consultor_nome: consultorSelecionado?.nome || '—',
      filtro_produto_nome: produtoNome || null,
      filtro_produto_codigo: produtoCodigo || null,
      observacao: observacao || null,
    });
    if (!d) return;

    const doc = new jsPDF();
    const margemX = 14;
    let y = 18;
    doc.setFontSize(16);
    doc.text('Relatório de Comissão Monetizze', margemX, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margemX, y);
    y += 8;
    doc.setTextColor(0);
    doc.setFontSize(11);

    const linhas: [string, string][] = [
      ['Consultor', d.consultor_nome || '—'],
      ['Mês de referência', d.mes],
      ['Filtro produto (nome)', d.filtro_produto_nome || '—'],
      ['Filtro produto (código)', d.filtro_produto_codigo || '—'],
      ['Quantidade vendida', String(d.quantidade_vendida)],
      ['Faturamento total', fmtBRL(Number(d.faturamento_total))],
      ['Comissão real Monetizze', fmtBRL(Number(d.comissao_total))],
      ['Percentual do consultor', `${Number(d.percentual).toLocaleString('pt-BR')}%`],
      ['Valor a receber', fmtBRL(Number(d.valor_consultor))],
    ];
    if (d.observacao) linhas.push(['Observação', String(d.observacao)]);

    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: linhas,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10 },
    });

    const porProduto = Array.isArray(d.por_produto) ? d.por_produto : [];
    if (porProduto.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Produto', 'Qtd', 'Faturamento', 'Comissão']],
        body: porProduto.map((p: any) => [
          p.nome,
          String(p.quantidade),
          fmtBRL(Number(p.faturamento)),
          fmtBRL(Number(p.comissao)),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });
    }

    const nome = (d.consultor_nome || 'consultor').replace(/\s+/g, '_').toLowerCase();
    doc.save(`comissao_${nome}_${d.mes}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Faturamento real Monetizze
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Consulta a API da Monetizze para apurar vendas finalizadas, quantidade e comissão real do mês selecionado. Filtre por nome de produto (parcial) ou pelo código exato.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Nome do produto (contém)</Label>
            <Input
              placeholder="ex.: Whey, Creatina..."
              value={produtoNome}
              onChange={(e) => setProdutoNome(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Código do produto (opcional)</Label>
            <Input
              placeholder="ex.: 12345"
              value={produtoCodigo}
              onChange={(e) => setProdutoCodigo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={consultar} disabled={loading}>
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consultando...</>
              : <><Search className="h-4 w-4 mr-2" />Consultar Monetizze</>}
          </Button>
        </div>

        {loading && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-semibold">Consultando Monetizze…</span>
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
                    <li
                      key={e.label}
                      className={`flex items-center gap-2 text-xs transition-colors ${
                        concluido ? 'text-emerald-600' : ativo ? 'text-primary font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {concluido ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : ativo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icone className="h-4 w-4 opacity-60" />
                      )}
                      <span>{e.label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                A consulta pode levar até 30 segundos quando o mês tem muitas transações. Não feche esta página.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Comissão de consultor sobre a comissão real
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Consultor</Label>
                    <Select value={consultorId} onValueChange={setConsultorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um consultor" />
                      </SelectTrigger>
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
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={percentual}
                      onChange={(e) => setPercentual(parseFloat(e.target.value) || 0)}
                    />
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
                  <Input
                    placeholder="ex.: fechamento de novembro"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={salvar} disabled={saving || !consultorSelecionado} size="sm">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar vinculado ao consultor
                  </Button>
                  <Button onClick={() => exportarPdf()} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cálculo: <strong>{percentual}%</strong> de {fmtBRL(data.comissao_total)} (comissão real do período){consultorSelecionado ? <> · vinculado a <strong>{consultorSelecionado.nome}</strong></> : ''}.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Quantidade vendida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.quantidade_vendida}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.total_retornado_api} retornadas pela API
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{fmtBRL(data.faturamento_total)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Comissão real
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtBRL(data.comissao_total)}</div>
                </CardContent>
              </Card>
            </div>

            {data.por_produto.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Por produto</div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.por_produto.map((p) => (
                        <TableRow key={p.nome}>
                          <TableCell className="max-w-[420px] truncate" title={p.nome}>{p.nome}</TableCell>
                          <TableCell className="text-right">{p.quantidade}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.faturamento)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(p.comissao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Vendas detalhadas ocultadas — exibimos apenas resumo financeiro e por produto. */}
          </div>
        )}

        {salvas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Consultas salvas{consultorId ? ' deste consultor' : ' (todos os consultores)'}
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
                      <TableHead>Filtro</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
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
                        <TableCell className="text-xs">{s.filtro_produto_nome || s.filtro_produto_codigo || '—'}</TableCell>
                        <TableCell className="text-right">{fmtBRL(Number(s.comissao_total))}</TableCell>
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

export default MonetizzeConsultaCard;