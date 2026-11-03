// O estado real da conexão com a Meta, para a tela poder dizer a verdade.
//
// O cabeçalho de Investimento em Anúncios mostrava uma bolinha verde fixa e
// "última sync <data>". Em 19/10/2026 o token venceu; dali em diante cada
// sincronização gravava `last_sync_status: 'erro'` com a mensagem da Meta, e a
// tela seguia verde, exibindo a data da TENTATIVA como se fosse de sucesso.
// Duas semanas de painel zerado sem ninguém saber por quê.

export type EstadoConexao = 'ok' | 'expirando' | 'expirada' | 'erro';

export interface ContaMeta {
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  token_expires_at?: string | null;
}

export interface StatusConexao {
  estado: EstadoConexao;
  /** Frase curta para o cabeçalho. Vazia quando está tudo bem. */
  resumo: string;
  /** Quando a conexão venceu ou vai vencer, se dá para saber. */
  data?: Date;
  diasRestantes?: number;
}

/** O token da Meta dura 60 dias; avisar com uma semana dá tempo de agir. */
export const DIAS_AVISO_VENCIMENTO = 7;

const MESES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * A Meta diz quando a sessão venceu no próprio texto do erro:
 * "Session has expired on Monday, 19-Oct-26 11:36:54 PDT". É a data mais
 * confiável que existe — `token_expires_at` é a PREVISÃO feita ao conectar, e
 * a Meta pode invalidar antes (troca de senha, permissão revogada).
 */
export function dataDoErroMeta(erro: string | null | undefined): Date | undefined {
  const m = /expired on \w+,\s*(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/i.exec(erro || '');
  if (!m) return undefined;
  const mes = MESES[m[2].toLowerCase()];
  if (mes === undefined) return undefined;
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(ano, mes, Number(m[1]));
}

/** Erro de token: vencido, inválido ou revogado — todos pedem reconectar. */
function erroDeToken(erro: string): boolean {
  return /session has expired|error validating access token|access token.*(expired|invalid)|"code"\s*:\s*190|\(#190\)|OAuthException/i.test(
    erro,
  );
}

export function statusConexaoMeta(conta: ContaMeta, agora: Date = new Date()): StatusConexao {
  const erro = (conta.last_sync_error || '').trim();
  const vence = conta.token_expires_at ? new Date(conta.token_expires_at) : undefined;
  const venceValido = vence && !Number.isNaN(vence.getTime()) ? vence : undefined;

  if ((conta.last_sync_status === 'erro' && erroDeToken(erro)) || (venceValido && venceValido <= agora)) {
    return {
      estado: 'expirada',
      resumo: 'conexão expirada',
      data: dataDoErroMeta(erro) ?? venceValido,
    };
  }

  if (conta.last_sync_status === 'erro') {
    return { estado: 'erro', resumo: 'última sincronização falhou' };
  }

  if (venceValido) {
    const dias = Math.ceil((venceValido.getTime() - agora.getTime()) / 86_400_000);
    if (dias <= DIAS_AVISO_VENCIMENTO) {
      return {
        estado: 'expirando',
        resumo: dias <= 1 ? 'conexão vence amanhã' : `conexão vence em ${dias} dias`,
        data: venceValido,
        diasRestantes: dias,
      };
    }
  }

  return { estado: 'ok', resumo: '' };
}
