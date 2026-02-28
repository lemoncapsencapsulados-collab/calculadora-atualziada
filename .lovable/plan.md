
# Combobox de Consultor com tabela de Usuarios

## Resumo
Criar tabela `usuarios` no banco de dados e substituir o campo texto livre "Consultor Responsavel" por uma combobox com autocomplete/filtro, alimentada pela tabela de usuarios. Adicionar botao "+" para abrir modal de CRUD completo de usuarios.

## Alteracoes no Banco de Dados

### Nova tabela `usuarios`
- `id` (uuid, PK, default gen_random_uuid())
- `nome` (text, NOT NULL)
- `cargo` (text, NOT NULL) - papel/cargo da pessoa
- `email` (text)
- `telefone` (text)
- `ativo` (boolean, default true)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- RLS: politicas publicas (mesmo padrao das demais tabelas do projeto)

## Novos Arquivos

### 1. `src/hooks/useUsuarios.ts`
- Hook com queries e mutations para CRUD da tabela `usuarios`
- Query principal com filtros opcionais: `ativo` (boolean), `searchNome` (text)
- Mutations: criar, atualizar, toggle ativo/inativo

### 2. `src/components/GerenciarUsuariosDialog.tsx`
- Modal com CRUD completo de usuarios
- Datatable listando usuarios com colunas: Nome, Cargo, Email, Telefone, Status
- Filtro por nome (campo de busca)
- Toggle para mostrar inativos (por padrao mostra somente ativos)
- Botoes para incluir novo, editar existente, ativar/inativar
- Formulario inline ou sub-modal para adicionar/editar usuario (campos: nome, cargo, email, telefone)
- Ao fechar, retorna o nome do usuario recem-criado (se houver) via callback

### 3. `src/components/ConsultorCombobox.tsx`
- Combobox com autocomplete e filtro usando `cmdk` (ja instalado no projeto via componente Command)
- Lista usuarios ativos da tabela `usuarios`
- Popover com input de busca e lista filtrada
- Prop `value` (nome selecionado) e `onChange` (callback)
- Botao "+" ao lado que abre `GerenciarUsuariosDialog`
- Campo nao editavel manualmente - somente selecao da lista

## Arquivos Modificados

### 4. `src/components/GerarOrcamentoDialog.tsx`
- Substituir o `<Input>` do campo "Consultor Responsavel" (linhas 309-314) pelo novo `<ConsultorCombobox>`
- Passar `value={consultorResponsavel}` e `onChange={setConsultorResponsavel}`
- Remover a possibilidade de digitacao livre

## Detalhes Tecnicos

**Combobox**: Sera construida usando os componentes `Popover` + `Command` (cmdk) ja disponiveis no projeto, seguindo o padrao de combobox do shadcn/ui.

**Fluxo do usuario**:
1. Ao abrir "Gerar Orcamento - Passo 1 de 4", o campo Consultor Responsavel aparece como combobox
2. Ao clicar, abre popover com lista filtrada de usuarios ativos
3. Digitar filtra a lista em tempo real
4. Se nao encontrar, clicar no botao "+" abre modal de gerenciamento
5. Ao adicionar usuario e fechar a modal, o nome do novo usuario e automaticamente preenchido no campo
6. O campo nao aceita digitacao manual - apenas selecao

**Valor salvo**: Continua salvando apenas o nome (string) no campo `consultor_responsavel` da tabela `orcamentos`, sem foreign key.
