import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type Departamento, departamentoDoCliente } from '@/lib/linhaProduto';
import { AbaCatalogo, SEM_LOJA, TODAS, abasDaFormula, nomeDeExibicao } from '@/lib/catalogoLoja';

interface UsePrecificacoesPaginadasParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  /**
   * Prateleira a listar. `undefined` traz tudo (aba "Produtos Criados").
   * Substituiu o antigo `catalogoOnly`, que so' sabia dizer "catalogo ou nao" e
   * nao tinha onde encaixar a terceira prateleira.
   */
  departamento?: Departamento;
  /** Só vale nas prateleiras da casa: recorta a aba do nicho. */
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

const SELECT_COMPLETO = '*, formulas!inner(nome_formula, cliente, tipo_produto, nicho)';

export function usePrecificacoesPaginadas({
  page,
  pageSize,
  searchTerm,
  departamento,
  nicho,
}: UsePrecificacoesPaginadasParams) {
  const trimmed = searchTerm.trim();
  const daCasa = departamento === 'white_label' || departamento === 'selecao_lemoncaps';

  // ---------------------------------------------------------------------------
  // Prateleiras da casa: UMA busca, guardada em cache.
  //
  // A chave não leva página, nicho nem busca, de propósito. Antes levava, e cada
  // clique num nicho invalidava o cache e refazia a consulta inteira -- era isso
  // que fazia a aba demorar a trocar. Agora o conjunto vem uma vez e o recorte
  // acontece na memória, que é instantâneo.
  //
  // Dá para fazer assim porque catálogo e seleção são conjuntos pequenos.
  // Private Label, que pode ter milhares, continua paginando no banco.
  // ---------------------------------------------------------------------------
  const prateleira = useQuery({
    // Mesmo prefixo da consulta paginada de proposito: as 7 telas que fazem
    // `invalidateQueries(['precificacoes-paginadas'])` depois de salvar, mover
    // ou apagar continuam atualizando esta tambem, sem precisar saber que ela
    // existe. Chave separada atualizaria so' metade da tela.
    queryKey: ['precificacoes-paginadas', 'prateleira', departamento],
    enabled: daCasa,
    // A prateleira muda pouco; refazer a consulta a cada remontagem da aba é
    // trabalho jogado fora.
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let q = supabase.from('precificacoes').select(SELECT_COMPLETO).order('created_at', {
        ascending: false,
      });

      // Filtra no banco em vez de trazer tudo e descartar quase todas.
      q =
        departamento === 'selecao_lemoncaps'
          ? q.ilike('formulas.cliente', '%sele%o lemon%')
          : q.or('cliente.ilike.%catálogo%,cliente.ilike.%catalogo%', {
              referencedTable: 'formulas',
            });

      const { data: rows, error } = await q;
      if (error) throw error;
      // Confere pelo critério do resto do sistema: o `ilike` do banco não
      // conhece as regras de acento que `departamentoDoCliente` aplica.
      return ((rows || []) as Linha[]).filter(
        (r) => departamentoDoCliente(r.formulas?.cliente) === departamento,
      );
    },
  });

  /** Recorte da prateleira: nicho, busca e página, tudo em memória. */
  const recorte = useMemo(() => {
    const todas = prateleira.data;
    if (!daCasa || !todas) return null;

    const contagem: ContagemPorAba = {};
    for (const linha of todas) {
      for (const aba of abasDaFormula(linha.formulas?.nome_formula, linha.formulas?.nicho)) {
        contagem[aba] = (contagem[aba] ?? 0) + 1;
      }
    }
    // "Todas" conta fórmula, não aparição: quem está em dois nichos soma uma
    // vez só, senão o total passaria do tamanho da prateleira.
    contagem[TODAS] = todas.length;

    const filtradas = todas
      .filter(
        (r) =>
          !nicho ||
          nicho === TODAS ||
          abasDaFormula(r.formulas?.nome_formula, r.formulas?.nicho).includes(nicho),
      )
      .filter((r) => combina(r, trimmed));

    const from = (page - 1) * pageSize;
    return {
      precificacoes: filtradas.slice(from, from + pageSize),
      totalCount: filtradas.length,
      totalPages: Math.ceil(filtradas.length / pageSize),
      contagemPorAba: contagem,
      totalCatalogo: todas.length,
    };
  }, [prateleira.data, daCasa, nicho, trimmed, page, pageSize]);

  // ---------------------------------------------------------------------------
  // Private Label e "Produtos Criados": paginação no banco, onde o volume é outro.
  // ---------------------------------------------------------------------------
  const paginada = useQuery({
    queryKey: ['precificacoes-paginadas', page, pageSize, trimmed, departamento],
    enabled: !daCasa,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const from = (page - 1) * pageSize;

      // Private Label é "nem catálogo nem seleção". Duas grafias de catálogo
      // porque as duas existem no cadastro.
      const soPrivateLabel = <T extends { not: (a: string, b: string, c: string) => T }>(q: T) =>
        q
          .not('formulas.cliente', 'ilike', '%catálogo%')
          .not('formulas.cliente', 'ilike', '%catalogo%')
          .not('formulas.cliente', 'ilike', '%sele%o lemon%');

      let countQuery = supabase
        .from('precificacoes')
        .select('id, formulas!inner(nome_formula, cliente)', { count: 'exact', head: true });
      if (trimmed) {
        countQuery = countQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' },
        );
      }
      if (departamento === 'private_label') countQuery = soPrivateLabel(countQuery);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      let dataQuery = supabase
        .from('precificacoes')
        .select(SELECT_COMPLETO)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (trimmed) {
        dataQuery = dataQuery.or(
          `nome_formula.ilike.%${trimmed}%,cliente.ilike.%${trimmed}%`,
          { referencedTable: 'formulas' },
        );
      }
      if (departamento === 'private_label') dataQuery = soPrivateLabel(dataQuery);

      const { data: rows, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const totalCount = count ?? 0;
      return {
        precificacoes: rows as Linha[],
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        contagemPorAba: {} as ContagemPorAba,
        totalCatalogo: 0,
      };
    },
  });

  const resultado = daCasa ? recorte : paginada.data;

  return {
    precificacoes: resultado?.precificacoes ?? [],
    totalCount: resultado?.totalCount ?? 0,
    totalPages: resultado?.totalPages ?? 0,
    contagemPorAba: resultado?.contagemPorAba ?? ({} as ContagemPorAba),
    totalCatalogo: resultado?.totalCatalogo ?? 0,
    // Trocar de nicho não recarrega nada: o carregando só vale na primeira
    // busca da prateleira.
    isLoading: daCasa ? prateleira.isLoading : paginada.isLoading,
  };
}

export { SEM_LOJA };
