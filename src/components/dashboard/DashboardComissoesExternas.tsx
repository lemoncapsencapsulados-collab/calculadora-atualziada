import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShoppingBag, Users } from 'lucide-react';
import type { DashboardFiltros } from '@/types/dashboard';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type Consulta = {
  consultor_nome: string;
  mes: string;
  quantidade_vendida: number;
  faturamento_total: number;
  comissao_total: number;
  valor_consultor: number;
};

export function DashboardComissoesExternas({ filtros }: { filtros: DashboardFiltros }) {
  const mesRef = useMemo(() => format(filtros.dataInicio, 'yyyy-MM'), [filtros.dataInicio]);
  const consultorFiltro = filtros.consultor;

  const [monetizze, setMonetizze] = useState<Consulta[]>([]);
  const [braip, setBraip] = useState<Consulta[]>([]);

  const carregar = async () => {
    const cols = 'consultor_nome, mes, quantidade_vendida, faturamento_total, comissao_total, valor_consultor';
    const [m, b] = await Promise.all([
      supabase.from('monetizze_consultas_salvas').select(cols).eq('mes', mesRef),
      supabase.from('braip_consultas_salvas').select(cols).eq('mes', mesRef),
    ]);
    setMonetizze((m.data as Consulta[]) || []);
    setBraip((b.data as Consulta[]) || []);
  };

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel(`dash-comissoes-externas-${mesRef}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monetizze_consultas_salvas' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'braip_consultas_salvas' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef]);

  const filtraConsultor = (arr: Consulta[]) =>
    consultorFiltro ? arr.filter((c) => c.consultor_nome === consultorFiltro) : arr;

  const mList = filtraConsultor(monetizze);
  const bList = filtraConsultor(braip);

  const sum = (arr: Consulta[], k: keyof Consulta) =>
    arr.reduce((acc, x) => acc + Number((x as any)[k] || 0), 0);

  const mFat = sum(mList, 'faturamento_total');
  const mCom = sum(mList, 'comissao_total');
  const mCons = sum(mList, 'valor_consultor');
  const mQtd = sum(mList, 'quantidade_vendida');

  const bFat = sum(bList, 'faturamento_total');
  const bCom = sum(bList, 'comissao_total');
  const bCons = sum(bList, 'valor_consultor');
  const bQtd = sum(bList, 'quantidade_vendida');

  const totalConsultor = mCons + bCons;

  const porConsultor = useMemo(() => {
    if (consultorFiltro) return [];
    const map = new Map<string, { nome: string; monetizze: number; braip: number }>();
    monetizze.forEach((c) => {
      const cur = map.get(c.consultor_nome) || { nome: c.consultor_nome, monetizze: 0, braip: 0 };
      cur.monetizze += Number(c.valor_consultor || 0);
      map.set(c.consultor_nome, cur);
    });
    braip.forEach((c) => {
      const cur = map.get(c.consultor_nome) || { nome: c.consultor_nome, monetizze: 0, braip: 0 };
      cur.braip += Number(c.valor_consultor || 0);
      map.set(c.consultor_nome, cur);
    });
    return Array.from(map.values())
      .map((x) => ({ ...x, total: x.monetizze + x.braip }))
      .sort((a, b) => b.total - a.total);
  }, [monetizze, braip, consultorFiltro]);

  const vazio = mList.length === 0 && bList.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            Comissões Externas — {mesRef}
            {consultorFiltro && <Badge variant="secondary">{consultorFiltro}</Badge>}
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total a receber (consultor)</p>
            <p className="text-lg font-bold text-emerald-600">{fmtBRL(totalConsultor)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Monetizze</p>
              <Badge variant="outline" className="gap-1"><ShoppingBag className="w-3 h-3" />{mQtd}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-muted-foreground">Faturam.</p><p className="font-semibold">{fmtBRL(mFat)}</p></div>
              <div><p className="text-muted-foreground">Comissão</p><p className="font-semibold">{fmtBRL(mCom)}</p></div>
              <div><p className="text-muted-foreground">Consultor</p><p className="font-bold text-emerald-600">{fmtBRL(mCons)}</p></div>
            </div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Braip</p>
              <Badge variant="outline" className="gap-1"><ShoppingBag className="w-3 h-3" />{bQtd}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-muted-foreground">Faturam.</p><p className="font-semibold">{fmtBRL(bFat)}</p></div>
              <div><p className="text-muted-foreground">Comissão</p><p className="font-semibold">{fmtBRL(bCom)}</p></div>
              <div><p className="text-muted-foreground">Consultor</p><p className="font-bold text-emerald-600">{fmtBRL(bCons)}</p></div>
            </div>
          </div>
        </div>

        {!consultorFiltro && porConsultor.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Users className="w-3 h-3" /> Por consultor
            </p>
            <div className="rounded-md border divide-y">
              {porConsultor.map((c) => (
                <div key={c.nome} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs items-center">
                  <span className="font-medium truncate">{c.nome}</span>
                  <span className="text-blue-700 dark:text-blue-300">{fmtBRL(c.monetizze)}</span>
                  <span className="text-orange-700 dark:text-orange-300">{fmtBRL(c.braip)}</span>
                  <span className="text-right font-bold text-emerald-600">{fmtBRL(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {vazio && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhuma consulta salva para {mesRef}{consultorFiltro ? ` (${consultorFiltro})` : ''}. Salve em Painel Administrador → Comissionamento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default DashboardComissoesExternas;