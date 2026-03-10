export const ESTADOS_CIVIS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'Separado(a)',
  'União Estável',
];

export const UFS_BRASIL = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

export async function fetchCidadesPorUF(uf: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((m: { nome: string }) => m.nome);
  } catch {
    return [];
  }
}

export function getOpcoesPote(segmento: string): string[] {
  const seg = segmento.toLowerCase();
  if (seg.includes('gummy')) return ['Transparente'];
  if (seg.includes('solúvel') || seg.includes('soluvel')) return ['Preto'];
  // Encapsulado e Líquido
  return ['Preto', 'Transparente'];
}

export function getOpcoesTampa(segmento: string): string[] {
  const seg = segmento.toLowerCase();
  if (seg.includes('gummy')) return ['Branca'];
  if (seg.includes('líquido') || seg.includes('liquido')) return ['Preta'];
  if (seg.includes('solúvel') || seg.includes('soluvel')) return ['Preta'];
  // Encapsulado
  return ['Preta', 'Branca'];
}
