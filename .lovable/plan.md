

## Plano: Effect de tipo roda apenas em troca manual

### Problema raiz
O `useEffect([tipoProduto])` roda na montagem (com `tipoProduto = 'Encapsulados'`) e consome o flag `isLoadingFormula`. Quando a fórmula carregada muda o tipo, o effect roda de novo sem proteção e sobrescreve os valores salvos.

### Solução
Remover toda a lógica de defaults e embalagens do `useEffect([tipoProduto])` e movê-la para um handler explícito que só é chamado pelo `Select` de tipo de produto.

### Alterações em `Calculator.tsx`

**1. Criar handler `handleTipoProdutoChange`**
```typescript
const handleTipoProdutoChange = (novoTipo: TipoProduto) => {
  setTipoProduto(novoTipo);
  
  // Defaults só aplicados em troca manual
  switch (novoTipo) {
    case 'Encapsulados': setQtdCapsulas('60'); setUnidadesPorDose('2'); break;
    case 'Solúvel': setUnidadeSoluvel('g'); setQtdCapsulas('300'); setUnidadesPorDose('10'); break;
    case 'Gummy': setQtdCapsulas('60'); setUnidadesPorDose('2'); break;
    case 'Líquido': setQtdCapsulas('30'); setUnidadesPorDose('1'); break;
  }
  
  // Pré-seleção de embalagens
  const config = EMBALAGENS_POR_TIPO[novoTipo];
  if (config) {
    setSelectedCapsula(config.capsula);
    const newEmbalagens = new Set<string>(config.embalagens);
    if (novoTipo === 'Solúvel') { /* dosador logic */ }
    setSelectedEmbalagens(newEmbalagens);
  }
};
```

**2. Remover o `useEffect([tipoProduto])` inteiro** (linhas 154-197)

**3. No `Select` de tipo de produto**, trocar `onValueChange={setTipoProduto}` por `onValueChange={handleTipoProdutoChange}`

**4. No carregamento da fórmula** (linhas 62-124), remover o flag `isLoadingFormula` e a ref, pois não são mais necessários — o effect que causava o problema não existe mais. O `setTipoProduto(...)` no carregamento agora apenas muda o estado sem efeitos colaterais.

### Resultado
- Troca manual de tipo → aplica defaults e embalagens automáticas
- Carregamento de fórmula → preserva valores salvos intactos
- Sem separação de fluxo edição/criação — mesma lógica, sem effects problemáticos

### Arquivo
- `src/pages/Calculator.tsx`

