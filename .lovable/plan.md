

# Print On Demand: Toggle mais visível + Métricas no Dashboard

## Problema
O seletor Estoque/Print On Demand existe no código mas está pouco visível (seção inferior do card, fácil de perder). O usuário quer que fique mais proeminente, ao lado do custo unitário. Além disso, a Dashboard precisa separar clientes por modelo de negócio.

## Alterações

### 1. Reposicionar toggle POD no card do item — `GerarOrcamentoDialog.tsx`
- Mover o seletor Estoque / Print On Demand para **ao lado do preço unitário**, na linha principal do item (onde aparece "R$ 12,90/un")
- Usar botões toggle estilizados (similar aos de Novo Produtor/Recompra) em vez de radio buttons discretos
- Quando POD selecionado: esconder input de quantidade, subtotal = preço unitário (lógica já existe)
- Remover a seção separada "Modelo:" que fica abaixo no card

### 2. Dashboard — Clientes com Estoque vs Print On Demand — `useDashboardComercial.ts`
- Analisar `itens_producao` dos orçamentos aprovados para classificar:
  - **Estoque**: orçamentos onde TODOS os itens são `modelo_negocio !== 'print_on_demand'` (ou sem modelo definido)
  - **Print On Demand**: orçamentos onde PELO MENOS UM item é `modelo_negocio === 'print_on_demand'`
- Criar métrica `clientesPorModelo` com contagem e valor por consultor

### 3. Dashboard UI — `DashboardVendas.tsx`
- Adicionar nova tabela/seção "Clientes com Estoque vs Print On Demand"
- Mostrar por consultor: quantidade de clientes fechados com estoque, quantidade POD, e valores respectivos
- Linha de total no rodapé

## Arquivos Modificados
- `src/components/GerarOrcamentoDialog.tsx` — reposicionar toggle POD
- `src/hooks/useDashboardComercial.ts` — nova métrica por modelo de negócio
- `src/components/dashboard/DashboardVendas.tsx` — nova tabela Estoque vs POD

