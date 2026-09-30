/**
 * Espelho do e-commerce (loja.lemoncaps.com.br) para o Catalogo Lemon.
 *
 * Duas coisas vivem aqui: os nichos que a loja usa para separar produtos, e a
 * correspondencia entre a formula da calculadora e o produto que o cliente ve'
 * na loja. Os nomes dos nichos e dos produtos sao copia literal da loja -- quem
 * atualizar isto deve conferir la', nao inventar.
 *
 * Formula sem correspondente fica FORA do mapa de proposito. O criterio e' o do
 * pedido: se o produto nao existe no e-commerce, ele continua com o nome do
 * sistema. Chutar uma correspondencia parecida faria o consultor cotar um
 * produto que nao e' aquele -- 150g virando 300g, tutti-frutti virando frutas
 * vermelhas. Na duvida, nao mapeie.
 */

export type NichoLoja = 'vitalidade' | 'energia' | 'performance' | 'sono' | 'beleza';

/** Sem correspondente na loja: continua como esta' no sistema. */
export const SEM_LOJA = 'sem_loja' as const;

/**
 * Aba que nao filtra nada: o catalogo inteiro.
 *
 * Nao e' um nicho, e' a ausencia de recorte -- por isso `abasDaFormula` nunca a
 * devolve. Quem filtra e' que trata `todas` como "nao filtre".
 */
export const TODAS = 'todas' as const;

export type AbaCatalogo = NichoLoja | typeof SEM_LOJA | typeof TODAS;

export const NICHOS: { id: NichoLoja; nome: string; colecao: string }[] = [
  { id: 'vitalidade', nome: 'Vitalidade & Equilíbrio', colecao: 'vitalidade-equilibrio' },
  { id: 'energia', nome: 'Energia & Foco', colecao: 'energia-disposicao' },
  { id: 'performance', nome: 'Performance & Treino', colecao: 'performance-treino' },
  { id: 'sono', nome: 'Sono & Recuperação', colecao: 'sono-relaxamento' },
  { id: 'beleza', nome: 'Beleza & Bem-Estar', colecao: 'beleza-bem-estar' },
];

/**
 * Cor de cada nicho. A loja nao tem tema por colecao, entao a paleta e' daqui e
 * segue o SIGNIFICADO do nicho: verde para vitalidade, ambar para energia, azul
 * para treino, indigo para noite, rosa para beleza, cinza para o que ainda nao
 * esta' na loja.
 *
 * Tons pasteis de proposito. A primeira versao usava as faixas 500/600 cheias,
 * e uma lista de quinze cartoes virava um mosaico que cansava de olhar -- a cor
 * aqui serve para AGRUPAR, nao para chamar atencao. Vermelho forte fica
 * reservado para o que e' urgente de verdade, como prazo de preco vencido.
 *
 * Sao classes inteiras, escritas por extenso, porque o Tailwind varre o codigo
 * procurando nome de classe -- montar `bg-${cor}-50` faria a cor sumir do build.
 */
export interface TemaNicho {
  /** Fundo da secao inteira. */
  fundo: string;
  /** Chip da aba quando selecionada. */
  chipAtivo: string;
  /** Chip quando nao selecionada. */
  chipInativo: string;
  /** Borda e texto de apoio. */
  destaque: string;
  /** Cartao da formula: fundo e borda, mais fracos que os da secao. */
  cartao: string;
  /** Faixa lateral do cartao, em cor cheia. */
  barra: string;
}

export const NICHO_TEMA: Record<AbaCatalogo, TemaNicho> = {
  vitalidade: {
    fundo: 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/60',
    chipAtivo: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100',
    chipInativo: 'border-emerald-200 bg-white text-emerald-900 hover:border-emerald-400 dark:border-emerald-900 dark:bg-transparent dark:text-emerald-200',
    destaque: 'text-emerald-700 dark:text-emerald-300',
    cartao: 'border-emerald-100 bg-emerald-50/25 dark:border-emerald-900/60 dark:bg-emerald-950/15',
    barra: 'bg-emerald-200 dark:bg-emerald-800',
  },
  energia: {
    fundo: 'bg-amber-50/40 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/60',
    chipAtivo: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-100',
    chipInativo: 'border-amber-200 bg-white text-amber-900 hover:border-amber-400 dark:border-amber-900 dark:bg-transparent dark:text-amber-200',
    destaque: 'text-amber-700 dark:text-amber-300',
    cartao: 'border-amber-100 bg-amber-50/25 dark:border-amber-900/60 dark:bg-amber-950/15',
    barra: 'bg-amber-200 dark:bg-amber-800',
  },
  performance: {
    fundo: 'bg-sky-50/40 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/60',
    chipAtivo: 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-100',
    chipInativo: 'border-sky-200 bg-white text-sky-900 hover:border-sky-400 dark:border-sky-900 dark:bg-transparent dark:text-sky-200',
    destaque: 'text-sky-700 dark:text-sky-300',
    cartao: 'border-sky-100 bg-sky-50/25 dark:border-sky-900/60 dark:bg-sky-950/15',
    barra: 'bg-sky-200 dark:bg-sky-800',
  },
  sono: {
    fundo: 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/60',
    chipAtivo: 'border-indigo-300 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-100',
    chipInativo: 'border-indigo-200 bg-white text-indigo-900 hover:border-indigo-400 dark:border-indigo-900 dark:bg-transparent dark:text-indigo-200',
    destaque: 'text-indigo-700 dark:text-indigo-300',
    cartao: 'border-indigo-100 bg-indigo-50/25 dark:border-indigo-900/60 dark:bg-indigo-950/15',
    barra: 'bg-indigo-200 dark:bg-indigo-800',
  },
  beleza: {
    fundo: 'bg-rose-50/40 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/60',
    chipAtivo: 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-900/50 dark:text-rose-100',
    chipInativo: 'border-rose-200 bg-white text-rose-900 hover:border-rose-400 dark:border-rose-900 dark:bg-transparent dark:text-rose-200',
    destaque: 'text-rose-700 dark:text-rose-300',
    cartao: 'border-rose-100 bg-rose-50/25 dark:border-rose-900/60 dark:bg-rose-950/15',
    barra: 'bg-rose-200 dark:bg-rose-800',
  },
  [SEM_LOJA]: {
    fundo: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800',
    chipAtivo: 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
    chipInativo: 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-transparent dark:text-slate-300',
    destaque: 'text-slate-600 dark:text-slate-400',
    cartao: 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/25',
    barra: 'bg-slate-200 dark:bg-slate-700',
  },
  // Ver tudo nao tem nicho, entao usa a cor da marca em vez de uma das cinco.
  [TODAS]: {
    fundo: 'bg-muted/40 border-border',
    chipAtivo: 'border-primary/40 bg-primary/10 text-foreground',
    chipInativo: 'border-border bg-background text-foreground hover:border-muted-foreground/40',
    destaque: 'text-muted-foreground',
    // "Todas" nunca chega a um cartao: cada um usa a cor do proprio nicho.
    cartao: 'border-border',
    barra: 'bg-muted-foreground/40',
  },
};

export const NICHO_NOME: Record<AbaCatalogo, string> = {
  vitalidade: 'Vitalidade & Equilíbrio',
  energia: 'Energia & Foco',
  performance: 'Performance & Treino',
  sono: 'Sono & Recuperação',
  beleza: 'Beleza & Bem-Estar',
  [SEM_LOJA]: 'Fora da loja',
  [TODAS]: 'Todas as Fórmulas White Label',
};

export interface ProdutoLoja {
  /** Nome exato como aparece na loja. */
  nome: string;
  /** Um produto pode estar em mais de uma colecao, como na loja. */
  nichos: NichoLoja[];
  /** Nomes de formula na calculadora que sao este produto. */
  formulas: string[];
}

/**
 * Os 17 produtos da loja. `formulas` lista so' o que da' para afirmar: mesmo
 * produto, mesma apresentacao, mesma gramatura.
 */
export const PRODUTOS_LOJA: ProdutoLoja[] = [
  {
    nome: 'Lemon Caps Moro Slim Complex Laranja Moro e Café Verde 60 cápsulas 30g',
    nichos: ['vitalidade'],
    formulas: ['Emagrecimento em Cápsulas - Moro Slim', 'EMAGRECIMENTO - MOROSLIM'],
  },
  {
    nome: 'Lemon Caps Slym Up Gotas 30 ml Cúrcuma Café Verde e Colina',
    nichos: ['vitalidade'],
    formulas: [
      'Emagrecimento em Gotas - Slim Up',
      'Emagrecimento - Emagrecimento em Gotas',
      'Emagrecimento em Gotas (Linha Standart - 30ml)',
      'EMAGRECIMENTO EM GOTAS (30ML)',
    ],
  },
  { nome: 'Lemon Caps Detox Bebida em Pó Vitamina C Sabor Limão 300g 30 doses', nichos: ['vitalidade'], formulas: [] },
  { nome: 'Lemon Caps Lidema Vitamina C L-Carnitina Cúrcuma 60 Cápsulas 30g', nichos: ['vitalidade'], formulas: [] },

  {
    nome: 'Lemon Caps Pró Energy Cafeína Taurina Guaraná 60 cápsulas',
    nichos: ['energia'],
    formulas: ['Energia e disposição - Pro Energy', 'PRÉ TREINO - PRÓ ENERGY'],
  },
  {
    nome: 'Lemon Caps Multivitamínico 60 cápsulas 12 vitaminas e 5 minerais',
    nichos: ['energia', 'beleza'],
    formulas: [
      'Imunidade - Multivitamínico',
      'Beleza e bem-estar - Multi Vitta',
      'MULTIVITAMÍNICO',
    ],
  },
  {
    nome: 'Lemon Caps Focus Colina L-Tirosina L-Teanina 60 Cápsulas',
    nichos: ['energia'],
    formulas: ['Foco e concentração - Focus Colina'],
  },

  {
    nome: 'Lemon Caps Creatina Monohidratada 150g Sem Sabor 30 Doses',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Creatina Monohidratada 150g'],
  },
  {
    nome: 'Lemon Caps Creatina Gummy Frutas Vermelhas 60 Gomas 180g',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Creatina Gummy Frutas Vermelhas'],
  },
  {
    nome: 'Césio 137 Pré-Treino + Creatina',
    nichos: ['performance'],
    formulas: ['Energia e disposição - Pré-treino + Creatina 420g'],
  },
  {
    nome: 'Lemon Caps ZMA Complex Zinco Magnésio B6 L-Teanina 60 Cápsulas',
    nichos: ['performance', 'sono'],
    formulas: ['Beleza e bem-estar - ZMA', 'ZMA', 'ZMA Em Cápsula'],
  },

  {
    nome: 'Lemon Caps Serena Gotas 30ml Melatonina L-Teanina Magnésio',
    nichos: ['sono'],
    formulas: ['Qualidade do sono - Serena', 'SERENA (30/06)', 'SERENA'],
  },
  {
    nome: 'Lemoncaps Dream Gummy Melatonina Triptofano 60 Gomas Sabor Uva',
    nichos: ['sono'],
    formulas: ['Qualidade do sono - Melatonina Gummy', 'Melatonina + Triptofanos EM GUMMY'],
  },

  {
    nome: 'Lemon Caps BioPrincess Colágeno Biotina Ácido Hialurônico 60 Cápsulas',
    nichos: ['beleza'],
    formulas: [
      'Beleza e bem-estar - Bio Princess',
      'Bio Princess (Saúde e bem estar - Encapsulado - Premium)',
      'CABELO PELE E UNHA - BIOPRINCESS',
    ],
  },
  {
    nome: 'Lemon Caps Artflex Colágeno Tipo II Glucosamina MSM 60 cápsulas',
    nichos: ['beleza'],
    formulas: ['ArtFlex', 'ArtFlex Duplicata'],
  },
  { nome: 'Lemon Caps Floravex Psyllium e Prebióticos 60 cápsulas 30g', nichos: ['beleza'], formulas: [] },
  { nome: 'Lemon Caps BioGummy Biotina Zinco Vitaminas A C E 60 gomas', nichos: ['beleza'], formulas: [] },
];

/** Compara nome de formula sem depender de acento, caixa ou pontuacao. */
function chave(nome: string | null | undefined): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PORFORMULA = new Map<string, ProdutoLoja>();
for (const produto of PRODUTOS_LOJA) {
  for (const formula of produto.formulas) PORFORMULA.set(chave(formula), produto);
}

/** O produto da loja que corresponde a esta formula, ou null. */
export function produtoDaLoja(nomeFormula: string | null | undefined): ProdutoLoja | null {
  return PORFORMULA.get(chave(nomeFormula)) ?? null;
}

/**
 * Como o produto deve aparecer: o nome da loja quando existe, senao o nome do
 * sistema, sem alteracao.
 */
export function nomeDeExibicao(nomeFormula: string | null | undefined): string {
  return produtoDaLoja(nomeFormula)?.nome || nomeFormula || 'Fórmula sem nome';
}

/** O texto gravado e' um nicho valido? */
export function nichoValido(valor: string | null | undefined): valor is NichoLoja {
  return !!valor && NICHOS.some((n) => n.id === valor);
}

/**
 * Em que abas esta formula aparece.
 *
 * O nicho escolhido a' mao manda: quem cadastrou disse onde queria. Sem escolha,
 * vale a correspondencia com a loja. Sem as duas, cai em "Fora da loja".
 */
export function abasDaFormula(
  nomeFormula: string | null | undefined,
  nichoEscolhido?: string | null,
): AbaCatalogo[] {
  if (nichoValido(nichoEscolhido)) return [nichoEscolhido];
  const produto = produtoDaLoja(nomeFormula);
  return produto ? produto.nichos : [SEM_LOJA];
}
