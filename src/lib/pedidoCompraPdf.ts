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
import { nomeArquivoDocumento } from '@/lib/nomeArquivo';
import { LIMAO_DATA_URL } from '@/assets/limaoPdf';
import {
  camposDaApresentacao,
  type CampoEmbalagem,
  CONTRATADA,
  PADROES_PEDIDO_COMPRA,
  rotuloPlanoMarca,
  type DadosPedidoCompra,
} from '@/types/pedidoCompra';

/**
 * Margem de 2 cm em todos os lados, como o juridico pede para revisar no Word.
 */
const MARGEM = 20;

/**
 * Faixa no pe' da pagina que fica VAZIA de proposito.
 *
 * O ZapSign carimba o codigo de seguranca (hash) ai' quando a assinatura e'
 * concluida. Se houver texto nosso embaixo, o hash cai por cima dele e o
 * documento assinado sai com as duas coisas ilegiveis.
 */
const RODAPE_LIVRE = 20;

/** Entrelinha de 1,15, o minimo que o juridico pede para revisar. */
const ENTRELINHA = 1.15;

/** Corpo de texto em 11 pt. */
const CORPO = 11;

/**
 * Tabela em 10 pt. Uma tabela de seis colunas em 11 pt nao cabe nos 17 cm que
 * sobram entre as margens de 2 cm -- as colunas de preco quebram no meio do
 * numero. O texto corrido, que e' o que o juridico le', fica em 11.
 */
const TABELA = 10;

/**
 * Paleta tirada do modelo impresso do Pedido de Compra, pixel a pixel -- nao
 * escolhida de novo. Mudar um destes valores desalinha o documento do modelo
 * que o cliente ja' recebeu.
 */
/** Barra de cabecalho de tabela e regua do titulo. */
export const VERDE_VIVO: [number, number, number] = [124, 181, 24]; // #7CB518
/** Titulo do documento e titulos de secao. */
export const VERDE_ESCURO: [number, number, number] = [78, 122, 14]; // #4E7A0E
/** Zebra das linhas e coluna de rotulo. */
export const VERDE_CLARO: [number, number, number] = [241, 247, 226]; // #F1F7E2
const CINZA_RODAPE: [number, number, number] = [128, 128, 128];
const PRETO: [number, number, number] = [0, 0, 0];
const BRANCO: [number, number, number] = [255, 255, 255];

/**
 * Serifada, como o modelo. jsPDF traz Times embutida, entao nao ha' fonte para
 * carregar nem risco de o documento sair com outra letra em outra maquina.
 */
export const FONTE = 'times';

/** Altura do limao no cabecalho, em mm. */
const LOGO_MM = 14;

/**
 * Faixa livre MINIMA acima de cada linha de assinatura, em mm.
 *
 * E' onde o carimbo do ZapSign pousa. O selo nao encolhe, entao faixa curta faz
 * o carimbo cobrir a linha e o nome de quem assinou.
 *
 * O minimo e' modesto de proposito: o ZapSign posiciona o bloco por clique na
 * tela dele ou por texto ancora, nao pelo espaco em branco do arquivo. Faixa
 * generosa demais custava uma pagina inteira so' de assinatura, depois de outra
 * com metade vazia. A faixa cresce ate' o teto quando a pagina permite.
 */
export const ESPACO_ASSINATURA_MIN = 26;

/** Teto da faixa: acima disto a assinatura parece solta no meio do vazio. */
export const ESPACO_ASSINATURA_MAX = 45;

/** Linha + as cinco linhas de identificacao abaixo dela, em mm. */
const ALTURA_IDENTIFICACAO = 30;

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

/**
 * Numero por extenso, para o documento repetir o valor como contrato faz:
 * "60 (sessenta) dias". So' cobre inteiros ate' 999 -- e' o que aparece aqui
 * (prazos em dias e percentuais); fora disso devolve o proprio numero.
 */
const UNIDADES_EXT = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS_EXT = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa',
];
const CENTENAS_EXT = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

export function porExtenso(valor: number): string {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < 0 || n > 999) return String(valor);
  if (n === 0) return 'zero';
  if (n === 100) return 'cem';
  if (n < 20) return UNIDADES_EXT[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS_EXT[d]} e ${UNIDADES_EXT[u]}` : DEZENAS_EXT[d];
  }
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto ? `${CENTENAS_EXT[c]} e ${porExtenso(resto)}` : CENTENAS_EXT[c];
}

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
  doc.setLineHeightFactor(ENTRELINHA);
  const larguraUtil = doc.internal.pageSize.getWidth() - MARGEM * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  /** Onde o conteudo tem que parar para nao invadir a faixa do hash. */
  const limiteConteudo = alturaPagina - RODAPE_LIVRE - 6;
  let y = MARGEM;

  /** Topo do texto nas paginas seguintes: abaixo do limao do cabecalho. */
  const TOPO_PAGINA = MARGEM + LOGO_MM - 2;
  const novaPagina = () => {
    doc.addPage();
    y = TOPO_PAGINA;
  };

  const tituloSecao = (texto: string) => {
    y += 7;
    doc.setFont(FONTE, 'bold').setFontSize(12).setTextColor(...VERDE_ESCURO);
    doc.text(texto, MARGEM, y);
    doc.setTextColor(...PRETO);
    y += 2;
  };

  /** Subtitulo dentro de uma secao, como "1. Creatina Monohidratada". */
  const subtitulo = (texto: string) => {
    y += 6;
    doc.setFont(FONTE, 'bold').setFontSize(10).setTextColor(...VERDE_ESCURO);
    doc.text(texto, MARGEM, y);
    doc.setTextColor(...PRETO);
    y += 1;
  };

  /**
   * Tabela de duas colunas: rotulo a' esquerda, valor a' direita.
   *
   * No modelo a coluna do rotulo e' tingida em TODAS as linhas -- e' o que
   * separa pergunta de resposta sem precisar de regua grossa no meio.
   */
  const tabelaCampos = (linhas: [string, string][], cabecalho?: string) => {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGEM, right: MARGEM, top: TOPO_PAGINA, bottom: RODAPE_LIVRE + 6 },
      theme: 'grid',
      // Linha inteira passa para a pagina seguinte em vez de partir no meio.
      // Uma condicao comercial cortada em "ja' acrescidas ao valor das" /
      // "parcelas" e' o tipo de coisa que vira discussao depois de assinado.
      rowPageBreak: 'avoid',
      styles: { font: FONTE, fontSize: TABELA, cellPadding: 2.2, lineColor: [170, 170, 170], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold', fillColor: VERDE_CLARO },
      },
      ...(cabecalho
        ? {
            head: [[{ content: cabecalho, colSpan: 2, styles: { halign: 'center' as const } }]],
            headStyles: {
              font: FONTE,
              fillColor: VERDE_VIVO,
              textColor: BRANCO,
              fontStyle: 'bold' as const,
              fontSize: 10.5,
            },
          }
        : {}),
      body: linhas,
    });
    y = (doc as any).lastAutoTable.finalY;
  };

  /** Estilos comuns das tabelas de dados, com zebra como no modelo. */
  const estiloTabela = {
    rowPageBreak: 'avoid' as const,
    styles: { font: FONTE, fontSize: TABELA, cellPadding: 2.2, lineColor: [170, 170, 170] as [number, number, number], lineWidth: 0.1 },
    headStyles: {
      font: FONTE,
      fillColor: VERDE_VIVO,
      textColor: BRANCO,
      fontStyle: 'bold' as const,
      halign: 'center' as const,
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: VERDE_CLARO },
    footStyles: {
      font: FONTE,
      fillColor: BRANCO,
      textColor: PRETO,
      fontStyle: 'bold' as const,
      lineColor: [170, 170, 170] as [number, number, number],
      lineWidth: 0.1,
    },
  };

  const paragrafo = (texto: string, tamanho = CORPO) => {
    doc.setFont(FONTE, 'normal').setFontSize(tamanho).setTextColor(...PRETO);
    const linhas = doc.splitTextToSize(texto, larguraUtil);
    // Justificado, como o modelo; o jsPDF so' justifica com largura declarada.
    doc.text(linhas, MARGEM, y + 5, { maxWidth: larguraUtil, align: 'justify' });
    // Altura de linha real do jsPDF (pt -> mm) com a entrelinha configurada.
    y += 5 + linhas.length * ((tamanho * ENTRELINHA) / 72) * 25.4;
  };

  // Cabecalho: limao a' esquerda, titulo centrado, regua verde embaixo.
  const meioPagina = doc.internal.pageSize.getWidth() / 2;
  doc.addImage(LIMAO_DATA_URL, 'PNG', MARGEM, y - 3, LOGO_MM, LOGO_MM);

  y += 7;
  doc.setFont(FONTE, 'bold').setFontSize(15).setTextColor(...VERDE_ESCURO);
  doc.text(`PEDIDO DE COMPRA Nº ${ou(numeroPedido)}`, meioPagina, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11).setTextColor(...PRETO);
  doc.text(
    `Vinculado ao Contrato de Fabricação de Produtos nº ${ou(numeroContrato)}`,
    meioPagina,
    y,
    { align: 'center' },
  );
  y += 6;
  doc.setDrawColor(...VERDE_VIVO).setLineWidth(0.7);
  doc.line(MARGEM, y, MARGEM + larguraUtil, y);
  doc.setLineWidth(0.2);
  y += 3;

  // 1. Identificacao
  // O modelo identifica as duas partes por representante E razao social, e o
  // documento fiscal traz CPF e CNPJ na mesma linha: quem assina e quem fatura
  // podem ser pessoas diferentes, e o financeiro precisa dos dois.
  const contratanteCompleto = [ou(dados.representante_nome, ''), ou(dados.contratante, '')]
    .filter(Boolean)
    .join(' / ') || '________';
  const documentos = [ou(dados.representante_cpf, ''), ou(dados.cnpj_cpf, '')]
    .filter(Boolean)
    .join(' / ') || '________';

  tabelaCampos(
    [
      ['CONTRATADA', `${CONTRATADA.razao_social} — CNPJ ${CONTRATADA.cnpj}`],
      ['CONTRATANTE', contratanteCompleto],
      ['CPF / CNPJ', documentos],
      ['Marca', ou(dados.marca)],
      ['Faturamento em', ou(dados.faturamento_em)],
      ['E-mail', ou(dados.email)],
      ['Data do pedido', dataPorExtenso(dados.data_pedido)],
      ['Canal formal', ou(dados.canal_formal)],
      ['Consultor responsável', ou(dados.consultor_responsavel)],
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
    margin: { left: MARGEM, right: MARGEM, top: TOPO_PAGINA, bottom: RODAPE_LIVRE + 6 },
    theme: 'grid',
    ...estiloTabela,
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
    foot: [[
      { content: 'VALOR TOTAL DO PEDIDO', colSpan: 5, styles: { halign: 'left' as const } },
      brl(totalProdutos),
    ]],
  });
  y = (doc as any).lastAutoTable.finalY;

  // 3. Condicoes comerciais
  tituloSecao('2. CONDIÇÕES COMERCIAIS');
  tabelaCampos([
    ['Plano de marca', rotuloPlanoMarca(dados.plano_marca)],
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
    ['Frete', 'opção escolhida pela CONTRATANTE entre as cotações apresentadas'],
    [
      'Prazo de entrega',
      `conforme a transportadora escolhida — acrescido ao prazo de produção, até ${dados.prazo_entrega_dias} dias úteis após o pagamento do frete`,
    ],
    ['Quantidade', 'entrega integral, conforme tabela do item 1'],
    ['Entrada mínima', `${dados.entrada_minima_percentual}% do valor total — condição para início da produção`],
    [
      'Taxa do meio de pagamento',
      'taxas do meio de pagamento escolhido pela CONTRATANTE, já acrescidas ao valor das parcelas',
    ],
    ['Armazenagem', '90 dias corridos sem custo; após, 10% ao mês sobre o valor da nota'],
    ['Endereço de entrega', ou(dados.endereco_entrega)],
    ['Contato no local', ou(dados.contato_local)],
  ]);

  paragrafo(
    `Condições específicas deste Pedido. O prazo de produção de ${dados.prazo_producao_dias} ` +
      `(${porExtenso(dados.prazo_producao_dias)}) dias corridos e a entrada mínima de ` +
      `${dados.entrada_minima_percentual}% (${porExtenso(dados.entrada_minima_percentual)} por cento) ` +
      'prevalecem, para este Pedido, sobre os prazos e percentuais gerais do Contrato de Fabricação ' +
      'de Produtos, na forma de sua Cláusula 2.4.',
  );

  // 4. Condicoes de pagamento
  if (y > 220) {
    novaPagina();
  }
  tituloSecao('3. CONDIÇÕES DE PAGAMENTO');
  const totalParcelas = dados.parcelas.reduce((s, p) => s + (p.valor || 0), 0);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: MARGEM, right: MARGEM, top: TOPO_PAGINA, bottom: RODAPE_LIVRE + 6 },
    theme: 'grid',
    ...estiloTabela,
    head: [['PARCELA', 'MEIO DE PAGAMENTO', 'VENCIMENTO', 'VALOR']],
    columnStyles: {
      0: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
    },
    body: dados.parcelas.map((p, i) => {
      const percentual =
        i === 0 && totalParcelas > 0 ? ((p.valor || 0) / totalParcelas) * 100 : null;
      return [
        percentual != null
          ? `1 — Entrada (${percentual.toFixed(2).replace('.', ',')}%)`
          : String(i + 1),
        ou(p.meio_pagamento),
        dataBr(p.vencimento),
        brl(p.valor),
      ];
    }),
    foot: [[
      { content: 'TOTAL', colSpan: 3, styles: { halign: 'left' as const } },
      brl(totalParcelas),
    ]],
  });
  y = (doc as any).lastAutoTable.finalY;
  paragrafo(
    'O frete e a taxa de manuseio não estão incluídos no valor acima e serão cobrados à parte, ' +
      'conforme a opção de transporte escolhida pela CONTRATANTE.',
  );

  // 5 e 6. Especificacao tecnica e embalagem, produto a produto. Cada um ganha
  // seu bloco: na fabrica, composicao solta sem dizer de qual produto e' erro.
  const especificacoes = dados.especificacoes || [];

  tituloSecao('4. ESPECIFICAÇÃO TÉCNICA DAS FORMULAÇÕES');
  especificacoes.forEach((esp, i) => {
    if (y > 200) {
      novaPagina();
    }
    subtitulo(`${i + 1}. ${ou(esp.produto_nome, 'Produto')}`);
    paragrafo(
      [
        `Pote / frasco: ${ou(esp.quantidade_por_frasco, '____')}`,
        esp.dose_diaria ? `Dose: ${esp.dose_diaria}` : '',
      ]
        .filter(Boolean)
        .join('  |  '),
    );

    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGEM, right: MARGEM, top: TOPO_PAGINA, bottom: RODAPE_LIVRE + 6 },
      theme: 'grid',
      ...estiloTabela,
      head: [['INSUMO', 'DOSE DIÁRIA']],
      columnStyles: { 1: { cellWidth: 55 } },
      body: (esp.composicao || []).length
        ? esp.composicao.map((a) => [ou(a.insumo), ou(a.dose, '____')])
        : [['________', '________']],
    });
    y = (doc as any).lastAutoTable.finalY;
  });

  if (y > 200) {
    novaPagina();
  }
  tituloSecao('5. DESCRIÇÃO DAS EMBALAGENS');
  especificacoes.forEach((esp, i) => {
    if (y > 205) {
      novaPagina();
    }
    const emb = esp.embalagem || ({} as typeof esp.embalagem);
    subtitulo(`${i + 1}. ${ou(esp.produto_nome, 'Produto')}`);
    // So' as linhas que aquela apresentacao usa: um liquido nao tem capsula, e
    // imprimir a linha vazia so' confunde quem produz.
    const usados = camposDaApresentacao(emb.apresentacao);
    const usa = (c: CampoEmbalagem) => usados.includes(c);
    const linhasEmbalagem: [string, string][] = [['Apresentação', ou(emb.apresentacao)]];
    if (usa('capsula_tipo')) {
      linhasEmbalagem.push([
        'Cápsula / comprimido',
        `tipo ${ou(emb.capsula_tipo, '____')} | cor ${ou(emb.capsula_cor, '____')}`,
      ]);
    }
    if (usa('bulbo')) {
      linhasEmbalagem.push(['Bulbo', ou(emb.bulbo, '____')]);
      linhasEmbalagem.push(['Cânula', ou(emb.canula, '____')]);
    }
    linhasEmbalagem.push([
      'Pote / frasco',
      `material ${ou(emb.pote_material, '____')} | capacidade ${ou(emb.pote_capacidade, '____')} | cor ${ou(emb.pote_cor, '____')}`,
    ]);
    linhasEmbalagem.push([
      'Tampa',
      `tipo ${ou(emb.tampa_tipo, '____')} | cor ${ou(emb.tampa_cor, '____')}${
        usa('lacre_inducao') ? ` | lacre de indução: ${emb.lacre_inducao ? 'sim' : 'não'}` : ''
      }`,
    ]);
    if (usa('silica')) linhasEmbalagem.push(['Sílica', ou(emb.silica, 'Não')]);
    if (usa('dosador')) linhasEmbalagem.push(['Dosador / acessório', ou(emb.dosador, 'Não')]);
    linhasEmbalagem.push([
      'Rótulo',
      `material ${ou(emb.rotulo_material, '____')} | acabamento ${ou(emb.rotulo_acabamento, '____')} | quantidade ${ou(emb.rotulo_quantidade, '____')}`,
    ]);
    linhasEmbalagem.push(['Embalagem secundária', ou(emb.embalagem_secundaria, 'Não')]);
    linhasEmbalagem.push(['Fornecimento da embalagem', `por conta de ${ou(emb.fornecimento_embalagem)}`]);
    tabelaCampos(linhasEmbalagem);
  });

  paragrafo(
    'A CONTRATANTE declara ter conferido e aprovado a composição, a dosagem e as especificações de embalagem acima, que constituem a base da produção contratada.',
  );

  // 7. Declaracoes e aceite -- texto fixo do modelo v3.
  //
  // Sem quebra forcada: o texto do aceite mais as duas assinaturas ocupam pouco
  // mais de meia pagina, e forcar pagina nova deixava a anterior pela metade e
  // ainda empurrava as assinaturas para uma terceira. So' quebra se nao couber.
  const ALTURA_ACEITE = 88; // o texto fixo das 5 clausulas, medido
  if (y + ALTURA_ACEITE + 2 * (ESPACO_ASSINATURA_MIN + ALTURA_IDENTIFICACAO) > limiteConteudo) {
    novaPagina();
  }
  tituloSecao('6. DECLARAÇÕES E ACEITE');
  [
    '6.1 Este Pedido de Compra integra e adere ao Contrato de Fabricação de Produtos celebrado entre as partes, sujeitando-se integralmente às suas cláusulas, que a CONTRATANTE declara conhecer e ratificar.',
    '6.2 Havendo divergência, prevalece este Pedido quanto a produto, quantidade, preço, prazo e condições de pagamento, e prevalece o Contrato de Fabricação de Produtos quanto a todas as demais matérias.',
    '6.3 Constitui aceite integral deste Pedido, indistintamente: a sua assinatura, a confirmação por escrito no canal formal de comunicação ou o pagamento, total ou parcial, de qualquer valor nele previsto.',
    '6.4 A CONTRATANTE declara ciência das cláusulas do Contrato de Fabricação de Produtos que limitam ou condicionam direitos, em especial as relativas a aceite tácito, vedação de chargeback, reserva de domínio e limitação de responsabilidade.',
    '6.5 As partes assinam o presente Pedido de Compra por meio de assinatura eletrônica, reconhecendo sua validade e eficácia nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020. Este Pedido, em conjunto com o Contrato de Fabricação de Produtos, constitui título executivo extrajudicial, nos termos do artigo 784, inciso III e §4º, do Código de Processo Civil.',
  ].forEach((p) => paragrafo(p));

  // As assinaturas ficam na mesma pagina das declaracoes quando cabem.
  //
  // Antes havia quebra forcada aqui: o documento terminava numa pagina quase
  // vazia depois de outra com metade do espaco sobrando. O ZapSign posiciona o
  // carimbo por clique ou por texto ancora, entao a faixa livre nao precisa ser
  // enorme -- precisa existir. Se as duas nao couberem, a quebra acontece
  // dentro de `blocoAssinatura`, e ai' as duas vao juntas para a pagina
  // seguinte.
  y += 8;
  doc.setFont(FONTE, 'normal').setFontSize(CORPO);
  // O modelo v3 deixava a data em branco para preencher a mao; com assinatura
  // eletronica isso so' vira lacuna no documento que vai ao financeiro.
  // A' direita, como no modelo.
  doc.text(
    `${PADROES_PEDIDO_COMPRA.local_assinatura}, ${dataPorExtenso(dados.data_pedido)}`,
    MARGEM + larguraUtil,
    y,
    { align: 'right' },
  );

  // Assinaturas empilhadas, uma abaixo da outra.
  //
  // Lado a lado sobrava meia largura para cada uma, e assinatura eletronica --
  // GOV.br, ZapSign -- carimba um bloco largo que nao cabe nessa metade. Em
  // pilha cada parte tem a largura inteira e uma faixa livre acima da linha.
  const larguraLinha = Math.min(larguraUtil, 110);

  y += 6;

  // Separar as duas assinaturas em paginas diferentes confunde quem confere se
  // o documento voltou assinado pelas duas partes: ou cabem as duas aqui, ou
  // as duas vao juntas para a pagina seguinte. O minimo e' o que decide.
  const minimoDoPar = 2 * (ESPACO_ASSINATURA_MIN + ALTURA_IDENTIFICACAO);
  if (y + minimoDoPar > limiteConteudo) novaPagina();

  // So' depois de saber em que pagina elas ficam da' para medir a folga: o
  // espaco que sobraria no pe' vira faixa para o carimbo, em vez de branco.
  const espacoAssinatura = Math.max(
    ESPACO_ASSINATURA_MIN,
    Math.min(ESPACO_ASSINATURA_MAX, (limiteConteudo - y) / 2 - ALTURA_IDENTIFICACAO),
  );

  const blocoAssinatura = (linhas: string[]) => {
    y += espacoAssinatura;
    doc.setDrawColor(40).setLineWidth(0.3);
    doc.line(MARGEM, y, MARGEM + larguraLinha, y);
    doc.setLineWidth(0.2);
    y += 5;
    doc.setFontSize(CORPO).setTextColor(...PRETO);
    linhas.forEach((linha, i) => {
      doc.setFont(FONTE, i === 0 ? 'bold' : 'normal');
      doc.splitTextToSize(linha, larguraUtil).forEach((l: string) => {
        doc.text(l, MARGEM, y);
        y += 4.4;
      });
    });
    y += 4;
  };

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

  // Limao e rodape em todas as paginas, como no modelo impresso.
  const total = doc.getNumberOfPages();
  const cliente = (dados.contratante || '').trim();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // A primeira ja' recebeu o limao junto do titulo.
    if (i > 1) doc.addImage(LIMAO_DATA_URL, 'PNG', MARGEM, MARGEM - 5, LOGO_MM, LOGO_MM);
    doc.setFont(FONTE, 'normal').setFontSize(8).setTextColor(...CINZA_RODAPE);
    doc.text(
      `Pedido de Compra${cliente ? ` — ${cliente}` : ''} — Lemon Caps — página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() / 2,
      alturaPagina - RODAPE_LIVRE - 4,
      { align: 'center' },
    );
    doc.setTextColor(...PRETO);
  }

  return doc;
}

export function baixarPedidoCompraPDF(opcoes: Opcoes) {
  const doc = gerarPedidoCompraPDF(opcoes);
  // [Cliente]_[Pedido-De-Compra]_[Data]_[Hora], com o carimbo do download.
  doc.save(nomeArquivoDocumento(opcoes.dados.contratante, 'Pedido-De-Compra'));
}
