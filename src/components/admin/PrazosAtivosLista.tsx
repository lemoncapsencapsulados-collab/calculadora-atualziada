import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { usePrazosAtivos, calcDiasRestantes, type PrazoPreco } from '@/hooks/usePrazoPrecoAtivo';

const PAGE_SIZE = 5;

type Ordem = 'dias_asc' | 'dias_desc' | 'inicio_desc' | 'inicio_asc';

interface Props {
  onAbrirHistorico?: (prazo: PrazoPreco) => void;
}

export function PrazosAtivosLista({ onAbrirHistorico }: Props) {
  const { data: prazos, isLoading } = usePrazosAtivos();
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('dias_asc');
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const ativos = (prazos || []).filter((p) => calcDiasRestantes(p.data_fim) > 0);
    const termo = busca.trim().toLowerCase();
    const list = ativos.filter((p) => {
      if (!termo) return true;
      const dataIni = new Date(p.data_inicio).toLocaleDateString('pt-BR');
      const dataFim = new Date(p.data_fim).toLocaleDateString('pt-BR');
      return dataIni.includes(termo) || dataFim.includes(termo) || p.id.toLowerCase().includes(termo);
    });
    list.sort((a, b) => {
      if (ordem === 'dias_asc') return calcDiasRestantes(a.data_fim) - calcDiasRestantes(b.data_fim);
      if (ordem === 'dias_desc') return calcDiasRestantes(b.data_fim) - calcDiasRestantes(a.data_fim);
      if (ordem === 'inicio_desc') return new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
      return new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime();
    });
    return list;
  }, [prazos, busca, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const visiveis = filtrados.slice(inicio, inicio + PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="w-4 h-4 text-primary" />
          Prazos Ativos
          <Badge variant="outline" className="ml-2 text-xs">{filtrados.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por data (dd/mm/aaaa) ou id..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              className="pl-8"
            />
          </div>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="w-full md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dias_asc">Dias restantes (menor primeiro)</SelectItem>
              <SelectItem value="dias_desc">Dias restantes (maior primeiro)</SelectItem>
              <SelectItem value="inicio_desc">Data de início (mais recente)</SelectItem>
              <SelectItem value="inicio_asc">Data de início (mais antiga)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prazo ativo.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Dias restantes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((p) => {
                  const dias = calcDiasRestantes(p.data_fim);
                  const cor = dias > 10 ? 'text-emerald-700' : dias > 3 ? 'text-amber-700' : 'text-red-700';
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{new Date(p.data_inicio).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-sm">{new Date(p.data_fim).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${cor}`}>{dias}</TableCell>
                      <TableCell className="text-right">
                        {onAbrirHistorico && (
                          <Button size="sm" variant="ghost" onClick={() => onAbrirHistorico(p)}>
                            Ver snapshot
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Página {paginaAtual} de {totalPaginas}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
