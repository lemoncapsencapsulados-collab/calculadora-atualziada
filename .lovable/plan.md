## Ajustes na Análise Apurada do Vendedor

### 1. Scroll do modal não rola até o fim
**Arquivo:** `src/components/dashboard/AnaliseVendedorDialog.tsx`
- O `ScrollArea` interno está dentro de outro `DialogContent` com `overflow-hidden`, e os cards finais (Setups) ficam cortados.
- Ajustar: dar altura/min-height correta ao container flex, garantir `flex-1 min-h-0` no wrapper do ScrollArea, e adicionar `pb-6` no conteúdo para folga no final.

### 2. Normalizar tipos de produto (Encapsulado vs Encapsulados)
**Arquivo:** `src/lib/analiseVendedor.ts`
- Hoje o `segmento` vem com variações ("Encapsulado", "Encapsulados", "Líquido", "Liquido", "Solúvel/Soluvel", "Gummy/Gomas").
- Criar função `normalizarSegmento()` que mapeia tudo para 4 chaves canônicas: **Encapsulado**, **Líquido**, **Solúvel**, **Gummy**.
- Resultado esperado no exemplo: `Encapsulado: 800`, `Líquido: 7156`, `Solúvel: 300`, `Gummy: 150` (sem duplicar). Remover a chave "Outro" se ficar vazia.

### 3. Explicar/renomear coluna "Vezes"
**Arquivo:** `src/components/dashboard/AnaliseVendedorDialog.tsx`
- Hoje "Vezes" = número de linhas (itens) do produto somadas entre todas as vendas (ex.: Mounjax aparece 2x = vendido em 2 orçamentos distintos).
- Renomear coluna para **"Nº de vendas"** com um ícone de tooltip explicando: *"Quantas vendas diferentes incluíram este produto"*.
- Aplicar a mesma mudança no PDF (`Produto | Nº de vendas | Potes | Receita`).

### Resultado
- Modal rola até o fim mostrando o card "Setups vendidos".
- Apenas 4 badges de tipo de produto, somando corretamente (Encapsulado: 800, não 0 + 800).
- Coluna com nome claro e tooltip explicativo.
