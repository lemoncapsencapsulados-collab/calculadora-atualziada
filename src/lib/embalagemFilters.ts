import { Embalagem } from '@/types/formula';

export type TipoProduto = 'Encapsulados' | 'Pó' | 'Gummy' | 'Líquido';

export interface EmbalagemObrigatoria {
  categoria: string;
  descricao: string;
  encontrada: boolean;
}

/**
 * Define quais categorias de embalagem são obrigatórias para cada tipo de produto
 */
export function getEmbalagensnObrigatorias(tipoProduto: TipoProduto): EmbalagemObrigatoria[] {
  switch (tipoProduto) {
    case 'Encapsulados':
      return [
        { categoria: 'Sílica', descricao: 'Sílica Gel (dessecante)', encontrada: false },
        { categoria: 'Cápsula', descricao: 'Tipo de Cápsula', encontrada: false },
        { categoria: 'Tampa', descricao: 'Tampa do Pote', encontrada: false },
        { categoria: 'Pote', descricao: 'Pote/Frasco', encontrada: false },
      ];
    
    case 'Gummy':
      return [
        { categoria: 'Sílica', descricao: 'Sílica Gel (dessecante)', encontrada: false },
        { categoria: 'Tampa', descricao: 'Tampa do Pote', encontrada: false },
        { categoria: 'Pote', descricao: 'Pote/Frasco', encontrada: false },
      ];
    
    case 'Líquido':
      return [
        { categoria: 'Tampa', descricao: 'Tampa Conta-Gotas', encontrada: false },
        { categoria: 'Frasco', descricao: 'Frasco para Líquido', encontrada: false },
        { categoria: 'Acessórios', descricao: 'Bulbo/Cânula', encontrada: false },
      ];
    
    case 'Pó':
      return [
        { categoria: 'Sílica', descricao: 'Sílica Gel (dessecante)', encontrada: false },
        { categoria: 'Tampa', descricao: 'Tampa do Pote', encontrada: false },
        { categoria: 'Pote', descricao: 'Pote/Frasco', encontrada: false },
      ];
    
    default:
      return [];
  }
}

/**
 * Filtra embalagens relevantes para o tipo de produto
 */
export function filtrarEmbalagensPorTipo(
  embalagens: Embalagem[],
  tipoProduto: TipoProduto
): Embalagem[] {
  const palavrasChave = getPalavrasChavePorTipo(tipoProduto);
  const categoriasExcluidas = getCategoriasExcluidas(tipoProduto);
  
  return embalagens.filter(emb => {
    const nomeUpper = emb.nome.toUpperCase();
    const categoriaUpper = (emb.categoria || '').toUpperCase();
    
    // Excluir categorias não aplicáveis
    if (categoriasExcluidas.some(cat => categoriaUpper.includes(cat))) {
      return false;
    }
    
    // Sempre incluir itens gerais (sem marcação específica de tipo)
    const temMarcacaoEspecifica = 
      nomeUpper.includes('(ENCAPSULADO)') ||
      nomeUpper.includes('(GUMMY)') ||
      nomeUpper.includes('(GOTA)') ||
      nomeUpper.includes('(GOTAS)') ||
      nomeUpper.includes('(LÍQUIDO)') ||
      nomeUpper.includes('(PÓ)');
    
    if (!temMarcacaoEspecifica) {
      // Incluir se for de categoria relevante (Sílica, Rótulo, etc)
      const categoriasGerais = ['SÍLICA', 'RÓTULO', 'LACRE'];
      return categoriasGerais.some(cat => categoriaUpper.includes(cat));
    }
    
    // Incluir se contém palavra-chave do tipo de produto
    return palavrasChave.some(palavra => nomeUpper.includes(palavra));
  });
}

/**
 * Retorna palavras-chave para identificar embalagens do tipo
 */
function getPalavrasChavePorTipo(tipoProduto: TipoProduto): string[] {
  switch (tipoProduto) {
    case 'Encapsulados':
      return ['(ENCAPSULADO)', '(ENCAPSULADOS)'];
    case 'Gummy':
      return ['(GUMMY)'];
    case 'Líquido':
      return ['(GOTA)', '(GOTAS)', '(LÍQUIDO)'];
    case 'Pó':
      return ['(PÓ)'];
    default:
      return [];
  }
}

/**
 * Retorna categorias que devem ser excluídas para o tipo
 */
function getCategoriasExcluidas(tipoProduto: TipoProduto): string[] {
  switch (tipoProduto) {
    case 'Gummy':
    case 'Pó':
      return ['CÁPSULA', 'CAPSULA'];
    
    case 'Líquido':
      return ['CÁPSULA', 'CAPSULA', 'SÍLICA', 'SILICA'];
    
    default:
      return [];
  }
}

/**
 * Verifica se um categoria obrigatória foi selecionada
 */
export function verificarEmbalagemObrigatoria(
  categoria: string,
  embalagensSelecionadas: Set<string>,
  todasEmbalagens: Embalagem[]
): boolean {
  return Array.from(embalagensSelecionadas).some(id => {
    const emb = todasEmbalagens.find(e => e.id === id);
    if (!emb) return false;
    
    const categoriaUpper = (emb.categoria || '').toUpperCase();
    const nomeUpper = emb.nome.toUpperCase();
    
    switch (categoria) {
      case 'Sílica':
        return categoriaUpper.includes('SÍLICA') || categoriaUpper.includes('SILICA');
      
      case 'Cápsula':
        return categoriaUpper.includes('CÁPSULA') || categoriaUpper.includes('CAPSULA') ||
               nomeUpper.includes('CÁPSULA') || nomeUpper.includes('CAPSULA');
      
      case 'Tampa':
        return categoriaUpper.includes('TAMPA');
      
      case 'Pote':
        return categoriaUpper.includes('POTE') || categoriaUpper.includes('FRASCO');
      
      case 'Frasco':
        return categoriaUpper.includes('FRASCO');
      
      case 'Acessórios':
        return categoriaUpper.includes('ACESSÓRIO') || categoriaUpper.includes('ACESSORIO');
      
      default:
        return false;
    }
  });
}

/**
 * Formata nome da embalagem para líquidos (coloca "Líquido" na frente)
 */
export function formatarNomeEmbalagem(emb: Embalagem, tipoProduto: TipoProduto): string {
  if (tipoProduto !== 'Líquido') return emb.nome;
  
  const nome = emb.nome;
  
  // Se já começa com "Líquido", retorna como está
  if (nome.toUpperCase().startsWith('LÍQUIDO')) return nome;
  
  // Se contém (GOTA) ou (GOTAS), adiciona "Líquido -" na frente
  if (nome.includes('(GOTA)') || nome.includes('(GOTAS)')) {
    return `Líquido - ${nome}`;
  }
  
  return nome;
}
