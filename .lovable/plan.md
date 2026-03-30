

## Plano: Campos de quantidade total como input livre

### Alteração em `Calculator.tsx` (linhas 715-739)

Substituir o `Select` de quantidade total por um `Input` numérico, permitindo qualquer valor:

```tsx
<Input
  id="qtdCapsulas"
  type="number"
  min="1"
  value={qtdCapsulas}
  onChange={(e) => setQtdCapsulas(e.target.value)}
  placeholder={tipoProduto === 'Encapsulados' ? 'Ex: 60' : tipoProduto === 'Solúvel' ? 'Ex: 300' : tipoProduto === 'Gummy' ? 'Ex: 60' : 'Ex: 30'}
/>
```

O sufixo da unidade (cápsulas, gramas, gummies, mL) será exibido no texto auxiliar abaixo do campo.

Atualizar também o texto auxiliar para refletir a unidade correspondente ao tipo selecionado.

### Arquivo
- `src/pages/Calculator.tsx`

