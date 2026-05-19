## Contexto

O sistema **já tem** toda a infraestrutura de consultores funcionando:

- Tabela `usuarios` no backend (campos: nome, cargo, email, telefone, ativo).
- Hook `useUsuarios` com CRUD completo.
- Componente `ConsultorCombobox` já usado em orçamentos, pedidos, recompras, dashboard, etc. — ele lê de `usuarios` filtrando `ativo = true`.
- Dialog `GerenciarUsuariosDialog` com formulário (nome, cargo, email, telefone) e listagem.

Hoje esse gerenciamento só aparece como botão **"+"** ao lado do `ConsultorCombobox` (dentro do fluxo de orçamento). Não existe entrada no **Painel Administrador**.

## O que falta

Trazer a gestão de consultores como uma aba dedicada no Painel Administrador, com foco em **nome + telefone** (que é o que o usuário pediu), reaproveitando todo o backend e o componente que já existe.

## Mudanças propostas

### 1. Nova aba "Consultores" no Painel Administrador
Arquivo: `src/pages/PainelAdministrador.tsx`

- Adicionar `<TabsTrigger value="consultores">Consultores</TabsTrigger>` e o `<TabsContent value="consultores">` correspondente.
- Conteúdo: nova seção embutida (não modal) com a mesma listagem/edição de `GerenciarUsuariosDialog`, mas renderizada inline.

### 2. Novo componente `ConsultoresAdmin`
Arquivo novo: `src/components/admin/ConsultoresAdmin.tsx`

- Reusa `useUsuarios` (já existe).
- Lista em tabela: Nome, Telefone, Cargo, Status, Ações (Editar / Ativar-Inativar).
- Formulário inline para criar/editar com:
  - **Nome** (obrigatório)
  - **Telefone** (obrigatório — foco do pedido)
  - **Cargo** (opcional, default `"Consultor"`)
  - **Email** (opcional)
- Filtro por nome + toggle "mostrar inativos" (mesmo padrão atual).

### 3. Ajuste mínimo no hook
Arquivo: `src/hooks/useUsuarios.ts` — tornar `cargo` opcional no tipo `UsuarioInsert` (default `"Consultor"` ao inserir) para alinhar com o foco em nome + telefone.

> A coluna `cargo` no banco continua `NOT NULL`; o default é aplicado no cliente. Sem migração necessária.

### 4. Propagação automática
Nenhuma mudança extra é necessária — todos os pontos onde se escolhe consultor (orçamentos, pedidos, recompras, dashboard, sucesso do cliente) já leem da mesma tabela `usuarios` via `ConsultorCombobox` / `useUsuarios`. Ao criar um consultor no painel, ele aparece automaticamente em todos esses lugares.

## Fora de escopo

- Nenhuma alteração de schema do banco.
- Nenhuma alteração nos fluxos de orçamento/pedido/dashboard.
- O botão "+" atual no `ConsultorCombobox` continua existindo (atalho rápido).