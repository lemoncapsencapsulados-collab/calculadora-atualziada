import { Insumo, Embalagem, Formula } from '@/types/formula';

const STORAGE_KEYS = {
  INSUMOS: 'formula_pricing_insumos',
  EMBALAGENS: 'formula_pricing_embalagens',
  FORMULAS: 'formula_pricing_formulas',
};

// Insumos storage
export function getInsumos(): Insumo[] {
  const data = localStorage.getItem(STORAGE_KEYS.INSUMOS);
  return data ? JSON.parse(data) : getDefaultInsumos();
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

// Default insumos based on the PDF inventory
function getDefaultInsumos(): Insumo[] {
  return [
    // VITAMINAS
    { id: '1', nome: 'Vitamina A - Acetato de Retinol', unidade_compra: 'kg', preco_por_unidade_compra: 387.60, fornecedor: 'valdequimica', categoria: 'Vitaminas' },
    { id: '2', nome: 'Vitamina B1 (Tiamina)', unidade_compra: 'kg', preco_por_unidade_compra: 280.00, fornecedor: 'PN FARMA', categoria: 'Vitaminas' },
    { id: '3', nome: 'Vitamina B2 - Riboflavina 100%', unidade_compra: 'kg', preco_por_unidade_compra: 310.00, fornecedor: 'PN FARMA', categoria: 'Vitaminas' },
    { id: '4', nome: 'Vitamina B3 - Nicotinamida 99%', unidade_compra: 'kg', preco_por_unidade_compra: 137.86, fornecedor: 'valdequimica', categoria: 'Vitaminas' },
    { id: '5', nome: 'Vitamina B5 - D-Pantotenato de Cálcio 98%', unidade_compra: 'kg', preco_por_unidade_compra: 112.00, fornecedor: 'Analitic', categoria: 'Vitaminas' },
    { id: '6', nome: 'Vitamina B6 - Cloridrato de Piridoxina 99%', unidade_compra: 'kg', preco_por_unidade_compra: 195.00, fornecedor: 'PN Parma', categoria: 'Vitaminas' },
    { id: '7', nome: 'Vitamina B9 - Ácido Fólico', unidade_compra: 'kg', preco_por_unidade_compra: 290.00, fornecedor: 'Purifarma', categoria: 'Vitaminas' },
    { id: '8', nome: 'Vitamina B12 (Metilcobalamina)', unidade_compra: 'kg', preco_por_unidade_compra: 16131.75, fornecedor: 'Galena', categoria: 'Vitaminas' },
    { id: '9', nome: 'Vitamina B12 (Cianocobalamina)', unidade_compra: 'kg', preco_por_unidade_compra: 15500.00, fornecedor: 'PN Farma', categoria: 'Vitaminas' },
    { id: '10', nome: 'Vitamina C - Ácido Ascórbico 99%', unidade_compra: 'kg', preco_por_unidade_compra: 38.00, fornecedor: 'PN Farma', categoria: 'Vitaminas' },
    { id: '11', nome: 'Vitamina C Revestida', unidade_compra: 'kg', preco_por_unidade_compra: 42.00, fornecedor: 'Analitic', categoria: 'Vitaminas' },
    { id: '12', nome: 'Vitamina D3 - Colecalciferol 100%', unidade_compra: 'kg', preco_por_unidade_compra: 27000.00, fornecedor: 'Purifarma', categoria: 'Vitaminas' },
    { id: '13', nome: 'Vitamina E - DL-alfa-tocoferol 50%', unidade_compra: 'kg', preco_por_unidade_compra: 190.00, fornecedor: 'Purifarma', categoria: 'Vitaminas' },
    { id: '14', nome: 'Piridoxal 5-fosfato', unidade_compra: 'kg', preco_por_unidade_compra: 1000.00, fornecedor: 'Florien', categoria: 'Vitaminas' },
    { id: '15', nome: 'Biotina - Vitamina 7 (H)', unidade_compra: 'kg', preco_por_unidade_compra: 1500.00, fornecedor: 'PN FARMA', categoria: 'Vitaminas' },
    { id: '16', nome: 'Metilfolato', unidade_compra: 'kg', preco_por_unidade_compra: 11000.00, fornecedor: 'Purifarma', categoria: 'Vitaminas' },
    { id: '17', nome: 'Vitamina K2 (MKT7)', unidade_compra: 'kg', preco_por_unidade_compra: 2800.00, fornecedor: 'Florien', categoria: 'Vitaminas' },
    { id: '18', nome: 'Frutooligossacarídeos FOS', unidade_compra: 'kg', preco_por_unidade_compra: 74.00, fornecedor: 'Fagron', categoria: 'Vitaminas' },
    { id: '19', nome: 'Colina Bitartarato', unidade_compra: 'kg', preco_por_unidade_compra: 65.00, fornecedor: 'Analitic', categoria: 'Vitaminas' },
    { id: '20', nome: 'L-metionina', unidade_compra: 'kg', preco_por_unidade_compra: 38.00, fornecedor: 'Fagron', categoria: 'Vitaminas' },
    { id: '21', nome: 'Colageno Hidrolisado', unidade_compra: 'kg', preco_por_unidade_compra: 84.00, fornecedor: 'Purifarma', categoria: 'Vitaminas' },
    { id: '22', nome: 'Colageno Tipo II', unidade_compra: 'kg', preco_por_unidade_compra: 800.00, fornecedor: 'Pn Farma', categoria: 'Vitaminas' },
    { id: '23', nome: 'L-prolina', unidade_compra: 'kg', preco_por_unidade_compra: 97.00, fornecedor: 'Fagron', categoria: 'Vitaminas' },
    { id: '24', nome: 'Metilsulfonilmetano (MSM)', unidade_compra: 'kg', preco_por_unidade_compra: 78.00, fornecedor: 'Infinity', categoria: 'Vitaminas' },
    { id: '25', nome: 'Inositol', unidade_compra: 'kg', preco_por_unidade_compra: 100.00, fornecedor: 'INFINITY', categoria: 'Vitaminas' },
    { id: '26', nome: 'Coenzima Q10', unidade_compra: 'kg', preco_por_unidade_compra: 990.00, fornecedor: 'Fagron', categoria: 'Vitaminas' },
    { id: '27', nome: 'Saw Palmetto', unidade_compra: 'kg', preco_por_unidade_compra: 95.00, fornecedor: 'Florien', categoria: 'Vitaminas' },
    
    // AMINOÁCIDOS
    { id: '28', nome: 'L Theanina', unidade_compra: 'kg', preco_por_unidade_compra: 150.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '29', nome: 'L-Triptofano', unidade_compra: 'kg', preco_por_unidade_compra: 142.00, fornecedor: 'Galena', categoria: 'Aminoácidos' },
    { id: '30', nome: 'L-Tirosina', unidade_compra: 'kg', preco_por_unidade_compra: 62.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '31', nome: 'L-Glicina', unidade_compra: 'kg', preco_por_unidade_compra: 28.50, fornecedor: 'PN FARMA', categoria: 'Aminoácidos' },
    { id: '32', nome: 'L-Taurina', unidade_compra: 'kg', preco_por_unidade_compra: 19.50, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '33', nome: 'L-Carnitina', unidade_compra: 'kg', preco_por_unidade_compra: 160.00, fornecedor: 'Florien', categoria: 'Aminoácidos' },
    { id: '34', nome: 'L-Fenilalanina', unidade_compra: 'kg', preco_por_unidade_compra: 60.00, fornecedor: 'PN FARMA', categoria: 'Aminoácidos' },
    { id: '35', nome: 'L-Citrulina malato', unidade_compra: 'kg', preco_por_unidade_compra: 59.00, fornecedor: 'Florien', categoria: 'Aminoácidos' },
    { id: '36', nome: 'L-Glutamina', unidade_compra: 'kg', preco_por_unidade_compra: 55.00, fornecedor: 'PN FARMA', categoria: 'Aminoácidos' },
    { id: '37', nome: 'Passiflora/Maracuja ext seco', unidade_compra: 'kg', preco_por_unidade_compra: 53.00, fornecedor: 'infinity', categoria: 'Aminoácidos' },
    { id: '38', nome: 'Sorbato de Potássio', unidade_compra: 'kg', preco_por_unidade_compra: 120.00, fornecedor: 'Fagron', categoria: 'Aminoácidos' },
    { id: '39', nome: 'Ashwagandha', unidade_compra: 'kg', preco_por_unidade_compra: 215.00, fornecedor: 'Florien', categoria: 'Aminoácidos' },
    { id: '40', nome: 'Aspartato de L-Arginina', unidade_compra: 'kg', preco_por_unidade_compra: 72.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '41', nome: 'Arginina HCL', unidade_compra: 'kg', preco_por_unidade_compra: 42.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '42', nome: 'TCM pó (farinha coco)', unidade_compra: 'kg', preco_por_unidade_compra: 89.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '43', nome: 'Magnésio Estearato', unidade_compra: 'kg', preco_por_unidade_compra: 37.00, fornecedor: 'Fagron', categoria: 'Aminoácidos' },
    { id: '44', nome: 'Beta Alanina', unidade_compra: 'kg', preco_por_unidade_compra: 35.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '45', nome: 'Maltodextrina', unidade_compra: 'kg', preco_por_unidade_compra: 12.00, fornecedor: 'Fagron', categoria: 'Aminoácidos' },
    { id: '46', nome: 'Ginseng (Panax ginseng)', unidade_compra: 'kg', preco_por_unidade_compra: 350.00, fornecedor: 'Fagron', categoria: 'Aminoácidos' },
    { id: '47', nome: 'Acido citrico', unidade_compra: 'kg', preco_por_unidade_compra: 24.00, fornecedor: 'Purifarma', categoria: 'Aminoácidos' },
    { id: '48', nome: 'Amido de Milho', unidade_compra: 'kg', preco_por_unidade_compra: 5.20, fornecedor: 'Adicel', categoria: 'Aminoácidos' },
    { id: '49', nome: 'Cacau em pó alcalino', unidade_compra: 'kg', preco_por_unidade_compra: 35.00, fornecedor: 'adicel', categoria: 'Aminoácidos' },
    
    // MINERAIS
    { id: '50', nome: 'Ácido Aspártico', unidade_compra: 'kg', preco_por_unidade_compra: 25.00, fornecedor: 'Analitic', categoria: 'Minerais' },
    { id: '51', nome: 'N Acetil L Cisteína (Nac)', unidade_compra: 'kg', preco_por_unidade_compra: 115.00, fornecedor: 'Fagron', categoria: 'Minerais' },
    { id: '52', nome: 'L cisteina', unidade_compra: 'kg', preco_por_unidade_compra: 82.00, fornecedor: 'Purifarma', categoria: 'Minerais' },
    { id: '53', nome: 'Selenio Quelado 0,2%', unidade_compra: 'kg', preco_por_unidade_compra: 668.00, fornecedor: 'Valdequimica', categoria: 'Minerais' },
    { id: '54', nome: 'Carbonato de Cálcio', unidade_compra: 'kg', preco_por_unidade_compra: 14.00, fornecedor: 'Analitic', categoria: 'Minerais' },
    { id: '55', nome: 'Picolinato de Cromo 98 - 99%', unidade_compra: 'kg', preco_por_unidade_compra: 345.00, fornecedor: 'Analitic', categoria: 'Minerais' },
    { id: '56', nome: 'Bisglicinato Ferroso H 20%', unidade_compra: 'kg', preco_por_unidade_compra: 67.66, fornecedor: 'Natural pro', categoria: 'Minerais' },
    { id: '57', nome: 'Bisglicinato Magnésio', unidade_compra: 'kg', preco_por_unidade_compra: 80.00, fornecedor: 'Purifarma', categoria: 'Minerais' },
    { id: '58', nome: 'Zinco QUELATO', unidade_compra: 'kg', preco_por_unidade_compra: 110.00, fornecedor: 'Galena', categoria: 'Minerais' },
    { id: '59', nome: 'Bisglicinato Manganês 17%', unidade_compra: 'kg', preco_por_unidade_compra: 70.00, fornecedor: 'Embrafarma/Alpremium', categoria: 'Minerais' },
    { id: '60', nome: 'Cobre Bios 24%', unidade_compra: 'kg', preco_por_unidade_compra: 106.54, fornecedor: 'Natural pro', categoria: 'Minerais' },
    { id: '61', nome: 'Silicio Organico (Silicium Max)', unidade_compra: 'kg', preco_por_unidade_compra: 1200.00, fornecedor: 'Fagron', categoria: 'Minerais' },
    { id: '62', nome: 'Boro Quelado 55', unidade_compra: 'kg', preco_por_unidade_compra: 185.46, fornecedor: 'Natural pro', categoria: 'Minerais' },
    { id: '63', nome: 'Silício Bisglicinato 13%', unidade_compra: 'kg', preco_por_unidade_compra: 167.57, fornecedor: 'Natural pro', categoria: 'Minerais' },
    { id: '64', nome: 'Cloreto de Sódio Cristal', unidade_compra: 'kg', preco_por_unidade_compra: 21.00, fornecedor: 'Infinity', categoria: 'Minerais' },
    { id: '65', nome: 'Fosfato de Cálcio Tribasico Anidro', unidade_compra: 'kg', preco_por_unidade_compra: 35.00, fornecedor: 'Fagron', categoria: 'Minerais' },
    { id: '66', nome: 'Iodeto de Potássio 99%', unidade_compra: 'kg', preco_por_unidade_compra: 1190.76, fornecedor: 'valdequimica', categoria: 'Minerais' },
    { id: '67', nome: 'Cloreto de Potácio', unidade_compra: 'kg', preco_por_unidade_compra: 40.00, fornecedor: 'Infinity', categoria: 'Minerais' },
    { id: '68', nome: 'Citrato de Sódio', unidade_compra: 'kg', preco_por_unidade_compra: 23.72, fornecedor: 'Adicel', categoria: 'Minerais' },
    { id: '69', nome: 'Citrato de Potássio', unidade_compra: 'kg', preco_por_unidade_compra: 42.00, fornecedor: 'Infinity', categoria: 'Minerais' },
    { id: '70', nome: 'Sacarina Sódica', unidade_compra: 'kg', preco_por_unidade_compra: 112.90, fornecedor: 'Adicel', categoria: 'Minerais' },
    { id: '71', nome: 'Capsiate (piperine,Bioperine)', unidade_compra: 'kg', preco_por_unidade_compra: 2.80, fornecedor: 'Embrafarma/Alpremium', categoria: 'Minerais' },
    
    // SUBSTÂNCIAS BIOATIVAS
    { id: '72', nome: 'Cafeína Anidra 99%', unidade_compra: 'kg', preco_por_unidade_compra: 88.00, fornecedor: 'Purifarma', categoria: 'Substâncias Bioativas' },
    { id: '73', nome: 'Guaraná em Pó', unidade_compra: 'kg', preco_por_unidade_compra: 85.00, fornecedor: 'INFINITY', categoria: 'Substâncias Bioativas' },
    { id: '74', nome: 'Café Verde (35% ácido clorogênico)', unidade_compra: 'kg', preco_por_unidade_compra: 600.00, fornecedor: 'Florien', categoria: 'Substâncias Bioativas' },
    { id: '75', nome: 'Curcuma', unidade_compra: 'kg', preco_por_unidade_compra: 20.00, fornecedor: 'Natural pro', categoria: 'Substâncias Bioativas' },
    { id: '76', nome: 'Teacrine', unidade_compra: 'kg', preco_por_unidade_compra: 1382.72, fornecedor: 'Galena', categoria: 'Substâncias Bioativas' },
    { id: '77', nome: 'Melatonina', unidade_compra: 'kg', preco_por_unidade_compra: 1030.00, fornecedor: 'Infinity', categoria: 'Substâncias Bioativas' },
    { id: '78', nome: 'Ácido lactico', unidade_compra: 'L', preco_por_unidade_compra: 39.80, fornecedor: 'Adicel', categoria: 'Substâncias Bioativas', densidade: 1.2 },
    { id: '79', nome: 'Inulina 90%', unidade_compra: 'kg', preco_por_unidade_compra: 50.00, fornecedor: 'Purifarma', categoria: 'Substâncias Bioativas' },
    { id: '80', nome: 'Resveratrol', unidade_compra: 'kg', preco_por_unidade_compra: 1200.00, fornecedor: 'Purifarma', categoria: 'Substâncias Bioativas' },
    { id: '81', nome: 'Canela pó', unidade_compra: 'kg', preco_por_unidade_compra: 36.00, fornecedor: 'Santos flora', categoria: 'Substâncias Bioativas' },
    { id: '82', nome: 'Morosil', unidade_compra: 'kg', preco_por_unidade_compra: 2227.57, fornecedor: 'GALENA', categoria: 'Substâncias Bioativas' },
    { id: '83', nome: 'Propolis extrato seco', unidade_compra: 'kg', preco_por_unidade_compra: 180.00, fornecedor: 'Florien', categoria: 'Substâncias Bioativas' },
    { id: '84', nome: 'Pó de cacau', unidade_compra: 'kg', preco_por_unidade_compra: 35.00, fornecedor: 'Adicel', categoria: 'Substâncias Bioativas' },
    { id: '85', nome: 'Premix Mix Vita', unidade_compra: 'kg', preco_por_unidade_compra: 268.36, fornecedor: 'Natural Pro', categoria: 'Substâncias Bioativas' },
    
    // FIBRA ALIMENTAR
    { id: '86', nome: 'Quitosana (Fibras de crustaceos)', unidade_compra: 'kg', preco_por_unidade_compra: 50.00, fornecedor: 'Florien', categoria: 'Fibra Alimentar' },
    { id: '87', nome: 'Goma Xantana (Goma acácia sem gluten)', unidade_compra: 'kg', preco_por_unidade_compra: 54.00, fornecedor: 'Adicel', categoria: 'Fibra Alimentar' },
    { id: '88', nome: 'Celulose microcristalina 101', unidade_compra: 'kg', preco_por_unidade_compra: 51.20, fornecedor: 'Florien', categoria: 'Fibra Alimentar' },
    { id: '89', nome: 'Gelatina 235 bloom', unidade_compra: 'kg', preco_por_unidade_compra: 35.00, fornecedor: 'Fagron', categoria: 'Fibra Alimentar' },
    { id: '90', nome: 'Sorbitol Pó', unidade_compra: 'kg', preco_por_unidade_compra: 20.00, fornecedor: 'Adicel', categoria: 'Fibra Alimentar' },
    { id: '91', nome: 'Pectina Citrica', unidade_compra: 'kg', preco_por_unidade_compra: 200.00, fornecedor: 'adicel', categoria: 'Fibra Alimentar' },
    { id: '92', nome: 'Maltitol cristal', unidade_compra: 'kg', preco_por_unidade_compra: 25.00, fornecedor: 'adicel', categoria: 'Fibra Alimentar' },
    { id: '93', nome: 'agar agar', unidade_compra: 'kg', preco_por_unidade_compra: 265.00, fornecedor: 'Infinity', categoria: 'Fibra Alimentar' },
    
    // ATIVOS EMAGRECEDORES
    { id: '94', nome: 'Citrus sinensis (Laranja Moro 08%)', unidade_compra: 'kg', preco_por_unidade_compra: 600.00, fornecedor: 'PN FARMA', categoria: 'Ativos Emagrecedores' },
    
    // ÓLEOS
    { id: '95', nome: 'Glicerina Bi destilada', unidade_compra: 'L', preco_por_unidade_compra: 20.00, fornecedor: 'Fagron', categoria: 'Óleos', densidade: 1.26 },
    { id: '96', nome: 'Clorela Pó', unidade_compra: 'kg', preco_por_unidade_compra: 50.00, fornecedor: 'Santos Flora', categoria: 'Óleos' },
    
    // SUPLEMENTO ALIMENTAR
    { id: '97', nome: 'Fosfatidilserina 50%', unidade_compra: 'kg', preco_por_unidade_compra: 1000.00, fornecedor: 'PN Farma', categoria: 'Suplemento Alimentar' },
    { id: '98', nome: 'Linhaça dourada', unidade_compra: 'kg', preco_por_unidade_compra: 25.00, fornecedor: 'Santos Flora', categoria: 'Suplemento Alimentar' },
    { id: '99', nome: 'Amora Pó Folhas', unidade_compra: 'kg', preco_por_unidade_compra: 26.00, fornecedor: 'Santos Flora', categoria: 'Suplemento Alimentar' },
    
    // SUPLEMENTO ERGOGÊNICO
    { id: '100', nome: 'Creatina Monohidratada', unidade_compra: 'kg', preco_por_unidade_compra: 47.00, fornecedor: 'Florien', categoria: 'Suplemento Ergogênico' },
    { id: '101', nome: 'Corante Amarelo Gema', unidade_compra: 'kg', preco_por_unidade_compra: 130.00, fornecedor: 'Adicel', categoria: 'Suplemento Ergogênico' },
    { id: '102', nome: 'Corante Verde Folha pó', unidade_compra: 'kg', preco_por_unidade_compra: 150.00, fornecedor: 'Adicel', categoria: 'Suplemento Ergogênico' },
    
    // AROMAS
    { id: '103', nome: 'Aroma de laranja em pó', unidade_compra: 'kg', preco_por_unidade_compra: 790.00, fornecedor: 'Adicel', categoria: 'Aromas' },
    { id: '104', nome: 'Aroma de Frutas Vermelhas', unidade_compra: 'kg', preco_por_unidade_compra: 79.56, fornecedor: 'Pentaroma Criaçoes', categoria: 'Aromas' },
    { id: '105', nome: 'Aroma Maracuja (fresh drink)', unidade_compra: 'kg', preco_por_unidade_compra: 75.00, fornecedor: 'Embrafarma/Alpremium', categoria: 'Aromas' },
    { id: '106', nome: 'Aroma limao Siciliano liquido', unidade_compra: 'L', preco_por_unidade_compra: 51.48, fornecedor: 'Pentaroma criaçoes', categoria: 'Aromas' },
    { id: '107', nome: 'Aroma maça verde Liquido', unidade_compra: 'kg', preco_por_unidade_compra: 33.75, fornecedor: 'Pentaroma criaçoes', categoria: 'Aromas' },
    { id: '108', nome: 'Aroma de Morango Líquido', unidade_compra: 'L', preco_por_unidade_compra: 128.00, fornecedor: 'Pentaroma criaçoes', categoria: 'Aromas' },
    { id: '109', nome: 'Aroma de Guaraná Líquido', unidade_compra: 'L', preco_por_unidade_compra: 51.30, fornecedor: 'Pentaroma Criaçoes', categoria: 'Aromas' },
    { id: '110', nome: 'Aroma Açai Liquido', unidade_compra: 'L', preco_por_unidade_compra: 500.45, fornecedor: 'WSL Industria comercio', categoria: 'Aromas' },
    { id: '111', nome: 'Aroma de Pimenta Vermelha Líquido', unidade_compra: 'kg', preco_por_unidade_compra: 45.54, fornecedor: 'Pentaroma Criaçoes', categoria: 'Aromas' },
    { id: '112', nome: 'Aroma de Pimenta Vermelha', unidade_compra: 'kg', preco_por_unidade_compra: 79.00, fornecedor: 'Pentaroma criaçoes', categoria: 'Aromas' },
    { id: '113', nome: 'Corante vermelho Ponce', unidade_compra: 'kg', preco_por_unidade_compra: 250.00, fornecedor: 'Adicel', categoria: 'Aromas' },
    
    // SACAROSE
    { id: '114', nome: 'Sucralose edulcorante', unidade_compra: 'kg', preco_por_unidade_compra: 950.00, fornecedor: 'Ingredientes Online', categoria: 'Sacarose' },
    
    // ENZIMAS
    { id: '115', nome: 'Bromelina 2400GDU Food', unidade_compra: 'kg', preco_por_unidade_compra: 260.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '116', nome: 'Papaina 2000USP', unidade_compra: 'kg', preco_por_unidade_compra: 209.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '117', nome: 'Lactase 10.000 ALU/g', unidade_compra: 'kg', preco_por_unidade_compra: 470.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '118', nome: 'Alfa Amilase', unidade_compra: 'kg', preco_por_unidade_compra: 310.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '119', nome: 'Fitase', unidade_compra: 'kg', preco_por_unidade_compra: 990.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '120', nome: 'Alfa Galactosidase', unidade_compra: 'kg', preco_por_unidade_compra: 830.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    { id: '121', nome: 'Protease', unidade_compra: 'kg', preco_por_unidade_compra: 300.00, fornecedor: 'Purifarma', categoria: 'Enzimas' },
    
    // OUTROS
    { id: '122', nome: 'Xilitol Cristal /Xylitol', unidade_compra: 'kg', preco_por_unidade_compra: 102.50, fornecedor: 'Império Comercio de Produtos', categoria: 'Outros' },
    { id: '123', nome: 'Eritritol Cristal', unidade_compra: 'kg', preco_por_unidade_compra: 99.50, fornecedor: 'Império Comercio de Produtos', categoria: 'Outros' },
  ];
}

// Default embalagens
function getDefaultEmbalagens(): Embalagem[] {
  return [
    {
      id: '1',
      nome: 'Pote PET 120ml',
      descricao: 'Pote PET 120ml + rótulo + lacre',
      preco_unitario: 2.50,
    },
    {
      id: '2',
      nome: 'Pote Âmbar 100ml',
      descricao: 'Pote âmbar 100ml + tampa + lacre de segurança',
      preco_unitario: 3.20,
    },
    {
      id: '3',
      nome: 'Sachê Metalizado',
      descricao: 'Sachê metalizado 10x15cm + lacre térmico',
      preco_unitario: 0.80,
    },
  ];
}

// Migrate existing embalagens data to new structure
export function migrateEmbalagensData(): void {
  const data = localStorage.getItem(STORAGE_KEYS.EMBALAGENS);
  if (!data) return;

  try {
    const embalagens = JSON.parse(data) as any[];
    const migrated = embalagens.map(emb => ({
      id: emb.id,
      nome: emb.nome || emb.descricao?.split('-')[0]?.trim() || emb.descricao || 'Embalagem',
      descricao: emb.descricao || '',
      preco_unitario: emb.preco_unitario || 0,
    }));
    saveEmbalagens(migrated);
  } catch (error) {
    console.error('Error migrating embalagens:', error);
  }
}

// Calculator State Persistence
interface CalculatorState {
  cliente: string;
  nomeFormula: string;
  tipoProduto?: 'Encapsulados' | 'Pó' | 'Gummy';
  qtdCapsulas: string;
  items: Array<{
    id: string;
    insumoNome: string;
    quantidade: string;
    unidade: string;
  }>;
  selectedEmbalagens: string[];
  selectedCapsula?: string | null;
}

export function saveCalculatorState(state: CalculatorState): void {
  localStorage.setItem('calculator-state', JSON.stringify(state));
}

export function getCalculatorState(): CalculatorState | null {
  const stored = localStorage.getItem('calculator-state');
  return stored ? JSON.parse(stored) : null;
}

export function clearCalculatorState(): void {
  localStorage.removeItem('calculator-state');
}
