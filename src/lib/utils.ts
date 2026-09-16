import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Arredondamento em cascata para valores em Reais.
 * Da última casa decimal para a esquerda, aplica 0–4 mantém / 5–9 soma 1,
 * repetindo até sobrar exatamente 2 casas decimais.
 */
export function arredondarReais(valor: number): number {
  if (!isFinite(valor)) return valor;

  const sign = valor < 0 ? -1 : 1;
  // Usar 10 casas para capturar precisão suficiente do float
  const str = Math.abs(valor).toFixed(10);
  const [intPart, decPart] = str.split('.');
  const digits = decPart.split('').map(Number);

  // Arredondar da direita para a esquerda até sobrar 2 dígitos
  while (digits.length > 2) {
    const last = digits.pop()!;
    if (last >= 5 && digits.length > 0) {
      digits[digits.length - 1] += 1;
    }
    // Propagar carry
    for (let i = digits.length - 1; i > 0; i--) {
      if (digits[i] >= 10) {
        digits[i] -= 10;
        digits[i - 1] += 1;
      } else break;
    }
  }

  let intNum = parseInt(intPart);
  if (digits.length > 0 && digits[0] >= 10) {
    digits[0] -= 10;
    intNum += 1;
  }

  return sign * parseFloat(`${intNum}.${digits.map(d => Math.min(d, 9)).join('')}`);
}
