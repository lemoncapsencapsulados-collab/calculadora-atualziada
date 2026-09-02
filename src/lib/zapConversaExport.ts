// Exportação de uma conversa do ZapVendas para PDF (+ .zip só com os áudios).
//
// A conversa é reconstruída do zero — nada é reaproveitado do cache da tela,
// que só carrega as 50 mensagens mais recentes. Aqui paginamos `messages.list`
// até o fim do histórico e, para cada imagem, baixamos a mídia sob demanda
// (`messages.media`), exatamente como a bolha faz na tela, só que em lote.
//
// Duas restrições ditam o formato do PDF:
//   - As fontes padrão do jsPDF são WinAnsi (Latin-1): acento sai certo, emoji
//     não existe no conjunto e sairia como caractere-lixo — por isso todo
//     texto passa por `sanitizarTextoPdf` antes de ser desenhado.
//   - A Evolution devolve imagem em formatos variados (webp, png, jpeg) e em
//     resolução cheia; `normalizarImagem` rebaixa tudo para um JPEG de no
//     máximo 1200px, senão um PDF de conversa longa passa de 100 MB.
//
// Áudio nunca entra no PDF (não há como tocar áudio ali): sai num .zip à
// parte, com um `indice.txt` que amarra cada arquivo ao momento da conversa.

import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  buscarMidiaZap,
  extrairNomeArquivo,
  extrairTexto,
  extrairThumbnailImagem,
  invokeZap,
  jidParaTelefone,
  mensagemDeErro,
  tipoMidia,
} from '@/hooks/useZapVendas';
import { ZapMensagem } from '@/types/zapvendas';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

/** Etapas da exportação, na ordem em que acontecem. */
export type EtapaExportacao = 'mensagens' | 'imagens' | 'audios' | 'pdf' | 'concluido';

export interface ProgressoExportacao {
  etapa: EtapaExportacao;
  /** Frase curta do que está acontecendo agora, pronta para a tela. */
  descricao: string;
  /** Itens já processados na etapa atual. */
  concluidos: number;
  /** Total de itens da etapa, ou `null` enquanto ainda for desconhecido (paginação). */
  total: number | null;
}

export interface OpcoesExportacao {
  instanceName: string;
  remoteJid: string;
  /** Nome exibido do contato/grupo — vai para o cabeçalho do PDF e para o nome do arquivo. */
  nomeContato: string;
  /** Vendedor dono da instância, quando conhecido. */
  vendedor?: string;
  /** Baixar e embutir as imagens no PDF. Desligado, elas viram só um rótulo. */
  incluirImagens: boolean;
  /** Baixar os áudios num .zip separado. */
  baixarAudios: boolean;
  onProgresso: (progresso: ProgressoExportacao) => void;
  /** Objeto vivo: a tela seta `cancelado = true` e a exportação aborta na próxima checagem. */
  sinal: { cancelado: boolean };
}

export interface ResultadoExportacao {
  totalMensagens: number;
  imagensIncluidas: number;
  /** Imagens que o WhatsApp já removeu do servidor, ou que falharam ao baixar. */
  imagensIndisponiveis: number;
  audiosBaixados: number;
  audiosIndisponiveis: number;
  nomeArquivoPdf: string;
  /** `null` quando não havia áudio na conversa (ou o download foi desligado). */
  nomeArquivoZip: string | null;
}

/** Erro lançado quando o usuário cancela — a tela o reconhece para não mostrar toast de falha. */
export class ExportacaoCancelada extends Error {
  constructor() {
    super('Exportação cancelada.');
    this.name = 'ExportacaoCancelada';
  }
}

// ---------------------------------------------------------------------------
// Busca de todas as mensagens
// ---------------------------------------------------------------------------

/** A edge function limita `limit` a 100 — é o maior passo possível por página. */
const TAMANHO_PAGINA = 100;

/**
 * Trava de segurança: 300 páginas = 30.000 mensagens. Existe para o caso de a
 * Evolution ignorar `page` e devolver sempre a mesma página — a checagem de
 * "nenhuma mensagem nova" já cobre isso, mas um teto absoluto garante que o
 * laço termina mesmo com um comportamento inesperado do servidor.
 */
const MAX_PAGINAS = 300;

type RespostaMensagens =
  | ZapMensagem[]
  | { messages?: { records?: ZapMensagem[]; total?: number; pages?: number; currentPage?: number } };

/**
 * Identidade estável de uma mensagem, usada para casar a mídia baixada com a
 * bolha correspondente na hora de desenhar o PDF. NÃO pode depender da
 * posição no laço: a lista de imagens e a lista completa de mensagens são
 * percorridas com índices diferentes, e uma chave posicional casaria a foto
 * errada com a mensagem errada. Devolve `null` quando a Evolution não mandou
 * id nenhum — mensagem assim não tem como ter mídia baixada (`messages.media`
 * exige o id), então ela simplesmente fica de fora dos downloads.
 */
function chaveMensagem(m: ZapMensagem): string | null {
  return m?.key?.id || m?.id || null;
}

/**
 * Pagina `messages.list` até esgotar o histórico e devolve tudo em ordem
 * cronológica crescente, sem duplicatas.
 *
 * Para em qualquer um destes casos, o que vier primeiro: página vazia; página
 * que não trouxe nenhuma mensagem inédita (protege contra paginação que não
 * anda); `pages` informado pela Evolution alcançado; página menor que o
 * tamanho pedido; ou `MAX_PAGINAS`.
 */
export async function buscarTodasMensagens(
  instanceName: string,
  remoteJid: string,
  onProgresso: (carregadas: number, total: number | null) => void,
  sinal: { cancelado: boolean }
): Promise<ZapMensagem[]> {
  const acumuladas: ZapMensagem[] = [];
  const vistos = new Set<string>();
  let total: number | null = null;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    if (sinal.cancelado) throw new ExportacaoCancelada();

    const bruto = await invokeZap<RespostaMensagens>('messages.list', {
      instanceName,
      remoteJid,
      limit: TAMANHO_PAGINA,
      page: pagina,
    });

    const ehArray = Array.isArray(bruto);
    const registros: ZapMensagem[] = ehArray ? bruto : bruto?.messages?.records ?? [];

    if (!ehArray && typeof bruto?.messages?.total === 'number') {
      total = bruto.messages.total;
    }

    let ineditas = 0;
    registros.forEach((m) => {
      // Mensagem sem id não é deduplicável — entra sempre, senão duas
      // mensagens distintas viradas anônimas pela Evolution viraria uma só.
      const chave = chaveMensagem(m);
      if (chave) {
        if (vistos.has(chave)) return;
        vistos.add(chave);
      }
      acumuladas.push(m);
      ineditas++;
    });

    onProgresso(acumuladas.length, total);

    if (registros.length === 0 || ineditas === 0) break;
    // Resposta sem envelope de paginação: a Evolution mandou tudo de uma vez.
    if (ehArray) break;
    const paginas = bruto?.messages?.pages;
    if (typeof paginas === 'number' && pagina >= paginas) break;
    if (registros.length < TAMANHO_PAGINA) break;
  }

  return acumuladas.sort((a, b) => (a?.messageTimestamp ?? 0) - (b?.messageTimestamp ?? 0));
}

// ---------------------------------------------------------------------------
// Mídia
// ---------------------------------------------------------------------------

/** Mídia baixada com sucesso, já pronta para virar imagem de PDF ou arquivo de .zip. */
interface MidiaBaixada {
  base64: string;
  mimetype: string;
}

/**
 * Três downloads de cada vez: o meio termo entre uma conversa com 200 imagens
 * levar minutos (sequencial) e disparar dezenas de chamadas simultâneas na
 * Evolution, que é compartilhada com outros produtos da mesma VPS.
 */
const CONCORRENCIA_MIDIA = 3;

async function baixarMidias(
  instanceName: string,
  mensagens: ZapMensagem[],
  onProgresso: (concluidos: number) => void,
  sinal: { cancelado: boolean }
): Promise<Map<string, MidiaBaixada | null>> {
  const resultado = new Map<string, MidiaBaixada | null>();
  let concluidos = 0;
  let proximo = 0;

  async function trabalhador() {
    for (;;) {
      if (sinal.cancelado) throw new ExportacaoCancelada();
      const indice = proximo++;
      if (indice >= mensagens.length) return;

      const m = mensagens[indice];
      const chave = chaveMensagem(m);
      if (!chave) {
        concluidos++;
        onProgresso(concluidos);
        continue;
      }
      try {
        const midia = await buscarMidiaZap({
          instanceName,
          messageId: m.key.id,
          remoteJid: m.key.remoteJid,
          fromMe: !!m.key.fromMe,
        });
        // `expirada` é o caso normal de mídia antiga (o WhatsApp apaga do CDN
        // em ~14-30 dias) — não é erro, e o PDF avisa isso na bolha.
        resultado.set(
          chave,
          'base64' in midia ? { base64: midia.base64, mimetype: midia.mimetype } : null
        );
      } catch (erro) {
        // Uma mídia que falha não pode derrubar a exportação inteira: o PDF
        // sai com o aviso de indisponível naquela bolha e o resto continua.
        console.error('[zapvendas] falha ao baixar mídia para exportação', mensagemDeErro(erro));
        resultado.set(chave, null);
      } finally {
        concluidos++;
        onProgresso(concluidos);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA_MIDIA, mensagens.length) }, () => trabalhador())
  );

  return resultado;
}

/** Maior lado de uma imagem embutida no PDF, em pixels. */
const MAX_PIXELS_IMAGEM = 1200;

interface ImagemNormalizada {
  dataUrl: string;
  largura: number;
  altura: number;
}

/**
 * Converte qualquer imagem (webp, png, gif, jpeg) num JPEG rebaixado, e de
 * quebra descobre as dimensões — que o jsPDF precisa para manter a proporção.
 * O fundo branco é pintado antes porque PNG com transparência vira preto ao
 * ser achatado em JPEG.
 */
function normalizarImagem(base64: string, mimetype: string): Promise<ImagemNormalizada | null> {
  return new Promise((resolve) => {
    const origem = base64.startsWith('data:') ? base64 : `data:${mimetype};base64,${base64}`;
    const img = new Image();

    img.onload = () => {
      try {
        const escala = Math.min(1, MAX_PIXELS_IMAGEM / Math.max(img.width, img.height));
        const largura = Math.max(1, Math.round(img.width * escala));
        const altura = Math.max(1, Math.round(img.height * escala));

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, 0, 0, largura, altura);

        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.72), largura, altura });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = origem;
  });
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

function extensaoAudio(mimetype: string): string {
  // A Evolution costuma mandar o mimetype com parâmetros ("audio/ogg; codecs=opus").
  const base = (mimetype || '').toLowerCase().split(';')[0].trim();
  if (EXTENSAO_POR_MIME[base]) return EXTENSAO_POR_MIME[base];
  const sub = base.split('/')[1];
  return sub && /^[a-z0-9]{1,5}$/.test(sub) ? sub : 'bin';
}

// ---------------------------------------------------------------------------
// Helpers de texto e data
// ---------------------------------------------------------------------------

/** A Evolution manda timestamp em segundos; algumas mensagens vêm em ms. */
function paraMilissegundos(ts: number | undefined | null): number {
  const n = typeof ts === 'number' ? ts : 0;
  if (!n) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function dataDaMensagem(m: ZapMensagem): Date | null {
  const ms = paraMilissegundos(m?.messageTimestamp);
  if (!ms) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function horaCurta(m: ZapMensagem): string {
  const d = dataDaMensagem(m);
  return d ? format(d, 'HH:mm', { locale: ptBR }) : '';
}

function diaCompleto(d: Date): string {
  return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * As fontes padrão do jsPDF (helvetica/times/courier) são WinAnsi: cobrem
 * Latin-1 — todo o português acentuado — e nada além disso. Emoji, que é
 * comum no WhatsApp, cairia fora e sairia como caractere aleatório; então
 * removemos o que a fonte não sabe desenhar. Uma mensagem que era SÓ emoji
 * ficaria vazia e pareceria uma mensagem perdida, por isso vira `[emoji]`.
 */
export function sanitizarTextoPdf(valor: string): string {
  const semQuebraWindows = (valor || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const filtrado = Array.from(semQuebraWindows)
    .map((c) => {
      if (c === '\n') return c;
      const cp = c.codePointAt(0) ?? 0;
      if (cp >= 0x20 && cp <= 0x7e) return c;
      if (cp >= 0xa0 && cp <= 0xff) return c;
      return '';
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (!filtrado && semQuebraWindows.trim()) return '[emoji]';
  return filtrado;
}

/** Nome de arquivo seguro em qualquer sistema, sem acento nem separador de caminho. */
function nomeArquivoSeguro(valor: string): string {
  const semAcento = (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const limpo = semAcento
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return limpo || 'conversa';
}

const ROTULO_MIDIA: Record<string, string> = {
  imagem: '[Imagem]',
  audio: '[Audio]',
  video: '[Video]',
  documento: '[Documento]',
};

// ---------------------------------------------------------------------------
// Desenho do PDF
// ---------------------------------------------------------------------------

const MARGEM = 14;
const LARGURA_PAGINA = 210; // A4 retrato, em mm
const ALTURA_PAGINA = 297;
const TOPO_CONTEUDO = 22;
const RODAPE = 14;
const LARGURA_MAX_BOLHA = 120;
const PADDING_BOLHA = 3;
const ALTURA_LINHA = 4.4;

const COR_ENVIADA: [number, number, number] = [229, 243, 245]; // primary-soft
const COR_RECEBIDA: [number, number, number] = [241, 244, 246]; // muted
const COR_TEXTO: [number, number, number] = [24, 32, 42]; // foreground
const COR_TENUE: [number, number, number] = [97, 110, 128]; // muted-foreground
const COR_PRIMARIA: [number, number, number] = [22, 114, 126]; // primary
const COR_BORDA: [number, number, number] = [226, 232, 240];

interface CabecalhoPdf {
  nomeContato: string;
  telefone: string;
  vendedor?: string;
  instanceName: string;
  totalMensagens: number;
}

function desenharCapa(doc: jsPDF, info: CabecalhoPdf): number {
  doc.setFillColor(...COR_PRIMARIA);
  doc.rect(0, 0, LARGURA_PAGINA, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(sanitizarTextoPdf(info.nomeContato) || 'Conversa', MARGEM, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const subtitulo = [
    info.telefone ? `WhatsApp ${info.telefone}` : 'WhatsApp',
    info.vendedor
      ? `Vendedor: ${sanitizarTextoPdf(info.vendedor)}`
      : `Instancia: ${sanitizarTextoPdf(info.instanceName)}`,
  ].join('   -   ');
  doc.text(subtitulo, MARGEM, 21);

  doc.setFontSize(8);
  doc.text(
    `${info.totalMensagens} mensagens   -   Exportado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`,
    MARGEM,
    26.5
  );

  doc.setTextColor(...COR_TEXTO);
  return 38;
}

function desenharSeparadorData(doc: jsPDF, texto: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const rotulo = sanitizarTextoPdf(texto).toUpperCase();
  const largura = doc.getTextWidth(rotulo) + 8;
  const x = (LARGURA_PAGINA - largura) / 2;

  doc.setFillColor(...COR_BORDA);
  doc.roundedRect(x, y, largura, 6, 3, 3, 'F');
  doc.setTextColor(...COR_TENUE);
  doc.text(rotulo, LARGURA_PAGINA / 2, y + 4, { align: 'center' });
  doc.setTextColor(...COR_TEXTO);

  return y + 11;
}

/** Peças já medidas de uma bolha, prontas para desenhar sem recalcular. */
interface BolhaMedida {
  fromMe: boolean;
  autor: string | null;
  linhas: string[];
  imagem: ImagemNormalizada | null;
  larguraImagem: number;
  alturaImagem: number;
  hora: string;
  larguraBolha: number;
  alturaBolha: number;
}

function medirBolha(
  doc: jsPDF,
  fromMe: boolean,
  autor: string | null,
  texto: string,
  imagem: ImagemNormalizada | null,
  hora: string
): BolhaMedida {
  const larguraTextoMax = LARGURA_MAX_BOLHA - PADDING_BOLHA * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const linhas = texto ? (doc.splitTextToSize(texto, larguraTextoMax) as string[]) : [];

  let larguraImagem = 0;
  let alturaImagem = 0;
  if (imagem) {
    larguraImagem = Math.min(larguraTextoMax, 80);
    alturaImagem = (imagem.altura / imagem.largura) * larguraImagem;
    // Teto de altura para a imagem caber sempre numa página em branco, mesmo
    // somada ao autor, ao texto e à hora — senão uma foto em retrato entraria
    // num laço de "não cabe, vira a página, ainda não cabe".
    const alturaMax = ALTURA_PAGINA - TOPO_CONTEUDO - RODAPE - 20 - linhas.length * ALTURA_LINHA;
    if (alturaImagem > alturaMax) {
      alturaImagem = Math.max(10, alturaMax);
      larguraImagem = (imagem.largura / imagem.altura) * alturaImagem;
    }
  }

  const larguraConteudo = Math.max(
    larguraImagem,
    linhas.reduce((max, l) => Math.max(max, doc.getTextWidth(l)), 0),
    autor ? doc.getTextWidth(autor) : 0,
    18 // espaço mínimo para a hora não encostar na borda
  );

  const larguraBolha = Math.min(LARGURA_MAX_BOLHA, larguraConteudo + PADDING_BOLHA * 2);

  const alturaBolha =
    PADDING_BOLHA * 2 +
    (autor ? 4 : 0) +
    (imagem ? alturaImagem + (linhas.length ? 1.5 : 0) : 0) +
    linhas.length * ALTURA_LINHA +
    3.5; // linha da hora

  return {
    fromMe,
    autor,
    linhas,
    imagem,
    larguraImagem,
    alturaImagem,
    hora,
    larguraBolha,
    alturaBolha,
  };
}

function desenharBolha(doc: jsPDF, b: BolhaMedida, y: number): number {
  const x = b.fromMe ? LARGURA_PAGINA - MARGEM - b.larguraBolha : MARGEM;

  doc.setFillColor(...(b.fromMe ? COR_ENVIADA : COR_RECEBIDA));
  doc.roundedRect(x, y, b.larguraBolha, b.alturaBolha, 2, 2, 'F');

  let cursor = y + PADDING_BOLHA + 2.6;

  if (b.autor) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR_PRIMARIA);
    doc.text(b.autor, x + PADDING_BOLHA, cursor);
    cursor += 4;
  }

  if (b.imagem) {
    try {
      doc.addImage(b.imagem.dataUrl, 'JPEG', x + PADDING_BOLHA, cursor - 2.6, b.larguraImagem, b.alturaImagem);
    } catch {
      // Imagem corrompida: some do PDF, mas o texto e a hora continuam.
    }
    cursor += b.alturaImagem + (b.linhas.length ? 1.5 : 0);
  }

  if (b.linhas.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COR_TEXTO);
    b.linhas.forEach((linha) => {
      doc.text(linha, x + PADDING_BOLHA, cursor);
      cursor += ALTURA_LINHA;
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...COR_TENUE);
  doc.text(b.hora, x + b.larguraBolha - PADDING_BOLHA, y + b.alturaBolha - PADDING_BOLHA + 1, {
    align: 'right',
  });
  doc.setTextColor(...COR_TEXTO);

  return y + b.alturaBolha + 3;
}

function desenharRodapes(doc: jsPDF, info: CabecalhoPdf) {
  const paginas = doc.getNumberOfPages();
  const identificacao = sanitizarTextoPdf(`${info.nomeContato} - ${info.telefone}`);

  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COR_TENUE);
    doc.text(identificacao, MARGEM, ALTURA_PAGINA - 8);
    doc.text(`Pagina ${p} de ${paginas}`, LARGURA_PAGINA - MARGEM, ALTURA_PAGINA - 8, { align: 'right' });
  }
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/**
 * Exporta a conversa inteira: busca todo o histórico, baixa imagens e áudios,
 * monta o PDF e dispara os downloads (PDF sempre; .zip só se houver áudio).
 *
 * Toda falha de mídia individual é absorvida — o PDF sai com um aviso na
 * bolha correspondente e o resultado informa quantas ficaram de fora. Só erro
 * na busca das mensagens (a espinha da exportação) interrompe tudo.
 */
export async function exportarConversaPdf(opcoes: OpcoesExportacao): Promise<ResultadoExportacao> {
  const {
    instanceName,
    remoteJid,
    nomeContato,
    vendedor,
    incluirImagens,
    baixarAudios,
    onProgresso,
    sinal,
  } = opcoes;

  const checar = () => {
    if (sinal.cancelado) throw new ExportacaoCancelada();
  };

  // 1. Histórico completo ----------------------------------------------------
  onProgresso({
    etapa: 'mensagens',
    descricao: 'Buscando o histórico da conversa…',
    concluidos: 0,
    total: null,
  });

  const mensagens = await buscarTodasMensagens(
    instanceName,
    remoteJid,
    (carregadas, total) =>
      onProgresso({
        etapa: 'mensagens',
        descricao: total
          ? `Buscando mensagens (${carregadas} de ${total})…`
          : `Buscando mensagens (${carregadas} até agora)…`,
        concluidos: carregadas,
        total,
      }),
    sinal
  );

  if (mensagens.length === 0) {
    throw new Error('Esta conversa não tem nenhuma mensagem para exportar.');
  }

  // 2. Imagens ---------------------------------------------------------------
  const mensagensImagem = incluirImagens
    ? mensagens.filter((m) => tipoMidia(m) === 'imagem' && chaveMensagem(m))
    : [];
  const imagensPorMensagem = new Map<string, ImagemNormalizada | null>();
  let imagensIncluidas = 0;
  let imagensIndisponiveis = 0;

  if (mensagensImagem.length > 0) {
    onProgresso({
      etapa: 'imagens',
      descricao: `Baixando imagens (0 de ${mensagensImagem.length})…`,
      concluidos: 0,
      total: mensagensImagem.length,
    });

    const baixadas = await baixarMidias(
      instanceName,
      mensagensImagem,
      (concluidos) =>
        onProgresso({
          etapa: 'imagens',
          descricao: `Baixando imagens (${concluidos} de ${mensagensImagem.length})…`,
          concluidos,
          total: mensagensImagem.length,
        }),
      sinal
    );

    for (let i = 0; i < mensagensImagem.length; i++) {
      checar();
      const m = mensagensImagem[i];
      const chave = chaveMensagem(m) as string; // filtrado em `mensagensImagem`
      const midia = baixadas.get(chave);

      let normalizada: ImagemNormalizada | null = null;
      if (midia) {
        normalizada = await normalizarImagem(midia.base64, midia.mimetype);
      } else {
        // A mídia cheia expirou no CDN do WhatsApp, mas a miniatura embutida
        // na própria mensagem continua disponível — melhor uma prévia
        // granulada no PDF do que só o aviso de indisponível.
        const thumb = extrairThumbnailImagem(m);
        if (thumb) normalizada = await normalizarImagem(thumb, 'image/jpeg');
      }

      imagensPorMensagem.set(chave, normalizada);
      if (normalizada) imagensIncluidas++;
      else imagensIndisponiveis++;
    }
  }

  // 3. Áudios ----------------------------------------------------------------
  const mensagensAudio = baixarAudios
    ? mensagens.filter((m) => tipoMidia(m) === 'audio' && chaveMensagem(m))
    : [];
  let audiosBaixados = 0;
  let audiosIndisponiveis = 0;
  let blobZip: Blob | null = null;

  if (mensagensAudio.length > 0) {
    onProgresso({
      etapa: 'audios',
      descricao: `Baixando áudios (0 de ${mensagensAudio.length})…`,
      concluidos: 0,
      total: mensagensAudio.length,
    });

    const baixados = await baixarMidias(
      instanceName,
      mensagensAudio,
      (concluidos) =>
        onProgresso({
          etapa: 'audios',
          descricao: `Baixando áudios (${concluidos} de ${mensagensAudio.length})…`,
          concluidos,
          total: mensagensAudio.length,
        }),
      sinal
    );

    const zip = new JSZip();
    const linhasIndice: string[] = [
      `Audios da conversa com ${nomeContato} (${jidParaTelefone(remoteJid)})`,
      `Exportado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`,
      '',
    ];

    for (let i = 0; i < mensagensAudio.length; i++) {
      checar();
      const m = mensagensAudio[i];
      const midia = baixados.get(chaveMensagem(m) as string);
      const data = dataDaMensagem(m);
      const carimbo = data ? format(data, 'yyyy-MM-dd_HH-mm-ss') : 'sem-data';
      const direcao = m.key?.fromMe ? 'enviado' : 'recebido';
      const sequencial = String(i + 1).padStart(3, '0');

      if (!midia) {
        audiosIndisponiveis++;
        linhasIndice.push(
          `${sequencial}  ${carimbo}  ${direcao}  -> INDISPONIVEL (audio antigo removido pelo WhatsApp)`
        );
        continue;
      }

      const nome = `${sequencial}_${carimbo}_${direcao}.${extensaoAudio(midia.mimetype)}`;
      zip.file(nome, midia.base64, { base64: true });
      audiosBaixados++;
      linhasIndice.push(`${sequencial}  ${carimbo}  ${direcao}  -> ${nome}`);
    }

    if (audiosBaixados > 0) {
      zip.file('indice.txt', linhasIndice.join('\n'));
      blobZip = await zip.generateAsync({ type: 'blob' });
    }
  }

  // 4. Montagem do PDF -------------------------------------------------------
  checar();
  onProgresso({ etapa: 'pdf', descricao: 'Montando o PDF…', concluidos: 0, total: mensagens.length });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const info: CabecalhoPdf = {
    nomeContato,
    telefone: jidParaTelefone(remoteJid),
    vendedor,
    instanceName,
    totalMensagens: mensagens.length,
  };

  const grupo = remoteJid.endsWith('@g.us');
  let y = desenharCapa(doc, info);
  let diaAtual = '';

  for (let i = 0; i < mensagens.length; i++) {
    if (i % 50 === 0) {
      checar();
      onProgresso({
        etapa: 'pdf',
        descricao: `Montando o PDF (${i} de ${mensagens.length} mensagens)…`,
        concluidos: i,
        total: mensagens.length,
      });
      // Devolve o fio para o navegador a cada 50 mensagens: sem isso, uma
      // conversa longa congela a aba inteira e a barra de progresso não anda.
      await new Promise((r) => setTimeout(r, 0));
    }

    const m = mensagens[i];
    const data = dataDaMensagem(m);
    const dia = data ? format(data, 'yyyy-MM-dd') : '';

    if (data && dia !== diaAtual) {
      diaAtual = dia;
      if (y + 17 > ALTURA_PAGINA - RODAPE) {
        doc.addPage();
        y = TOPO_CONTEUDO;
      }
      y = desenharSeparadorData(doc, diaCompleto(data), y);
    }

    const fromMe = !!m.key?.fromMe;
    const tipo = tipoMidia(m);
    const textoOriginal = extrairTexto(m);
    const nomeArquivo = extrairNomeArquivo(m);
    const chave = chaveMensagem(m);
    const imagem =
      tipo === 'imagem' && incluirImagens && chave ? imagensPorMensagem.get(chave) ?? null : null;

    const partes: string[] = [];
    if (tipo === 'imagem' && incluirImagens) {
      if (!imagem) partes.push('[Imagem indisponivel - o WhatsApp remove arquivos antigos do servidor]');
    } else if (tipo !== 'texto') {
      const rotulo = ROTULO_MIDIA[tipo] ?? '[Midia]';
      partes.push(nomeArquivo ? `${rotulo} ${nomeArquivo}` : rotulo);
      if (tipo === 'audio' && baixarAudios) partes.push('(arquivo no .zip de audios)');
    }
    if (textoOriginal) partes.push(textoOriginal);
    if (partes.length === 0 && !imagem) partes.push('[Mensagem sem conteudo de texto]');

    const texto = sanitizarTextoPdf(partes.join('\n'));

    // Só grupo precisa de autor: numa conversa individual o lado da bolha já
    // diz quem falou, e repetir o nome em toda mensagem só polui.
    const autor = !fromMe && grupo && m.pushName ? sanitizarTextoPdf(m.pushName) || null : null;

    const bolha = medirBolha(doc, fromMe, autor, texto, imagem, horaCurta(m));

    if (y + bolha.alturaBolha > ALTURA_PAGINA - RODAPE) {
      doc.addPage();
      y = TOPO_CONTEUDO;
    }
    y = desenharBolha(doc, bolha, y);
  }

  desenharRodapes(doc, info);

  // 5. Downloads -------------------------------------------------------------
  checar();
  const base = `conversa-${nomeArquivoSeguro(nomeContato)}-${format(new Date(), 'yyyy-MM-dd')}`;
  const nomeArquivoPdf = `${base}.pdf`;
  const nomeArquivoZip = blobZip ? `${base}-audios.zip` : null;

  doc.save(nomeArquivoPdf);
  if (blobZip && nomeArquivoZip) saveAs(blobZip, nomeArquivoZip);

  onProgresso({
    etapa: 'concluido',
    descricao: 'Exportação concluída.',
    concluidos: mensagens.length,
    total: mensagens.length,
  });

  return {
    totalMensagens: mensagens.length,
    imagensIncluidas,
    imagensIndisponiveis,
    audiosBaixados,
    audiosIndisponiveis,
    nomeArquivoPdf,
    nomeArquivoZip,
  };
}
