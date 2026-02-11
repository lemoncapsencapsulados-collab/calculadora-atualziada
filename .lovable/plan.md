

## Plano: Capsulas como categoria na hierarquia de embalagens

### Problema atual

A "Capsula 0 (ENCAPSULADOS)" esta cadastrada com categoria **"Potes PET"** no banco de dados, e o card separado "Tipo de Capsula" nao a encontra porque filtra por `categoria === 'Capsulas'`. Alem disso, o usuario quer que as capsulas aparecam diretamente na secao de embalagens como uma categoria, em vez de num card separado.

### O que sera feito

1. **Corrigir a categoria no banco de dados** - Atualizar a "Capsula 0" de "Potes PET" para "Capsulas"

2. **Remover o card separado "Tipo de Capsula"** (linhas 1164-1224 do Calculator.tsx)

3. **Incluir capsulas na hierarquia de embalagens** - Remover o `excludeCategoria="Capsulas"` do `EmbalagensHierarchy`

4. **Ordenar categorias para que "Capsulas" fique acima de "Silica"** - Ajustar a ordenacao no `EmbalagensHierarchy` para que "Capsulas" apareca antes de "Silica gel"

5. **Comportamento especial para capsulas** - Na hierarquia, capsulas terao selecao exclusiva (radio) em vez de checkbox, pois so se pode selecionar um tipo de capsula por formula. Ao selecionar uma capsula, ela sera registrada como `selectedCapsula` (selecao unica), e o custo sera calculado como `preco_unitario x quantidade_capsulas`

### Detalhes tecnicos

**Migracao SQL:**
```sql
UPDATE embalagens SET categoria = 'Cápsulas' WHERE id = '0e499d80-ca08-41ec-832d-035b37eb1656';
```

**Arquivo: `src/components/EmbalagensHierarchy.tsx`**
- Remover a prop `excludeCategoria`
- Adicionar props `selectedCapsulaId` e `onCapsulaSelect` para gerenciar selecao exclusiva de capsulas
- Adicionar prop `qtdCapsulas` para exibir o custo total (preco x qtd)
- Para a categoria "Capsulas", renderizar radio buttons em vez de checkboxes
- Ordenar categorias com prioridade customizada: "Capsulas" fica acima de "Silica"
- Mostrar apenas para tipo "Encapsulados" (controlado via prop `tipoProduto`)

**Arquivo: `src/pages/Calculator.tsx`**
- Remover o card separado "Tipo de Capsula" (linhas 1164-1224)
- Remover `excludeCategoria="Capsulas"` do EmbalagensHierarchy
- Passar as novas props `selectedCapsulaId`, `onCapsulaSelect`, `qtdCapsulas` e `tipoProduto` para o EmbalagensHierarchy
- Manter toda a logica de calculo de custo de capsulas existente (preco x quantidade)

