import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Users, ClipboardList, Loader2 } from 'lucide-react';

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
}

interface Props {
  itens: ItemCobranca[];
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

export function AsaasConciliacaoPedidos({ itens }: Props) {
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

  return (
    <div className="space-y-4">
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
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente (Asaas)</TableHead>
                  <TableHead>Orçamento(s)</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Bruto pago</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conciliacao.linhas.map((l, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {l.match ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Pago</Badge>
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
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      <span className="font-semibold">{l.qtdPagas}</span>
                      {l.totalParcelas ? <span className="text-muted-foreground"> / {l.totalParcelas}</span> : ''}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{fmtBRL(l.brutoPago)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap font-medium">{fmtBRL(l.liquidoPago)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AsaasConciliacaoPedidos;