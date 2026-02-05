
## Plano: Garantir PDF em Pagina Unica A4 e Melhorar Preview

### Status Atual

Apos testes no browser, verifiquei que:
- O **preview do PDF esta funcionando** no "Gerar Orcamento"
- A **Proposta Completa** tambem gera preview corretamente
- O layout compacto ja esta implementado em ambos os arquivos

### Problema Identificado

O PDF pode ultrapassar 1 pagina quando:
1. Ha muitos produtos na tabela
2. Ha muitos servicos
3. Observacoes ou forma de pagamento sao muito longos

### Solucao Proposta

#### 1. Adicionar Controle de Altura no `orcamentoGenerator.ts`

Verificar se o conteudo total vai ultrapassar a altura A4 e ajustar dinamicamente:

```typescript
const MAX_CONTENT_HEIGHT = 265; // A4 (297mm) - margens (32mm)

function calculateTotalHeight(orcamento: Orcamento): number {
  let height = 28; // header
  height += 20; // dados cliente
  height += Math.min(orcamento.itens_producao?.length || 0, 5) * 8; // max 5 produtos visiveis
  height += Math.min(orcamento.servicos_marca?.length || 0, 3) * 6; // max 3 servicos
  height += 20; // total box
  height += 10; // forma pagamento
  height += 10; // observacoes
  height += 15; // footer
  return height;
}
```

#### 2. Limitar Itens Exibidos em Tabelas

Para garantir pagina unica, limitar quantidade de itens nas tabelas:

- **Produtos**: Exibir ate 6 produtos; se mais, mostrar resumo
- **Servicos**: Exibir ate 4 servicos; se mais, consolidar
- **Composicao**: Ja esta truncada em 3 insumos

#### 3. Fallback para Multiplas Paginas

Se o conteudo for muito grande para uma pagina, usar layout com quebras de pagina controladas:

```typescript
const useSinglePageMode = calculateTotalHeight(orcamento) <= MAX_CONTENT_HEIGHT;

if (useSinglePageMode) {
  // Layout compacto atual
} else {
  // Layout expandido com checkPageBreak
}
```

#### 4. Atualizar `propostaGenerator.ts` 

Aplicar mesmas melhorias para manter consistencia.

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/lib/orcamentoGenerator.ts` | Adicionar calculo de altura e modo dual (pagina unica vs multiplas) |
| `src/lib/propostaGenerator.ts` | Sincronizar estilo e aplicar mesmas otimizacoes |

---

### Detalhes Tecnicos

#### Funcao de Calculo de Altura

```typescript
function estimateTotalContentHeight(orcamento: Orcamento): number {
  const headerHeight = 28;
  const clienteHeight = 20;
  const produtosHeight = Math.min((orcamento.itens_producao?.length || 0) * 10, 60) + 15; // max 60mm
  const servicosHeight = orcamento.servicos_marca?.length ? 
    Math.min((orcamento.servicos_marca.length) * 8, 32) + 12 : 0;
  const freteHeight = orcamento.detalhamento_frete ? 15 : 0;
  const totalHeight = 18;
  const pagamentoHeight = orcamento.forma_pagamento ? 8 : 0;
  const obsHeight = orcamento.observacoes ? 8 : 0;
  const footerHeight = 12;
  
  return headerHeight + clienteHeight + produtosHeight + servicosHeight + 
         freteHeight + totalHeight + pagamentoHeight + obsHeight + footerHeight;
}
```

#### Modo Dual de Renderizacao

```typescript
async function createOrcamentoPDF(orcamento: Orcamento): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const estimatedHeight = estimateTotalContentHeight(orcamento);
  const singlePageMode = estimatedHeight <= 265;
  
  if (singlePageMode) {
    // Usar fontes compactas e layout atual
    return renderSinglePage(doc, orcamento);
  } else {
    // Usar layout com quebras de pagina controladas
    return renderMultiPage(doc, orcamento);
  }
}
```

#### Truncar Tabela de Produtos se Necessario

```typescript
function renderProdutos(doc, orcamento, yPos, maxRows = 10) {
  const itens = orcamento.itens_producao?.slice(0, maxRows) || [];
  const hasMore = (orcamento.itens_producao?.length || 0) > maxRows;
  
  // Renderizar tabela...
  
  if (hasMore) {
    // Adicionar linha: "... e mais X produtos"
  }
}
```

---

### Resultado Esperado

1. PDFs com poucos itens: uma unica pagina A4
2. PDFs com muitos itens: multiplas paginas bem formatadas
3. Preview funcionando em ambos os casos
4. Consistencia entre Orcamento e Proposta Completa
