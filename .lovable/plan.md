

## Plano: Segmentar "Fórmulas do Catálogo" em aba dedicada + botão no Orçamento

### Contexto
Existem fórmulas com cliente contendo variações de "CATÁLOGO" (ex: "LEMON CAPS - FÓRMULAS DO CATÁLOGO", "CATÁLOGO - LEMON CAPS", etc.). Essas precisam ser separadas visualmente.

### Alterações

**1. `src/pages/Precificacao.tsx`** — Nova aba "Produtos do Catálogo"
- Alterar as tabs de 2 para 3 colunas: "Produtos Criados" | "Produtos Precificados" | "Produtos do Catálogo"
- Adicionar nova `TabsContent value="catalogo"` que renderiza o componente `PrecificacoesSalvas` com uma prop `catalogoOnly={true}`
- Na aba "Produtos Precificados" existente, passar prop `catalogoOnly={false}` para excluir os do catálogo

**2. `src/components/PrecificacoesSalvas.tsx`** — Filtrar por catálogo
- Receber nova prop `catalogoOnly?: boolean`
- Quando `catalogoOnly === true`: filtrar precificações onde `formulas.cliente` contém "catálogo" (case-insensitive)
- Quando `catalogoOnly === false`: filtrar precificações onde `formulas.cliente` NÃO contém "catálogo"
- Quando `undefined`: manter comportamento atual (mostrar tudo)

**3. `src/hooks/usePrecificacoesPaginadas.ts`** — Suportar filtro de catálogo
- Adicionar param `catalogoOnly?: boolean` 
- Na query, aplicar filtro `.ilike('formulas.cliente', '%catálogo%')` ou `.not('formulas.cliente', 'ilike', '%catálogo%')` conforme o caso

**4. `src/components/GerarOrcamentoDialog.tsx`** — Botão "Fórmulas do Catálogo" no Step 2
- Adicionar novo botão "Fórmulas do Catálogo" ao lado de "Precificação Salva"
- Novo state `showCatalogoSelector` com painel similar ao de precificações
- Filtrar `precificacoesDisponiveis` mostrando apenas as que têm "catálogo" no nome do cliente
- Reutilizar a mesma lógica de seleção (checkbox, margem baixa, etc.)

### Detecção de fórmula do catálogo
Função utilitária: `const isCatalogo = (cliente: string) => cliente.toLowerCase().includes('catálogo') || cliente.toLowerCase().includes('catalogo')`

Aplicada consistentemente em todos os pontos.

