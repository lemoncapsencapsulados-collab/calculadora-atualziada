
# Visualizacao Lista/Kanban e Filtro por Consultor em /orcamentos

## Resumo
Adicionar dois modos de visualizacao (Lista e Kanban) na tela de orcamentos, com toggle no topo direito, e um filtro por consultor responsavel. O modo Kanban agrupa os orcamentos em 4 colunas por status. O nome do consultor sera exibido nos cards de ambos os modos.

## Alteracoes

### 1. Hook `useOrcamentosPaginados` - Adicionar filtro por consultor
- Adicionar parametro `consultorFilter` ao hook
- Quando preenchido, aplicar `.eq('consultor_responsavel', consultorFilter)` nas queries de contagem e dados
- Para o modo Kanban, criar um novo hook (ou query separada) que busca TODOS os orcamentos sem paginacao (agrupados por status no frontend), respeitando os filtros de busca e consultor

### 2. Novo hook `useConsultoresDisponiveis`
- Query distinta em `orcamentos` para listar os valores unicos de `consultor_responsavel`
- Alimenta o dropdown de filtro por consultor

### 3. Pagina `Orcamentos.tsx` - Refatoracao
- **Estado de modo de visualizacao**: `viewMode: 'list' | 'kanban'`
- **Estado de filtro consultor**: `consultorFilter: string`
- **Barra de filtros**: Ao lado do campo de busca, adicionar:
  - Select/dropdown para filtrar por consultor responsavel
  - No topo direito (ao lado do botao "Novo Orcamento"), dois icones toggle: `List` (lucide) e `Columns` ou `LayoutGrid` (lucide) para alternar entre lista e kanban
- **Modo Lista**: Manter implementacao atual com paginacao, passando o filtro de consultor ao hook
- **Modo Kanban**: Renderizar 4 colunas (Rascunho, Enviado, Aprovado, Recusado), cada uma com scroll vertical, cards compactos com: nome cliente, consultor, numero orcamento, valor total, data/hora. Acoes de editar/excluir/gerar PDF acessiveis via botoes no card

### 4. Componente `OrcamentoKanbanView` (novo)
- Recebe lista completa de orcamentos filtrados
- Agrupa por status em 4 colunas
- Cards compactos com informacoes resumidas e acoes
- Estilo visual com cores distintas no cabecalho de cada coluna (cinza para rascunho, azul para enviado, verde para aprovado, vermelho para recusado)

### 5. Nome do consultor nos cards
- Ja esta parcialmente implementado (linha 178-179 mostra `consultor_responsavel`). Garantir que apareca de forma clara em ambos os modos com label "Consultor:"

## Detalhes Tecnicos

**Arquivos modificados:**
- `src/hooks/useOrcamentosPaginados.ts` - adicionar `consultorFilter` como parametro
- `src/pages/Orcamentos.tsx` - adicionar estados, filtros, toggle de visualizacao, e renderizacao condicional

**Arquivos criados:**
- `src/components/OrcamentoKanbanView.tsx` - componente do kanban

**Kanban - busca de dados:**
No modo kanban, a paginacao nao se aplica da mesma forma. Sera feita uma query sem `.range()` (limitada a 200 registros para performance) com os filtros de busca e consultor aplicados, e o agrupamento por status sera feito no frontend.

**Icones sugeridos (lucide-react):**
- Modo lista: `List`
- Modo kanban: `Kanban` ou `Columns3`
