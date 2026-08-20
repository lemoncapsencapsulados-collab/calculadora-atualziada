import { Pencil, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatBRL, labelCanal } from '@/lib/anuncios';
import type { RegistroTabela } from '@/hooks/useAnunciosDados';
import type { AdInvestment } from '@/hooks/useAdInvestments';

interface Props {
  linhas: RegistroTabela[];
  onEditar: (r: AdInvestment) => void;
  onExcluir: (r: AdInvestment) => void;
}

export default function RegistrosTabela({ linhas, onEditar, onExcluir }: Props) {
  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro de investimento no período e filtros atuais.</p>;
  }
  const totalInvest = linhas.reduce((s, l) => s + l.invest, 0);
  const totalLeads = linhas.reduce((s, l) => s + l.leads, 0);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead className="text-right">Investimento</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">CPL</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-sm whitespace-nowrap">{l.dataLabel}</TableCell>
              <TableCell>
                <Badge variant="outline">{l.canal === 'meta_api' ? 'Meta Ads (API)' : labelCanal(l.canal)}</Badge>
              </TableCell>
              <TableCell className="text-sm">{l.campanha}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(l.invest)}</TableCell>
              <TableCell className="text-right tabular-nums">{l.leads}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(l.cpl)}</TableCell>
              <TableCell>
                {l.origem === 'meta' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" /> sync
                  </span>
                ) : (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => l.registro && onEditar(l.registro)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => l.registro && onExcluir(l.registro)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold">
            <TableCell colSpan={3}>TOTAL</TableCell>
            <TableCell className="text-right tabular-nums">{formatBRL(totalInvest)}</TableCell>
            <TableCell className="text-right tabular-nums">{totalLeads}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBRL(totalLeads > 0 ? totalInvest / totalLeads : 0)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
