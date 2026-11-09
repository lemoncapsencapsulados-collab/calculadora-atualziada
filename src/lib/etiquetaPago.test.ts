import { describe, expect, it } from 'vitest';
import {
  contarMarcadosPago,
  ehEtiquetaPago,
  etiquetasDePagamento,
  normalizarEtiqueta,
} from './etiquetaPago';

describe('que etiqueta quer dizer "pago"', () => {
  it('a que o time usa hoje', () => {
    expect(ehEtiquetaPago('PAGO')).toBe(true);
  });

  it('não depende de caixa, acento nem espaço', () => {
    // As três grafias convivem: cada consultor criou a sua.
    for (const nome of ['pago', ' Pago ', 'PAGO']) {
      expect(ehEtiquetaPago(nome)).toBe(true);
    }
  });

  it('emoji no nome não derruba a contagem', () => {
    // O caso que zera tudo sem aviso: alguém renomeia a etiqueta no celular.
    expect(ehEtiquetaPago('PAGO ✅')).toBe(true);
    expect(ehEtiquetaPago('💰 PAGO')).toBe(true);
    expect(ehEtiquetaPago('PAGO/FECHADO')).toBe(true);
    expect(ehEtiquetaPago('CLIENTE PAGO')).toBe(true);
  });

  it('negação não conta como pago', () => {
    for (const nome of ['NÃO PAGO', 'NAO PAGO', 'AGUARDANDO PAGO', 'PAGO PENDENTE']) {
      expect(ehEtiquetaPago(nome)).toBe(false);
    }
  });

  it('etapa do processo não é fato consumado', () => {
    // "A PAGAR" é promessa; "PAGAMENTO" é assunto. Nenhum dos dois é venda.
    expect(ehEtiquetaPago('A PAGAR')).toBe(false);
    expect(ehEtiquetaPago('PAGAMENTO')).toBe(false);
    expect(ehEtiquetaPago('LEAD')).toBe(false);
    expect(ehEtiquetaPago('EM NEGOCIAÇÃO')).toBe(false);
    expect(ehEtiquetaPago('')).toBe(false);
    expect(ehEtiquetaPago(null)).toBe(false);
  });

  it('normaliza para comparar', () => {
    expect(normalizarEtiqueta('Não Pago ✅')).toBe('NAO PAGO');
  });
});

describe('contagem de contatos marcados', () => {
  const etiquetas = [
    { instance_name: 'ana', label_id: '1', nome: 'PAGO' },
    { instance_name: 'ana', label_id: '2', nome: 'LEAD' },
    { instance_name: 'bia', label_id: '1', nome: 'EM NEGOCIAÇÃO' },
  ];

  it('conta quem está na etiqueta de pagamento', () => {
    const vinculos = [
      { instance_name: 'ana', remote_jid: 'x@lid', label_id: '1' },
      { instance_name: 'ana', remote_jid: 'y@lid', label_id: '1' },
      { instance_name: 'ana', remote_jid: 'z@lid', label_id: '2' },
    ];
    expect(contarMarcadosPago(etiquetas, vinculos)).toBe(2);
  });

  it('o mesmo label_id em outra conta não vaza', () => {
    // `label_id` só é único dentro da instância: na conta da Bia o 1 é
    // "EM NEGOCIAÇÃO". Casar só pelo id daria venda onde há negociação.
    const vinculos = [{ instance_name: 'bia', remote_jid: 'x@lid', label_id: '1' }];
    expect(contarMarcadosPago(etiquetas, vinculos)).toBe(0);
  });

  it('contato em duas etiquetas de pagamento conta uma vez', () => {
    const comDuas = [...etiquetas, { instance_name: 'ana', label_id: '3', nome: 'PAGO ✅' }];
    const vinculos = [
      { instance_name: 'ana', remote_jid: 'x@lid', label_id: '1' },
      { instance_name: 'ana', remote_jid: 'x@lid', label_id: '3' },
    ];
    expect(contarMarcadosPago(comDuas, vinculos)).toBe(1);
  });

  it('a mesma conversa em duas contas são duas', () => {
    const comBia = [...etiquetas, { instance_name: 'bia', label_id: '9', nome: 'PAGO' }];
    const vinculos = [
      { instance_name: 'ana', remote_jid: 'x@lid', label_id: '1' },
      { instance_name: 'bia', remote_jid: 'x@lid', label_id: '9' },
    ];
    expect(contarMarcadosPago(comBia, vinculos)).toBe(2);
  });

  it('sem etiqueta de pagamento na conta, é zero', () => {
    const vinculos = [{ instance_name: 'bia', remote_jid: 'x@lid', label_id: '1' }];
    expect(etiquetasDePagamento([etiquetas[2]])).toEqual([]);
    expect(contarMarcadosPago([etiquetas[2]], vinculos)).toBe(0);
  });

  it('não quebra com lista vazia', () => {
    expect(contarMarcadosPago([], [])).toBe(0);
  });
});
