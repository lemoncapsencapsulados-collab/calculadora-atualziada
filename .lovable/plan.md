

# Plano: Preservar quantidade e dose ao carregar fórmula

## Problema

Ao carregar uma fórmula salva, o fluxo é:
1. `loadFormula` effect sets `cliente`, `nomeFormula`, `tipoProduto`, `qtdCapsulas`, `unidadesPorDose` ✅
2. `tipoProduto` change triggers second `useEffect` (linha 150) which **resets** `qtdCapsulas` and `unidadesPorDose` to defaults ❌

## Solução

Adicionar um flag `isLoadingFormula` (ref) que:
1. É setado para `true` antes de aplicar os dados da fórmula
2. No `useEffect` de `tipoProduto`, se `isLoadingFormula.current` é `true`, pula o reset de defaults e embalagens, e seta o flag para `false`
3. Isso preserva os valores originais da fórmula carregada

### Alterações em `Calculator.tsx`

1. **Adicionar ref**: `const isLoadingFormula = useRef(false);`

2. **No useEffect de loadFormula** (linha 62): setar `isLoadingFormula.current = true` antes de aplicar os dados

3. **No useEffect de tipoProduto** (linha 150): adicionar guard no início:
```typescript
if (isLoadingFormula.current) {
  isLoadingFormula.current = false;
  return;
}
```

Isso garante que trocar tipo manualmente continua aplicando defaults, mas carregar uma fórmula preserva os valores salvos.

## Arquivo modificado
- `src/pages/Calculator.tsx`

