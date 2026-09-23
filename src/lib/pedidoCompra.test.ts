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
      linha_produto: 'white_label' as const,
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

/** Preenche as listas fechadas, que sao todas obrigatorias para baixar. */
const completarSelecoes = (dados: any) => ({
  ...dados,
  canal_formal: 'Grupo de WhatsApp',
  parcelas: (dados.parcelas.length ? dados.parcelas : [{ valor: 100 }]).map((p: any) => ({
    ...p,
    meio_pagamento: p.meio_pagamento || 'PIX',
    vencimento: p.vencimento || '2026-10-10',
    valor: p.valor || 100,
  })),
  especificacoes: dados.especificacoes.map((e: any) => ({
    ...e,
    quantidade_por_frasco: e.quantidade_por_frasco || '60 cápsulas',
    embalagem: {
      ...e.embalagem,
      pote_material: e.embalagem.pote_material || 'PET',
      pote_capacidade: e.embalagem.pote_capacidade || '250 mL',
      rotulo_quantidade: e.embalagem.rotulo_quantidade || '1000',
      silica: 'Sim',
      dosador: e.embalagem.dosador || 'Não',
      apresentacao: 'Encapsulado',
      capsula_tipo: 'Cápsula 0',
      capsula_cor: 'Laranja',
      pote_cor: 'Branco',
      tampa_tipo: 'Rosca',
      tampa_cor: 'Preto',
      rotulo_material: 'BOPP',
      rotulo_acabamento: 'Fosco',
      embalagem_secundaria: 'Não',
      fornecimento_embalagem: 'CONTRATADA' as const,
    },
  })),
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

  it('cobra toda lista de seleção não preenchida', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    const labels = listarCamposFaltantes(dados, '260922').map((f) => f.label);
    // As listas fechadas existem para padronizar; em branco o documento sai ambíguo.
    expect(labels).toContain('Cor da cápsula');
    expect(labels).toContain('Tipo de tampa');
    expect(labels).toContain('Acabamento do rótulo');
    expect(labels).toContain('Embalagem secundária');
  });

  it('não sobra nada quando o consultor completa', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    expect(listarCamposFaltantes(completarSelecoes(dados), '260922')).toEqual([]);
  });
});

/** Extrai o texto de todas as páginas do PDF gerado. */
function textoDoPdf(doc: any): string {
  const paginas: string[] = [];
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    const conteudo = doc.internal.pages[i] || [];
    paginas.push(Array.isArray(conteudo) ? conteudo.join(' ') : String(conteudo));
  }
  return paginas.join(' ');
}

describe('PDF baixado não sai com lacuna', () => {
  /** Preenchimento completo, como a tela exige para liberar o download. */
  const completo = () => {
    const base = completarSelecoes(
      montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null }),
    );
    return {
      ...base,
      endereco_entrega: base.endereco_entrega || 'Rua X, 1 - Centro - Cuiabá/MT',
      contato_local: base.contato_local || 'Maria - (65) 99999-8888',
    };
  };

  it('a tela considera o preenchimento completo', () => {
    expect(listarCamposFaltantes(completo(), '260922')).toEqual([]);
  });

  it('não resta marcador de campo vazio no documento', () => {
    const doc = gerarPedidoCompraPDF({
      numeroPedido: '400-01',
      numeroContrato: '2609',
      dados: completo() as any,
    });
    const texto = textoDoPdf(doc);
    // "________" e "____" sao os marcadores que o gerador usa para lacuna.
    expect(texto).not.toContain('________');
    expect(texto).not.toContain('__/__/____');
  });

  it('o documento traz a linha de cada produto', () => {
    const doc = gerarPedidoCompraPDF({
      numeroPedido: '400-01',
      numeroContrato: '2609',
      dados: completo() as any,
    });
    expect(textoDoPdf(doc)).toMatch(/White Label|Private Label/);
  });
});

describe('geração do PDF', () => {
  it('gera as 3 páginas do modelo v3 com conteúdo', () => {
    const dados = montarDadosPedidoCompra({ snapshot: snapshotExemplo as any, cliente: null });
    const doc = gerarPedidoCompraPDF({
      numeroPedido: '260922-4',
      numeroContrato: '260922',
      dados: completarSelecoes(dados),
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
