/**
 * Quanto cada consultor trouxe, e de quais clientes.
 *
 * Soma o que já está na tela de Pedidos: se o gestor filtrou um período ou um
 * consultor, o resumo acompanha o filtro. Um total que ignora o filtro ao lado
 * dele não é um resumo, é um segundo número para conferir.
 *
 * Carteira dividida existe: o mesmo produtor pode ter sido atendido por mais de
 * um consultor ao longo do tempo. Cada PEDIDO conta para quem o atendeu, não o
 * cliente inteiro para o último que apareceu -- senão a troca de carteira
 * transferiria faturamento histórico de um consultor para outro.
 */

export interface ClienteDoConsultor {
  nome: string;
  cnpj: string;
  pedidos: number;
  valor: number;
}

export interface ResumoConsultor {
  consultor: string;
  pedidos: number;
  valor: number;
  clientes: ClienteDoConsultor[];
}

export interface PedidoParaResumo {
  consultor: string;
  clienteNome: string;
  clienteCnpj: string;
  valor: number;
}

/** Sem nome no cadastro, o pedido não some: vai para um balde identificado. */
export const SEM_CONSULTOR = 'Sem consultor';

export function resumirPorConsultor(pedidos: PedidoParaResumo[]): ResumoConsultor[] {
  const porConsultor = new Map<string, ResumoConsultor>();

  for (const p of pedidos) {
    const nome = (p.consultor || '').trim() || SEM_CONSULTOR;
    const valor = Number(p.valor) || 0;

    if (!porConsultor.has(nome)) {
      porConsultor.set(nome, { consultor: nome, pedidos: 0, valor: 0, clientes: [] });
    }
    const r = porConsultor.get(nome)!;
    r.pedidos += 1;
    r.valor += valor;

    // Agrupa pelo CNPJ quando existe; sem ele, pelo nome. Cliente sem CNPJ
    // cadastrado é comum nos pedidos antigos e não pode virar uma linha por
    // pedido.
    const chave = (p.clienteCnpj || '').replace(/\D/g, '') || p.clienteNome.trim().toLowerCase();
    let cliente = r.clientes.find(
      (c) => ((c.cnpj || '').replace(/\D/g, '') || c.nome.trim().toLowerCase()) === chave,
    );
    if (!cliente) {
      cliente = { nome: p.clienteNome || 'Sem nome', cnpj: p.clienteCnpj || '', pedidos: 0, valor: 0 };
      r.clientes.push(cliente);
    }
    cliente.pedidos += 1;
    cliente.valor += valor;
  }

  const lista = Array.from(porConsultor.values());
  // Quem trouxe mais primeiro: é a ordem que a conversa de gestão segue.
  for (const r of lista) r.clientes.sort((a, b) => b.valor - a.valor);
  lista.sort((a, b) => b.valor - a.valor);
  return lista;
}

/** Totais da seleção inteira, para o resumo ter uma linha de fechamento. */
export function totalGeral(resumos: ResumoConsultor[]) {
  return resumos.reduce(
    (acc, r) => ({ pedidos: acc.pedidos + r.pedidos, valor: acc.valor + r.valor }),
    { pedidos: 0, valor: 0 },
  );
}

/** Quanto este consultor representa do total faturado da seleção. */
export function participacao(resumo: ResumoConsultor, total: number): number {
  if (!total) return 0;
  return (resumo.valor / total) * 100;
}
