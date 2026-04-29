## Objetivo

Criar uma nova aba **"Leads Orçamento"** no menu, listando todos os clientes que possuem ao menos um orçamento gerado. Cada lead exibirá nome, telefone com DDD, botão direto para WhatsApp e a lista expansível de todos os orçamentos do cliente com seus detalhes.

Também garantir que, ao gerar um orçamento, o nome do cliente e o telefone com DDD sejam obrigatórios e capturados corretamente para alimentar essa aba.

---

## 1. Garantir captura de Nome + WhatsApp no Orçamento

No `GerarOrcamentoDialog.tsx` (Step 1) o `ClienteSelector` no modo `basico` já força nome + telefone ao criar novo cliente. Vou:

- Validar obrigatoriedade do telefone do cliente selecionado antes de avançar (bloquear "Próximo" se `clienteSelecionado.telefone` estiver vazio).
- Garantir que o `cliente_id` é salvo em `orcamentos.cliente_id` (campo já existe na tabela; vou adicionar ao payload do `createOrcamento` e `updateOrcamento`).
- No `ClienteSelector` (criação inline), adicionar máscara/validação de telefone brasileiro com DDD: mínimo 10 dígitos, formatação `(11) 91234-5678`.

## 2. Nova rota e item de menu "Leads Orçamento"

- Adicionar rota `/leads-orcamento` em `src/App.tsx`.
- Adicionar link no `Navigation.tsx` com ícone `Users` (entre "Orçamentos" e "Pedidos").

## 3. Página `src/pages/LeadsOrcamento.tsx`

Estrutura:

- **Hook novo** `src/hooks/useLeadsOrcamento.ts`: faz JOIN lógico — busca todos `orcamentos`, agrupa por `cliente_id` (fallback para `nome_cliente` quando `cliente_id` é nulo, para orçamentos antigos), e enriquece com dados de `clientes` (nome, telefone, email).
- **Lista** de cards, um por cliente:
  - Nome do cliente + badge com nº total de orçamentos
  - Telefone formatado com DDD
  - **Botão WhatsApp** (verde) → abre `https://wa.me/55<DDD><numero>?text=...` em nova aba
  - Resumo: valor total acumulado, último orçamento (data), consultor mais recente
  - Accordion expansível "Ver orçamentos" listando cada orçamento com:
    - Nº orçamento, status (badge), data criação, valor total
    - Produtos (lista resumida com nome e quantidade)
    - Botões: "Ver PDF" (abre `PreviewPdfDialog`), "Editar" (abre `GerarOrcamentoDialog`)
- **Filtros** no topo: busca por nome/telefone, filtro por status (ao menos 1 orçamento no status), filtro por consultor.

## 4. Detalhes técnicos

```text
LeadsOrcamento (page)
├── Filtros (busca, status, consultor)
└── Lista de leads agrupados
    └── Card do cliente
        ├── Header: nome + telefone + botão WhatsApp
        ├── Resumo: total orçamentos | valor acumulado | último contato
        └── Accordion: lista de orçamentos
            └── Item: nº | status | data | produtos | valor | ações
```

**Agrupamento (no hook):**
- Chave: `cliente_id` quando presente, senão `nome_cliente` normalizado.
- Para cada grupo, buscar dados completos do cliente em `clientes` (uma query `in` por todos os `cliente_id` distintos).
- Ordenar leads pelo orçamento mais recente (desc).

**Link WhatsApp:**
```ts
const numero = telefone.replace(/\D/g, '');
const numeroComDDI = numero.startsWith('55') ? numero : `55${numero}`;
const url = `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(`Olá ${nome}, sobre seu orçamento...`)}`;
```

**Reuso de componentes:**
- `PreviewPdfDialog` para visualizar PDF.
- `GerarOrcamentoDialog` para editar (passa `orcamentoExistente`).
- `STATUS_CONFIG` (copiar de `Orcamentos.tsx`) para badges consistentes.

## 5. Arquivos a criar/editar

- **Criar** `src/hooks/useLeadsOrcamento.ts`
- **Criar** `src/pages/LeadsOrcamento.tsx`
- **Editar** `src/App.tsx` (nova rota)
- **Editar** `src/components/Navigation.tsx` (novo link)
- **Editar** `src/components/GerarOrcamentoDialog.tsx` (validar telefone obrigatório no step 1; salvar `cliente_id`)
- **Editar** `src/hooks/useOrcamentos.ts` (aceitar `cliente_id` no insert/update — já está no tipo `OrcamentoUpdate`, falta no `OrcamentoInsert`)
- **Editar** `src/types/orcamento.ts` (adicionar `cliente_id?: string` em `OrcamentoInsert`)

Sem necessidade de migração — todos os campos já existem no banco (`orcamentos.cliente_id`, `clientes.telefone`).
