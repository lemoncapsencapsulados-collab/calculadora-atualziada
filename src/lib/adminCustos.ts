import { arredondarReais } from '@/lib/utils';

export type TipoProdutoKey = 'encapsulados' | 'soluvel' | 'gummy' | 'liquido';

export const TIPOS_PRODUTO_KEYS: TipoProdutoKey[] = ['encapsulados', 'soluvel', 'gummy', 'liquido'];

export const TIPO_PRODUTO_LABELS: Record<TipoProdutoKey, string> = {
  encapsulados: 'Encapsulados / Cápsula',
  soluvel: 'Solúvel',
  gummy: 'Gummy',
  liquido: 'Líquido',
};

// Mapeia o tipo_produto da fórmula (ex: "Encapsulados", "Solúvel") para a chave interna.
export function tipoProdutoToKey(tipoProduto?: string | null): TipoProdutoKey {
  const t = (tipoProduto || '').toLowerCase();
  if (t.startsWith('sol')) return 'soluvel';
  if (t.startsWith('gum')) return 'gummy';
  if (t.startsWith('liq') || t.startsWith('líq')) return 'liquido';
  return 'encapsulados';
}

export interface CapacidadesPorTipo {
  encapsulados: number;
  soluvel: number;
  gummy: number;
  liquido: number;
}

export interface CustoUnitarioPorTipo {
  encapsulados: { mod: number; admin: number };
  soluvel: { mod: number; admin: number };
  gummy: { mod: number; admin: number };
  liquido: { mod: number; admin: number };
}

/**
 * MOD por unidade = Folha Produção ÷ Capacidade do tipo
 * Admin por unidade = Folha Administrativa ÷ Capacidade do tipo
 */
export function calcularCustosPorTipo(
  folhaProducao: number,
  folhaAdmin: number,
  capacidades: CapacidadesPorTipo
): CustoUnitarioPorTipo {
  const calcUm = (folha: number, cap: number) =>
    cap > 0 ? arredondarReais(folha / cap) : 0;

  return {
    encapsulados: {
      mod: calcUm(folhaProducao, capacidades.encapsulados),
      admin: calcUm(folhaAdmin, capacidades.encapsulados),
    },
    soluvel: {
      mod: calcUm(folhaProducao, capacidades.soluvel),
      admin: calcUm(folhaAdmin, capacidades.soluvel),
    },
    gummy: {
      mod: calcUm(folhaProducao, capacidades.gummy),
      admin: calcUm(folhaAdmin, capacidades.gummy),
    },
    liquido: {
      mod: calcUm(folhaProducao, capacidades.liquido),
      admin: calcUm(folhaAdmin, capacidades.liquido),
    },
  };
}

/**
 * Pega o custo de MOD/Admin para um tipo específico, com fallback no valor legado da config.
 */
export function getCustosParaTipo(
  config: any,
  tipoProduto?: string | null
): { mod: number; admin: number } {
  const key = tipoProdutoToKey(tipoProduto);
  const modPorTipo = config?.mao_obra_direta_por_tipo as Record<string, number> | undefined;
  const adminPorTipo = config?.despesas_admin_por_tipo as Record<string, number> | undefined;

  const mod = Number(modPorTipo?.[key]);
  const admin = Number(adminPorTipo?.[key]);

  return {
    mod: Number.isFinite(mod) && mod > 0 ? mod : Number(config?.mao_obra_direta) || 0,
    admin: Number.isFinite(admin) && admin > 0 ? admin : Number(config?.despesas_administrativas) || 0,
  };
}
