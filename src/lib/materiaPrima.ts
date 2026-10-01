import type { MateriaPrima } from '@/types/formula';

/**
 * Converte a linha de `materias_primas` do banco na matéria-prima do app.
 *
 * Mora aqui, longe dos hooks, por dois motivos. O primeiro é que é conversão
 * pura: não depende de rede nem de React, e assim dá para testar sem arrastar o
 * cliente do Supabase junto. O segundo é que precisa existir UMA vez só.
 *
 * Quando houve uma cópia desta função, a cópia leu `preco_por_unidade_compra`
 * da linha crua -- esse é o nome do campo DEPOIS de convertido; no banco a
 * coluna é `preco_compra`. Ler o nome errado não quebra nada em TypeScript:
 * devolve `undefined`, vira zero, e a fórmula inteira passa a custar R$ 0,00 sem
 * erro nenhum na tela. O "Editar produto" ficou impossível de salvar, acusando
 * que faltava matéria-prima válida.
 */
export function mapFromDB(db: any): MateriaPrima {
  return {
    id: db.id,
    nome: db.nome,
    unidade_compra: db.unidade_compra,
    preco_por_unidade_compra: Number(db.preco_compra),
    densidade: db.densidade ? Number(db.densidade) : undefined,
    fornecedor: db.fornecedor || undefined,
    categoria: db.categoria || undefined,
    observacoes: db.observacoes || undefined,
    updated_at: db.updated_at || undefined,
  };
}
