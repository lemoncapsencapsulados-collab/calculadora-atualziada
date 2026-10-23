/**
 * Quem editou o quê, e quando.
 *
 * Um orçamento e um Pedido de Compra passam por muitas mãos antes de virar
 * contrato, e passaram a se atualizar sozinhos quando o produto ou o orçamento
 * mudam. Sem registro, a pergunta "por que este valor está diferente do que
 * mandei ao cliente?" não tem resposta -- e ela aparece no pior momento, com o
 * cliente na linha.
 *
 * O registro guarda a data com hora e minuto, de onde veio a mudança, e o que
 * mudou em texto corrido. Texto, e não um diff de campos: quem lê é o
 * consultor, não o programador, e "Dose diária: 2 cápsulas ao dia → 3 cápsulas
 * ao dia" responde a pergunta sem precisar de tradução.
 */

export type OrigemEdicao =
  /** Alguém editou o documento na tela. */
  | 'manual'
  /** Veio do Orçamento para Contrato ao ser gravado. */
  | 'orcamento_para_contrato'
  /** Veio da edição de um produto em Produtos Precificados. */
  | 'edicao_produto';

export const ROTULO_ORIGEM: Record<OrigemEdicao, string> = {
  manual: 'Editado na tela',
  orcamento_para_contrato: 'Veio do Orçamento para Contrato',
  edicao_produto: 'Veio da edição do produto precificado',
};

export interface RegistroEdicao {
  /** ISO. A tela formata com hora e minuto. */
  em: string;
  origem: OrigemEdicao;
  /** Uma frase por mudança, em português. */
  mudancas: string[];
}

export function novoRegistro(
  origem: OrigemEdicao,
  mudancas: string[],
  em: Date = new Date(),
): RegistroEdicao {
  return { em: em.toISOString(), origem, mudancas };
}

/** "23/10/2026 às 14:07" -- dia, hora e minuto, que é o que se pergunta. */
export function dataHoraDaEdicao(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const data = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/** O registro mais recente da lista, sem depender de ela estar ordenada. */
export function ultimaEdicao(historico: unknown): RegistroEdicao | null {
  if (!Array.isArray(historico) || historico.length === 0) return null;
  const validos = historico.filter(
    (r): r is RegistroEdicao => !!r && typeof r === 'object' && typeof (r as RegistroEdicao).em === 'string',
  );
  if (!validos.length) return null;
  return validos.reduce((a, b) => (new Date(a.em) >= new Date(b.em) ? a : b));
}

const texto = (v: unknown) => String(v ?? '').trim();

/** "de X para Y", ou "preenchido com Y" / "apagado" quando um dos lados falta. */
function comoMudou(rotulo: string, antes: unknown, depois: unknown): string | null {
  const a = texto(antes);
  const b = texto(depois);
  if (a === b) return null;
  if (!a) return `${rotulo}: preenchido com "${b}"`;
  if (!b) return `${rotulo}: apagado (era "${a}")`;
  return `${rotulo}: "${a}" → "${b}"`;
}

interface EspecificacaoComparavel {
  produto_nome?: string;
  quantidade_por_frasco?: string;
  dose_diaria?: string;
  doses_por_pote?: string;
  composicao?: { insumo?: string; dose?: string }[];
}

interface DocumentoComparavel {
  produtos?: { descricao?: string; quantidade?: number; preco_unitario?: number }[];
  especificacoes?: EspecificacaoComparavel[];
}

/** "Vitamina D3 149 mcg · Zinco 7 mg" -- a fórmula numa linha. */
function formulaEmTexto(composicao: EspecificacaoComparavel['composicao']): string {
  if (!Array.isArray(composicao)) return '';
  return composicao
    .filter((a) => texto(a?.insumo))
    .map((a) => `${texto(a.insumo)} ${texto(a.dose)}`.trim())
    .join(' · ');
}

const chave = (n: unknown) => texto(n).toLowerCase();

/**
 * O que mudou de um documento para o outro, em frases.
 *
 * Só o que o consultor reconhece: produto, quantidade, preço, fórmula e doses.
 * Comparar campo a campo o documento inteiro encheria o histórico de linhas
 * que ninguém lê, e a que importa se perderia no meio.
 */
export function resumirDiferencas(
  antes: unknown,
  depois: unknown,
  limite = 12,
): string[] {
  const a = (antes || {}) as DocumentoComparavel;
  const b = (depois || {}) as DocumentoComparavel;
  const frases: string[] = [];

  const produtosAntes = Array.isArray(a.produtos) ? a.produtos : [];
  const produtosDepois = Array.isArray(b.produtos) ? b.produtos : [];
  for (const p of produtosDepois) {
    const velho = produtosAntes.find((x) => chave(x?.descricao) === chave(p?.descricao));
    const nome = texto(p?.descricao) || 'Produto';
    if (!velho) {
      frases.push(`${nome}: produto acrescentado`);
      continue;
    }
    if (Number(velho.quantidade) !== Number(p.quantidade)) {
      frases.push(`${nome} — quantidade: ${velho.quantidade} → ${p.quantidade}`);
    }
    if (Number(velho.preco_unitario) !== Number(p.preco_unitario)) {
      frases.push(
        `${nome} — preço unitário: ${Number(velho.preco_unitario).toFixed(2)} → ${Number(p.preco_unitario).toFixed(2)}`,
      );
    }
  }
  for (const p of produtosAntes) {
    if (!produtosDepois.some((x) => chave(x?.descricao) === chave(p?.descricao))) {
      frases.push(`${texto(p?.descricao) || 'Produto'}: produto removido`);
    }
  }

  const especAntes = Array.isArray(a.especificacoes) ? a.especificacoes : [];
  const especDepois = Array.isArray(b.especificacoes) ? b.especificacoes : [];
  for (const e of especDepois) {
    const velha = especAntes.find((x) => chave(x?.produto_nome) === chave(e?.produto_nome));
    if (!velha) continue;
    const nome = texto(e?.produto_nome) || 'Produto';
    const campos: [string, unknown, unknown][] = [
      ['quantidade por frasco', velha.quantidade_por_frasco, e.quantidade_por_frasco],
      ['dose diária', velha.dose_diaria, e.dose_diaria],
      ['doses por pote', velha.doses_por_pote, e.doses_por_pote],
      ['fórmula', formulaEmTexto(velha.composicao), formulaEmTexto(e.composicao)],
    ];
    for (const [rotulo, de, para] of campos) {
      const frase = comoMudou(`${nome} — ${rotulo}`, de, para);
      if (frase) frases.push(frase);
    }
  }

  if (frases.length > limite) {
    const restantes = frases.length - limite;
    return [...frases.slice(0, limite), `… e mais ${restantes} alteraç${restantes > 1 ? 'ões' : 'ão'}`];
  }
  return frases;
}
