

# Adicionar "Unidade" no select de unidades + Cápsula não obrigatória

## Alterações

### 1. Adicionar "unidade" no select de unidades — `src/pages/Calculator.tsx`
Na linha ~760, dentro do `<SelectContent>` de unidade dos itens da fórmula, adicionar:
```
<SelectItem value="unidade">Unidade</SelectItem>
```
Isso já é suportado pelo tipo `UnitType` e pela lógica de `calcularCustoInsumo` em `unitConversion.ts`.

### 2. Remover obrigatoriedade da cápsula para Encapsulados — `src/pages/Calculator.tsx`
Na linha ~441, remover a validação que bloqueia salvar sem cápsula selecionada:
```typescript
// REMOVER:
if (tipoProduto === 'Encapsulados' && !selectedCapsula) {
  toast.error('Selecione o tipo de cápsula');
  return;
}
```

## Arquivos Modificados
- `src/pages/Calculator.tsx` — 2 edições pontuais

