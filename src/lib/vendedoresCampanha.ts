// Reconhecimento do vendedor a partir do nome da campanha (Meta Ads).
// Regras: sem acento, sem diferenciar maiúsculas, casamento por palavra inteira.

export const VENDEDORES_CAMPANHA: { nome: string; apelidos: string[] }[] = [
  { nome: 'Emmanuel', apelidos: ['emmanuel', 'emanuel', 'emanoel', 'manoel', 'manu'] },
  { nome: 'Guilherme', apelidos: ['guilherme', 'guillherme', 'gui'] },
  { nome: 'Everton', apelidos: ['everton', 'evert', 'ton'] },
];

function normalizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Retorna o nome canônico do vendedor citado na campanha, ou null (campanha geral).
 * Se houver mais de um nome, vale o primeiro que aparece no texto.
 */
export function detectarVendedorNaCampanha(nomeCampanha: string): string | null {
  const texto = normalizar(nomeCampanha);
  if (!texto) return null;

  let melhor: { nome: string; pos: number } | null = null;

  for (const v of VENDEDORES_CAMPANHA) {
    for (const apelido of v.apelidos) {
      const re = new RegExp(`(^|[^a-z0-9])${apelido}([^a-z0-9]|$)`, 'i');
      const m = re.exec(texto);
      if (m) {
        const pos = m.index + (m[1] ? m[1].length : 0);
        if (!melhor || pos < melhor.pos) melhor = { nome: v.nome, pos };
      }
    }
  }

  return melhor ? melhor.nome : null;
}
