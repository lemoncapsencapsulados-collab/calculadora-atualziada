import { describe, expect, it } from 'vitest';
import { montarDadosPedidoCompra } from './pedidoCompraAutoFill';
import { montarDadosZapSign, type ZapSignContratoCampos } from './zapsignContrato';
import { chavePlanoMarca, rotuloPlanoMarca } from '@/types/pedidoCompra';

const POTE = 'PET 250ml âmbar, boca larga, com lacre de indução';
const TAMPA = 'Rosca 63mm branca fosca';

/**
 * Pote e tampa fora do catálogo.
 *
 * O consultor combina com o cliente um pote que a Lemon não tem em lista. Esse
 * texto precisa chegar inteiro em dois lugares: no contrato que o cliente
 * assina e na ordem que a fábrica recebe. Chegar só num dos dois é pior que
 * não existir -- promete-se o que não se vai produzir, ou produz-se o que não
 * foi contratado.
 */

const camposVazios = (): ZapSignContratoCampos =>
  new Proxy({} as any, { get: (_, k) => (typeof k === 'string' ? '' : undefined) });

describe('o pote personalizado no contrato', () => {
  it('vai para o anexo em linha própria, separado da cor', () => {
    const campos = {
      ...camposVazios(),
      anexo_cor_pote: 'Âmbar',
      anexo_cor_tampa: 'Branca',
      anexo_pote_personalizado: POTE,
      anexo_tampa_personalizada: TAMPA,
    } as ZapSignContratoCampos;

    const subs = montarDadosZapSign(campos);
    const achar = (tag: string) => subs.find((s) => s.de === tag)?.para;

    expect(achar('{{ANEXO_POTE_PERSONALIZADO}}')).toBe(POTE);
    expect(achar('{{ANEXO_TAMPA_PERSONALIZADA}}')).toBe(TAMPA);
    // A cor continua sendo a cor: a descrição não a sequestra.
    expect(achar('{{ANEXO_COR_POTE}}')).toBe('Âmbar');
    expect(achar('{{ANEXO_COR_TAMPA}}')).toBe('Branca');
  });

  it('fica em branco quando o pote é de catálogo', () => {
    const subs = montarDadosZapSign({
      ...camposVazios(),
      anexo_cor_pote: 'Preto',
    } as ZapSignContratoCampos);
    expect(subs.find((s) => s.de === '{{ANEXO_POTE_PERSONALIZADO}}')?.para).toBe('');
  });
});

describe('o pote personalizado na ordem de produção', () => {
  const item = (detalhes: Record<string, string>, extras: Record<string, unknown> = {}) =>
    montarDadosPedidoCompra({
      snapshot: {
      nome_cliente: 'X',
      valor_total: 1,
      itens_producao: [
        {
          tipo: 'precificacao' as const,
          nome_produto: 'Produto',
          segmento: 'Encapsulados',
          tipo_produto: 'Encapsulados',
          preco_unitario: 10,
          quantidade: 100,
          subtotal: 1000,
          detalhes_producao: detalhes,
          ...extras,
        },
      ],
      },
    } as any);

  it('a fábrica recebe a descrição do pote, não um campo em branco', () => {
    // Sem isto, o contrato promete um pote âmbar de boca larga e a ordem de
    // compra manda montar o pote padrão.
    const d = item({ pote_personalizado: POTE, cor_pote: 'Âmbar' });
    expect(d.especificacoes[0].embalagem.pote_material).toBe(POTE);
    expect(d.especificacoes[0].embalagem.pote_cor).toBe('Âmbar');
  });

  it('a tampa personalizada vira o tipo da tampa', () => {
    const d = item({ tampa_personalizada: TAMPA, cor_tampa: 'Branca' });
    expect(d.especificacoes[0].embalagem.tampa_tipo).toBe(TAMPA);
    expect(d.especificacoes[0].embalagem.tampa_cor).toBe('Branca');
  });

  it('o material fechado no orçamento tem precedência sobre a descrição', () => {
    // Quando o orçamento já fechou um material, ele é o que foi precificado.
    // A descrição livre não pode sobrescrever o que entrou na conta.
    const d = item({ pote_personalizado: POTE }, { embalagem_pote_material: 'PEAD' });
    expect(d.especificacoes[0].embalagem.pote_material).toBe('PEAD');
  });

  it('pote de catálogo não inventa material', () => {
    const d = item({ cor_pote: 'Preto' });
    expect(d.especificacoes[0].embalagem.pote_material).toBe('');
    expect(d.especificacoes[0].embalagem.tampa_tipo).toBe('');
  });
});

describe('plano de marca fora da lista', () => {
  it('rótulo conhecido vai e volta sem se perder', () => {
    // A tela mostra "Branding", o registro guarda "branding". Sem a volta,
    // escolher na lista gravaria o rótulo e a tradução passaria a depender de
    // o texto bater letra por letra.
    expect(chavePlanoMarca('Branding')).toBe('branding');
    expect(rotuloPlanoMarca('branding')).toBe('Branding');
    expect(rotuloPlanoMarca(chavePlanoMarca('Premium'))).toBe('Premium');
  });

  it('plano personalizado vale pelo próprio texto', () => {
    // O risco concreto: `PLANO_MARCA_LABEL['Plano X']` é `undefined`, e o
    // Pedido de Compra sairia com a palavra "undefined" impressa numa linha
    // que o cliente assina.
    const escrito = 'Branding + social media, 6 meses';
    expect(chavePlanoMarca(escrito)).toBe(escrito);
    expect(rotuloPlanoMarca(escrito)).toBe(escrito);
    expect(rotuloPlanoMarca(escrito)).not.toContain('undefined');
  });

  it('vazio continua vazio, não vira "undefined"', () => {
    expect(rotuloPlanoMarca('')).toBe('');
    expect(rotuloPlanoMarca(null)).toBe('');
    expect(rotuloPlanoMarca(undefined)).toBe('');
    expect(chavePlanoMarca(undefined)).toBe('');
  });
});
