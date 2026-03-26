

# Plano: Validação visual + bloqueio de salvamento para Solúvel e Encapsulados

## Alterações em `Calculator.tsx`

### 1. Adicionar alertas visuais para Solúvel (após linha 956)

Dois blocos condicionais na seção "Análise da Composição do Solúvel":

- **Alerta amber (≥90%)**: quando `totaisInsumosMG.totalMG >= unidadesPorDoseEmMG * 0.9` mas não excede. Mostra percentual de preenchimento.
- **Alerta vermelho (excedido)**: quando `totaisInsumosMG.totalMG > unidadesPorDoseEmMG`. Mostra excedente em mg, usa `animate-pulse`, mesma estilização do alerta de Encapsulados.

### 2. Criar variável de controle `capacidadeExcedida`

Adicionar um `useMemo` que retorna `true` quando a MP excede o limite, para ambos os tipos:

```typescript
const capacidadeExcedida = useMemo(() => {
  if (tipoProduto === 'Encapsulados') {
    return totaisInsumosMG.totalMG > (parseFloat(unidadesPorDose) || 1) * 500;
  }
  if (tipoProduto === 'Solúvel') {
    return totaisInsumosMG.totalMG > unidadesPorDoseEmMG;
  }
  return false;
}, [tipoProduto, totaisInsumosMG.totalMG, unidadesPorDose, unidadesPorDoseEmMG]);
```

### 3. Bloquear salvamento (linha 1370)

Adicionar `capacidadeExcedida` à condição `disabled` do botão Salvar:

```typescript
<Button onClick={handleSave} disabled={!cliente || custoTotal === 0 || capacidadeExcedida}>
```

### 4. Validação no `handleSave` (linha 510)

Adicionar check redundante no início da função para segurança:

```typescript
if (capacidadeExcedida) {
  toast.error('Capacidade de matéria-prima por dose excedida. Ajuste antes de salvar.');
  return;
}
```

## Arquivo modificado
- `src/pages/Calculator.tsx`

