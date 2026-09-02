import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Funil de atendimento como pirâmide invertida.
 *
 * A DECISÃO DE DESENHO: num funil comum, quem fica é desenhado e quem sai é o
 * espaço vazio ao redor. Aqui é o contrário — a perda ganha forma própria. Cada
 * etapa ocupa um retângulo da largura da etapa anterior, e esse retângulo se
 * divide em duas partes: o trapézio central, que são os que seguiram, e duas
 * cunhas laterais em vermelho, que são os que ficaram pelo caminho.
 *
 * O motivo é prático, não estético: esta tela existe para achar vazamento. Se a
 * perda for espaço negativo, ela não tem rótulo, não tem número e o olho passa
 * por cima. Tendo forma, ela compete por atenção com o que sobrou — que é
 * exatamente a hierarquia certa para quem precisa agir.
 *
 * A paleta caminha do citrus da marca (topo, abundância) ao teal profundo
 * (base, o que resistiu). Números em IBM Plex Mono, que é a face de dado do
 * projeto; rótulos em Instrument Sans.
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

/** Citrus -> teal, em HSL, para o degradê acompanhar o afunilamento. */
function corDaEtapa(i: number, total: number): { de: string; para: string } {
  const t = total <= 1 ? 0 : i / (total - 1);
  const h = 70 + (187 - 70) * t;
  const s = 78 - 20 * t;
  const l = 47 - 12 * t;
  return {
    de: `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${(l + 8).toFixed(0)}%)`,
    para: `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`,
  };
}

const L = 760;
const ALT = 86;
const MIN = 132;

export function FunilPiramide({ etapas, unidade = 'contatos' }: Props) {
  const validas = useMemo(() => etapas.filter((e) => Number.isFinite(e.valor)), [etapas]);
  const [revelado, setRevelado] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  // Revela quando entra na tela, não no mount: a seção fica abaixo da dobra, e
  // animar fora da vista gasta o efeito com ninguém olhando.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevelado(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && setRevelado(true),
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (validas.length === 0) return null;

  const topo = Math.max(validas[0].valor, 1);
  const altura = validas.length * ALT + 24;
  const cx = L / 2;
  const largura = (v: number) => MIN + (L - 40 - MIN) * Math.min(1, Math.max(0, v / topo));
  const fim = validas[validas.length - 1];
  const conversao = topo > 0 ? (fim.valor / topo) * 100 : 0;

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <svg
          ref={ref}
          viewBox={`0 0 ${L} ${altura}`}
          className="w-full"
          style={{ minWidth: 480 }}
          role="img"
          aria-label={`Funil de atendimento: ${validas
            .map((e) => `${e.rotulo} ${e.valor}`)
            .join(', ')}`}
        >
          <defs>
            {validas.map((_, i) => {
              const c = corDaEtapa(i, validas.length);
              return (
                <linearGradient key={i} id={`funil-g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.de} />
                  <stop offset="100%" stopColor={c.para} />
                </linearGradient>
              );
            })}
            <linearGradient id="funil-perda" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(4 66% 52%)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="hsl(4 66% 52%)" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {validas.map((e, i) => {
            const yT = i * ALT + 12;
            const yB = yT + ALT - 14;
            const wT = largura(i === 0 ? topo : validas[i - 1].valor);
            const wB = largura(e.valor);
            const anterior = i === 0 ? e.valor : validas[i - 1].valor;
            const perdidos = Math.max(0, anterior - e.valor);
            const pctPerda = anterior > 0 ? (perdidos / anterior) * 100 : 0;
            const pctTopo = (e.valor / topo) * 100;

            const corpo = [
              `${cx - wT / 2},${yT}`,
              `${cx + wT / 2},${yT}`,
              `${cx + wB / 2},${yB}`,
              `${cx - wB / 2},${yB}`,
            ].join(' ');

            // As cunhas: o que o trapézio deixou de fora dentro do retângulo da
            // etapa anterior. É a gente que saiu, com forma e número.
            const cunhaEsq = [
              `${cx - wT / 2},${yT}`,
              `${cx - wB / 2},${yB}`,
              `${cx - wT / 2},${yB}`,
            ].join(' ');
            const cunhaDir = [
              `${cx + wT / 2},${yT}`,
              `${cx + wB / 2},${yB}`,
              `${cx + wT / 2},${yB}`,
            ].join(' ');

            const atraso = `${i * 90}ms`;

            return (
              <g
                key={e.rotulo}
                style={{
                  opacity: revelado ? 1 : 0,
                  transform: revelado ? 'none' : 'translateY(-10px)',
                  transition: `opacity 520ms cubic-bezier(.16,1,.3,1) ${atraso}, transform 520ms cubic-bezier(.16,1,.3,1) ${atraso}`,
                }}
              >
                {perdidos > 0 && (
                  <>
                    <polygon points={cunhaEsq} fill="url(#funil-perda)" />
                    <polygon points={cunhaDir} fill="url(#funil-perda)" />
                    <text
                      x={cx - wT / 2 + 6}
                      y={yB - 6}
                      fontSize="11.5"
                      fontFamily="'IBM Plex Mono', monospace"
                      fontWeight="500"
                      fill="hsl(4 72% 62%)"
                    >
                      −{perdidos.toLocaleString('pt-BR')}
                    </text>
                    <text
                      x={cx + wT / 2 - 6}
                      y={yB - 6}
                      textAnchor="end"
                      fontSize="11.5"
                      fontFamily="'IBM Plex Mono', monospace"
                      fill="hsl(4 72% 62%)"
                      fillOpacity="0.75"
                    >
                      {pctPerda.toFixed(0)}% saíram
                    </text>
                  </>
                )}

                <polygon points={corpo} fill={`url(#funil-g${i})`} />

                {/* Aresta superior clara: dá espessura ao volume sem sombra, que
                    em fundo escuro vira borrão. */}
                <line
                  x1={cx - wT / 2}
                  y1={yT}
                  x2={cx + wT / 2}
                  y2={yT}
                  stroke="#fff"
                  strokeOpacity="0.22"
                  strokeWidth="1"
                />

                <text
                  x={cx}
                  y={yT + 30}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  letterSpacing="0.02em"
                  fill="#0b1220"
                  fillOpacity="0.88"
                >
                  {e.rotulo}
                  {e.deterministica === false ? ' ✳' : ''}
                </text>
                <text
                  x={cx}
                  y={yT + 54}
                  textAnchor="middle"
                  fontSize="21"
                  fontWeight="600"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="#0b1220"
                >
                  {e.valor.toLocaleString('pt-BR')}
                  <tspan fontSize="11" fontWeight="400" fillOpacity="0.7">
                    {'  '}
                    {pctTopo.toFixed(1)}%
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* O número que o funil inteiro existe para produzir. Fora do desenho
          porque é conclusão, não etapa. */}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          De <span className="num text-foreground">{topo.toLocaleString('pt-BR')}</span> {unidade} no
          topo, <span className="num text-foreground">{fim.valor.toLocaleString('pt-BR')}</span>{' '}
          chegaram a {fim.rotulo.toLowerCase()}.
        </span>
        <span className="text-xs text-muted-foreground">
          Conversão ponta a ponta{' '}
          <span className="num font-semibold text-foreground">{conversao.toFixed(1)}%</span>
        </span>
      </div>

      {validas.some((e) => e.deterministica === false) && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
          ✳ etapa inferida por IA a partir do conteúdo das conversas, não contada diretamente.
        </p>
      )}
    </div>
  );
}
