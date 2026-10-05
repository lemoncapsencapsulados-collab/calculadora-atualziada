/**
 * Até onde o WhatsApp foi sincronizado -- e o que o painel pode afirmar.
 *
 * Um zero na tela tem duas causas possíveis e opostas: ou o consultor não
 * atendeu ninguém, ou a sincronização não trouxe aquele período. As duas
 * aparecem idênticas, e a primeira acusa uma pessoa pelo defeito da segunda.
 *
 * Foi o que aconteceu: a pesquisa do EVERTON em setembro/2026 mostrou "1
 * conversa". O número está certo -- a ingestão de mensagens parou em 01/09/2026
 * e o mês inteiro tem 27 mensagens de um dia só. No mesmo painel, agosto dá 192
 * contatos para ele. Não havia erro de contagem nem de nome: havia um período
 * sem dado sendo apresentado como período sem trabalho.
 *
 * Daí estas funções. Elas não consertam a sincronização: comparam a janela
 * pedida com a data da última mensagem que existe e dizem, em texto, o que a
 * tela tem direito de concluir. Enquanto a ingestão estiver parada, o painel
 * precisa dizer isso mais alto do que mostra os números.
 */

/** O quanto do período pedido a sincronização cobre. */
export type Cobertura =
  /** A janela inteira está dentro do que foi sincronizado. */
  | 'coberta'
  /** Começa dentro, termina depois do último dado. Os números são um pedaço. */
  | 'parcial'
  /** Inteiramente depois do último dado. Todo número aqui é vazio técnico. */
  | 'descoberta'
  /** Não há mensagem nenhuma desta instância. Nada a afirmar. */
  | 'desconhecida';

export interface JanelaConsultada {
  inicio: Date;
  fim: Date;
  /** Última mensagem que existe no banco para este consultor. */
  ultimaMensagem?: string | Date | null;
}

/**
 * Dias sem mensagem nova antes de a sincronização ser considerada parada.
 *
 * Três e não um: sexta à noite a sábado não é defeito, é fim de semana. Três
 * dias atravessam um feriado emendado sem acusar falha que não existe.
 */
export const DIAS_PARA_SUSPEITA = 3;

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const UM_DIA = 24 * 60 * 60 * 1000;

/** Meia-noite local: a contagem é por data virada, como se fala dela. */
function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function coberturaDaJanela({ inicio, fim, ultimaMensagem }: JanelaConsultada): Cobertura {
  const ultima = paraData(ultimaMensagem);
  if (!ultima) return 'desconhecida';
  // Comparação por DIA, não por instante: a janela costuma terminar às 23:59:59
  // e a última mensagem cai às 14h daquele mesmo dia. Comparar instantes
  // chamaria de "parcial" todo mês fechado, e o aviso viraria ruído diário.
  const fimDia = inicioDoDia(fim);
  const inicioDia = inicioDoDia(inicio);
  const ultimaDia = inicioDoDia(ultima);
  if (ultimaDia >= fimDia) return 'coberta';
  if (ultimaDia >= inicioDia) return 'parcial';
  return 'descoberta';
}

/** Dias inteiros desde a última mensagem. Negativo nunca: no futuro, zero. */
export function diasSemSincronizar(
  ultimaMensagem: string | Date | null | undefined,
  hoje: Date = new Date(),
): number {
  const ultima = paraData(ultimaMensagem);
  if (!ultima) return 0;
  const dias = Math.floor((inicioDoDia(hoje) - inicioDoDia(ultima)) / UM_DIA);
  return dias > 0 ? dias : 0;
}

/** A ingestão de mensagens parou de trazer coisa nova. */
export function sincronizacaoParada(
  ultimaMensagem: string | Date | null | undefined,
  hoje: Date = new Date(),
): boolean {
  if (!paraData(ultimaMensagem)) return false;
  return diasSemSincronizar(ultimaMensagem, hoje) >= DIAS_PARA_SUSPEITA;
}

export interface AvisoCobertura {
  /** `parada` é problema de sistema; `recorte` é só a janela passando do fim. */
  tom: 'parada' | 'recorte';
  titulo: string;
  detalhe: string;
  /** Até onde dá para confiar nos números desta tela. */
  confiavelAte: Date;
}

function dd(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * O texto do aviso, ou `null` quando não há o que avisar.
 *
 * Diz a data exata do último dado e o que fazer em seguida. Um aviso genérico
 * ("pode haver atraso") não serve: quem lê precisa saber se o número da tela
 * vale para a decisão que vai tomar hoje.
 */
export function avisoCobertura(
  janela: JanelaConsultada,
  hoje: Date = new Date(),
): AvisoCobertura | null {
  const ultima = paraData(janela.ultimaMensagem);
  if (!ultima) {
    return {
      tom: 'parada',
      titulo: 'Nenhuma mensagem sincronizada para este consultor',
      detalhe:
        'O painel não tem conversa nenhuma desta instância do WhatsApp. Os números de atendimento ficam todos em zero por falta de dado, não por falta de atendimento.',
      confiavelAte: janela.inicio,
    };
  }

  const cobertura = coberturaDaJanela({ ...janela, ultimaMensagem: ultima });
  const parada = sincronizacaoParada(ultima, hoje);
  const dias = diasSemSincronizar(ultima, hoje);

  if (cobertura === 'descoberta') {
    return {
      tom: 'parada',
      titulo: `Período sem dado: a sincronização do WhatsApp parou em ${dd(ultima)}`,
      detalhe:
        `Não existe mensagem depois de ${dd(ultima)}, e o período pedido começa em ` +
        `${dd(janela.inicio)} -- depois disso. Os números abaixo estão vazios porque não ` +
        `houve ingestão, não porque o consultor deixou de atender. Escolha um período até ` +
        `${dd(ultima)} para ver o atendimento real, e trate a ingestão parada` +
        (dias ? ` (${dias} dias sem mensagem nova)` : '') + '.',
      confiavelAte: ultima,
    };
  }

  if (cobertura === 'parcial') {
    return {
      tom: parada ? 'parada' : 'recorte',
      titulo: `Período cortado em ${dd(ultima)}`,
      detalhe:
        `O período pedido vai até ${dd(janela.fim)}, mas a última mensagem sincronizada é de ` +
        `${dd(ultima)}. O que aparece abaixo cobre só até essa data` +
        (parada
          ? `, e já são ${dias} dias sem mensagem nova: a ingestão provavelmente está parada.`
          : '. O restante do período ainda não entrou.'),
      confiavelAte: ultima,
    };
  }

  // Janela coberta, mas a ingestão pode estar morta -- o caso de quem consulta
  // um mês antigo e fechado. Vale avisar: o painel inteiro está envelhecendo.
  if (parada) {
    return {
      tom: 'parada',
      titulo: `Sincronização do WhatsApp parada desde ${dd(ultima)}`,
      detalhe:
        `Este período está completo, mas não entra mensagem nova há ${dias} dias. ` +
        `Qualquer consulta a partir de ${dd(ultima)} vai aparecer vazia enquanto a ingestão ` +
        `não voltar.`,
      confiavelAte: ultima,
    };
  }

  return null;
}
