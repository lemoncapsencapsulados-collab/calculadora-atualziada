import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface LemoncapsLogoProps {
  className?: string;
}

/* Paths compartilhados entre as duas versões — vetores extraídos de
   src/assets/lemoncaps-loader.svg, sem qualquer alteração de geometria. */
const LETTER_PATHS: Record<string, string> = {
  l: 'M0.0326843 7.23497H3.08265V22.2441H13.8863V25.043H0.0326843V7.23497Z',
  e: 'M15.6659 7.23497H29.6469V10.0338H18.7159V14.7396H28.6298V17.5384H18.7159V22.2441H29.9016V25.043H15.6659V7.23497Z',
  m: 'M31.8086 7.23497H34.8585L42.0775 20.769L49.2964 7.23497H52.3464V25.043H49.2964V13.3664L43.0691 25.043H41.0858L34.8585 13.3664V25.043H31.8086V7.23497Z',
  n: 'M74.4645 7.23497H77.5145L86.8951 19.9805V7.23497H89.945V25.043H86.8951L77.5145 12.2465V25.043H74.4645V7.23497Z',
  c: 'M91.9794 16.1142C91.9794 9.85693 94.8016 6.8542 100.674 6.8542C106.038 6.8542 109.114 8.68612 109.114 13.4173H107.283C107.283 9.34723 103.8 8.66064 100.521 8.66064C95.7424 8.66064 93.9627 10.8988 93.9627 16.0888C93.9627 21.2787 96.3775 23.6188 101.462 23.6188C104.335 23.6188 107.385 23.0342 107.385 19.0915H109.216C109.216 23.8227 106.064 25.4253 101.285 25.4253C95.0069 25.4253 91.9809 22.3731 91.9809 16.1142H91.9794Z',
  a: 'M116.84 7.23497H118.9L126.527 25.043H124.492L122.942 21.4556H112.799L111.274 25.043H109.214L116.84 7.23497ZM122.179 19.6747L117.883 9.62607L113.561 19.6747H122.179Z',
  p: 'M128.508 7.23497H136.413C141.37 7.23497 143.556 9.19432 143.556 13.0605C143.556 16.9268 141.447 18.8861 136.413 18.8861H130.363V25.043H128.507V7.23497H128.508ZM136.517 17.1052C140.227 17.1052 141.55 15.7575 141.55 13.0605C141.55 10.3636 140.229 9.01592 136.517 9.01592H130.365V17.1052H136.517Z',
  s: 'M145.312 11.7128C145.312 8.27836 147.625 6.8542 152.734 6.8542C157.234 6.8542 159.928 8.43127 159.928 12.9091H158.123C158.123 9.2198 155.555 8.76258 152.633 8.76258C148.514 8.76258 147.319 9.80596 147.319 11.6619C147.319 13.6722 149.403 14.4352 152.784 15.0199C157.639 15.8339 160.13 16.9538 160.13 20.4377C160.13 23.9217 157.766 25.4238 152.478 25.4238C147.903 25.4238 145.081 23.8467 145.081 19.3688H146.912C146.912 23.1346 149.607 23.6173 152.631 23.6173C156.342 23.6173 158.121 22.6504 158.121 20.5396C158.121 17.5384 154.486 17.462 152.275 16.9777C148.207 16.0618 145.309 15.3497 145.309 11.7113L145.312 11.7128Z',
};

const LEMON_PATH =
  'M71.127 10.4221C71.0116 10.2602 70.9727 10.0533 71.0281 9.86293C71.2768 8.99044 70.9996 8.01302 70.2476 7.40887C69.4956 6.80473 68.4845 6.74326 67.686 7.17501C67.5108 7.26945 67.301 7.27695 67.1183 7.199C63.3088 5.57396 58.7354 6.59935 56.015 9.98886C53.3261 13.3379 53.2796 17.9552 55.5985 21.3192C55.7334 21.5156 55.7633 21.7674 55.6689 21.9863C55.266 22.9233 55.5162 24.0491 56.3491 24.7192C57.1849 25.3923 58.3444 25.3908 59.1713 24.7881C59.3586 24.6517 59.6042 24.6277 59.8185 24.7162C63.6024 26.2648 68.104 25.2259 70.7959 21.8739C73.5178 18.4844 73.5328 13.7951 71.127 10.4221Z';

const LEAF_PATH =
  'M63.2774 3.68057C62.7007 2.88154 62.3996 1.96707 62.3576 1.05111C62.3486 0.850229 62.5209 0.685326 62.7216 0.704815C64.0728 0.829241 65.3656 1.51434 66.224 2.70164C66.8007 3.50067 67.1018 4.41513 67.1438 5.33109C67.1528 5.53197 66.9805 5.69688 66.7798 5.67739C65.4285 5.55296 64.1357 4.86637 63.2789 3.68057H63.2774Z';

/* Ordem das letras tal como aparecem no wordmark original (o "o" foi
   substituído pelo limão, por isso não há entrada para ele aqui). */
const LETTER_ORDER = ['l', 'e', 'm', 'n', 'c', 'a', 'p', 's'];

/** Sufixo único por instância — evita colisão de id/keyframe quando múltiplas
 *  logos (estáticas e/ou animadas) são renderizadas juntas na mesma página. */
function useUid(prefix: string) {
  const raw = useId().replace(/:/g, '');
  return `${prefix}-${raw}`;
}

/* ────────────────────────────────────────────────────────────────────────
 * LemoncapsLogo — versão estática (cabeçalho, login). Sem <style>, sem
 * animação, sem partículas/anéis/reflexo/ground-glow: só wordmark + limão + folha.
 * ──────────────────────────────────────────────────────────────────────── */
export function LemoncapsLogo({ className }: LemoncapsLogoProps) {
  const uid = useUid('lc-logo');
  const glowId = `${uid}-glow`;
  const highlightId = `${uid}-highlight`;
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 26"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('h-6 w-auto', className)}
    >
      <title id={titleId}>Lemoncaps</title>
      <desc id={descId}>Logo da Lemoncaps</desc>

      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.65" result="blur" />
          <feFlood floodColor="#E8F235" floodOpacity="0.78" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id={highlightId} cx="36%" cy="28%" r="72%">
          <stop offset="0" stopColor="#F4FA52" />
          <stop offset="0.42" stopColor="#CAD400" />
          <stop offset="1" stopColor="#AEB700" />
        </radialGradient>
      </defs>

      <g fill="currentColor">
        {LETTER_ORDER.map((letter) => (
          <path key={letter} d={LETTER_PATHS[letter]} />
        ))}
      </g>

      <g filter={`url(#${glowId})`}>
        <path d={LEMON_PATH} fill={`url(#${highlightId})`} />
        <path d={LEAF_PATH} fill="#CAD400" />
      </g>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * LemoncapsLoader — versão animada (estados de carregamento). Reproduz a
 * revelação das letras, o limão saltando, a folha, os anéis, as partículas
 * e o reflexo de luz do SVG original, com ids/keyframes escopados por
 * instância via useId() e respeitando prefers-reduced-motion.
 * ──────────────────────────────────────────────────────────────────────── */
export function LemoncapsLoader({ className }: LemoncapsLogoProps) {
  const uid = useUid('lc-loader');

  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const greenGlowId = `${uid}-green-glow`;
  const softGlowId = `${uid}-soft-glow`;
  const shineGradientId = `${uid}-shine-gradient`;
  const lemonHighlightId = `${uid}-lemon-highlight`;
  const sceneClipId = `${uid}-scene-clip`;
  const logoMaskId = `${uid}-logo-mask`;
  const stageId = `${uid}-stage`;
  const groundGlowId = `${uid}-ground-glow`;
  const energyRingsId = `${uid}-energy-rings`;
  const orbitParticlesId = `${uid}-orbit-particles`;
  const wordmarkId = `${uid}-wordmark`;
  const lemonSymbolId = `${uid}-lemon-symbol`;
  const lemonCoreId = `${uid}-lemon-core`;
  const leafId = `${uid}-leaf`;
  const lightSweepId = `${uid}-light-sweep`;

  const shapeId = (name: string) => `${uid}-shape-${name}`;

  const svgStyle = { '--cycle': '3.8s' } as CSSProperties;

  const css = `
    #${stageId} {
      transform-origin: 80px 13px;
      animation: stage-breathe-${uid} var(--cycle) cubic-bezier(.22,.75,.2,1) infinite;
    }

    #${stageId} .letter {
      opacity: 0;
      clip-path: inset(0 100% 0 0);
      transform-box: fill-box;
      transform-origin: center;
      animation: letter-reveal-${uid} var(--cycle) cubic-bezier(.2,.8,.2,1) infinite;
    }

    #${stageId} .letter:nth-child(1) { animation-delay: 0.00s; }
    #${stageId} .letter:nth-child(2) { animation-delay: 0.06s; }
    #${stageId} .letter:nth-child(3) { animation-delay: 0.12s; }
    #${stageId} .letter:nth-child(4) { animation-delay: 0.28s; }
    #${stageId} .letter:nth-child(5) { animation-delay: 0.34s; }
    #${stageId} .letter:nth-child(6) { animation-delay: 0.40s; }
    #${stageId} .letter:nth-child(7) { animation-delay: 0.46s; }
    #${stageId} .letter:nth-child(8) { animation-delay: 0.52s; }

    #${lemonCoreId} {
      transform-box: fill-box;
      transform-origin: center;
      animation: lemon-motion-${uid} var(--cycle) cubic-bezier(.22,.85,.25,1) infinite;
    }

    #${leafId} {
      transform-box: fill-box;
      transform-origin: 20% 90%;
      animation: leaf-motion-${uid} var(--cycle) cubic-bezier(.22,.85,.25,1) infinite;
    }

    #${energyRingsId} {
      transform-origin: 63.5px 15px;
      animation: ring-pulse-${uid} var(--cycle) ease-out infinite;
    }

    #${orbitParticlesId} {
      transform-origin: 63.5px 14.6px;
      animation: orbit-${uid} var(--cycle) cubic-bezier(.4,0,.2,1) infinite;
    }

    #${stageId} .particle {
      fill: #EAF337;
      filter: url(#${greenGlowId});
      animation: particle-flicker-${uid} 0.9s ease-in-out infinite alternate;
    }
    #${stageId} .particle:nth-child(2) { animation-delay: -0.24s; }
    #${stageId} .particle:nth-child(3) { animation-delay: -0.51s; }
    #${stageId} .particle:nth-child(4) { animation-delay: -0.73s; }

    #${lightSweepId} {
      transform: translateX(-56px) skewX(-14deg);
      animation: sweep-${uid} var(--cycle) cubic-bezier(.3,.65,.3,1) infinite;
      mix-blend-mode: screen;
    }

    #${groundGlowId} {
      transform-origin: center;
      animation: glow-pulse-${uid} var(--cycle) ease-in-out infinite;
    }

    @keyframes letter-reveal-${uid} {
      0%, 8%   { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateY(2.2px) scale(.97); }
      22%, 78% { opacity: 1; clip-path: inset(0 0 0 0); transform: translateY(0) scale(1); }
      92%,100% { opacity: 0; clip-path: inset(0 0 0 0); transform: translateY(-1px) scale(1); }
    }

    @keyframes lemon-motion-${uid} {
      0%, 7%   { opacity: 0; transform: translateY(7px) rotate(-28deg) scale(.3); }
      20%      { opacity: 1; transform: translateY(-1px) rotate(7deg) scale(1.08); }
      29%      { transform: translateY(0) rotate(-3deg) scale(.98); }
      38%, 76% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
      49%      { transform: translateY(-.65px) rotate(2deg) scale(1.025); }
      92%,100% { opacity: 0; transform: translateY(-1px) rotate(5deg) scale(.96); }
    }

    @keyframes leaf-motion-${uid} {
      0%, 12%  { opacity: 0; transform: rotate(-34deg) scale(.3); }
      24%      { opacity: 1; transform: rotate(12deg) scale(1.08); }
      34%      { transform: rotate(-5deg) scale(1); }
      44%, 78% { opacity: 1; transform: rotate(0) scale(1); }
      53%      { transform: rotate(8deg) scale(1.02); }
      92%,100% { opacity: 0; transform: rotate(2deg) scale(.96); }
    }

    @keyframes ring-pulse-${uid} {
      0%, 12%  { opacity: 0; transform: scale(.35); }
      22%      { opacity: .8; transform: scale(.65); }
      44%      { opacity: 0; transform: scale(1.45); }
      45%,100% { opacity: 0; transform: scale(1.45); }
    }

    @keyframes orbit-${uid} {
      0%, 10%  { opacity: 0; transform: rotate(-70deg) scale(.45); }
      23%      { opacity: 1; }
      55%      { opacity: .9; transform: rotate(170deg) scale(1); }
      75%      { opacity: 0; transform: rotate(300deg) scale(1.08); }
      100%     { opacity: 0; transform: rotate(300deg) scale(1.08); }
    }

    @keyframes sweep-${uid} {
      0%, 38%  { opacity: 0; transform: translateX(-56px) skewX(-14deg); }
      43%      { opacity: 1; }
      61%      { opacity: .85; transform: translateX(188px) skewX(-14deg); }
      64%,100% { opacity: 0; transform: translateX(188px) skewX(-14deg); }
    }

    @keyframes particle-flicker-${uid} {
      from { opacity: .35; }
      to   { opacity: 1; }
    }

    @keyframes glow-pulse-${uid} {
      0%, 15%, 95%,100% { opacity: 0; transform: scaleX(.45); }
      35%, 72%          { opacity: .34; transform: scaleX(1); }
    }

    @keyframes stage-breathe-${uid} {
      0%, 12%  { transform: scale(.985); }
      34%, 75% { transform: scale(1); }
      92%,100% { transform: scale(.995); }
    }

    @media (prefers-reduced-motion: reduce) {
      #${stageId},
      #${stageId} .letter,
      #${lemonCoreId},
      #${leafId},
      #${energyRingsId},
      #${orbitParticlesId},
      #${stageId} .particle,
      #${lightSweepId},
      #${groundGlowId} {
        animation: none !important;
      }
      #${stageId} .letter,
      #${lemonCoreId},
      #${leafId} { opacity: 1; clip-path: none; transform: none; }
      #${energyRingsId},
      #${orbitParticlesId},
      #${lightSweepId},
      #${groundGlowId} { opacity: 0; }
    }
  `;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 26"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('h-8 w-auto', className)}
      style={svgStyle}
    >
      <title id={titleId}>Lemoncaps — carregando</title>
      <desc id={descId}>Logo Lemoncaps animada com revelação das letras, limão em movimento, partículas e reflexo de luz.</desc>

      <defs>
        <filter id={greenGlowId} x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.65" result="blur" />
          <feFlood floodColor="#E8F235" floodOpacity="0.78" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={softGlowId} x="-40%" y="-100%" width="180%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>

        <linearGradient id={shineGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF" stopOpacity="0" />
          <stop offset="0.42" stopColor="#FFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFF" stopOpacity="0.95" />
          <stop offset="0.58" stopColor="#E8F235" stopOpacity="0" />
          <stop offset="1" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={lemonHighlightId} cx="36%" cy="28%" r="72%">
          <stop offset="0" stopColor="#F4FA52" />
          <stop offset="0.42" stopColor="#CAD400" />
          <stop offset="1" stopColor="#AEB700" />
        </radialGradient>

        <clipPath id={sceneClipId}>
          <rect width="160" height="26" rx="1" />
        </clipPath>

        <mask id={logoMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="26">
          <rect width="160" height="26" fill="#000" />
          <g fill="#FFF">
            {LETTER_ORDER.map((letter) => (
              <use key={letter} href={`#${shapeId(letter)}`} />
            ))}
            <use href={`#${shapeId('lemon')}`} />
            <use href={`#${shapeId('leaf')}`} />
          </g>
        </mask>

        <style>{css}</style>
      </defs>

      <g id={stageId} clipPath={`url(#${sceneClipId})`}>
        <ellipse id={groundGlowId} cx="63.5" cy="24.1" rx="12" ry="1.15" fill="#CAD400" opacity="0" filter={`url(#${softGlowId})`} />

        <g id={energyRingsId} fill="none" stroke="#CAD400" opacity="0">
          <ellipse cx="63.5" cy="15" rx="7.8" ry="7.2" strokeWidth=".34" />
          <ellipse cx="63.5" cy="15" rx="10.2" ry="9.4" strokeWidth=".16" strokeDasharray="1.1 1.8" />
        </g>

        <g id={orbitParticlesId} opacity="0">
          <circle className="particle" cx="54.1" cy="12.1" r=".42" />
          <circle className="particle" cx="68.9" cy="6.5" r=".31" />
          <circle className="particle" cx="72.8" cy="17.6" r=".38" />
          <circle className="particle" cx="58.4" cy="23.3" r=".27" />
        </g>

        <g id={`${uid}-artwork`}>
          <g id={wordmarkId} fill="currentColor">
            {LETTER_ORDER.map((letter) => (
              <g className="letter" key={letter}>
                <path id={shapeId(letter)} d={LETTER_PATHS[letter]} />
              </g>
            ))}
          </g>

          <g id={lemonSymbolId} filter={`url(#${greenGlowId})`}>
            <g id={lemonCoreId}>
              <path id={shapeId('lemon')} d={LEMON_PATH} fill={`url(#${lemonHighlightId})`} />
            </g>
            <g id={leafId}>
              <path id={shapeId('leaf')} d={LEAF_PATH} fill="#CAD400" />
            </g>
          </g>
        </g>

        <g mask={`url(#${logoMaskId})`} pointerEvents="none">
          <rect id={lightSweepId} x="0" y="-4" width="31" height="34" fill={`url(#${shineGradientId})`} opacity="0" />
        </g>
      </g>
    </svg>
  );
}
