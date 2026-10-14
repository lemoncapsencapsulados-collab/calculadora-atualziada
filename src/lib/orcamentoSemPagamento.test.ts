import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * O orçamento do cliente não fala de pagamento.
 *
 * Nessa etapa o produtor está decidindo O QUE produzir: fórmulas, quantidades,
 * setup de marca, preços de produção e serviço, e o investimento total.
 * Parcelamento, percentual de entrada e meio de pagamento são a negociação
 * seguinte -- aparecem no Pedido de Compra e no Projeto para Contrato.
 *
 * O teste lê a fonte em vez de gerar o PDF porque jsPDF precisa de canvas, que
 * não existe no ambiente de teste. O que importa aqui não é o desenho: é a
 * regra de quem chama com qual opção, e isso está no texto.
 */

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), 'utf8');

describe('as seções de pagamento são opcionais', () => {
  const gerador = () => ler('./orcamentoGenerator.ts');

  it('só entram quando a opção pede', () => {
    // Antes as duas eram chamadas direto, sem condição nenhuma -- todo
    // orçamento saía com as parcelas, inclusive o do cliente.
    const src = gerador();
    expect(src).toMatch(/if \(options\.incluirCondicoesPagamento\) \{/);
  });

  it('nenhuma das duas é chamada fora da condição', () => {
    const src = gerador();
    // `yPos = ` na frente para contar CHAMADAS, não a declaração da função.
    for (const nome of ['renderCondicoesPagamento', 'renderFormaPagamento']) {
      const chamada = `yPos = ${nome}(doc`;
      const vezes = src.split(chamada).length - 1;
      // Uma chamada só, e dentro do `if`. Duas significaria que alguém
      // restaurou a chamada incondicional ao lado da condicional.
      expect(vezes, `${nome} é chamada ${vezes}x`).toBe(1);
    }
  });

  it('o padrão é não mostrar', () => {
    // `incluirCondicoesPagamento?: boolean` sem valor padrão: quem esquecer de
    // passar gera o documento seguro, não o que vaza condição comercial.
    expect(gerador()).toMatch(/incluirCondicoesPagamento\?: boolean;/);
  });
});

describe('quem pede cada versão', () => {
  it('o Projeto para Contrato pede as condições', () => {
    const src = ler('../components/PropostaCompletaDialog.tsx');
    expect(src).toContain('incluirCondicoesPagamento: true');
  });

  it('o orçamento do cliente não pede nada disso', () => {
    // `PreviewPdfDialog` é a tela de "Orçamento Gerado", a que o produtor
    // recebe. Se um dia alguém passar a opção aqui, o teste cai.
    const src = ler('../components/PreviewPdfDialog.tsx');
    expect(src).not.toContain('incluirCondicoesPagamento');
    expect(src).not.toContain('incluirIntermediador');
  });
});

describe('prazo de entrega do Pedido de Compra', () => {
  const pdf = () => ler('./pedidoCompraPdf.ts');

  it('é só o da transportadora', () => {
    expect(pdf()).toContain("['Prazo de entrega', 'conforme a transportadora escolhida']");
  });

  it('não soma o prazo de produção nem espera o pagamento do frete', () => {
    // As duas condições extras faziam o produtor ler um prazo maior do que o
    // que ele contratou com a transportadora.
    const src = pdf();
    expect(src).not.toContain('acrescido ao prazo de produção');
    expect(src).not.toContain('após o pagamento do frete');
  });
});
