/**
 * Funil como pirâmide invertida.
 *
 * Barra horizontal comum mostra o tamanho de cada etapa, mas não mostra a
 * PERDA — e a perda é o que se quer olhar. Aqui cada etapa é um trapézio cuja
 * largura no topo é a etapa anterior e na base é ela mesma: o recorte lateral
 * do trapézio É a gente que saiu. Fica impossível ver o gráfico sem ver onde o
 * funil vaza.
 *
 * SVG e não biblioteca: são seis polígonos e dois textos por etapa. Trazer um
 * pacote de gráficos para isso custaria mais em bundle do que o desenho inteiro.
 */

export interface EtapaPiramide {
  rotulo: string;
  valor: number;
  /** `false` quando a etapa depende de julgamento da IA. A tela marca isso —
   *  misturar contagem com inferência sem avisar é o pior erro possível aqui. */
  deterministica?: boolean;
}

interface Props {
  etapas: EtapaPiramide[];
  /** Rótulo do que está sendo contado, para o número não ficar solto. */
  unidade?: string;
  alturaEtapa?: number;
}

const COR_ETAPA = ['#25d366', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'];

export function FunilPiramide({ etapas, unidade = 'contatos', alturaEtapa = 62 }: Props) {
  const validas = etapas.filter((e) => Number.isFinite(e.valor));
  if (validas.length === 0) return null;

  const topo = Math.max(validas[0]?.valor ?? 0, 1);
  const LARGURA = 640;
  const MIN = 90; // nenhuma etapa some: 0 vira uma fita fina, ainda legível
  const altura = validas.length * alturaEtapa + 16;

  const larguraDe = (v: number) => MIN + (LARGURA - MIN) * Math.min(1, Math.max(0, v / topo));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${LARGURA} ${altura}`}
        className="w-full"
        style={{ minWidth: 420 }}
        role="img"
        aria-label="Funil de atendimento em pirâmide invertida"
      >
        {validas.map((e, i) => {
          const yTopo = i * alturaEtapa + 8;
          const yBase = yTopo + alturaEtapa - 10;
          const wTopo = larguraDe(i === 0 ? topo : validas[i - 1].valor);
          const wBase = larguraDe(e.valor);
          const cx = LARGURA / 2;

          const perdidos = i === 0 ? 0 : Math.max(0, validas[i - 1].valor - e.valor);
          const pctDoTopo = topo > 0 ? (e.valor / topo) * 100 : 0;
          const cor = COR_ETAPA[i % COR_ETAPA.length];

          const pontos = [
            `${cx - wTopo / 2},${yTopo}`,
            `${cx + wTopo / 2},${yTopo}`,
            `${cx + wBase / 2},${yBase}`,
            `${cx - wBase / 2},${yBase}`,
          ].join(' ');

          return (
            <g key={e.rotulo}>
              <polygon points={pontos} fill={cor} fillOpacity={0.85} />

              {/* Rótulo e número dentro do trapézio: fora dele, o olho perde a
                  associação quando as etapas ficam estreitas. */}
              <text
                x={cx}
                y={yTopo + (yBase - yTopo) / 2 - 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#fff"
              >
                {e.rotulo}
                {e.deterministica === false ? ' *' : ''}
              </text>
              <text
                x={cx}
                y={yTopo + (yBase - yTopo) / 2 + 13}
                textAnchor="middle"
                fontSize="12"
                fill="#fff"
                fillOpacity={0.9}
              >
                {e.valor.toLocaleString('pt-BR')} {unidade} · {pctDoTopo.toFixed(1)}% do topo
              </text>

              {/* A perda, do lado de fora e em vermelho. É a informação que a
                  barra horizontal não dá. */}
              {perdidos > 0 && (
                <text
                  x={LARGURA - 4}
                  y={yTopo + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#ef4444"
                  fontWeight="600"
                >
                  −{perdidos.toLocaleString('pt-BR')} (
                  {((perdidos / Math.max(validas[i - 1].valor, 1)) * 100).toFixed(1)}%)
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {validas.some((e) => e.deterministica === false) && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          * etapa inferida por IA a partir do conteúdo das conversas, não contada diretamente.
        </p>
      )}
    </div>
  );
}
