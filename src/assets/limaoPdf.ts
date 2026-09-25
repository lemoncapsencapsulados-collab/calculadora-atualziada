/**
 * O limao do cabecalho dos documentos, embutido.
 *
 * E' o icone da marca (public/images/icone-lemoncaps.jpg) recolorido: o limao
 * em oliva escuro sobre fundo BRANCO, do jeito que ele aparece no modelo
 * impresso. O arquivo original tem o inverso -- limao claro sobre fundo escuro
 * --, que num cabecalho branco viraria um quadrado preto.
 *
 * Branco opaco, e nao transparente: o PNG com canal alfa saiu do jsPDF como um
 * retangulo creme atras do limao. O cabecalho e' branco, entao opaco resolve.
 *
 * Vai embutido, e nao por URL, porque o PDF e' gerado no navegador e precisa da
 * imagem na hora: buscar do servidor daria documento sem logo quando a rede
 * falhasse, justo no documento que vai ao cliente.
 */
export const LIMAO_PNG_BASE64 =
  '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' +
  'AQAAAABJRU5ErkJggg==';

export const LIMAO_DATA_URL = `data:image/png;base64,${LIMAO_PNG_BASE64}`;
