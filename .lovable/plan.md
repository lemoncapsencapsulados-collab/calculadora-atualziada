## Objetivos

1. **Limpar o popup "Detalhes do Pedido"** — remover a seção "Acompanhamento de Processos" e a seção "Setup (Entregáveis)" para reduzir poluição visual.
2. **Marca vinculada à Razão Social** — cada cliente (razão social) passa a ter uma marca; ela aparece automaticamente ao lado da razão social na lista de pedidos. Quando não houver marca, surge um botão "Adicionar marca" na própria linha.
3. **Captura opcional no fluxo de aprovação** — quando o consultor move um orçamento de "enviado" para "aprovado", aparece um campo opcional "Marca". Se preenchido, já vincula a marca à razão social automaticamente.

---

## Mudanças

### 1) `src/components/DetalhesPedidoDialog.tsx`
- Remover o bloco **"Acompanhamento de Processos"** (`<AcompanhamentoProcessos>`) e suas props relacionadas (`onUpdateAcompanhamento`, `setupCategorias`).
- Remover o bloco **"Setup (Entregáveis)"** (lista agrupada `setupAgrupado`) e a prop `setupDemandas`.
- Limpar imports não utilizados (`AcompanhamentoProcessos`, `CATEGORIAS_ENTREGAVEIS`, `DemandaEntregavel`, `ClipboardList`).
- Demais seções (Status, Cliente, Produtos, Pagamento, Histórico, Frete, Observações, Totais) **permanecem intactas**.

### 2) `src/pages/Pedidos.tsx`
- Na tabela de pedidos, ao lado da **Razão Social** exibir a **marca** quando existir:
  - Layout: `Razão Social  ·  Marca: <nome>` (texto secundário em destaque suave).
  - Quando o cliente ainda não tiver marca cadastrada, mostrar um botão pequeno **"+ Adicionar marca"** no mesmo lugar.
- Versão mobile recebe o mesmo tratamento.
- Remover a passagem das props `setupDemandas` / `onUpdateAcompanhamento` para `DetalhesPedidoDialog`.

### 3) Novo `src/components/AdicionarMarcaDialog.tsx`
- Dialog simples reutilizável com:
  - Razão Social (somente leitura, vinda do pedido/cliente).
  - Campo de texto **Marca** (obrigatório dentro do diálogo).
  - Botões Cancelar / Salvar.
- Ao salvar: atualiza `clientes.marca` do cliente vinculado e fecha. Lista de pedidos reflete via realtime/refetch do hook de clientes.

### 4) Fluxo de aprovação do orçamento
- No componente onde o consultor muda status do orçamento para **"aprovado"** (provavelmente `AprovacaoOrcamentoDialog.tsx`), incluir um campo **Marca (opcional)** após o restante dos campos atuais.
- Se preenchido, ao confirmar a aprovação também grava `clientes.marca` para a razão social vinculada (via `cliente_id` ou matching por CNPJ/razão social).
- Se vazio, mantém comportamento atual (sem alterações na marca).

### 5) Banco de dados (migração)
- Adicionar coluna `marca text` em `public.clientes` (nullable).
- Sem mudanças de RLS: políticas existentes já cobrem o campo.

### 6) Resolução da marca para exibição
Helper `getMarcaCliente(pedido, clientes)`:
1. `clientes.find(c => c.id === pedido.cliente_id)?.marca`
2. Fallback: match por CNPJ/razão social do snapshot caso `cliente_id` esteja ausente.
3. Retorna `null` se não houver — nesse caso, renderiza o botão "Adicionar marca".

---

## Fora de escopo
- Múltiplas marcas por razão social (este plano assume **uma marca por cliente**; se no futuro precisar de várias, migrar para tabela própria).
- Edição/remoção da marca dentro do popup de Detalhes — fica só a inclusão via botão na linha e via aprovação.
- Exibição da marca em PDFs, relatórios, dashboards ou orçamentos.
- Alterações em `AcompanhamentoProcessos` em outras telas (continua funcionando onde já é usado fora de Pedidos).
