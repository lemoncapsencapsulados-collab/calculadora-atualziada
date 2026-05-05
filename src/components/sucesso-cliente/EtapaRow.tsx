import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EtapaId, EtapaInfo } from '@/lib/sucessoCliente';

interface Props {
  info: EtapaInfo;
  onChangeStatus: (etapa: EtapaId, status: string) => void;
  onChangePrazo: (etapa: EtapaId, dataISO: string | undefined) => void;
  onChangeObs: (etapa: EtapaId, texto: string) => void;
  showObs?: boolean;
}

const corBadgeStatus = (concluida: boolean, atrasada: boolean) =>
  concluida
    ? 'bg-green-100 text-green-800 border-green-300'
    : atrasada
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : 'bg-yellow-100 text-yellow-800 border-yellow-300';

export default function EtapaRow({ info, onChangeStatus, onChangePrazo, onChangeObs, showObs }: Props) {
  const { etapa, status, statusLabel, concluida, prazoPrevisto, diasRestantes, atrasada, dataConclusao, observacao, contratada } = info;

  if (!contratada) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-muted/30 opacity-60">
        <span className="text-sm font-medium">{etapa.label}</span>
        <Badge variant="outline" className="text-xs">Não contratado</Badge>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col gap-2 py-2 px-2 rounded-md border',
      atrasada ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{etapa.label}</span>
          <Badge variant="outline" className="text-[10px]">
            <User className="w-3 h-3 mr-1" />{etapa.responsavel}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-[10px]', corBadgeStatus(concluida, atrasada))}>
            {concluida ? <CheckCircle2 className="w-3 h-3 mr-0.5" /> : atrasada ? <AlertTriangle className="w-3 h-3 mr-0.5" /> : null}
            {statusLabel}
          </Badge>
          <Select value={status} onValueChange={(v) => onChangeStatus(etapa.id, v)}>
            <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {etapa.options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {concluida && dataConclusao ? (
          <span className="text-green-700">Concluído em {format(dataConclusao, 'dd/MM/yyyy', { locale: ptBR })}</span>
        ) : prazoPrevisto ? (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  Prazo: {format(prazoPrevisto, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={prazoPrevisto}
                  onSelect={(d) => onChangePrazo(etapa.id, d?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className={cn(
              atrasada ? 'text-destructive font-semibold' :
              diasRestantes != null && diasRestantes <= 3 ? 'text-yellow-600' : '',
            )}>
              {atrasada
                ? `${Math.abs(diasRestantes!)}d atrasado`
                : `${diasRestantes}d restantes`}
            </span>
          </>
        ) : null}
        <span className="text-[10px] italic ml-auto">{etapa.responsavelNota}</span>
      </div>

      {showObs && (
        <Textarea
          value={observacao || ''}
          onChange={(e) => onChangeObs(etapa.id, e.target.value)}
          placeholder="Observações da etapa (ex: aguardando feedback do cliente, gráfica X)..."
          className="min-h-[50px] text-xs"
        />
      )}
    </div>
  );
}