import { useState } from 'react';
import { Loader2, Search, ShoppingBag, TrendingUp, Percent, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUsuarios } from '@/hooks/useUsuarios';

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
  const [mes, setMes] = useState(mesAtual());
  const [produtoNome, setProdutoNome] = useState('');
  const [produtoCodigo, setProdutoCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Resultado | null>(null);
  const [consultorId, setConsultorId] = useState<string>('');
  const [percentual, setPercentual] = useState<number>(1);
  const { data: usuarios = [] } = useUsuarios(true);

  const consultorSelecionado = usuarios.find((u) => u.id === consultorId) || null;
  const valorConsultor = data ? (data.comissao_total * (percentual || 0)) / 100 : 0;

  const consultar = async () => {
    if (!mes) {
      toast({ title: 'Informe o mês', variant: 'destructive' });
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
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

            {data.itens.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Vendas detalhadas</div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.itens.map((it, i) => (
                        <TableRow key={`${it.codigo}-${i}`}>
                          <TableCell className="font-mono text-xs">{it.codigo}</TableCell>
                          <TableCell className="max-w-[260px] truncate" title={it.produto}>{it.produto}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={it.cliente}>{it.cliente}</TableCell>
                          <TableCell className="text-xs">{it.data_finalizacao || '—'}</TableCell>
                          <TableCell className="text-right">{fmtBRL(it.valor)}</TableCell>
                          <TableCell className="text-right">{fmtBRL(it.comissao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MonetizzeConsultaCard;