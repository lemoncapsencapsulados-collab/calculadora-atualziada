import { UnitType, Insumo, FormulaItem } from "@/types/formula";
import { arredondarReais } from "@/lib/utils";

/**
 * Convert value to base unit (g for mass, mL for volume)
 */
function toBase(value: number, unit: UnitType): number {
  switch (unit) {
    // Mass conversions → g
    case "kg":
      return value * 1000;
    case "g":
      return value;
    case "mg":
      return value / 1000;
    case "mcg":
      return value / 1_000_000;

    // Volume conversions → mL
    case "L":
      return value * 1000;
    case "mL":
      return value;

    // No conversion needed
    case "UI":
    case "unidade":
      return value;

    default:
      throw new Error(`Unidade '${unit}' não suportada.`);
  }
}

/**
 * Check if unit is a mass unit
 */
function isMassUnit(unit: UnitType): boolean {
  return ["kg", "g", "mg", "mcg"].includes(unit);
}

/**
 * Check if unit is a volume unit
 */
function isVolumeUnit(unit: UnitType): boolean {
  return ["L", "mL"].includes(unit);
}

/**
 * Calculate cost for a single formula item
 */
export function calcularCustoInsumo(item: FormulaItem, insumo: Insumo): number {
  const { qtd_informada, unidade_informada } = item;
  const { unidade_compra, preco_por_unidade_compra, densidade } = insumo;

  // Handle UI and unidade specially (no conversion needed)
  if (unidade_compra === "UI" || unidade_compra === "unidade") {
    if (unidade_informada !== unidade_compra) {
      throw new Error(
        `Para insumo comprado em ${unidade_compra}, a quantidade deve ser informada em ${unidade_compra}.`,
      );
    }
    return qtd_informada * preco_por_unidade_compra;
  }

  // If price is in mass units (kg, g, mg)
  if (isMassUnit(unidade_compra)) {
    let quantidadeEmKg: number;

    if (isMassUnit(unidade_informada)) {
      // Mass → mass conversion
      const quantidadeEmG = toBase(qtd_informada, unidade_informada);
      quantidadeEmKg = quantidadeEmG / 1000;
    } else if (isVolumeUnit(unidade_informada)) {
      // Volume → mass conversion (requires density)
      if (!densidade) {
        throw new Error(
          `Para converter ${unidade_informada}→${unidade_compra}, informe a densidade (g/mL) do insumo '${insumo.nome}'.`,
        );
      }
      const quantidadeEmML = toBase(qtd_informada, unidade_informada);
      const quantidadeEmG = quantidadeEmML * densidade;
      quantidadeEmKg = quantidadeEmG / 1000;
    } else {
      throw new Error(`Conversão não suportada: ${unidade_informada} → ${unidade_compra}`);
    }

    // Convert purchase unit to kg if needed
    const precoEmKg =
      unidade_compra === "kg"
        ? preco_por_unidade_compra
        : preco_por_unidade_compra * (unidade_compra === "g" ? 1000 : 1_000_000);

    return quantidadeEmKg * precoEmKg;
  }

  // If price is in volume units (L, mL)
  if (isVolumeUnit(unidade_compra)) {
    let quantidadeEmL: number;

    if (isVolumeUnit(unidade_informada)) {
      // Volume → volume conversion
      const quantidadeEmML = toBase(qtd_informada, unidade_informada);
      quantidadeEmL = quantidadeEmML / 1000;
    } else if (isMassUnit(unidade_informada)) {
      // Mass → volume conversion (requires density)
      if (!densidade) {
        throw new Error(
          `Para converter ${unidade_informada}→${unidade_compra}, informe a densidade (g/mL) do insumo '${insumo.nome}'.`,
        );
      }
      const quantidadeEmG = toBase(qtd_informada, unidade_informada);
      const quantidadeEmML = quantidadeEmG / densidade;
      quantidadeEmL = quantidadeEmML / 1000;
    } else {
      throw new Error(`Conversão não suportada: ${unidade_informada} → ${unidade_compra}`);
    }

    // Convert purchase unit to L if needed
    const precoEmL = unidade_compra === "L" ? preco_por_unidade_compra : preco_por_unidade_compra * 1000;

    return quantidadeEmL * precoEmL;
  }

  throw new Error(`Unidade de compra '${unidade_compra}' não suportada.`);
}

/**
 * Format currency in BRL (always 2 decimal places, cascading rounding)
 */
export function formatCurrency(value: number): string {
  const rounded = arredondarReais(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * @deprecated Use formatCurrency instead - kept for backward compatibility
 */
export const formatCurrencyDetailed = formatCurrency;

/**
 * Format currency keeping extra precision when value is sub-cent.
 * - |v| >= 0.01  → standard R$ x,xx
 * - 0 < |v| < 0.01 → expand decimals (up to 20) so the value is visible
 *   (shows first significant digit + 2 more, e.g. R$ 0,0000217)
 * - 0 → R$ 0,00
 */
export function formatCurrencyPrecise(value: number, extraSignificant: number = 2): string {
  if (!isFinite(value) || value === 0) return formatCurrency(value || 0);
  const abs = Math.abs(value);
  if (abs >= 0.01) return formatCurrency(value);

  // Expand decimals: find position of first significant digit
  const fixed = abs.toFixed(20); // "0.000021700000..."
  const decPart = fixed.split('.')[1] || '';
  let firstSig = -1;
  for (let i = 0; i < decPart.length; i++) {
    if (decPart[i] !== '0') { firstSig = i; break; }
  }
  if (firstSig === -1) return formatCurrency(0);
  const decimals = Math.min(20, firstSig + 1 + extraSignificant);
  // Trim trailing zeros but keep at least firstSig+1 digits
  let out = abs.toFixed(decimals);
  out = out.replace(/0+$/, '').replace(/\.$/, '');
  const sign = value < 0 ? '-' : '';
  return `${sign}R$ ${out.replace('.', ',')}`;
}

/**
 * Format unit for display
 */
export function formatUnit(unit: UnitType): string {
  const unitMap: Record<UnitType, string> = {
    mcg: "mcg",
    mg: "mg",
    g: "g",
    kg: "kg",
    mL: "mL",
    L: "L",
    UI: "UI",
    unidade: "un",
  };
  return unitMap[unit] || unit;
}
