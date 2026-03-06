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
 * Format currency in BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 13,
  }).format(value);
}

/**
 * Format currency in BRL with detailed precision (up to 8 decimal places)
 * Used for small quantities where precision is critical
 */
export function formatCurrencyDetailed(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 13,
  }).format(value);
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
