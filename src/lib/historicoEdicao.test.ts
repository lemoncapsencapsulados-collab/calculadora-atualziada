import { describe, expect, it } from 'vitest';
import {
  dataHoraDaEdicao,
  novoRegistro,
  resumirDiferencas,
  ultimaEdicao,
} from './historicoEdicao';

const doc = (over: Record<string, unknown> = {}) => ({
  produtos: [{ descricao: 'Multi', quantidade: 500, preco_unitario: 24 }],
  especificacoes: [
    {
      produto_nome: 'Multi',
      quantidade_por_frasco: '60 capsulas',
      dose_diaria: '2 cápsulas ao dia',
      doses_por_pote: '30 doses',
      composicao: [{ insumo: 'Vitamina D3', dose: '149 mcg' }],
    },
  ],
  ...over,
});

describe('a data que a tela mostra', () => {
  it('traz dia, hora e minuto', () => {
    // A pergunta é "quando foi editado?", e a resposta útil tem minuto.
    const r = dataHoraDaEdicao(new Date(2026, 9, 23, 14, 7).toISOString());
    expect(r).toContain('23/10/2026');
    expect(r).toContain('14:07');
    expect(r).toContain('às');
  });

  it('não quebra com data ausente ou inválida', () => {
    expect(dataHoraDaEdicao(null)).toBe('');
    expect(dataHoraDaEdicao('ontem')).toBe('');
  });
});

describe('qual é a última edição', () => {
  it('pega a mais recente, mesmo fora de ordem', () => {
    const h = [
      novoRegistro('manual', ['a'], new Date(2026, 9, 1)),
      novoRegistro('edicao_produto', ['b'], new Date(2026, 9, 20)),
      novoRegistro('manual', ['c'], new Date(2026, 9, 10)),
    ];
    expect(ultimaEdicao(h)?.mudancas).toEqual(['b']);
  });

  it('histórico vazio ou inválido devolve nulo', () => {
    expect(ultimaEdicao([])).toBeNull();
    expect(ultimaEdicao(null)).toBeNull();
    expect(ultimaEdicao(['lixo', 7, null])).toBeNull();
  });
});

describe('o que mudou, em texto', () => {
  it('descreve a troca de dose diária', () => {
    const d = resumirDiferencas(
      doc(),
      doc({
        especificacoes: [{ ...doc().especificacoes[0], dose_diaria: '3 cápsulas ao dia' }],
      }),
    );
    expect(d).toContain('Multi — dose diária: "2 cápsulas ao dia" → "3 cápsulas ao dia"');
  });

  it('descreve a troca de dosagem na fórmula', () => {
    // O caso real dos 149 mcg para 49 mcg.
    const d = resumirDiferencas(
      doc(),
      doc({
        especificacoes: [
          { ...doc().especificacoes[0], composicao: [{ insumo: 'Vitamina D3', dose: '49 mcg' }] },
        ],
      }),
    );
    expect(d.some((f) => f.includes('149 mcg') && f.includes('49 mcg'))).toBe(true);
  });

  it('descreve quantidade e preço do produto', () => {
    const d = resumirDiferencas(
      doc(),
      doc({ produtos: [{ descricao: 'Multi', quantidade: 800, preco_unitario: 26 }] }),
    );
    expect(d).toContain('Multi — quantidade: 500 → 800');
    expect(d.some((f) => f.includes('preço unitário') && f.includes('26.00'))).toBe(true);
  });

  it('avisa produto acrescentado e removido', () => {
    const comDois = doc({
      produtos: [
        { descricao: 'Multi', quantidade: 500, preco_unitario: 24 },
        { descricao: 'Colágeno', quantidade: 100, preco_unitario: 30 },
      ],
    });
    expect(resumirDiferencas(doc(), comDois)).toContain('Colágeno: produto acrescentado');
    expect(resumirDiferencas(comDois, doc())).toContain('Colágeno: produto removido');
  });

  it('campo preenchido do zero não vira "de vazio para"', () => {
    const semDose = doc({
      especificacoes: [{ ...doc().especificacoes[0], dose_diaria: '' }],
    });
    expect(resumirDiferencas(semDose, doc())).toContain(
      'Multi — dose diária: preenchido com "2 cápsulas ao dia"',
    );
  });

  it('documento igual não gera frase nenhuma', () => {
    // Sem isto, cada gravação automática encheria o histórico de linhas vazias.
    expect(resumirDiferencas(doc(), doc())).toEqual([]);
  });

  it('não quebra com documento ausente', () => {
    expect(() => resumirDiferencas(null, doc())).not.toThrow();
    expect(() => resumirDiferencas(doc(), null)).not.toThrow();
  });

  it('corta a lista quando a edição mexeu em tudo', () => {
    // Um histórico de 40 linhas não é lido; a linha que importa se perde.
    const muitos = Array.from({ length: 20 }, (_, i) => ({
      descricao: `P${i}`,
      quantidade: 1,
      preco_unitario: 1,
    }));
    const d = resumirDiferencas({ produtos: [] }, { produtos: muitos }, 5);
    expect(d).toHaveLength(6);
    expect(d[5]).toContain('e mais 15');
  });
});
