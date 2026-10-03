import { describe, expect, it } from 'vitest';
import {
  SEM_CONSULTOR,
  type PedidoParaResumo,
  participacao,
  resumirPorConsultor,
  totalGeral,
} from './resumoConsultor';

const p = (
  consultor: string,
  clienteNome: string,
  valor: number,
  clienteCnpj = '',
): PedidoParaResumo => ({ consultor, clienteNome, clienteCnpj, valor });

describe('resumo por consultor', () => {
  const pedidos = [
    p('Guilherme', 'TRULY', 10000, '56.411.570/0001-29'),
    p('Guilherme', 'TRULY', 5000, '56411570000129'),
    p('Guilherme', 'SOLANGE', 3000, '64.264.827/0001-95'),
    p('Everton', 'IMPERIO', 20000, '51564667000158'),
  ];

  it('conta pedidos e soma valor de cada consultor', () => {
    const r = resumirPorConsultor(pedidos);
    const guilherme = r.find((x) => x.consultor === 'Guilherme')!;
    expect(guilherme.pedidos).toBe(3);
    expect(guilherme.valor).toBe(18000);
  });

  it('mostra quanto cada cliente dele gerou', () => {
    const guilherme = resumirPorConsultor(pedidos).find((x) => x.consultor === 'Guilherme')!;
    const truly = guilherme.clientes.find((c) => c.nome === 'TRULY')!;
    expect(truly.pedidos).toBe(2);
    expect(truly.valor).toBe(15000);
  });

  it('o mesmo CNPJ com e sem pontuação é um cliente só', () => {
    // "56.411.570/0001-29" e "56411570000129" são a mesma empresa; sem
    // normalizar, a carteira do consultor apareceria com um cliente a mais.
    const guilherme = resumirPorConsultor(pedidos).find((x) => x.consultor === 'Guilherme')!;
    expect(guilherme.clientes).toHaveLength(2);
  });

  it('ordena do maior faturamento para o menor', () => {
    const r = resumirPorConsultor(pedidos);
    expect(r[0].consultor).toBe('Everton');
    expect(r[0].valor).toBe(20000);
    const guilherme = r.find((x) => x.consultor === 'Guilherme')!;
    expect(guilherme.clientes[0].nome).toBe('TRULY');
  });
});

describe('carteira dividida', () => {
  it('cada pedido conta para quem o atendeu', () => {
    // O mesmo produtor passou de um consultor para outro. O faturamento
    // histórico não migra junto: senão trocar a carteira reescreveria o
    // passado de quem vendeu.
    const r = resumirPorConsultor([
      p('Guilherme', 'TRULY', 10000, '56411570000129'),
      p('Everton', 'TRULY', 7000, '56411570000129'),
    ]);
    expect(r.find((x) => x.consultor === 'Guilherme')!.valor).toBe(10000);
    expect(r.find((x) => x.consultor === 'Everton')!.valor).toBe(7000);
  });
});

describe('o que não pode sumir', () => {
  it('pedido sem consultor vai para um balde identificado', () => {
    // Descartar some com faturamento; juntar com outro consultor mente.
    const r = resumirPorConsultor([p('', 'CLIENTE X', 500), p('   ', 'CLIENTE Y', 300)]);
    expect(r).toHaveLength(1);
    expect(r[0].consultor).toBe(SEM_CONSULTOR);
    expect(r[0].valor).toBe(800);
  });

  it('cliente sem CNPJ agrupa pelo nome, não vira uma linha por pedido', () => {
    const r = resumirPorConsultor([
      p('Guilherme', 'Cliente Antigo', 100),
      p('Guilherme', 'cliente antigo', 200),
    ]);
    expect(r[0].clientes).toHaveLength(1);
    expect(r[0].clientes[0].valor).toBe(300);
  });

  it('valor inválido conta como zero, não como NaN', () => {
    const r = resumirPorConsultor([
      { consultor: 'A', clienteNome: 'X', clienteCnpj: '', valor: Number('abc') },
    ]);
    expect(r[0].valor).toBe(0);
  });

  it('lista vazia não quebra', () => {
    expect(resumirPorConsultor([])).toEqual([]);
    expect(totalGeral([])).toEqual({ pedidos: 0, valor: 0 });
  });
});

describe('fechamento', () => {
  it('o total bate com a soma dos consultores', () => {
    const r = resumirPorConsultor([
      p('A', 'X', 1000),
      p('B', 'Y', 3000),
    ]);
    expect(totalGeral(r)).toEqual({ pedidos: 2, valor: 4000 });
  });

  it('participação é a fatia do consultor no total', () => {
    const r = resumirPorConsultor([p('A', 'X', 1000), p('B', 'Y', 3000)]);
    const total = totalGeral(r).valor;
    expect(participacao(r.find((x) => x.consultor === 'B')!, total)).toBe(75);
  });

  it('total zero não divide por zero', () => {
    const r = resumirPorConsultor([p('A', 'X', 0)]);
    expect(participacao(r[0], 0)).toBe(0);
  });
});
