import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardFiltros } from '@/types/dashboard';

interface DashboardFiltrosProps {
  filtros: DashboardFiltros;
  onFiltrosChange: (filtros: DashboardFiltros) => void;
  consultoresDisponiveis: string[];
}

export function DashboardFiltrosComponent({ 
  filtros, 
  onFiltrosChange, 
  consultoresDisponiveis 
}: DashboardFiltrosProps) {
  const handlePeriodoChange = (tipo: DashboardFiltros['periodoTipo']) => {
    const hoje = new Date();
    let dataInicio: Date;
    let dataFim: Date = endOfMonth(hoje);

    switch (tipo) {
      case 'mensal':
        dataInicio = startOfMonth(hoje);
        break;
      case 'bimestral':
        dataInicio = startOfMonth(subMonths(hoje, 1));
        break;
      case 'trimestral':
        dataInicio = startOfMonth(subMonths(hoje, 2));
        break;
      case 'semestral':
        dataInicio = startOfMonth(subMonths(hoje, 5));
        break;
      case 'customizado':
        dataInicio = filtros.dataInicio;
        dataFim = filtros.dataFim;
        break;
      default:
        dataInicio = startOfYear(hoje);
    }

    onFiltrosChange({
      ...filtros,
      periodoTipo: tipo,
      dataInicio,
      dataFim
    });
  };

  const handleConsultorChange = (consultor: string) => {
    onFiltrosChange({
      ...filtros,
      consultor: consultor === 'todos' ? null : consultor
    });
  };

  const limparFiltros = () => {
    const hoje = new Date();
    onFiltrosChange({
      consultor: null,
      periodoTipo: 'semestral',
      dataInicio: startOfMonth(subMonths(hoje, 5)),
      dataFim: endOfMonth(hoje)
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtros:
      </div>

      {/* Consultor */}
      <Select
        value={filtros.consultor || 'todos'}
        onValueChange={handleConsultorChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Consultor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os consultores</SelectItem>
          {consultoresDisponiveis.map(consultor => (
            <SelectItem key={consultor} value={consultor}>
              {consultor}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Período */}
      <Select
        value={filtros.periodoTipo}
        onValueChange={handlePeriodoChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mensal">Mensal</SelectItem>
          <SelectItem value="bimestral">Bimestral</SelectItem>
          <SelectItem value="trimestral">Trimestral</SelectItem>
          <SelectItem value="semestral">Semestral</SelectItem>
          <SelectItem value="customizado">Customizado</SelectItem>
        </SelectContent>
      </Select>

      {/* Data Início */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(filtros.dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filtros.dataInicio}
            onSelect={(date) => {
              if (date) {
                onFiltrosChange({
                  ...filtros,
                  periodoTipo: 'customizado',
                  dataInicio: date
                });
              }
            }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground">até</span>

      {/* Data Fim */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(filtros.dataFim, 'dd/MM/yyyy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filtros.dataFim}
            onSelect={(date) => {
              if (date) {
                onFiltrosChange({
                  ...filtros,
                  periodoTipo: 'customizado',
                  dataFim: date
                });
              }
            }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Limpar Filtros */}
      {(filtros.consultor || filtros.periodoTipo !== 'semestral') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={limparFiltros}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
