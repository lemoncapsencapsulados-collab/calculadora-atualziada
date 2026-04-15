

## Plano: Adicionar categoria "Rótulos" ao inventário de embalagens e integrar na precificação

### Problema atual
O custo de rótulo é hardcoded no código (R$ 0,94 para Encapsulados, R$ 1,54 para Solúvel, etc.) e não pode ser gerenciado como item de inventário. O usuário quer cadastrar rótulos como embalagens na categoria "Rótulos" e selecioná-los na calculadora/precificação como qualquer outro acessório.

### Alterações

**1. `src/pages/Inventario.tsx`**
- Adicionar "Rótulos" como opção no Select de categorias do formulário de embalagens (ao lado de Potes PET, Frascos, Tampa, Acessórios, etc.)

**2. `src/pages/Calculator.tsx`**
- Remover o `custoRotulo` hardcoded (linhas 435-443)
- Tratar embalagens da categoria "Rótulos" como os outros acessórios: quando selecionada, seu `preco_unitario` entra no cálculo de `custoEmbalagensExtras`
- Atualizar `totalEmbalagem` para não somar mais `custoRotulo` separadamente
- Remover a linha fixa "Rótulo: R$ X,XX" do resumo e deixar o rótulo aparecer como item selecionado normal

**3. `src/pages/Precificacao.tsx`**
- Remover a linha hardcoded "Rótulo: R$ 1,00" do detalhamento de embalagens
- O rótulo agora aparecerá como parte das embalagens selecionadas na fórmula

**4. `src/components/PrecificacoesSalvas.tsx`**
- Remover a linha hardcoded "Rótulo: R$ 1,00" do detalhamento

**5. `src/components/EmbalagensHierarchy.tsx`**
- Já possui suporte para categoria "Rótulo" (ícone e ordem definidos) - apenas verificar se está como "Rótulos" (plural) para consistência

### Resultado
- Rótulos serão cadastrados no inventário com nome, preço e fornecedor
- Na calculadora, o usuário seleciona o rótulo correto como qualquer outra embalagem
- O custo do rótulo selecionado é somado automaticamente na precificação
- Sem mais valores hardcoded para rótulos

