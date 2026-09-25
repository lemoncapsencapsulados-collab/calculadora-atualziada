import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ehCatalogo } from '@/lib/linhaProduto';
import { AbaCatalogo, SEM_LOJA, abasDaFormula, nomeDeExibicao } from '@/lib/catalogoLoja';

interface UsePrecificacoesPaginadasParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  catalogoOnly?: boolean;
  /** Só vale no catálogo: recorta a aba do nicho. */
  nicho?: AbaCatalogo | null;
}

type Linha = Record<string, any>;

/** Contagem por aba, para os números que aparecem nas subpáginas. */
export type ContagemPorAba = Partial<Record<AbaCatalogo, number>>;

/**
 * No catálogo a busca também olha o nome da loja: é o nome que está na tela, e
 * procurar pelo que se está lendo tem que funcionar.
 */
function combina(linha: Linha, termo: string): boolean {
  if (!termo) return true;
  const nome = linha.formulas?.nome_formula || '';
  const alvo = `${nome} ${nomeDeExibicao(nome)} ${linha.formulas?.cliente || ''}`.toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

export function usePrecificacoesPaginadas({
  page,
  pageSize,
  searchTerm,
  catalogoOnly,
  nicho,
}: UsePrecificacoesPaginadasParams) {
  const trimmed = searchTerm.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['precificacoes-paginadas', page, pageSize, trimmed, catalogoOnly, nicho],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * pageSize;

      // ---------------------------------------------------------------------
      // Catálogo: o nicho vem de uma tabela em código (o espelho da loja), não
      // de coluna do banco. Então busca tudo e recorta aqui -- são dezenas de
      // linhas, e é o que permite contar quantas há em cada aba sem uma
      // consulta por aba.
      // ---------------------------------------------------------------------
      if (catalogoOnly === true) {
        const { data: rows, error } = await supabase
          .from('precificacoes')
          .select('*, formulas!inner(nome_formula, cliente, tipo_produto)')
          .order('created_at', { ascending: false });
        if (error) throw error;

        // `ehCatalogo` aceita "catálogo" e "catalogo"; a consulta antiga pedia
        // só a forma acentuada e perdia as fórmulas cadastradas sem acento.
        const doCatalogo = (rows || []).filter((r: Linha) => ehCatalogo(r.formulas?.cliente));

        const contagem: ContagemPorAba = {};
        for (const linha of doCatalogo) {
          for (const aba of abasDaFormula(linha.formulas?.nome_formula)) {
            contagem[aba] = (contagem[aba] ?? 0) + 1;
          }
        }

        const filtradas = doCatalogo
          .filter((r: Linha) => !nicho || abasDaFormula(r.formulas?.nome_formula).includes(nicho))
          .filter((r: Linha) => combina(r, trimmed));

        return {
          precificacoes: filtradas.slice(from, from + pageSize),
          totalCount: filtradas.length,
          totalPages: Math.ceil(filtradas.length / pageSize),
          contagemPorAba: contagem,
          totalCatalogo: doCatalogo.length,
        };
      }

      // ---------------------------------------------------------------------
      // Private Label: paginação no banco, que aqui pode ser muita linha.
      // ---------------------------------------------------------------------
      const semCatalogo = <T extends { not: (a: string, b: string, c: string) => T }>(q: T) =>
        // Duas grafias porque as duas existem no cadastro.
        q.not('formulas.cliente', 'ilike', '%catálogo%').not('formulas.cliente', 'ilike', '%catalogo%');

      let countQuery = supabase
        .from('precificacoes')
        .select('id, formulas!inner(nome_formula, cliente)', { count: 'exact', head: true });
      if (trimmed) {
        countQuery = countQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' },
        );
      }
      if (catalogoOnly === false) countQuery = semCatalogo(countQuery);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      let dataQuery = supabase
        .from('precificacoes')
        .select('*, formulas!inner(nome_formula, cliente, tipo_produto)')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (trimmed) {
        dataQuery = dataQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' },
        );
      }
      if (catalogoOnly === false) dataQuery = semCatalogo(dataQuery);

      const { data: rows, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const totalCount = count ?? 0;
      return {
        precificacoes: rows,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        contagemPorAba: {} as ContagemPorAba,
        totalCatalogo: 0,
      };
    },
  });

  return {
    precificacoes: data?.precificacoes ?? [],
    totalCount: data?.totalCount ?? 0,
    totalPages: data?.totalPages ?? 0,
    contagemPorAba: data?.contagemPorAba ?? ({} as ContagemPorAba),
    totalCatalogo: data?.totalCatalogo ?? 0,
    isLoading,
  };
}

export { SEM_LOJA };
