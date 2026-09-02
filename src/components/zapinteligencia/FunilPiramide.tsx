import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Funil de atendimento como pirâmide invertida.
 *
 * A DECISÃO CENTRAL: num funil comum, quem fica é desenhado e quem sai é o
 * espaço vazio ao redor. Aqui a perda ganha forma. Cada etapa ocupa o retângulo
 * da etapa anterior, dividido entre o trapézio central — os que seguiram — e
 * duas cunhas laterais, que são os que ficaram pelo caminho. A tela existe para
 * achar vazamento: perda como espaço negativo não tem rótulo, não tem número, e
 * o olho passa por cima.
 *
 * MATIZ ÚNICA, DE PROPÓSITO. A versão anterior usava um degradê de lima a teal,
 * e isso mentia sobre o dado: cinco matizes sugerem cinco categorias, quando as
 * etapas são uma sequência só. Aqui a matiz é uma e o que varia é a
 * luminosidade — a mesma coisa, aprofundando. O citrus da marca aparece uma vez
 * só, contornando a etapa final, que é o resultado.
 *
 * ABAIXO DE 640px o desenho dá lugar à lista. Não é degradação: SVG com texto
 * dentro não reflui, e um funil ilegível é pior que uma tabela legível. A lista
 * também é o caminho de leitura para quem usa leitor de tela.
 */

export interface EtapaPiramide {
  rotulo: string;
  valor: number;
  /** `false` quando a etapa depende de julgamento da IA. A marcação é
   *  obrigatória: misturar contagem com inferência sem avisar é o pior erro
   *  possível numa tela de decisão. */
  deterministica?: boolean;
}

interface Props {
  etapas: EtapaPiramide[];
  unidade?: string;
}

interface Passo extends EtapaPiramide {
  perdidos: number;
  pctPerda: number;
  pctTopo: number;
  maiorPerda: boolean;
}

const L = 720;
const ALT = 84;
const MIN = 150;
const PAD = 16;

/** Teal da marca, só a luminosidade caindo. Escura o bastante para texto branco
 *  passar em contraste AA em todas as etapas — o que permite um único
 *  tratamento de texto, em vez de inverter a cor no meio do gráfico. */
function tonalidade(i: number, total: number): [string, string] {
  const t = total <= 1 ? 0 : i / (total - 1);
  const l = 38 - 15 * t;
  const sat = 52 - 8 * t;
  return [`hsl(187 ${sat}% ${l + 6}%)`, `hsl(187 ${sat}% ${l}%)`];
}

function useTelaEstreita(): boolean {
  const [estreito, setEstreito] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const aplicar = () => setEstreito(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);
  return estreito;
}

export function FunilPiramide({ etapas, unidade = 'contatos' }: Props) {
  const estreito = useTelaEstreita();
  const [revelado, setRevelado] = useState(false);
  const alvo = useRef<HTMLDivElement>(null);

  const passos: Passo[] = useMemo(() => {
    const validas = etapas.filter((e) => Number.isFinite(e.valor));
    const brutos = validas.map((e, i) => {
      const anterior = i === 0 ? e.valor : validas[i - 1].valor;
      const perdidos = Math.max(0, anterior - e.valor);
      return {
        ...e,
        perdidos,
        pctPerda: anterior > 0 ? (perdidos / anterior) * 100 : 0,
        pctTopo: validas[0]?.valor ? (e.valor / validas[0].valor) * 100 : 0,
        maiorPerda: false,
      };
    });
    // O maior vazamento é o que a tela precisa entregar primeiro. Marcá-lo é
    // recomendação de leitura de funil, não enfeite.
    const pior = brutos.reduce((a, b) => (b.perdidos > a.perdidos ? b : a), brutos[0]);
    if (pior && pior.perdidos > 0) pior.maiorPerda = true;
    return brutos;
  }, [etapas]);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevelado(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setRevelado(true), {
      threshold: 0.2,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (passos.length === 0) return null;

  const topo = Math.max(passos[0].valor, 1);
  const fim = passos[passos.length - 1];
  const conversao = (fim.valor / topo) * 100;
  const cx = L / 2;
  const largura = (v: number) =>
    MIN + (L - PAD * 2 - MIN) * Math.min(1, Math.max(0, v / topo));

  const rodape = (
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        <span className="num text-foreground">{topo.toLocaleString('pt-BR')}</span> {unidade} no
        topo, <span className="num text-foreground">{fim.valor.toLocaleString('pt-BR')}</span>{' '}
        chegaram ao fim
      </p>
      <p className="text-xs text-muted-foreground">
        Conversão ponta a ponta{' '}
        <span className="num font-semibold text-foreground">{conversao.toFixed(1)}%</span>
      </p>
    </div>
  );

  const nota = passos.some((e) => e.deterministica === false) && (
    <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">
      Etapas marcadas com <span className="text-foreground">IA</span> são inferidas do conteúdo das
      conversas, não contadas diretamente.
    </p>
  );

  // ---------------------------------------------------------------------------
  // Lista: telas estreitas e leitores de tela.
  // ---------------------------------------------------------------------------
  if (estreito) {
    return (
      <div ref={alvo}>
        <ol className="space-y-2">
          {passos.map((e, i) => {
            const [, cor] = tonalidade(i, passos.length);
            return (
              <li key={e.rotulo} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: cor }}
                    />
                    {e.rotulo}
                    {e.deterministica === false && (
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        IA
                      </span>
                    )}
                  </span>
                  <span className="num shrink-0 text-base font-semibold">
                    {e.valor.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {e.pctTopo.toFixed(1)}% do topo
                  </span>
                  {e.perdidos > 0 && (
                    <span className={e.maiorPerda ? 'font-medium text-destructive' : 'text-destructive/75'}>
                      −{e.perdidos.toLocaleString('pt-BR')} ({e.pctPerda.toFixed(0)}%)
                      {e.maiorPerda ? ' · maior perda' : ''}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {rodape}
        {nota}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Desenho.
  // ---------------------------------------------------------------------------
  const altura = passos.length * ALT + 16;

  return (
    <div ref={alvo}>
      <svg
        viewBox={`0 0 ${L} ${altura}`}
        className="w-full"
        role="img"
        aria-label={`Funil: ${passos.map((e) => `${e.rotulo}, ${e.valor}`).join('; ')}`}
      >
        <defs>
          {passos.map((_, i) => {
            const [de, para] = tonalidade(i, passos.length);
            return (
              <linearGradient key={i} id={`fn-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={de} />
                <stop offset="100%" stopColor={para} />
              </linearGradient>
            );
          })}
        </defs>

        {passos.map((e, i) => {
          const yT = i * ALT + 10;
          const yB = yT + ALT - 16;
          const wT = largura(i === 0 ? topo : passos[i - 1].valor);
          const wB = largura(e.valor);
          const ultimo = i === passos.length - 1;
          const atraso = `${i * 80}ms`;

          const corpo = `${cx - wT / 2},${yT} ${cx + wT / 2},${yT} ${cx + wB / 2},${yB} ${cx - wB / 2},${yB}`;
          const cunhaE = `${cx - wT / 2},${yT} ${cx - wB / 2},${yB} ${cx - wT / 2},${yB}`;
          const cunhaD = `${cx + wT / 2},${yT} ${cx + wB / 2},${yB} ${cx + wT / 2},${yB}`;

          return (
            <g
              key={e.rotulo}
              style={{
                opacity: revelado ? 1 : 0,
                transform: revelado ? 'none' : 'translateY(-8px)',
                transition: `opacity 460ms cubic-bezier(.16,1,.3,1) ${atraso}, transform 460ms cubic-bezier(.16,1,.3,1) ${atraso}`,
              }}
            >
              {/* Perda: contorno tracejado e preenchimento mínimo. Bloco
                  vermelho cheio competiria com o corpo e escureceria o cartão;
                  o contorno diz "isto saiu" sem gritar. */}
              {e.perdidos > 0 && (
                <>
                  <polygon
                    points={cunhaE}
                    fill="hsl(4 70% 55%)"
                    fillOpacity={e.maiorPerda ? 0.2 : 0.1}
                    stroke="hsl(4 70% 58%)"
                    strokeOpacity={e.maiorPerda ? 0.7 : 0.35}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <polygon
                    points={cunhaD}
                    fill="hsl(4 70% 55%)"
                    fillOpacity={e.maiorPerda ? 0.2 : 0.1}
                    stroke="hsl(4 70% 58%)"
                    strokeOpacity={e.maiorPerda ? 0.7 : 0.35}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </>
              )}

              {/* O corpo vem ANTES dos rótulos. Na versão anterior era o
                  contrário e o polígono cobria o texto da perda. */}
              <polygon
                points={corpo}
                fill={`url(#fn-${i})`}
                stroke={ultimo ? 'hsl(70 78% 47%)' : 'transparent'}
                strokeWidth={ultimo ? 1.5 : 0}
              />

              <text
                x={cx}
                y={yT + 27}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#fff"
                fillOpacity="0.95"
              >
                {e.rotulo}
              </text>
              {e.deterministica === false && (
                <text
                  x={cx}
                  y={yT + 27}
                  dx={
                    // Deslocamento aproximado pela largura do rótulo: SVG não
                    // mede texto sem layout, e uma estimativa por caractere
                    // erra menos que um valor fixo.
                    e.rotulo.length * 3.6 + 14
                  }
                  fontSize="8.5"
                  fontWeight="600"
                  letterSpacing="0.06em"
                  fill="#fff"
                  fillOpacity="0.55"
                >
                  IA
                </text>
              )}
              <text
                x={cx}
                y={yT + 50}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono', ui-monospace, monospace"
                fontSize="20"
                fontWeight="600"
                fill="#fff"
              >
                {e.valor.toLocaleString('pt-BR')}
                <tspan fontSize="11" fontWeight="400" fillOpacity="0.72" dx="8">
                  {e.pctTopo.toFixed(1)}%
                </tspan>
              </text>

              {/* Um número por fato, não dois. A contagem fica dentro da cunha
                  esquerda; o percentual, menor, logo abaixo. */}
              {e.perdidos > 0 && wT - wB > 84 && (
                <>
                  <text
                    x={cx - (wT + wB) / 4}
                    y={yB - 16}
                    textAnchor="middle"
                    fontFamily="'IBM Plex Mono', ui-monospace, monospace"
                    fontSize="12"
                    fontWeight="600"
                    fill="hsl(4 76% 66%)"
                  >
                    −{e.perdidos.toLocaleString('pt-BR')}
                  </text>
                  <text
                    x={cx - (wT + wB) / 4}
                    y={yB - 5}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="hsl(4 76% 66%)"
                    fillOpacity="0.8"
                  >
                    {e.pctPerda.toFixed(0)}% saíram
                  </text>
                </>
              )}

              {/* Quando a cunha é estreita demais para conter texto, o número
                  vai para fora, à direita — em vez de sumir ou vazar. */}
              {e.perdidos > 0 && wT - wB <= 84 && (
                <text
                  x={L - 4}
                  y={yB - 8}
                  textAnchor="end"
                  fontFamily="'IBM Plex Mono', ui-monospace, monospace"
                  fontSize="11"
                  fontWeight="600"
                  fill="hsl(4 76% 66%)"
                >
                  −{e.perdidos.toLocaleString('pt-BR')} · {e.pctPerda.toFixed(0)}%
                </text>
              )}

              {e.maiorPerda && (
                <text
                  x={cx - (wT + wB) / 4}
                  y={yT + 14}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  letterSpacing="0.08em"
                  fill="hsl(4 76% 66%)"
                  fillOpacity="0.9"
                >
                  MAIOR PERDA
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {rodape}
      {nota}
    </div>
  );
}
