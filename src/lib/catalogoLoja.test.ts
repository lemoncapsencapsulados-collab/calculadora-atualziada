import { describe, expect, it } from 'vitest';
import {
  NICHOS,
  NICHO_NOME,
  NICHO_TEMA,
  PRODUTOS_LOJA,
  SEM_LOJA,
  TODAS,
  abasDaFormula,
  nichoValido,
  nomeDeExibicao,
  prateleiraUsaNichos,
  produtoDaLoja,
} from './catalogoLoja';

describe('espelho da loja', () => {
  it('tem os cinco nichos do menu da loja', () => {
    expect(NICHOS.map((n) => n.nome)).toEqual([
      'Vitalidade & Equilíbrio',
      'Energia & Foco',
      'Performance & Treino',
      'Sono & Recuperação',
      'Beleza & Bem-Estar',
    ]);
  });

  it('tem os 17 produtos da loja', () => {
    expect(PRODUTOS_LOJA).toHaveLength(17);
  });

  it('todo produto pertence a pelo menos um nicho conhecido', () => {
    const ids = new Set(NICHOS.map((n) => n.id));
    for (const p of PRODUTOS_LOJA) {
      expect(p.nichos.length).toBeGreaterThan(0);
      for (const n of p.nichos) expect(ids.has(n)).toBe(true);
    }
  });

  it('nenhuma fórmula aponta para dois produtos', () => {
    const vistas = new Map<string, string>();
    for (const p of PRODUTOS_LOJA) {
      for (const f of p.formulas) {
        expect(vistas.has(f), `"${f}" mapeada duas vezes`).toBe(false);
        vistas.set(f, p.nome);
      }
    }
  });
});

describe('correspondência formula → produto', () => {
  it('acha o produto ignorando acento e caixa', () => {
    expect(produtoDaLoja('ARTFLEX')?.nome).toContain('Artflex');
    expect(produtoDaLoja('Qualidade do sono - serena')?.nome).toContain('Serena');
  });

  it('usa o nome da loja quando há correspondente', () => {
    expect(nomeDeExibicao('Energia e disposição - Pro Energy'))
      .toBe('Lemon Caps Pró Energy Cafeína Taurina Guaraná 60 cápsulas');
  });

  it('mantém o nome do sistema quando não há correspondente', () => {
    // Era o pedido: fórmula que não existe no e-commerce fica como está.
    expect(nomeDeExibicao('TIRZ')).toBe('TIRZ');
    expect(nomeDeExibicao('ESTIMULANTE SEXUAL - LIBIDO')).toBe('ESTIMULANTE SEXUAL - LIBIDO');
  });

  it('não confunde gramaturas diferentes', () => {
    // 150g existe na loja; 300g não. Casar as duas viraria cotação errada.
    expect(produtoDaLoja('Energia e disposição - Creatina Monohidratada 150g')).not.toBeNull();
    expect(produtoDaLoja('Energia e disposição - Creatina Monohidratada 300g')).toBeNull();
  });

  it('cai em "Fora da loja" quando não há correspondente', () => {
    expect(abasDaFormula('TIRZ')).toEqual([SEM_LOJA]);
  });

  it('põe o produto em todos os nichos dele, como na loja', () => {
    // Multivitamínico está em Energia & Foco e em Beleza & Bem-Estar.
    expect(abasDaFormula('Imunidade - Multivitamínico')).toEqual(['energia', 'beleza']);
    // ZMA está em Performance & Treino e em Sono & Recuperação.
    expect(abasDaFormula('Beleza e bem-estar - ZMA')).toEqual(['performance', 'sono']);
  });

  it('fórmula vazia não quebra', () => {
    expect(produtoDaLoja(null)).toBeNull();
    expect(nomeDeExibicao(null)).toBe('Fórmula sem nome');
  });
});

describe('nicho escolhido à mão', () => {
  it('manda sobre a correspondência com a loja', () => {
    // O produto está em Beleza pela loja; quem cadastrou disse Energia.
    expect(abasDaFormula('ArtFlex', 'energia')).toEqual(['energia']);
  });

  it('tira a fórmula de "Fora da loja"', () => {
    expect(abasDaFormula('TIRZ')).toEqual([SEM_LOJA]);
    expect(abasDaFormula('TIRZ', 'sono')).toEqual(['sono']);
  });

  it('nicho inválido é ignorado, não quebra a tela', () => {
    // Valor estranho no banco não pode sumir com a fórmula da listagem.
    expect(abasDaFormula('ArtFlex', 'inventado')).toEqual(['beleza']);
    expect(abasDaFormula('TIRZ', '')).toEqual([SEM_LOJA]);
  });

  it('tem tema de cor para todo nicho e para "Fora da loja"', () => {
    for (const aba of [...NICHOS.map((n) => n.id), SEM_LOJA]) {
      expect(NICHO_TEMA[aba]?.fundo, `${aba} sem tema`).toBeTruthy();
      expect(NICHO_TEMA[aba].chipAtivo).toBeTruthy();
      expect(NICHO_TEMA[aba].chipInativo).toBeTruthy();
    }
  });

  it('cores são distintas entre os nichos', () => {
    // Duas abas com o mesmo fundo tiram o sentido de colorir.
    const fundos = NICHOS.map((n) => NICHO_TEMA[n.id].fundo);
    expect(new Set(fundos).size).toBe(fundos.length);
  });
});

describe('aba "Todas as Fórmulas White Label"', () => {
  it('tem nome e tema próprios', () => {
    expect(NICHO_NOME[TODAS]).toBe('Todas as Fórmulas White Label');
    expect(NICHO_TEMA[TODAS].fundo).toBeTruthy();
  });

  it('não é um nicho: nenhuma fórmula é classificada nela', () => {
    // Quem filtra trata "todas" como "não filtre"; se ela saísse daqui, a
    // fórmula apareceria duplicada na contagem.
    expect(abasDaFormula('ArtFlex')).not.toContain(TODAS);
    expect(abasDaFormula('TIRZ')).not.toContain(TODAS);
    expect(abasDaFormula('TIRZ', 'sono')).not.toContain(TODAS);
  });

  it('não é aceita como escolha manual de nicho', () => {
    expect(nichoValido(TODAS)).toBe(false);
    expect(abasDaFormula('TIRZ', TODAS)).toEqual([SEM_LOJA]);
  });
});

describe('tema do cartão', () => {
  it('todo nicho tem cor de cartão e de faixa', () => {
    for (const aba of [...NICHOS.map((n) => n.id), SEM_LOJA, TODAS]) {
      expect(NICHO_TEMA[aba].cartao, `${aba} sem cor de cartão`).toBeTruthy();
      expect(NICHO_TEMA[aba].barra, `${aba} sem faixa`).toBeTruthy();
    }
  });

  it('faixas são distintas entre os nichos', () => {
    const barras = NICHOS.map((n) => NICHO_TEMA[n.id].barra);
    expect(new Set(barras).size).toBe(barras.length);
  });

  it('as classes são literais, não montadas', () => {
    // O Tailwind varre o código atrás do nome inteiro da classe: `bg-${cor}-50`
    // compila e some do CSS. Este teste falha se alguém voltar a interpolar.
    for (const aba of [...NICHOS.map((n) => n.id), SEM_LOJA, TODAS]) {
      const tema = NICHO_TEMA[aba];
      for (const valor of [tema.fundo, tema.cartao, tema.barra, tema.chipAtivo, tema.chipInativo]) {
        expect(valor).not.toContain('${');
        expect(valor.trim()).not.toBe('');
      }
    }
  });
});

describe('que prateleira se organiza por nicho', () => {
  it('White Label e Seleção se organizam por nicho', () => {
    // As duas espelham as coleções de loja.lemoncaps.com.br.
    expect(prateleiraUsaNichos('white_label')).toBe(true);
    expect(prateleiraUsaNichos('selecao_lemoncaps')).toBe(true);
  });

  it('o CATÁLOGO 2026 é lista única, sem nicho', () => {
    // O pedido: na curadoria do ano se quer ver os produtos de uma vez, não
    // repartidos em cinco subpáginas e numa aba "Todas".
    expect(prateleiraUsaNichos('catalogo_2026')).toBe(false);
  });

  it('Private Label nunca teve nicho', () => {
    expect(prateleiraUsaNichos('private_label')).toBe(false);
    expect(prateleiraUsaNichos(undefined)).toBe(false);
  });

  it('usar nicho não é o mesmo que ser prateleira da casa', () => {
    // A distinção que o código precisa manter: as TRÊS prateleiras da casa
    // travam o preço e mostram o nome da loja, mas só DUAS usam nicho.
    // Colapsar as duas perguntas numa só foi o que encheu o 2026 de
    // subpáginas e o fez exigir um nicho que nenhuma tela lia.
    const daCasa = ['white_label', 'selecao_lemoncaps', 'catalogo_2026'] as const;
    const comNicho = daCasa.filter(prateleiraUsaNichos);
    expect(daCasa).toHaveLength(3);
    expect(comNicho).toHaveLength(2);
    expect(comNicho).not.toContain('catalogo_2026');
  });
});
