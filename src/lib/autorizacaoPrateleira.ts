import { conferirSenhaAdmin } from '@/lib/senhaAdmin';
import { conferirCodigoCatalogo2026 } from '@/lib/codigoCatalogo2026';
import { departamentoDoCliente } from '@/lib/linhaProduto';

/**
 * Qual tranca abre cada prateleira.
 *
 * Mexer numa fórmula de prateleira da casa -- preço, fórmula, nicho, duplicata
 * ou mudança de lista -- muda o produto para TODO cliente que o usa, então
 * todas pedem autorização. O que muda é QUAL.
 *
 * O CATÁLOGO 2026 tem código próprio: montar a curadoria do ano é trabalho
 * comercial, e quem a monta não é necessariamente quem administra o sistema.
 * As demais seguem na senha de administrador.
 *
 * Mora num lugar só porque são seis pontos de entrada -- preço no card, editar
 * produto, duplicar, trocar nicho, mover para cá e mover daqui. Decidido em
 * cada um, bastava esquecer um para a prateleira ter uma porta destrancada, e
 * o esquecimento não apareceria em teste nenhum: a tela continuaria
 * funcionando, só que sem pedir nada.
 */

export interface Autorizacao {
  conferir: (valor: string) => Promise<boolean>;
  /** Cabeçalho do diálogo. */
  titulo: string;
  /** Rótulo do campo. */
  rotuloCampo: string;
  /** Como citar a tranca no meio de uma frase. */
  comoChamar: string;
  /** Nome da prateleira, para a frase dizer de onde a fórmula é. */
  nomeDaPrateleira: string;
}

const ADMIN: Autorizacao = {
  conferir: conferirSenhaAdmin,
  titulo: 'Senha de administrador',
  rotuloCampo: 'Senha',
  comoChamar: 'senha de administrador',
  nomeDaPrateleira: 'Catálogo Lemon',
};

const CATALOGO_2026: Autorizacao = {
  conferir: conferirCodigoCatalogo2026,
  titulo: 'Código do CATÁLOGO 2026',
  rotuloCampo: 'Código',
  comoChamar: 'código do CATÁLOGO 2026',
  nomeDaPrateleira: 'CATÁLOGO 2026',
};

/** A tranca da prateleira em que a fórmula está hoje. */
export function autorizacaoDaPrateleira(
  clienteDaFormula: string | null | undefined,
): Autorizacao {
  return departamentoDoCliente(clienteDaFormula) === 'catalogo_2026' ? CATALOGO_2026 : ADMIN;
}

/** A tranca do destino, para quem vai MOVER uma fórmula para outra lista. */
export function autorizacaoDoDestino(destino: string): Autorizacao {
  return destino === 'catalogo_2026' ? CATALOGO_2026 : ADMIN;
}

/**
 * A tranca de uma mudança de lista.
 *
 * Sair do CATÁLOGO 2026 pede o código do catálogo, não a senha de
 * administrador: tirar uma fórmula da curadoria é decisão de quem a montou.
 * Entrar também. Entre as outras prateleiras, segue a senha.
 */
export function autorizacaoDaMudanca(
  clienteAtual: string | null | undefined,
  destino: string,
): Autorizacao {
  const saindoDoCatalogo2026 = departamentoDoCliente(clienteAtual) === 'catalogo_2026';
  return saindoDoCatalogo2026 || destino === 'catalogo_2026' ? CATALOGO_2026 : ADMIN;
}
