import { Insumo, Embalagem, Formula } from '@/types/formula';

const STORAGE_KEYS = {
  INSUMOS: 'formula_pricing_insumos',
  EMBALAGENS: 'formula_pricing_embalagens',
  FORMULAS: 'formula_pricing_formulas',
};

// Insumos storage
export function getInsumos(): Insumo[] {
  const data = localStorage.getItem(STORAGE_KEYS.INSUMOS);
  return data ? JSON.parse(data) : [];
}

export function saveInsumos(insumos: Insumo[]): void {
  localStorage.setItem(STORAGE_KEYS.INSUMOS, JSON.stringify(insumos));
}

export function addInsumo(insumo: Insumo): void {
  const insumos = getInsumos();
  insumos.push(insumo);
  saveInsumos(insumos);
}

export function updateInsumo(id: string, updates: Partial<Insumo>): void {
  const insumos = getInsumos();
  const index = insumos.findIndex((i) => i.id === id);
  if (index !== -1) {
    insumos[index] = { ...insumos[index], ...updates };
    saveInsumos(insumos);
  }
}

export function deleteInsumo(id: string): void {
  const insumos = getInsumos().filter((i) => i.id !== id);
  saveInsumos(insumos);
}

// Embalagens storage
export function getEmbalagens(): Embalagem[] {
  const data = localStorage.getItem(STORAGE_KEYS.EMBALAGENS);
  return data ? JSON.parse(data) : getDefaultEmbalagens();
}

export function saveEmbalagens(embalagens: Embalagem[]): void {
  localStorage.setItem(STORAGE_KEYS.EMBALAGENS, JSON.stringify(embalagens));
}

export function addEmbalagem(embalagem: Embalagem): void {
  const embalagens = getEmbalagens();
  embalagens.push(embalagem);
  saveEmbalagens(embalagens);
}

export function updateEmbalagem(id: string, updates: Partial<Embalagem>): void {
  const embalagens = getEmbalagens();
  const index = embalagens.findIndex((e) => e.id === id);
  if (index !== -1) {
    embalagens[index] = { ...embalagens[index], ...updates };
    saveEmbalagens(embalagens);
  }
}

export function deleteEmbalagem(id: string): void {
  const embalagens = getEmbalagens().filter((e) => e.id !== id);
  saveEmbalagens(embalagens);
}

// Formulas storage
export function getFormulas(): Formula[] {
  const data = localStorage.getItem(STORAGE_KEYS.FORMULAS);
  return data ? JSON.parse(data).map((f: any) => ({ ...f, data: new Date(f.data) })) : [];
}

export function saveFormulas(formulas: Formula[]): void {
  localStorage.setItem(STORAGE_KEYS.FORMULAS, JSON.stringify(formulas));
}

export function addFormula(formula: Formula): void {
  const formulas = getFormulas();
  formulas.push(formula);
  saveFormulas(formulas);
}

export function deleteFormula(id: string): void {
  const formulas = getFormulas().filter((f) => f.id !== id);
  saveFormulas(formulas);
}

// Default embalagens based on the requirements
function getDefaultEmbalagens(): Embalagem[] {
  return [
    { id: '1', descricao: 'Sílica gel', preco_unitario: 0.04, qtd_por_pote: 1 },
    { id: '2', descricao: 'Cápsula 0', preco_unitario: 1.14, qtd_por_pote: 60 },
    { id: '3', descricao: 'Pote 170mL', preco_unitario: 1.05, qtd_por_pote: 1 },
    { id: '4', descricao: 'Tampa', preco_unitario: 0.98, qtd_por_pote: 1 },
    { id: '5', descricao: 'Rótulo', preco_unitario: 0.28, qtd_por_pote: 1 },
  ];
}
