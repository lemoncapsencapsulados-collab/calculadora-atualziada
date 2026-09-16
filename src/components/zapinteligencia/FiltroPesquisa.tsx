import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Filtro do painel: monta a pesquisa inteira e só então busca.
 *
 * Antes as consultas disparavam a cada mudança — digitar uma data fazia a tela
 * buscar períodos intermediários que ninguém pediu. Agora o rascunho fica aqui
 * e só sobe para o pai quando o botão é apertado.
 *
 * A ordem dos campos segue a leitura: primeiro QUEM se analisa, depois QUANDO.
 */

export type Preset = 'mes_passado' | 'ultimos_30' | 'ultimos_90' | 'personalizado';

export interface Pesquisa {
  usuarioId: string;
  inicio: Date;
  fim: Date;
  rotulo: string;
}

interface Props {
  consultores: { usuario_id: string; consultor: string }[];
  carregando: boolean;
  onPesquisar: (p: Pesquisa) => void;
}

/**
 * Traduz o atalho em janela concreta, sempre em horário LOCAL. Data pura viraria
 * meia-noite UTC e deslocaria o recorte em três horas, cortando o começo ou o
 * fim do expediente.
 */
function janelaDoPreset(preset: Preset, de: string, ate: string): { inicio: Date; fim: Date; rotulo: string } {
  const hoje = new Date();
  if (preset === 'mes_passado') {
    const base = subMonths(hoje, 1);
    return {
      inicio: startOfMonth(base),
      fim: endOfMonth(base),
      rotulo: format(base, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }
  if (preset === 'ultimos_30') {
    return { inicio: startOfDay(subDays(hoje, 29)), fim: endOfDay(hoje), rotulo: 'últimos 30 dias' };
  }
  if (preset === 'ultimos_90') {
    return { inicio: startOfDay(subDays(hoje, 89)), fim: endOfDay(hoje), rotulo: 'últimos 90 dias' };
  }
  const a = startOfDay(parseISO(de));
  const b = endOfDay(parseISO(ate));
  // Intervalo invertido é erro de digitação, não pedido de resultado vazio.
  const [ini, fim] = a <= b ? [a, b] : [startOfDay(parseISO(ate)), endOfDay(parseISO(de))];
  return { inicio: ini, fim, rotulo: `${format(ini, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}` };
}

export default function FiltroPesquisa({ consultores, carregando, onPesquisar }: Props) {
  const [usuarioId, setUsuarioId] = useState<string>('');
  const [preset, setPreset] = useState<Preset>('mes_passado');
  const [de, setDe] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [ate, setAte] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Pré-seleciona o primeiro consultor assim que a lista chega, para o botão de
  // pesquisa já nascer utilizável.
  useEffect(() => {
    if (!usuarioId && consultores.length) setUsuarioId(consultores[0].usuario_id);
  }, [consultores, usuarioId]);

  const pesquisar = () => {
    if (!usuarioId) return;
    const { inicio, fim, rotulo } = janelaDoPreset(preset, de, ate);
    onPesquisar({ usuarioId, inicio, fim, rotulo });
  };

  const atalhos: { id: Preset; rotulo: string }[] = [
    { id: 'mes_passado', rotulo: 'Mês passado' },
    { id: 'ultimos_30', rotulo: 'Últimos 30 dias' },
    { id: 'ultimos_90', rotulo: 'Últimos 90 dias' },
    { id: 'personalizado', rotulo: 'Período personalizado' },
  ];

  return (
    <div className="surface p-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-1.5">
          <Label>Consultor</Label>
          <Select value={usuarioId} onValueChange={setUsuarioId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o consultor" />
            </SelectTrigger>
            <SelectContent>
              {consultores.map((c) => (
                <SelectItem key={c.usuario_id} value={c.usuario_id}>
                  {c.consultor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Período</Label>
          <div className="flex flex-wrap gap-2">
            {atalhos.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant={preset === a.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset(a.id)}
              >
                {a.id === 'personalizado' && <CalendarRange className="w-3.5 h-3.5 mr-1" />}
                {a.rotulo}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Os campos de data só existem quando fazem sentido: mostrá-los sempre
          sugeriria que os atalhos também dependem deles. */}
      {preset === 'personalizado' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Data inicial</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={pesquisar} disabled={carregando || !usuarioId}>
          {carregando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
          {carregando ? 'Pesquisando…' : 'Fazer pesquisa'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {preset === 'personalizado'
            ? 'Digite as datas ou use o calendário de cada campo.'
            : `Vai analisar ${janelaDoPreset(preset, de, ate).rotulo}.`}
        </span>
      </div>
    </div>
  );
}

/**
 * Tela de carregamento.
 *
 * A barra é indeterminada de propósito: a consulta é um lote de agregações no
 * banco, sem etapas contáveis. Mostrar percentual inventado seria mentir sobre
 * quanto falta — a barra sinaliza atividade, não progresso.
 *
 * Diz QUEM e QUAL período está apurando: sem isso, quem espera não sabe se a
 * tela busca o que pediu ou uma pesquisa antiga restaurada do navegador.
 *
 * O cronômetro e o aviso aos 25s existem porque esta tela já ficou girando sem
 * fim uma vez, e um spinner mudo não diz se falta um segundo ou se travou.
 */
export function TelaCarregando({
  consultor,
  periodo,
  onVoltar,
}: {
  consultor?: string | null;
  periodo?: string;
  onVoltar?: () => void;
}) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const demorado = segundos >= 25;

  return (
    <div className="surface p-10 flex flex-col items-center gap-4 text-center">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-sm font-medium tracking-wide uppercase">Em carregamento</p>
        {(consultor || periodo) && (
          <p className="text-sm">
            {consultor && <strong>{consultor}</strong>}
            {consultor && periodo && ' · '}
            {periodo}
          </p>
        )}
      </div>
      <div className="w-full max-w-sm h-1.5 rounded bg-muted overflow-hidden">
        <div className="h-full w-1/3 bg-primary rounded animate-[zapCarregando_1.2s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs text-muted-foreground">
        Apurando conversas, turnos e análises do período · {segundos}s
      </p>
      {demorado && (
        <div className="space-y-2">
          <p className="text-xs text-warning">
            Está demorando mais que o normal. O esperado é menos de 5 segundos.
          </p>
          {onVoltar && (
            <Button variant="outline" size="sm" onClick={onVoltar}>
              Voltar ao filtro
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
