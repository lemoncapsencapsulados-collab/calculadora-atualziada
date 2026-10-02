import { describe, expect, it } from 'vitest';
import {
  INDICADORES_DERIVADOS,
  METRICAS,
  type ResultadoMes,
  compararMes,
  lerMes,
  nomeDoMes,
  participacaoRecompra,
  taxaConversao,
  ticketMedio,
} from './desempenhoVendedor';

const mes = (m: string, p: Partial<ResultadoMes> = {}): ResultadoMes => ({
  mes: m,
  leads: 0,
  orcamentos: 0,
  valorPrimeirasVendas: 0,
  valorRecompras: 0,
  vendasNovas: 0,
  recompras: 0,
  ...p,
});

describe('comparação com o mês anterior', () => {
  it('subir numa métrica boa é melhora', () => {
    expect(compararMes(12, 10).tendencia).toBe('melhorou');
  });

  it('cair numa métrica boa é piora', () => {
    expect(compararMes(8, 10).tendencia).toBe('piorou');
  });

  it('oscilação pequena não vira notícia', () => {
    // 2% não é mudança de comportamento; chamar de "piorou" na frente do
    // vendedor transforma ruído em cobrança.
    expect(compararMes(98, 100).tendencia).toBe('estavel');
    expect(compararMes(102, 100).tendencia).toBe('estavel');
  });

  it('5% já conta', () => {
    expect(compararMes(105, 100).tendencia).toBe('melhorou');
    expect(compararMes(95, 100).tendencia).toBe('piorou');
  });

  it('sair do zero não é "cresceu 100%"', () => {
    // É o primeiro mês do vendedor. Mostrar porcentagem aqui começa a conversa
    // com um número que não quer dizer nada.
    const v = compararMes(7, 0);
    expect(v.tendencia).toBe('sem_base');
    expect(v.percentual).toBeNull();
  });

  it('zero continuando zero é estável, não "sem base"', () => {
    expect(compararMes(0, 0).tendencia).toBe('estavel');
  });

  it('respeita métrica em que subir é ruim', () => {
    expect(compararMes(20, 10, false).tendencia).toBe('piorou');
    expect(compararMes(5, 10, false).tendencia).toBe('melhorou');
  });
});

describe('indicadores derivados', () => {
  const m = mes('2026-09', {
    orcamentos: 20,
    vendasNovas: 4,
    recompras: 1,
    valorPrimeirasVendas: 40000,
    valorRecompras: 10000,
  });

  it('taxa de conversão conta venda nova e recompra', () => {
    expect(taxaConversao(m)).toBe(25);
  });

  it('ticket médio é o valor por venda fechada', () => {
    expect(ticketMedio(m)).toBe(10000);
  });

  it('participação em recompra sai do valor, não da contagem', () => {
    expect(participacaoRecompra(m)).toBe(20);
  });

  it('mês sem venda não divide por zero', () => {
    const vazio = mes('2026-09');
    expect(taxaConversao(vazio)).toBe(0);
    expect(ticketMedio(vazio)).toBe(0);
    expect(participacaoRecompra(vazio)).toBe(0);
  });
});

describe('a leitura que vai para a conversa', () => {
  const meses = [
    mes('2026-08', { orcamentos: 20, vendasNovas: 5, valorPrimeirasVendas: 50000, recompras: 2, valorRecompras: 20000 }),
    mes('2026-09', { orcamentos: 30, vendasNovas: 3, valorPrimeirasVendas: 30000, recompras: 2, valorRecompras: 20000 }),
  ];

  it('separa o que melhorou do que piorou, por nome', () => {
    const l = lerMes(meses, 1)!;
    expect(l.melhorou).toContain('Orçamentos gerados');
    expect(l.piorou).toContain('Vendas novas');
    expect(l.piorou).toContain('Valor em vendas novas');
  });

  it('o que ficou igual não entra em nenhuma lista', () => {
    const l = lerMes(meses, 1)!;
    expect(l.melhorou).not.toContain('Recompras');
    expect(l.piorou).not.toContain('Recompras');
  });

  it('usa nome de gente, não chave de código', () => {
    const l = lerMes(meses, 1)!;
    expect(l.piorou.join(' ')).not.toContain('valorPrimeirasVendas');
  });

  it('primeiro mês não acusa piora', () => {
    const l = lerMes(meses, 0)!;
    expect(l.piorou).toHaveLength(0);
  });

  it('mês que não existe devolve nulo', () => {
    expect(lerMes(meses, 9)).toBeNull();
  });
});

describe('o painel se explica sozinho', () => {
  it('toda métrica tem nome e explicação', () => {
    for (const m of METRICAS) {
      expect(m.nome.length, m.chave).toBeGreaterThan(3);
      expect(m.explicacao.length, m.chave).toBeGreaterThan(20);
    }
  });

  it('toda sigla criada tem o que ela quer dizer', () => {
    // Foi o pedido: o painel é lido na frente do vendedor.
    for (const i of INDICADORES_DERIVADOS) {
      expect(i.sigla.length).toBeGreaterThan(0);
      expect(i.explicacao.length).toBeGreaterThan(30);
    }
  });

  it('cobre as seis medidas pedidas para a gestão', () => {
    const chaves = METRICAS.map((m) => m.chave);
    expect(chaves).toEqual(
      expect.arrayContaining([
        'leads', 'orcamentos', 'vendasNovas', 'valorPrimeirasVendas', 'recompras', 'valorRecompras',
      ]),
    );
  });

  it('o mês aparece por extenso', () => {
    expect(nomeDoMes('2026-09')).toBe('setembro de 2026');
    expect(nomeDoMes('')).toBe('—');
  });
});
