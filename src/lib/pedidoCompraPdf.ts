/**
 * Gera o PDF do Pedido de Compra Lemoncaps v3.
 *
 * Segue a estrutura do modelo em `docs/pedido-de-compra-modelo-v3.md`: seis
 * secoes numeradas, os textos fixos de aceite e o bloco de assinaturas. O que
 * o consultor nao preencheu sai como linha em branco, do mesmo jeito que o
 * documento original -- mas a tela impede chegar ate' aqui incompleto.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/lib/unitConversion';
import { LINHA_PRODUTO_CURTO } from '@/lib/linhaProduto';
import {
  CONTRATADA,
  PADROES_PEDIDO_COMPRA,
  PLANO_MARCA_LABEL,
  type DadosPedidoCompra,
} from '@/types/pedidoCompra';

const MARGEM = 15;
const VERDE: [number, number, number] = [222, 232, 210];

const brl = (v: number) => formatCurrency(v || 0);
const ou = (v: string | number | undefined | null, vazio = '________') => {
  const t = String(v ?? '').trim();
  return t || vazio;
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "18 de setembro de 2026" -- a data por extenso do bloco de assinatura. */
const dataPorExtenso = (iso: string): string => {
  const t = (iso || '').trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

const dataBr = (iso: string): string => {
  const t = (iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return ou(t, '__/__/____');
  const [a, m, d] = t.split('-');
  return `${d}/${m}/${a}`;
};

interface Opcoes {
  numeroPedido: string;
  numeroContrato: string;
  dados: DadosPedidoCompra;
}

export function gerarPedidoCompraPDF({ numeroPedido, numeroContrato, dados }: Opcoes): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const larguraUtil = doc.internal.pageSize.getWidth() - MARGEM * 2;
  let y = MARGEM;

  const tituloSecao = (texto: string) => {
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text(texto, MARGEM, y);
    y += 2;
  };

  /** Tabela de duas colunas: rotulo em negrito à esquerda, valor à direita. */
  const tabelaCampos = (linhas: [string, string][], cabecalho?: string) => {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGEM, right: MARGEM },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: [120, 120, 120] },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
      ...(cabecalho
        ? {
            head: [[{ content: cabecalho, colSpan: 2, styles: { halign: 'center' as const } }]],
            headStyles: { fillColor: VERDE, textColor: [0, 0, 0], fontStyle: 'bold' as const },
          }
        : {}),
      body: linhas,
    });
    y = (doc as any).lastAutoTable.finalY;
  };

  const paragrafo = (texto: string, tamanho = 9) => {
    doc.setFont('helvetica', 'normal').setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, larguraUtil);
    doc.text(linhas, MARGEM, y + 5);
    y += 5 + linhas.length * (tamanho * 0.42);
  };

  // Cabecalho
  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text(`PEDIDO DE COMPRA Nº ${ou(numeroPedido)}`, doc.internal.pageSize.getWidth() / 2, y, {
    align: 'center',
  });
  y += 6;
  doc.setFontSize(10);
  doc.text(
    `Vinculado ao Contrato de Fabricação de Produtos nº ${ou(numeroContrato)}`,
    doc.internal.pageSize.getWidth() / 2,
    y,
    { align: 'center' },
  );
  y += 4;
  doc.setDrawColor(180).line(MARGEM, y, MARGEM + larguraUtil, y);
  y += 2;

  // 1. Identificacao
  tabelaCampos(
    [
      ['CONTRATANTE', ou(dados.contratante)],
      ['CNPJ / CPF', ou(dados.cnpj_cpf)],
      ['Faturamento em', ou(dados.faturamento_em)],
      ['Data do pedido', dataBr(dados.data_pedido)],
      ['Canal formal', ou(dados.canal_formal)],
    ],
    'IDENTIFICAÇÃO',
  );

  // 2. Produtos
  tituloSecao('1. PRODUTOS');
  const totalProdutos = dados.produtos.reduce(
    (s, p) => s + (p.preco_unitario || 0) * (p.quantidade || 0),
    0,
  );
  autoTable(doc, {
    startY: y + 2,
    margin: { left: MARGEM, right: MARGEM },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [120, 120, 120] },
    headStyles: { fillColor: VERDE, textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    head: [['DESCRIÇÃO', 'LINHA', 'APRESENTAÇÃO', 'PREÇO UNIT.', 'QTD.', 'TOTAL']],
    columnStyles: {
      1: { cellWidth: 24 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    body: dados.produtos.map((p) => [
      ou(p.descricao),
      p.linha ? LINHA_PRODUTO_CURTO[p.linha] : '—',
      ou(p.apresentacao),
      brl(p.preco_unitario),
      String(p.quantidade ?? ''),
      brl((p.preco_unitario || 0) * (p.quantidade || 0)),
    ]),
    foot: [['VALOR TOTAL DO PEDIDO', '', '', '', '', brl(totalProdutos)]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 3. Condicoes comerciais
  tituloSecao('2. CONDIÇÕES COMERCIAIS');
  tabelaCampos([
    ['Plano de marca', PLANO_MARCA_LABEL[dados.plano_marca]],
    ['Entregáveis do plano', dados.entregaveis.length ? dados.entregaveis.join(' | ') : 'Não se aplica'],
    ['Etapas e valores', `setup/rótulo: ${brl(dados.valor_setup)}  |  produção: ${brl(dados.valor_producao)}`],
    [
      'Prazo do rótulo',
      `${dados.prazo_rotulo_primeira_versao} dias úteis para a 1ª versão | ${dados.prazo_rotulo_correcao} dias úteis por correção`,
    ],
    [
      'Prazo de produção',
      `${dados.prazo_producao_dias} dias corridos após aprovação da arte, até a disponibilização para expedição`,
    ],
    [
      'Prazo de entrega',
      `acrescido ao prazo de produção — até ${dados.prazo_entrega_dias} dias úteis após o pagamento do frete`,
    ],
    ['Quantidade', 'entrega integral, conforme tabela do item 1'],
    ['Entrada mínima', `${dados.entrada_minima_percentual}% do valor total — condição para início da produção`],
    ['Armazenagem', '90 dias corridos sem custo; após, 10% ao mês sobre o valor da nota'],
    ['Endereço de entrega', ou(dados.endereco_entrega)],
    ['Contato no local', ou(dados.contato_local)],
  ]);

  // 4. Condicoes de pagamento
  if (y > 220) {
    doc.addPage();
    y = MARGEM;
  }
  tituloSecao('3. CONDIÇÕES DE PAGAMENTO');
  const totalParcelas = dados.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: MARGEM, right: MARGEM },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, lineColor: [120, 120, 120] },
    headStyles: { fillColor: VERDE, textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    head: [['PARCELA', 'MEIO DE PAGAMENTO', 'VENCIMENTO', 'VALOR']],
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 3: { halign: 'right' } },
    body: dados.parcelas.map((p, i) => [
      String(i + 1),
      ou(p.meio_pagamento),
      dataBr(p.vencimento),
      brl(p.valor),
    ]),
    foot: [['TOTAL', '', '', brl(totalParcelas)]],
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
  });
  y = (doc as any).lastAutoTable.finalY;
  paragrafo(
    'O frete não está incluído no valor acima e será cobrado à parte, conforme valor praticado pela transportadora.',
    8,
  );

  // 5 e 6. Especificacao tecnica e embalagem, produto a produto. Cada um ganha
  // seu bloco: na fabrica, composicao solta sem dizer de qual produto e' erro.
  const especificacoes = dados.especificacoes || [];
  especificacoes.forEach((esp, i) => {
    if (y > 190) {
      doc.addPage();
      y = MARGEM;
    }
    const rotulo = especificacoes.length > 1
      ? `${i + 1}. ${ou(esp.produto_nome, 'Produto')}`
      : ou(esp.produto_nome, 'Produto');

    tituloSecao(`4.${i + 1} ESPECIFICAÇÃO TÉCNICA — ${rotulo.toUpperCase()}`);
    paragrafo(
      `Produto: ${ou(esp.produto_nome)}  |  Quantidade por frasco: ${ou(esp.quantidade_por_frasco, '____')}`,
    );

    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGEM, right: MARGEM },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: [120, 120, 120] },
      headStyles: { fillColor: VERDE, textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [['INSUMO', 'DOSE DIÁRIA']],
      columnStyles: { 1: { cellWidth: 55 } },
      body: (esp.composicao || []).length
        ? esp.composicao.map((a) => [ou(a.insumo), ou(a.dose, '____')])
        : [['________', '________']],
    });
    y = (doc as any).lastAutoTable.finalY;

    const emb = esp.embalagem || ({} as typeof esp.embalagem);
    tituloSecao(`5.${i + 1} DESCRIÇÃO DA EMBALAGEM — ${rotulo.toUpperCase()}`);
    tabelaCampos([
      ['Apresentação', ou(emb.apresentacao)],
      ['Cápsula / comprimido', `tipo ${ou(emb.capsula_tipo, '____')} | cor ${ou(emb.capsula_cor, '____')}`],
      [
        'Pote / frasco',
        `material ${ou(emb.pote_material, '____')} | capacidade ${ou(emb.pote_capacidade, '____')} | cor ${ou(emb.pote_cor, '____')}`,
      ],
      [
        'Tampa',
        `tipo ${ou(emb.tampa_tipo, '____')} | cor ${ou(emb.tampa_cor, '____')} | lacre de indução: ${emb.lacre_inducao ? 'sim' : 'não'}`,
      ],
      ['Dosador / acessório', ou(emb.dosador, 'não')],
      [
        'Rótulo',
        `material ${ou(emb.rotulo_material, '____')} | acabamento ${ou(emb.rotulo_acabamento, '____')} | quantidade ${ou(emb.rotulo_quantidade, '____')}`,
      ],
      ['Embalagem secundária', ou(emb.embalagem_secundaria, 'Não')],
      ['Fornecimento da embalagem', `por conta de ${ou(emb.fornecimento_embalagem)}`],
    ]);
  });

  paragrafo(
    'A CONTRATANTE declara ter conferido e aprovado a composição, a dosagem e as especificações de embalagem acima, que constituem a base da produção contratada.',
  );

  // 7. Declaracoes e aceite -- texto fixo do modelo v3
  doc.addPage();
  y = MARGEM;
  tituloSecao('6. DECLARAÇÕES E ACEITE');
  [
    '6.1 Este Pedido de Compra integra e adere ao Contrato de Fabricação de Produtos celebrado entre as partes, sujeitando-se integralmente às suas cláusulas, que a CONTRATANTE declara conhecer e ratificar.',
    '6.2 Havendo divergência, prevalece este Pedido quanto a produto, quantidade, preço, prazo e condições de pagamento, e prevalece o Contrato de Fabricação de Produtos quanto a todas as demais matérias.',
    '6.3 Constitui aceite integral deste Pedido, indistintamente: a sua assinatura, a confirmação por escrito no canal formal de comunicação ou o pagamento, total ou parcial, de qualquer valor nele previsto.',
    '6.4 A CONTRATANTE declara ciência das cláusulas do Contrato de Fabricação de Produtos que limitam ou condicionam direitos, em especial as relativas a aceite tácito, vedação de chargeback, reserva de domínio e limitação de responsabilidade.',
    '6.5 As partes assinam o presente Pedido de Compra por meio de assinatura eletrônica, reconhecendo sua validade e eficácia nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020. Este Pedido, em conjunto com o Contrato de Fabricação de Produtos, constitui título executivo extrajudicial, nos termos do artigo 784, inciso III e §4º, do Código de Processo Civil.',
  ].forEach((p) => paragrafo(p));

  y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  // O modelo v3 deixava a data em branco para preencher a mao; com assinatura
  // eletronica isso so' vira lacuna no documento que vai ao financeiro.
  doc.text(
    `${PADROES_PEDIDO_COMPRA.local_assinatura}, ${dataPorExtenso(dados.data_pedido)}.`,
    doc.internal.pageSize.getWidth() / 2,
    y,
    { align: 'center' },
  );

  // Assinaturas empilhadas, uma abaixo da outra.
  //
  // Lado a lado sobrava meia largura para cada uma, e assinatura eletronica --
  // GOV.br, ZapSign -- carimba um bloco largo que nao cabe nessa metade. Em
  // pilha cada parte tem a largura inteira e uma faixa livre acima da linha.
  const ESPACO_ASSINATURA = 26; // mm livres para o carimbo ou a assinatura
  const larguraLinha = Math.min(larguraUtil, 120);
  const meio = doc.internal.pageSize.getWidth() / 2;

  const blocoAssinatura = (linhas: string[]) => {
    // Cada bloco precisa de espaco livre + linha + identificacao.
    if (y + ESPACO_ASSINATURA + 24 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = MARGEM;
    }
    y += ESPACO_ASSINATURA;
    doc.setDrawColor(60);
    doc.line(meio - larguraLinha / 2, y, meio + larguraLinha / 2, y);
    y += 5;
    doc.setFontSize(9);
    linhas.forEach((linha, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.splitTextToSize(linha, larguraUtil - 20).forEach((l: string) => {
        doc.text(l, meio, y, { align: 'center' });
        y += 4.2;
      });
    });
    y += 4;
  };

  y += 6;
  blocoAssinatura([
    dados.contratante || '[RAZÃO SOCIAL / NOME DA CONTRATANTE]',
    `CNPJ/CPF nº ${ou(dados.cnpj_cpf)}`,
    ou(dados.representante_nome, '[NOME DO REPRESENTANTE LEGAL]'),
    `CPF nº ${ou(dados.representante_cpf)}`,
    'CONTRATANTE',
  ]);
  blocoAssinatura([
    CONTRATADA.razao_social,
    `CNPJ nº ${CONTRATADA.cnpj}`,
    CONTRATADA.representante,
    `CPF nº ${CONTRATADA.representante_cpf}`,
    'CONTRATADA',
  ]);

  // Rodape em todas as paginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120);
    doc.text(
      `Pedido de Compra Lemoncaps v3 — página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
    doc.setTextColor(0);
  }

  return doc;
}

export function baixarPedidoCompraPDF(opcoes: Opcoes) {
  const doc = gerarPedidoCompraPDF(opcoes);
  doc.save(`Pedido-de-Compra-${opcoes.numeroPedido || 'sem-numero'}.pdf`);
}
