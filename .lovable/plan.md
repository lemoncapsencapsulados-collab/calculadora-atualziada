# Plano: Pré-seleção automática de embalagens por tipo de produto

## Resumo

Ao trocar o tipo de produto, as embalagens corretas serão pré-selecionadas automaticamente, mas o usuário poderá alterá-las manualmente. As quantidades serão restritas via Select dropdown, e o custo de rótulo será dinâmico.

## Alterações em `Calculator.tsx`

### 1. Custo de rótulo dinâmico (linha 359)

Substituir `const custoRotulo = 1.00` por:

```typescript
const custoRotulo = useMemo(() => {
  switch (tipoProduto) {
    case 'Encapsulados': return 0.94;
    case 'Solúvel': return 1.54;
    case 'Gummy': return 1.34;
    case 'Líquido': return 0.72;
    default: return 1.14;
  }
}, [tipoProduto]);
```

### 2. Quantidades fixas via Select (linhas 638-649)

Substituir o Input de `qtdCapsulas` por um Select com opções fixas:

- **Encapsulados**: 30, 60
- **Solúvel**: 150, 300 (gramas, forçar `unidadeSoluvel = 'g'`)
- **Gummy**: 30, 60
- **Líquido**: 30 (apenas uma opção)

### 3. useEffect para pré-seleção de embalagens (após linha 127)

Ao mudar `tipoProduto`, pré-selecionar automaticamente os IDs corretos:

```text
Encapsulados:
  selectedCapsula = 0e499d80 (Cápsula 0)
  selectedEmbalagens = {7bad5af1, 7cb20b55, 18a9b933}

Solúvel:
  selectedCapsula = null
  selectedEmbalagens = {6b8d9a17, ba19c064} + dosador dinâmico

Gummy:
  selectedCapsula = null
  selectedEmbalagens = {7bad5af1, 95ba10a6, c4b906eb}

Líquido:
  selectedCapsula = null
  selectedEmbalagens = {4fbf0747, a8ff3b3e, fd44bb06, 88de1bd9}
```

O card de EmbalagensHierarchy continua visível e editável — o usuário pode adicionar ou remover itens após a pré-seleção.

### 4. Ajuste de defaults ao trocar tipo (useEffect existente, linhas 130-140)

Atualizar `qtdCapsulas` e `unidadesPorDose` para valores padrão do novo tipo:

- Encapsulados: 60 cáps, 2 por dose
- Solúvel: 300g, 3g por dose, forçar `unidadeSoluvel = 'g'`
- Gummy: 30, 1 por dose
- Líquido: 30mL, 1 por dose

### 5. Dosador dinâmico para Solúvel

Buscar o dosador correto baseado na dose selecionada. Mapeamento dos IDs de dosadores será feito com base nos nomes existentes na tabela `embalagens`.

### 6. Validação de MP para Solúvel

Limitar total de matéria-prima por dose à quantidade de gramas por dose informada (similar ao limite de 500mg/cápsula dos Encapsulados).

## Arquivos modificados

- `src/pages/Calculator.tsx` — todas as alterações