// Quais contas de anúncio ficam ativas quando a Meta é (re)conectada.
//
// A conexão devolve TODAS as contas que o usuário enxerga na Business Manager
// — na Lemon Caps são 21, das quais o painel usa 1. Antes, cada reconexão
// marcava as 21 como ativas: o token vence a cada 60 dias, e a cada renovação
// o painel passava a somar o gasto de contas que alguém tinha desligado de
// propósito, sem aviso.
//
// TypeScript puro, sem `Deno`: roda no vitest junto do resto de `_shared`.

export interface ContaExistente {
  ad_account_id: string;
  ativo: boolean | null;
  last_sync_status?: string | null;
}

/**
 * Decide se a conta `adAccountId`, vinda agora da Meta, fica ativa.
 *
 * 1. Se alguma conta já estava ativa, a seleção atual manda: quem existia
 *    mantém o que era, e conta nova chega desligada — alguém escolheu quais
 *    contas o painel soma, e uma conta nova não deve entrar na conta sozinha.
 * 2. Se nenhuma estava ativa porque o painel foi desconectado, voltam as que o
 *    desconectar desligou (ficaram marcadas `desconectado`).
 * 3. Primeira conexão de todas: ativa tudo, como sempre foi — é na tela de
 *    Contas que se escolhe depois.
 */
export function ficaAtiva(existentes: ContaExistente[], adAccountId: string): boolean {
  const anterior = existentes.find((e) => e.ad_account_id === adAccountId);

  if (existentes.some((e) => e.ativo)) {
    return anterior ? !!anterior.ativo : false;
  }

  const desconectadas = existentes.filter((e) => e.last_sync_status === 'desconectado');
  if (desconectadas.length) {
    return desconectadas.some((e) => e.ad_account_id === adAccountId);
  }

  return true;
}
