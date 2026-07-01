## Objetivo
1. Em **Gerar Orçamento → Consultor Responsável**, só listar consultores **ativos** cadastrados em **Admin › Consultores**.
2. No **Ranking de Consultores** (Dashboard), só mostrar consultores cadastrados na tabela `usuarios`. Consultores não cadastrados (antigos, removidos) só aparecem se tiverem **venda no período filtrado**.

## Mudanças

### 1. Gerar Orçamento — combobox já filtra ativo, garantir integridade
`src/components/ConsultorCombobox.tsx` já usa `useUsuarios(true)` → só ativos. Nenhuma mudança necessária, exceto validar: quando o valor atual (`value`) for um nome que não está mais na lista de ativos (ex.: orçamento antigo sendo editado), ainda exibimos o nome no botão mas ele não reaparece nas opções — comportamento já correto.

**Ação:** nenhuma mudança de código aqui. Se o usuário ainda vê nomes "extras" no dropdown, é porque eles estão marcados como **ativos** em Admin › Consultores. A solução real é inativá-los na tela de Admin (já existente).

### 2. Ranking de Consultores — filtrar por cadastrados + vendas
Arquivo: `src/components/dashboard/DashboardVendas.tsx`

- Adicionar hook `useUsuarios(true)` para obter a lista de nomes de consultores ativos cadastrados.
- Ao montar `rankingCompleto`:
  - **Consultores com vendas no período (`comVendas`)** — sempre incluídos (mesmo que não estejam mais cadastrados).
  - **Consultores sem vendas (`semVendas`)** — filtrar `consultoresUnicos` para manter **apenas os que existem em `usuarios` ativos** (normalização case-insensitive por `nome.trim().toLowerCase()`).
- Resultado: ranking limpo. Ex-consultores só aparecem se venderam no período; consultores ativos cadastrados aparecem mesmo com 0 vendas.

### Detalhes técnicos
- Normalização: `const ativosSet = new Set(usuarios.map(u => u.nome.trim().toLowerCase()))`.
- Filtro em `semVendas`: `.filter(nome => ativosSet.has(nome.trim().toLowerCase()))`.
- Não alterar props do componente (mantém compatibilidade com `DashboardComercial.tsx`).

## Fora do escopo
- Não mexer em `useDashboardComercial` nem em `DashboardComercial.tsx` — a filtragem fica localizada no ranking.
- Não alterar outros lugares que usam `consultoresUnicos` (SucessoCliente, Pedidos).