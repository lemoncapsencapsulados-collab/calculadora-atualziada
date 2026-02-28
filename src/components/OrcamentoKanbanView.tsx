import { Orcamento } from '@/types/orcamento';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2, FileText, FileCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLUMNS = [
  { status: 'rascunho', label: 'Rascunho', headerClass: 'bg-muted text-muted-foreground', badgeVariant: 'secondary' as const },
  { status: 'enviado', label: 'Enviado', headerClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', badgeVariant: 'default' as const },
  { status: 'aprovado', label: 'Aprovado', headerClass: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', badgeVariant: 'outline' as const },
  { status: 'recusado', label: 'Recusado', headerClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', badgeVariant: 'destructive' as const },
];

interface Props {
  orcamentos: Orcamento[];
  onEdit: (o: Orcamento) => void;
  onDelete: (id: string) => void;
  onPreview: (o: Orcamento) => void;
  onPropostaCompleta: (o: Orcamento) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrcamentoKanbanView({ orcamentos, onEdit, onDelete, onPreview, onPropostaCompleta }: Props) {
  const grouped = COLUMNS.map(col => ({
    ...col,
    items: orcamentos.filter(o => o.status === col.status),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {grouped.map(col => (
        <div key={col.status} className="flex flex-col rounded-lg border bg-card overflow-hidden">
          <div className={`px-4 py-3 font-semibold text-sm flex items-center justify-between ${col.headerClass}`}>
            <span>{col.label}</span>
            <Badge variant={col.badgeVariant} className="text-xs">{col.items.length}</Badge>
          </div>
          <ScrollArea className="flex-1 max-h-[65vh]">
            <div className="p-2 space-y-2">
              {col.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum orçamento</p>
              )}
              {col.items.map(o => (
                <Card key={o.id} className="shadow-sm">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{o.nome_cliente}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Consultor: {o.consultor_responsavel || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">{o.numero_orcamento}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                    <p className="font-bold text-sm text-primary">{formatCurrency(o.valor_total)}</p>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onEdit(o)}>
                        <Pencil className="w-3 h-3 mr-1" />Editar
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onPreview(o)}>
                        <FileText className="w-3 h-3 mr-1" />PDF
                      </Button>
                      <Button variant="default" size="sm" className="h-7 text-xs px-2" onClick={() => onPropostaCompleta(o)}>
                        <FileCheck className="w-3 h-3 mr-1" />Proposta
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={() => onDelete(o.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
