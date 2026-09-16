import { describe, expect, it } from 'vitest';
import { montarDadosPedidoCompra } from './pedidoCompraAutoFill';
import { gerarPedidoCompraPDF } from './pedidoCompraPdf';
import { compararPorSequencial, montarNumeroPedido, parseNumeroPedido } from './numeroPedido';
import { listarCamposFaltantes } from '@/types/pedidoCompra';

/** Snapshot parecido com o que um orcamento aprovado grava no pedido. */
const snapshotExemplo = {
  nome_cliente: 'Produtora Teste',
  subtotal_producao: 12000,
  subtotal_servicos: 3000,
  valor_total: 15000,
  condicoes_pagamento: { metodo_principal: 'pix_boleto' },
  dados_cliente: {
    tipo_pessoa: 'pj' as const,
    razao_social: 'PRODUTORA TESTE LTDA',
    cnpj: '11.222.333/0001-44',
    endereco_cnpj: 'Rua das Flores',
    numero_cnpj: '100',
    bairro_cnpj: 'Centro',
    cep_cnpj: '78000-000',
    cidade: 'Cuiabá',
    estado: 'MT',
    telefone: '65999998888',
    responsavel_pj: { nome: 'Maria Souza', cpf: '123.456.789-00' },
  },
  itens_producao: [
    {
      tipo: 'precificacao' as const,
      nome_produto: 'Colágeno Verisol',
      segmento: 'Encapsulados',
      tipo_produto: 'Encapsulados',
      preco_unitario: 24,
      quantidade: 500,
      subtotal: 12000,
      quantidade_por_pote: 60,
      unidade_por_pote: 'cápsulas',
      dose_diaria_sugerida: '2 cápsulas',
      insumos_formula: [
        { nome: 'Colágeno', quantidade: 500, unidade: 'mg' },
        { nome: 'Amido de milho', quantidade: 100, unidade: 'mg' },
      ],
      detalhes_producao: { cor_pote: 'Branco', cor_tampa: 'Preta' },
    },
  ],
  servicos_marca: [
    {
      nome_plano: 'Plano Branding',
      valor: 3000,
      entregaveis: [
        { nome: 'Ficha técnica', incluso: true, quantidade: 1 },
        { nome: 'Logo', incluso: true, quantidade: 1 },
        { nome: 'Impressão', incluso: false, quantidade: 0 },
      ],
    },
  ],
};

describe('numeração do pedido de compra', () => {
  it('separa contrato e sequencial do formato definitivo', () => {
    expect(parseNumeroPedido('260922-4')).toEqual({
      numeroContrato: '260922',
      sequencial: 4,
      completo: true,
    });
  });

  it('trata o formato antigo como incompleto, mas ainda ordenável', () => {
    const r = parseNumeroPedido('PED-001');
    expect(r.completo).toBe(false);
    expect(r.numeroContrato).toBeNull();
    expect(r.sequencial).toBe(1);
  });

  it('ordena pelo sequencial como número, não como texto', () => {
    const numeros = ['260922-11', '260922-2', '260922-1'];
    expect([...numeros].sort(compararPorSequencial)).toEqual([
      '260922-1',
      '260922-2',
      '260922-11',
    ]);
  });

  it('joga para o fim quem não tem número legível', () => {
    expect([...['ABC', '260922-1']].sort(compararPorSequencial)).toEqual(['260922-1', 'ABC']);
  });

  it('monta o próximo número a partir da contagem do CNPJ', () => {
    // O exemplo do documento: contrato 260922, produtor com 3 pedidos -> -4.
    expect(montarNumeroPedido('260922', 3)).toBe('260922-4');
  });
});

describe('preenchimento automático', () => {
  const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });

  it('puxa contratante, documento e representante do cadastro', () => {
    expect(dados.contratante).toBe('PRODUTORA TESTE LTDA');
    expect(dados.cnpj_cpf).toBe('11.222.333/0001-44');
    expect(dados.representante_nome).toBe('Maria Souza');
    expect(dados.representante_cpf).toBe('123.456.789-00');
  });

  it('monta o endereço a partir dos campos fiscais', () => {
    expect(dados.endereco_entrega).toContain('Rua das Flores, 100');
    expect(dados.endereco_entrega).toContain('Cuiabá/MT');
    expect(dados.endereco_entrega).toContain('CEP 78000-000');
  });

  it('traz os produtos com apresentação e preço', () => {
    expect(dados.produtos).toHaveLength(1);
    expect(dados.produtos[0]).toMatchObject({
      descricao: 'Colágeno Verisol',
      apresentacao: 'Encapsulados - 60 cápsulas',
      preco_unitario: 24,
      quantidade: 500,
    });
  });

  it('deduz o plano e lista só os entregáveis inclusos', () => {
    expect(dados.plano_marca).toBe('branding');
    expect(dados.entregaveis).toEqual(['Ficha técnica', 'Logo']);
  });

  it('separa setup de produção', () => {
    expect(dados.valor_setup).toBe(3000);
    expect(dados.valor_producao).toBe(12000);
  });

  it('gera uma especificação por produto', () => {
    expect(dados.especificacoes).toHaveLength(1);
    expect(dados.especificacoes[0].produto_nome).toBe('Colágeno Verisol');
  });

  it('descreve a composição em linhas de insumo e dose', () => {
    // A quantidade sai como está na fórmula — já é por dose.
    expect(dados.especificacoes[0].composicao).toEqual([
      { insumo: 'Colágeno', dose: '500 mg' },
      { insumo: 'Amido de milho', dose: '100 mg' },
    ]);
  });

  it('sugere o dobro de potes na quantidade de rótulo', () => {
    expect(dados.especificacoes[0].embalagem.rotulo_quantidade).toBe('1000');
  });

  it('deixa o canal formal vazio, porque não existe no cadastro', () => {
    expect(dados.canal_formal).toBe('');
  });

  it('aplica os padrões impressos no documento v3', () => {
    expect(dados.prazo_producao_dias).toBe(40);
    expect(dados.entrada_minima_percentual).toBe(45);
  });
});

describe('cobrança do que falta', () => {
  it('cobra o número do contrato e o canal formal de um preenchimento cru', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    const faltantes = listarCamposFaltantes(dados, '');
    const campos = faltantes.map((f) => f.campo);
    expect(campos).toContain('numero_contrato');
    expect(campos).toContain('canal_formal');
    // Fornecimento da embalagem nunca vem do orçamento: sempre é perguntado.
    expect(campos).toContain('especificacoes');
  });

  it('não sobra nada quando o consultor completa', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    const completo = {
      ...dados,
      canal_formal: 'Grupo de WhatsApp',
      especificacoes: dados.especificacoes.map((e) => ({
        ...e,
        embalagem: { ...e.embalagem, fornecimento_embalagem: 'CONTRATADA' as const },
      })),
    };
    expect(listarCamposFaltantes(completo, '260922')).toEqual([]);
  });
});

describe('geração do PDF', () => {
  it('gera as 3 páginas do modelo v3 com conteúdo', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    const doc = gerarPedidoCompraPDF({
      numeroPedido: '260922-4',
      numeroContrato: '260922',
      dados: {
        ...dados,
        canal_formal: 'Grupo de WhatsApp',
        especificacoes: dados.especificacoes.map((e) => ({
          ...e,
          embalagem: { ...e.embalagem, fornecimento_embalagem: 'CONTRATADA' as const },
        })),
      },
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });

  it('gera mesmo com um orçamento quase vazio, sem estourar', () => {
    const dados = montarDadosPedidoCompra({ snapshot: {} as any, cliente: null });
    const doc = gerarPedidoCompraPDF({ numeroPedido: '', numeroContrato: '', dados });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
