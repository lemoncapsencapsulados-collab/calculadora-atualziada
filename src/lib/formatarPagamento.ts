// Utility to format payment conditions into human-readable strings

import { calcularComJuros, rotuloJurosExtenso } from '@/lib/jurosParcelas';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarCondicoesPagamento(condicoes: any, valorTotal?: number): string[] {
  if (!condicoes) return [];
  const lines: string[] = [];
  const metodo = condicoes.metodo_principal;

  if (metodo === 'pix_boleto') {
    lines.push('Método: Pix / Boleto');
    const parcelas = condicoes.parcelas_pix_boleto || [];
    parcelas.forEach((p: any, i: number) => {
      const val = p.tipo_valor === 'percentual' && valorTotal
        ? (p.valor / 100) * valorTotal
        : p.valor;
      lines.push(`  Parcela ${i + 1}: ${fmt(val)}${p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : ''}`);
    });
  } else if (metodo === 'cartao_credito') {
    lines.push('Método: Cartão de Crédito');
    const cartoes = condicoes.cartoes || [];
    cartoes.forEach((c: any, i: number) => {
      const val = c.tipo_valor === 'percentual' && valorTotal
        ? (c.valor / 100) * valorTotal
        : c.valor;
      const { taxa, totalComJuros, valorParcela } = calcularComJuros(val, c);
      lines.push(`  Cartão ${i + 1}: ${c.parcelas}x de ${fmt(valorParcela)}${rotuloJurosExtenso(taxa)} — Total: ${fmt(totalComJuros)}`);
    });
  } else if (metodo === 'misto') {
    lines.push('Método: Misto (Pix/Boleto + Cartão)');
    const parcelas = condicoes.misto_parcelas_pix_boleto || [];
    if (parcelas.length > 0) {
      lines.push('  Pix/Boleto:');
      parcelas.forEach((p: any, i: number) => {
        const val = p.tipo_valor === 'percentual' && valorTotal
          ? (p.valor / 100) * valorTotal
          : p.valor;
        lines.push(`    Parcela ${i + 1}: ${fmt(val)}${p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : ''}`);
      });
    }
    const cartoes = condicoes.misto_cartoes || [];
    if (cartoes.length > 0) {
      lines.push('  Cartão de Crédito:');
      cartoes.forEach((c: any, i: number) => {
        const val = c.tipo_valor === 'percentual' && valorTotal
          ? (c.valor / 100) * valorTotal
          : c.valor;
        const { taxa, totalComJuros, valorParcela } = calcularComJuros(val, c);
        lines.push(`    Cartão ${i + 1}: ${c.parcelas}x de ${fmt(valorParcela)}${rotuloJurosExtenso(taxa)} — Total: ${fmt(totalComJuros)}`);
      });
    }
  } else if (condicoes.valor_entrada || condicoes.valor_termino) {
    // Legacy format
    if (condicoes.valor_entrada) {
      lines.push(`Entrada: ${fmt(condicoes.valor_entrada)} (${condicoes.forma_pagamento_entrada || '-'})`);
    }
    if (condicoes.valor_termino) {
      lines.push(`Término: ${fmt(condicoes.valor_termino)} (${condicoes.forma_pagamento_termino || '-'})`);
    }
  }

  return lines;
}

export function formatarPagamentoResumo(condicoes: any, valorTotal?: number): string {
  const lines = formatarCondicoesPagamento(condicoes, valorTotal);
  return lines.join('\n');
}

// Versão organizada para inserir em contratos — sem a palavra "Misto"
// e com sentenças legíveis, adequadas para preencher em documentos.
export function formatarCondicoesParaContrato(condicoes: any, valorTotal?: number): string {
  if (!condicoes) return '';
  const metodo = condicoes.metodo_principal;
  const partes: string[] = [];

  const formatarParcelasPB = (parcelas: any[], prefixo = 'Parcela') => {
    return parcelas.map((p: any, i: number) => {
      const val = p.tipo_valor === 'percentual' && valorTotal ? (p.valor / 100) * valorTotal : p.valor;
      const pct = p.tipo_valor === 'percentual' ? ` (${p.valor}%)` : '';
      const venc = p.data_vencimento ? ` vencendo em ${new Date(p.data_vencimento).toLocaleDateString('pt-BR')}` : '';
      return `${prefixo} ${i + 1}: ${fmt(val)}${pct}${venc}`;
    });
  };

  const formatarCartoes = (cartoes: any[]) => {
    return cartoes.map((c: any, i: number) => {
      const val = c.tipo_valor === 'percentual' && valorTotal ? (c.valor / 100) * valorTotal : c.valor;
      const { taxa, totalComJuros, valorParcela } = calcularComJuros(val, c);
      return `Cartão ${i + 1}: ${c.parcelas}x de ${fmt(valorParcela)}${rotuloJurosExtenso(taxa)} — Total: ${fmt(totalComJuros)}`;
    });
  };

  if (metodo === 'pix_boleto') {
    const linhas = formatarParcelasPB(condicoes.parcelas_pix_boleto || []);
    partes.push(`Pix/Boleto — ${linhas.join('; ')}`);
  } else if (metodo === 'cartao_credito') {
    const linhas = formatarCartoes(condicoes.cartoes || []);
    partes.push(`Cartão de Crédito — ${linhas.join('; ')}`);
  } else if (metodo === 'misto') {
    const parcelasPB = condicoes.misto_parcelas_pix_boleto || [];
    const cartoes = condicoes.misto_cartoes || [];
    if (parcelasPB.length) partes.push(`Pix/Boleto — ${formatarParcelasPB(parcelasPB).join('; ')}`);
    if (cartoes.length) partes.push(`Cartão de Crédito — ${formatarCartoes(cartoes).join('; ')}`);
  } else if (condicoes.valor_entrada || condicoes.valor_termino) {
    if (condicoes.valor_entrada) partes.push(`Entrada: ${fmt(condicoes.valor_entrada)} (${condicoes.forma_pagamento_entrada || '-'})`);
    if (condicoes.valor_termino) partes.push(`Término: ${fmt(condicoes.valor_termino)} (${condicoes.forma_pagamento_termino || '-'})`);
  }

  return partes.join('. ');
}
