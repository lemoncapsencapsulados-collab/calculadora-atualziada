import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CelulaHeatmap, FaixaResposta, ObjecaoRanking, PontoSerie } from '@/hooks/useZapInteligencia';
import { formatarDuracao } from '@/hooks/useZapInteligencia';

/**
 * Gráficos do painel individual.
 *
 * Ficam num arquivo próprio para a página não virar um bloco ilegível — ela já
 * carrega filtros, disparo de análise, funil, parecer e exportação.
 */

const EIXO = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const TOOLTIP = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
};

/**
 * Distribuição das respostas por faixa de tempo.
 *
 * As três primeiras faixas (até 30 min) são verdes e as três últimas vermelhas:
 * a cor carrega o julgamento que o número sozinho não carrega — 4,8% parece
 * pouco até se perceber que são 68 clientes esperando mais de meio dia.
 */
export function GraficoDistribuicao({ dados }: { dados: FaixaResposta[] }) {
  if (!dados.length) return <SemDados />;
  const cor = (ordem: number) => (ordem <= 3 ? 'hsl(var(--success))' : 'hsl(var(--destructive))');

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="faixa" tick={EIXO} interval={0} angle={-18} textAnchor="end" height={54} />
        <YAxis tick={EIXO} />
        <Tooltip
          {...TOOLTIP}
          formatter={(v: number, _n, p: any) => [`${v} respostas (${p.payload.pct}%)`, '']}
        />
        <Bar dataKey="respostas" radius={[4, 4, 0, 0]}>
          {dados.map((d) => (
            <Cell key={d.ordem} fill={cor(d.ordem)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Heatmap hora × dia da semana, em horário de Brasília.
 *
 * Feito com grid CSS e não com recharts: a biblioteca não tem heatmap nativo, e
 * uma matriz 7×24 de divs é mais simples e mais leve que forçar um ScatterChart
 * a parecer um mapa de calor.
 */
export function Heatmap({ dados }: { dados: CelulaHeatmap[] }) {
  if (!dados.length) return <SemDados />;

  const mapa = new Map(dados.map((d) => [`${d.dia_semana}-${d.hora}`, d.mensagens]));
  const max = Math.max(...dados.map((d) => d.mensagens));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[34px_repeat(24,1fr)] gap-[2px]">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-muted-foreground text-center">
              {/* Só as horas pares, senão os rótulos se sobrepõem. */}
              {h % 2 === 0 ? h : ''}
            </div>
          ))}

          {DIAS.map((nome, dia) => (
            <FileiraHeatmap key={dia} nome={nome} dia={dia} mapa={mapa} max={max} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Mensagens por hora, horário de Brasília. Quanto mais claro, mais movimento.
        </p>
      </div>
    </div>
  );
}

function FileiraHeatmap({
  nome,
  dia,
  mapa,
  max,
}: {
  nome: string;
  dia: number;
  mapa: Map<string, number>;
  max: number;
}) {
  return (
    <>
      <div className="text-[10px] text-muted-foreground flex items-center">{nome}</div>
      {Array.from({ length: 24 }, (_, h) => {
        const n = mapa.get(`${dia}-${h}`) ?? 0;
        // Raiz quadrada em vez de escala linear: sem isso, um pico de meio-dia
        // apaga visualmente todo o resto do expediente.
        const intensidade = max > 0 ? Math.sqrt(n / max) : 0;
        return (
          <div
            key={h}
            title={`${nome} ${h}h — ${n} mensagens`}
            className="aspect-square rounded-[2px]"
            style={{
              background:
                n === 0 ? 'hsl(var(--muted))' : `hsl(var(--primary) / ${0.12 + intensidade * 0.88})`,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Ranking de objeções, com a fatia contornada destacada.
 *
 * Mostra total e superadas na mesma barra porque a pergunta que importa não é
 * "qual objeção mais aparece", e sim "qual delas trava a venda".
 */
export function GraficoObjecoes({ dados }: { dados: ObjecaoRanking[] }) {
  if (!dados.length) return <SemDados texto="Nenhuma objeção registrada nas conversas analisadas." />;

  return (
    <div className="space-y-2">
      {dados.slice(0, 10).map((o) => {
        const max = dados[0].total || 1;
        const pctBarra = (o.total / max) * 100;
        const pctSuperada = o.total > 0 ? (o.superadas / o.total) * 100 : 0;
        return (
          <div key={o.categoria} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="capitalize">{o.categoria}</span>
              <span className="text-muted-foreground">
                {o.total} em {o.conversas} conversas ·{' '}
                <strong className={o.superadas === 0 ? 'text-destructive' : 'text-success'}>
                  {o.superadas} contornadas
                </strong>
              </span>
            </div>
            <div className="h-2.5 rounded bg-muted overflow-hidden" style={{ width: `${pctBarra}%` }}>
              <div className="h-full bg-success" style={{ width: `${pctSuperada}%` }} />
              <div className="h-full bg-primary/60 -mt-2.5" style={{ width: '100%', zIndex: -1 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Evolução diária, separando contato NOVO de RECORRENTE.
 *
 * A versão anterior juntava os dois numa linha só e escondia a pergunta que
 * importa: o consultor é lento com quem chega agora, ou com quem já está na
 * carteira? São problemas diferentes — atendimento de lead novo contra
 * follow-up abandonado — e exigem correções diferentes.
 *
 * Quatro séries em dois eixos: volume à esquerda, tempo de resposta à direita.
 * As linhas de tempo são tracejadas para não competirem visualmente com o
 * volume, que é a leitura primária.
 */
export function GraficoSerie({ dados }: { dados: PontoSerie[] }) {
  if (dados.length < 2) return <SemDados texto="Período curto demais para mostrar evolução." />;

  const pontos = dados.map((d) => ({
    dia: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7),
    novos: Number(d.contatos_novos ?? 0),
    recorrentes: Number(d.contatos_recorrentes ?? 0),
    // Em minutos: em segundos o eixo vira uma parede de números.
    tmr1Novo: d.tmr1_novos_seg == null ? null : Number(d.tmr1_novos_seg) / 60,
    tmr1Recorrente: d.tmr1_recorrentes_seg == null ? null : Number(d.tmr1_recorrentes_seg) / 60,
  }));

  const NOMES: Record<string, string> = {
    novos: 'contatos novos',
    recorrentes: 'contatos recorrentes',
    tmr1Novo: 'resposta a contato novo',
    tmr1Recorrente: 'resposta a recorrente',
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={pontos} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="dia" tick={EIXO} interval="preserveStartEnd" />
        <YAxis yAxisId="l" tick={EIXO} />
        <YAxis yAxisId="r" orientation="right" tick={EIXO} />
        <Tooltip
          {...TOOLTIP}
          formatter={(v: number, nome: string) =>
            nome.startsWith('tmr1')
              ? [v == null ? '—' : formatarDuracao(v * 60), NOMES[nome] ?? nome]
              : [v, NOMES[nome] ?? nome]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => NOMES[v] ?? v} />
        <Line yAxisId="l" type="monotone" dataKey="novos" stroke="hsl(var(--primary))" strokeWidth={2.4} dot={false} />
        <Line yAxisId="l" type="monotone" dataKey="recorrentes" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
        <Line yAxisId="r" type="monotone" dataKey="tmr1Novo" stroke="hsl(var(--success))" strokeWidth={1.6} strokeDasharray="4 3" dot={false} connectNulls />
        <Line yAxisId="r" type="monotone" dataKey="tmr1Recorrente" stroke="hsl(var(--destructive))" strokeWidth={1.6} strokeDasharray="4 3" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SemDados({ texto = 'Sem dados no período.' }: { texto?: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{texto}</p>;
}
