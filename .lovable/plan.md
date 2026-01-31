

## Plano: Incluir Insumos/Dose no PDF do Orcamento (Simplificado)

### Objetivo
Quando o PDF do orcamento for gerado em "Orcamentos Gerados", incluir para cada produto vindo de "Precificacoes Salvas" apenas a lista de insumos com suas quantidades e unidades de medida.

**O que incluir:**
- Nome do insumo
- Quantidade
- Unidade de medida

**O que NAO incluir:**
- Preco dos insumos
- Embalagens

---

### Alteracao no Tipo ItemProducao

Adicionar campo para armazenar os insumos da formula:

```typescript
export interface InsumoSnapshot {
  nome: string;
  quantidade: number;
  unidade: string;
}

export interface ItemProducao {
  // campos existentes...
  insumos_formula?: InsumoSnapshot[];
}
```

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/types/orcamento.ts` | Adicionar interface `InsumoSnapshot` e campo `insumos_formula` em `ItemProducao` |
| `src/components/GerarOrcamentoDialog.tsx` | Buscar insumos da formula ao adicionar precificacao |
| `src/lib/orcamentoGenerator.ts` | Adicionar lista de insumos abaixo de cada produto no PDF |

---

### Exemplo Visual do PDF Final

```text
CUSTOS DE PRODUCAO
+-------+-------------------+-----+------------+
| #     | Produto           | Qtd | Valor      |
+-------+-------------------+-----+------------+
| 1     | Vitamina C 500mg  | 100 | R$ 4.500   |
+-------+-------------------+-----+------------+

    Composicao:
    • Vitamina C (Acido Ascorbico) - 500 mg
    • Zinco Quelato - 15 mg
    • Vitamina D3 - 2000 UI
    • Selenio Quelato - 55 mcg

+-------+-------------------+-----+------------+
| 2     | Omega 3 Premium   | 50  | R$ 1.900   |
+-------+-------------------+-----+------------+

    Composicao:
    • Omega 3 (EPA/DHA) - 1000 mg
    • Vitamina E - 10 UI
```

---

### Detalhes Tecnicos

#### Em GerarOrcamentoDialog.tsx

Ao adicionar precificacao, buscar e mapear apenas os insumos:

```typescript
const insumos_formula = formula?.itens?.map(item => ({
  nome: item.nome_insumo_snapshot,
  quantidade: item.qtd_informada,
  unidade: item.unidade_informada,
})) || [];
```

#### Em orcamentoGenerator.ts

Apos cada produto de precificacao, listar insumos:

```typescript
if (item.tipo === 'precificacao' && item.insumos_formula?.length) {
  doc.setFontSize(9);
  doc.text('Composição:', x, yPos);
  yPos += 4;
  
  item.insumos_formula.forEach(insumo => {
    doc.text(
      `• ${insumo.nome} - ${insumo.quantidade} ${insumo.unidade}`,
      x + 5,
      yPos
    );
    yPos += 3.5;
  });
}
```

---

### Sequencia de Implementacao

1. Atualizar tipos em `src/types/orcamento.ts`
2. Modificar `GerarOrcamentoDialog.tsx` para buscar insumos
3. Atualizar `orcamentoGenerator.ts` para renderizar composicao no PDF

