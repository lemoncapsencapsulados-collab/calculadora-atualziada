/**
 * Quem é a pessoa do outro lado da conversa.
 *
 * O WhatsApp migrou para identificadores `@lid`, que por design NÃO carregam o
 * telefone. O painel vinha imprimindo esse identificador no lugar do número --
 * `201894198833332` aparecia como se fosse um telefone, e nenhum vendedor
 * conseguia ligar para aquilo. Pior: o casamento com o CRM usava esse mesmo
 * identificador como telefone, então conversa `@lid` nunca encontrava cliente,
 * mesmo com o cliente cadastrado.
 *
 * Este módulo decide o que MOSTRAR, na ordem em que a informação é confiável:
 *
 *   1. nome do cliente no CRM     -- o melhor que existe
 *   2. nome público do WhatsApp   -- quando não é número disfarçado
 *   3. telefone de verdade        -- de `zap_contatos.telefone`, que a ingestão
 *                                    extrai do `key.remoteJidAlt`
 *   4. "Contato sem número"       -- com o final do identificador, para o
 *                                    vendedor distinguir uma conversa da outra
 *
 * É a mesma ordem da função SQL `zap_identificacao_contato`, de propósito: as
 * duas descrevem a mesma pessoa e divergir faria o relatório citar um nome e a
 * tela outro.
 *
 * NENHUMA CONVERSA SOME por não ter número. O passo 4 existe exatamente para
 * isso: contato sem telefone continua na lista, só para de fingir que o
 * identificador interno é um telefone.
 */

/** Identificador `@lid`: existe, mas não diz o número de ninguém. */
export function ehLid(jid: string | null | undefined): boolean {
  return !!jid && jid.endsWith('@lid');
}

/** Conversa de grupo. */
export function ehGrupoJid(jid: string | null | undefined): boolean {
  return !!jid && jid.endsWith('@g.us');
}

/**
 * O telefone que o próprio `remoteJid` carrega -- `null` quando ele não carrega
 * nenhum.
 *
 * Só um JID de telefone (`@s.whatsapp.net` ou `@c.us`) traz número. Devolver os
 * dígitos de um `@lid` aqui seria devolver um identificador interno com cara de
 * telefone, que foi justamente o defeito que este módulo existe para corrigir.
 */
export function telefoneDoJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const [parte, dominio] = jid.split('@');
  if (dominio !== 's.whatsapp.net' && dominio !== 'c.us') return null;
  const digitos = (parte || '').replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 13 ? digitos : null;
}

/**
 * Os últimos dígitos do identificador, para diferenciar conversas sem nome.
 *
 * Quatro dígitos bastam para o vendedor saber que são duas conversas
 * diferentes, e não convidam ninguém a tentar discar.
 */
export function finalDoIdentificador(jid: string | null | undefined): string {
  const parte = (jid || '').split('@')[0] || '';
  const digitos = parte.replace(/\D/g, '');
  return digitos.slice(-4);
}

/**
 * Nome que serve para chamar alguém.
 *
 * O WhatsApp devolve o próprio identificador como "nome" quando o contato não
 * tem nome público, e a ingestão às vezes grava "Você" -- o rótulo do consultor
 * nas mensagens que ele mesmo enviou, não o nome do cliente.
 */
export function nomeUtilizavel(nome: string | null | undefined): string | null {
  const limpo = (nome || '').trim();
  if (!limpo) return null;
  if (/^[0-9+\s()-]+$/.test(limpo)) return null;
  if (limpo.toLowerCase() === 'você' || limpo.toLowerCase() === 'voce') return null;
  return limpo;
}

/** Telefone brasileiro legível: +55 (65) 99999-9999. */
export function formatarTelefoneBr(telefone: string | null | undefined): string {
  const d = (telefone || '').replace(/\D/g, '');
  if (!d) return '';
  const sem55 = d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
  if (sem55.length === 11) return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 7)}-${sem55.slice(7)}`;
  if (sem55.length === 10) return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 6)}-${sem55.slice(6)}`;
  return d;
}

export interface DadosIdentidade {
  remoteJid: string | null | undefined;
  /** Nome público do WhatsApp (`pushName`). */
  pushName?: string | null;
  /** Telefone já descoberto para este contato, de `zap_contatos.telefone`. */
  telefoneConhecido?: string | null;
  /** Nome do cliente casado no CRM, quando houver. */
  nomeCliente?: string | null;
}

export interface Identidade {
  /** O que vai no lugar do nome. Nunca vazio. */
  titulo: string;
  /** A linha de baixo: o telefone, ou por que não há um. */
  detalhe: string;
  /** Há um telefone real para ligar ou casar com o CRM. */
  temTelefone: boolean;
  /** O telefone em dígitos, quando existe. */
  telefone: string | null;
  /** A conversa é de um contato que não expõe número. */
  anonimo: boolean;
}

/**
 * A melhor identificação possível para um contato.
 *
 * Nunca devolve string vazia: uma linha sem título sumiria da lista aos olhos
 * do vendedor mesmo continuando lá.
 */
export function identidadeDoContato(d: DadosIdentidade): Identidade {
  const grupo = ehGrupoJid(d.remoteJid);
  const telefone = d.telefoneConhecido?.replace(/\D/g, '') || telefoneDoJid(d.remoteJid);
  const nomePublico = nomeUtilizavel(d.pushName);
  const nomeCrm = nomeUtilizavel(d.nomeCliente);

  if (grupo) {
    return {
      titulo: nomePublico || 'Grupo',
      detalhe: 'Conversa em grupo',
      temTelefone: false,
      telefone: null,
      anonimo: false,
    };
  }

  const titulo = nomeCrm || nomePublico || (telefone ? formatarTelefoneBr(telefone) : null);
  const final = finalDoIdentificador(d.remoteJid);

  if (!titulo) {
    return {
      titulo: final ? `Contato ·${final}` : 'Contato',
      detalhe: 'Sem número: contato oculto pelo WhatsApp',
      temTelefone: false,
      telefone: null,
      anonimo: true,
    };
  }

  if (telefone) {
    const formatado = formatarTelefoneBr(telefone);
    return {
      titulo,
      detalhe: titulo === formatado ? 'Telefone' : formatado,
      temTelefone: true,
      telefone,
      anonimo: false,
    };
  }

  return {
    titulo,
    detalhe: final ? `Sem número · final ${final}` : 'Sem número',
    temTelefone: false,
    telefone: null,
    anonimo: true,
  };
}

/**
 * O texto que a busca precisa varrer para encontrar esta conversa.
 *
 * Inclui o identificador bruto de propósito: quem copia um `@lid` de outro
 * lugar e cola na busca ainda precisa achar a conversa. Tirar isso faria
 * sumir da busca conversas que continuam existindo.
 */
export function textoDeBusca(d: DadosIdentidade): string {
  const partes = [
    d.nomeCliente || '',
    d.pushName || '',
    d.telefoneConhecido || '',
    telefoneDoJid(d.remoteJid) || '',
    (d.remoteJid || '').split('@')[0] || '',
  ];
  return partes.join(' ').toLowerCase();
}
