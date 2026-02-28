

## Plano: Modal fullscreen para precificacao e paginacao de formulas

### Problema atual

Quando o usuario seleciona uma formula na lista, os cards de custos/impostos/precificacao aparecem abaixo da lista, forcando scroll extenso. Com muitas formulas, a navegacao fica ruim. Alem disso, todas as formulas sao carregadas de uma vez sem paginacao.

### Mudancas planejadas

#### 1. Modal fullscreen ao selecionar formula

Ao clicar em uma formula, em vez de exibir os cards no final da pagina, abrira uma modal em tela cheia contendo:

- **Cabecalho**: Nome da formula, cliente, tipo de produto, data de criacao, custo total (MP + Embalagem)
- **Corpo**: Todos os cards existentes (Custos Diretos, Custos Indiretos, Custos Base/Margem/Total, Calculo de Precificacao, Impostos, Precificacao Final) dentro de um ScrollArea
- **Botao de fechar** no canto superior

Toda a logica de calculo, desbloqueio de custos, salvar e gerar proposta permanece identica, apenas movida para dentro da modal.

#### 2. Paginacao no banco de dados

Substituir o carregamento de todas as formulas de uma vez por paginacao server-side:

- 24 cards por pagina
- Ordenadas por `created_at DESC` (mais recente primeiro)
- Navegacao entre paginas com botoes Anterior/Proxima e indicador de pagina
- A pesquisa por nome/cliente continuara funcionando (filtro aplicado na query do banco)
- Contagem total de formulas para calcular numero de paginas

### Detalhes tecnicos

**Hook `useFormulas` - novo hook paginado (`useFormulasPaginadas`)**

Criar um novo hook que aceita `page`, `pageSize` e `searchTerm` como parametros:

```text
useFormulasPaginadas({ page, pageSize, searchTerm })
  -> Query 1: SELECT count(*) FROM formulas WHERE (filtro de busca)
  -> Query 2: SELECT * FROM formulas WHERE (filtro de busca) 
              ORDER BY created_at DESC
              LIMIT 24 OFFSET (page - 1) * 24
  -> Retorna: { formulas, totalCount, totalPages, isLoading }
```

A busca usara `ilike` no banco para filtrar por `nome_formula` ou `cliente`.

**Arquivo `src/pages/Precificacao.tsx`**

- Adicionar estados: `currentPage` (default 1), resetar para pagina 1 ao mudar searchTerm
- Substituir `useFormulas` por `useFormulasPaginadas` na aba "Nova Precificacao"
- Remover o bloco `{formulaSelecionada && (...)}` que renderiza os cards inline (linhas 324-695)
- Adicionar componente de paginacao abaixo do grid de cards (Anterior | Pagina X de Y | Proxima)
- Ao clicar em uma formula, abrir Dialog fullscreen em vez de scroll
- A modal usara `DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto"` para ocupar quase toda a tela
- O `handleSelectFormula` passara a abrir a modal e setar a formula selecionada
- Manter toda logica de calculo, desbloqueio, salvar e gerar proposta

**Estrutura da Modal:**

```text
Dialog (fullscreen)
  DialogHeader
    - Nome da formula (titulo principal)
    - Badges: tipo produto, cliente, data criacao
    - Custo total resumido
  DialogContent (scrollable)
    - Grid Custos Diretos + Custos Indiretos
    - Grid Custos Base + Margem + Total
    - Card Calculo de Precificacao
    - Grid Impostos + Precificacao Final (condicional ao resultado)
  DialogFooter (nao necessario, botoes ja estao nos cards)
```

**Componente de paginacao:**

Reutilizar os componentes de UI existentes (Button) para criar navegacao simples:
- Botao "Anterior" (desabilitado na pagina 1)
- Indicador "Pagina X de Y"
- Botao "Proxima" (desabilitado na ultima pagina)
- Exibir total de formulas encontradas

**Nenhuma migracao SQL necessaria** - a paginacao usa `range()` do cliente ou `LIMIT/OFFSET` via query existente.

