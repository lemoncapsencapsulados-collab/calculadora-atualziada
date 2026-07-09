import { montarDadosZapSign, type ZapSignContratoCampos, type ZapSignReplacement } from './zapsignContrato';

// Normaliza nome de variável (sem chaves) para comparação flexível
export function normalizarVariavel(nome: string): string {
  return String(nome || '')
    .replace(/^\{\{|\}\}$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Constrói mapa { NORMALIZED_VAR: valor } a partir de todos os aliases conhecidos.
export function construirMapaAutoFill(campos: ZapSignContratoCampos): Record<string, string> {
  const replacements: ZapSignReplacement[] = montarDadosZapSign(campos);
  const mapa: Record<string, string> = {};
  for (const r of replacements) {
    const key = normalizarVariavel(r.de);
    if (key && !mapa[key] && r.para) mapa[key] = r.para;
  }
  return mapa;
}

// Retorna valor pré-preenchido para uma variável detectada no modelo (por nome sem chaves)
export function preencherAutomatico(variavel: string, mapa: Record<string, string>): string {
  const key = normalizarVariavel(variavel);
  return mapa[key] || '';
}