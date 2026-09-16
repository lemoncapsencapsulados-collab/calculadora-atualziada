export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(nums)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(nums[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(nums[10]);
}

export function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(nums)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = 0;
  for (let i = 0; i < 12; i++) soma += parseInt(nums[i]) * pesos1[i];
  let resto = soma % 11;
  const dig1 = resto < 2 ? 0 : 11 - resto;
  if (dig1 !== parseInt(nums[12])) return false;

  soma = 0;
  for (let i = 0; i < 13; i++) soma += parseInt(nums[i]) * pesos2[i];
  resto = soma % 11;
  const dig2 = resto < 2 ? 0 : 11 - resto;
  return dig2 === parseInt(nums[13]);
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Formata nomes próprios em "Title Case" preservando acentos.
 * Mantém conectivos (de, da, do, dos, das, e) em minúsculo (exceto no início).
 * Mantém siglas ALL CAPS curtas (ex: LTDA, ME, EPP, S/A) em maiúsculo.
 */
export function formatarNomeProprio(input: string | null | undefined): string {
  if (!input) return '';
  const conectivos = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'di', 'du']);
  const siglas = new Set(['ltda', 'me', 'epp', 'eireli', 's/a', 'sa', 'cia', 'inc', 'ltd']);
  const limpo = String(input).replace(/\s+/g, ' ').trim();
  if (!limpo) return '';
  return limpo
    .split(' ')
    .map((palavra, idx) => {
      const baixo = palavra.toLowerCase();
      if (siglas.has(baixo)) return palavra.toUpperCase();
      if (idx > 0 && conectivos.has(baixo)) return baixo;
      // Suporta hífen e apóstrofo (ex: D'Avila, Saint-Germain)
      return baixo.replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}
