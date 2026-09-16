import { describe, expect, it } from 'vitest';
import {
  checadoHoje, contarResultados, diasDesdeCheckup, estiloDoHistorico,
  rankingObjecoes, ultimoCheckup,
} from './checkupOrcamento';
import type { ContatoOrcamento } from '@/types/orcamento';

const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const checkup = (
  id: string,
  data: string,
  resultado: ContatoOrcamento['resultado'],
  objecao?: string,
): ContatoOrcamento => ({
  id,
  data,
  tipo: 'contato',
  observacao: 'nota',
  resultado,
  objecao,
});

/** Contato antigo, de antes do checkup existir: sem `resultado`. */
const contatoAntigo = (id: string, data: string): ContatoOrcamento => ({
  id,
  data,
  tipo: 'contato',
  observacao: 'contato legado',
});

describe('último checkup', () => {
  it('ignora contatos antigos sem resultado', () => {
    const h = [contatoAntigo('a', dias(1)), checkup('b', dias(5), 'negativa')];
    expect(ultimoCheckup(h)?.id).toBe('b');
  });

  it('pega o mais recente, não o último do array', () => {
    const h = [checkup('a', dias(1), 'positiva'), checkup('b', dias(9), 'negativa')];
    expect(ultimoCheckup(h)?.id).toBe('a');
  });

  it('devolve null quando só há contatos legados', () => {
    expect(ultimoCheckup([contatoAntigo('a', dias(2))])).toBeNull();
    expect(ultimoCheckup([])).toBeNull();
    expect(ultimoCheckup(undefined)).toBeNull();
  });

  it('conta os dias desde o último checkup', () => {
    expect(diasDesdeCheckup([checkup('a', dias(3), 'neutra')])).toBe(3);
    expect(diasDesdeCheckup([])).toBeNull();
  });

  it('reconhece o que foi checado hoje', () => {
    expect(checadoHoje([checkup('a', new Date().toISOString(), 'positiva')])).toBe(true);
    expect(checadoHoje([checkup('a', dias(1), 'positiva')])).toBe(false);
  });
});

describe('cor do card', () => {
  it('verde na positiva, vermelho na negativa', () => {
    expect(estiloDoHistorico([checkup('a', dias(0), 'positiva')]).ponto).toBe('bg-green-500');
    expect(estiloDoHistorico([checkup('a', dias(0), 'negativa')]).ponto).toBe('bg-red-500');
  });

  it('cinza quando nunca foi checado', () => {
    expect(estiloDoHistorico([]).ponto).toBe('bg-muted-foreground/40');
  });

  it('vale o último resultado, não o primeiro', () => {
    const h = [checkup('a', dias(9), 'negativa'), checkup('b', dias(1), 'positiva')];
    expect(estiloDoHistorico(h).ponto).toBe('bg-green-500');
  });
});

describe('contagem por resultado', () => {
  it('separa checados de não checados', () => {
    const c = contarResultados([
      [checkup('a', dias(1), 'positiva')],
      [checkup('b', dias(1), 'negativa')],
      [checkup('c', dias(1), 'neutra')],
      [contatoAntigo('d', dias(1))],
      undefined,
    ]);
    expect(c).toEqual({ positiva: 1, negativa: 1, neutra: 1, semCheckup: 2 });
  });
});

describe('ranking de objeções', () => {
  it('ordena pela mais frequente e soma o valor travado', () => {
    const r = rankingObjecoes([
      { historico: [checkup('a', dias(1), 'negativa', 'preco')], valor: 1000 },
      { historico: [checkup('b', dias(1), 'negativa', 'preco')], valor: 500 },
      { historico: [checkup('c', dias(1), 'neutra', 'prazo')], valor: 300 },
    ]);
    expect(r[0].valor).toBe('preco');
    expect(r[0].quantidade).toBe(2);
    expect(r[0].valorTravado).toBe(1500);
    expect(r[0].percentual).toBeCloseTo(66.67, 1);
    expect(r[1].valor).toBe('prazo');
  });

  it('não conta objeção já superada por uma conversa positiva', () => {
    // O cliente reclamou do preço e depois aceitou: preço não trava mais nada.
    const h = [checkup('a', dias(9), 'negativa', 'preco'), checkup('b', dias(1), 'positiva')];
    expect(rankingObjecoes([{ historico: h, valor: 1000 }])).toEqual([]);
  });

  it('usa a objeção mais recente quando o cliente mudou de motivo', () => {
    const h = [
      checkup('a', dias(9), 'negativa', 'preco'),
      checkup('b', dias(1), 'negativa', 'prazo'),
    ];
    const r = rankingObjecoes([{ historico: h, valor: 800 }]);
    expect(r).toHaveLength(1);
    expect(r[0].valor).toBe('prazo');
  });

  it('devolve lista vazia sem objeções registradas', () => {
    expect(rankingObjecoes([{ historico: [], valor: 100 }])).toEqual([]);
  });
});
