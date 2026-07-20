## Nova seção: Logística

Adiciona uma seção dedicada de cotações de frete, com dois modelos (Estoque Próprio e Print on Demand), vinculáveis a orçamentos existentes e refletidas no PDF do orçamento e na Proposta de Contrato.

---

### 1. Navegação

- Novo item **"Logística"** em `src/components/Navigation.tsx`, imediatamente após "Orçamentos".
- Nova rota `/logistica` registrada em `src/App.tsx` apontando para `src/pages/Logistica.tsx`.
- Página com duas tabs: **Estoque Próprio** e **Print on Demand**.

---

### 2. Modelo de dados (migrations)

**Tabela `frete_cotacoes`** (comum aos dois modelos):
- `id`, `tipo` (`estoque_proprio` | `pod`), `orcamento_id` (FK → `orcamentos`)
- `ativa` (boolean, default true — permite soft-archive ao substituir)
- Estoque Próprio: `nome_produtor`, `nome_produto`, `tipo_produto` (Encapsulado/Líquido/Gummy/Solúvel), `quantidade_unidades`, `valor_frete`, `status` (`pendente` | `confirmado`), `observacoes_internas`
- POD: `tipo_produto`, `plano` (int: 1/2/3/5/6/8/9/10/12/20/50), `preco_por_envio`, `preco_editado_manualmente` (bool), `quantidade_envios_estimada`, `observacoes`
- `created_at`, `updated_at`, timestamps padrão + trigger `update_updated_at_column`

**Tabela `frete_pod_precos`** (tabela de preços interna POD):
- `id`, `tipo_produto`, `plano` (int), `preco` (numeric), `faixa_peso` (texto informativo), `vigencia_inicio` (date), `ativo` (bool)
- Unique `(tipo_produto, plano, ativo=true)`
- Seed inicial: apenas Líquido e Encapsulado com valores da tabela fornecida. Gummy e Solúvel serão cadastrados manualmente pelo admin.

**Tabela `frete_pod_precos_historico`**:
- Registra alterações: `preco_id`, `preco_anterior`, `preco_novo`, `alterado_por`, `alterado_em`.

**RLS/GRANTs**: leitura e escrita para `authenticated`; `service_role` full. Sem `anon`.

---

### 3. Página `/logistica`

**Tab Estoque Próprio**
- Botão "Nova Cotação" abre dialog com os campos do formulário (produtor, produto, tipo, quantidade, valor frete, seletor de orçamento, observações).
- Tabela: Produtor | Produto | Tipo | Qtd | Frete Médio | Orçamento | Status | Ações.
- Badge de status: verde (Confirmado) / amarelo (Pendente).
- Edição livre do valor quando "Pendente"; ao confirmar, exibe `AlertDialog` antes de permitir nova edição.
- Seletor de orçamento usa `useOrcamentos` filtrando por código + nome do cliente.

**Tab Print on Demand**
- Botão "Nova Cotação" abre dialog com seletor de orçamento, tipo de produto, plano (dropdown com os valores fixos), preço por envio (auto-preenchido da tabela `frete_pod_precos`, com destaque visual quando sobrescrito manualmente), quantidade estimada de envios (mostra total estimado abaixo), observações.
- Tabela: Orçamento | Tipo | Plano | Preço/envio | Qtd estimada | Total estimado | Data | Ações.
- Se Gummy/Solúvel selecionado e não houver preço cadastrado → mensagem orientando admin a cadastrar via configuração.

**Regra de exclusividade**: ao criar/vincular cotação em orçamento que já tem uma ativa, exibir dialog perguntando se deseja substituir. Ao confirmar, a antiga vira `ativa=false` (mantida no histórico) e a nova é marcada ativa.

---

### 4. Tela de configuração (Painel Administrativo)

Novo card `FretePodPrecosCard.tsx` em `src/pages/PainelAdministrador.tsx`, protegido pelo `AdminPasswordGate` já existente (senha 0212):
- Tabela editável de preços POD (tipo × plano × preço × vigência).
- Adicionar/editar/desativar preços.
- Cadastro dos valores Gummy e Solúvel.
- Aba de histórico exibindo alterações (data, usuário, valor antes/depois).

---

### 5. Integrações com fluxos existentes

**Listagem de Orçamentos (`src/pages/Orcamentos.tsx`)**:
- Nova coluna "Frete" exibindo: `EP - R$ X (status)` ou `POD - Tipo/Plano X - R$ Y/envio` ou "Sem cotação".

**PDF do Orçamento (`src/lib/orcamentoGenerator.ts`)**:
- Ao gerar, buscar cotação ativa em `frete_cotacoes` para o `orcamento_id`.
- Estoque Próprio: linha `"Frete estimado (Estoque Próprio): R$ X,XX"` com rodapé `"Valor sujeito a confirmação após finalização da produção."`.
- POD: linha `"Logística (Print on Demand) — [Tipo] / Plano [X] frascos: R$ Y,YY/envio"`.

**Proposta de Contrato (`src/lib/propostaGenerator.ts` e `PropostaCompletaDialog.tsx`)**:
- Mesma linha adicional exibida no preview e no export.

**Painel do orçamento** (dialogs de detalhes): indicador visual de frete vinculado.

---

### 6. Hook e helpers

- `src/hooks/useFreteCotacoes.ts` — CRUD + query por orçamento (filtrando `ativa=true`).
- `src/hooks/useFretePodPrecos.ts` — CRUD da tabela de preços + histórico.
- `src/lib/freteHelpers.ts` — formatação de labels de frete (para tabela de orçamentos e PDFs) e função `buscarPrecoPodTabelado(tipo, plano)`.

---

### Detalhes técnicos

- Todos os valores monetários em `numeric(15,6)` para consistência com o padrão do projeto.
- Datas em ISO (YYYY-MM-DD).
- Upserts com `.limit(1)`.
- Componentes shadcn existentes (Dialog, Table, Tabs, Select, AlertDialog, Badge).
- Tipos TypeScript em `src/types/frete.ts`.
- Sem alteração no `src/integrations/supabase/client.ts` nem `types.ts` (auto-gen após migration).
