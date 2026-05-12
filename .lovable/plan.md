## 1) Histórico de cadastro no VhSys por pedido

### Banco
Migration: adicionar coluna `historico_vhsys jsonb NOT NULL DEFAULT '[]'` em `pedidos`. Cada entrada:
```ts
{
  data: string;            // ISO
  sucesso: boolean;
  mensagem: string;        // mensagem amigável (sucesso ou erro)
  origem: 'aprovacao_pagamento' | 'proposta_completa' | 'manual';
  payload?: Record<string, any>;   // dados enviados ao VhSys
  resposta?: any;          // retorno bruto da edge function
}
```

### Tipos & hook
- `src/types/formula.ts` (interface `Pedido`): adicionar `historico_vhsys?: HistoricoVhsysEntry[]`.
- `src/hooks/usePedidos.ts`:
  - Selecionar a coluna no fetch.
  - Nova mutação `registrarHistoricoVhsys({ pedidoId, entry })` que faz select+update do array (mesmo padrão de `pagamento_alteracoes`).
  - Expor `registrarVhsysAsync`.

### Geração da entrada
- `src/components/AprovacaoOrcamentoDialog.tsx`: após `cadastrarClienteVhSys`, chamar `registrarVhsysAsync` no pedido recém-criado (capturar `pedido.id` retornado por `createPedidoFromOrcamento`). Origem `aprovacao_pagamento`.
- `src/components/PropostaCompletaDialog.tsx`: se houver `pedido_id` vinculado, fazer o mesmo. Origem `proposta_completa`. Caso ainda não exista pedido, ignorar (sem erro).

### Exibição
- Novo componente `src/components/pedidos/HistoricoVhsysLista.tsx` (espelha o estilo de `HistoricoPagamentoLista`): linha por entrada com ícone (CheckCircle2/AlertTriangle), data/hora formatada (`dd/MM/yyyy HH:mm`), mensagem, badge de origem e expand opcional do payload (collapsible) sem dados sensíveis.
- Inserir o componente em:
  - `src/components/DetalhesPedidoDialog.tsx` (aba Pedidos): nova seção "Histórico de cadastro no VhSys" abaixo do histórico de pagamento.
  - `src/components/sucesso-cliente/ProjetoDetalheDialog.tsx`: idem.

## 2) Pagamentos por parcela com vencimento (sub-aba em Sucesso do Cliente)

### Modelo de parcela
- `src/types/orcamento.ts`:
  - `ParcelaPixBoleto`: adicionar `data_vencimento?: string` (ISO YYYY-MM-DD) e `pago?: boolean` opcionais.
  - `CartaoPagamento`: adicionar `data_primeira_parcela?: string` opcional. As demais parcelas do cartão são derivadas (+30 dias por parcela).
- Alterações são opcionais — registros existentes continuam funcionando (vencimento `undefined` = considerado "sem data" e cai em "sem agenda").

### Captura no formulário
- `src/components/CondicoesPagamentoForm.tsx`: ao lado do valor de cada parcela Pix/Boleto adicionar um `DateNumericInput` (DD/MM/AAAA) compacto para `data_vencimento`. Para Cartão, um único campo "1ª parcela em" — demais parcelas derivam. Não obrigatório (validação só avisa).
- Campo opcional `pago` por parcela: checkbox "Recebido" para marcar como pago manualmente.

### Derivação dos recebimentos
- Novo helper `src/lib/recebimentos.ts`:
  - `derivarRecebimentos(pedido): Recebimento[]` retornando lista achatada `{ pedidoId, numeroPedido, clienteNome, clienteCnpj, descricao, valor, data_vencimento, status: 'pago'|'pendente'|'futuro'|'sem_data' }`.
  - Regras:
    - Se parcela tem `pago === true` → `pago` (data efetiva = `pedido.orcamento_snapshot.data_pagamento` se a parcela for a 1ª, senão `data_vencimento`).
    - Senão se `data_vencimento <= hoje` → `pendente`.
    - Senão `data_vencimento > hoje` → `futuro`.
    - Sem data → `sem_data`.
  - Para cartão: gera N parcelas com vencimento `data_primeira_parcela + i*30d`. Se ausente, usa `pedido.data_pagamento + i*30d`.
  - Valores convertidos respeitando `tipo_valor` (% vs fixo) usando `valor_total` do snapshot e arredondamento `arredondarReais`.

### Sub-abas em Sucesso do Cliente
`src/pages/SucessoCliente.tsx` ganha abas (`Tabs` shadcn) no topo do conteúdo:
- **Projetos** (atual): grid existente intacto.
- **Recebimentos** (nova): exibe a UI nova abaixo.

Estrutura da aba Recebimentos:
- 4 KPIs no topo (cards): Total recebido, Total pendente, Total futuro, Próximo recebimento (data + valor + cliente).
- Sub-tabs internas: **Realizados** | **Pendentes** | **Futuros** | **Todos**.
- Lista única (não cards) — `src/components/sucesso-cliente/RecebimentosLista.tsx`:
  - Cabeçalho sticky com colunas: Cliente · CNPJ/CPF · Pedido · Descrição · Vencimento · Valor · Status.
  - Rows com hover, status como badge colorido (verde/âmbar/azul/cinza), data formatada `dd/MM/yyyy`.
  - Agrupamento opcional por cliente (collapsible) com subtotal.
  - Busca por cliente/CNPJ/nº pedido reaproveita o input do header.
- Visual harmônico: cards `border-border/60`, gradiente sutil no header, tipografia consistente, sem cores fora do design system (HSL tokens).

### Tempo real & sincronização
- `usePedidos` já usa React Query. Adicionar canal Realtime (`supabase.channel('pedidos-rt')`) ouvindo `postgres_changes` em `public.pedidos` (INSERT/UPDATE/DELETE) e invalidando `['pedidos']` — assim a aba Sucesso e a aba Pedidos compartilham a mesma cache e atualizam juntas.
- Migration adicional: `ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;` e `ALTER TABLE public.pedidos REPLICA IDENTITY FULL;`.
- A derivação dos recebimentos é puramente computada em cima de `pedidos`, então qualquer alteração em Pedidos (status, condicoes_pagamento via Alterar Pagamento, parcelas marcadas como pagas) reflete em <1s na aba Sucesso.

### "Marcar como recebido"
Na lista de Recebimentos, ação inline (botão) "Marcar como recebido" para uma parcela Pendente/Futura. Reaproveita `alterarPagamento` (já existe e já registra histórico) atualizando o array de parcelas dentro do `condicoes_pagamento`. Opcional senha — mantemos sem senha para reduzir fricção, já que existe histórico.

## Resumo técnico

```text
DB
  ALTER TABLE pedidos ADD COLUMN historico_vhsys jsonb NOT NULL DEFAULT '[]';
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
  ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

Tipos
  Pedido.historico_vhsys
  ParcelaPixBoleto.data_vencimento, pago
  CartaoPagamento.data_primeira_parcela

Hooks
  usePedidos: select da nova coluna + registrarVhsysAsync + canal Realtime

UI nova
  src/components/pedidos/HistoricoVhsysLista.tsx
  src/components/sucesso-cliente/RecebimentosLista.tsx
  src/lib/recebimentos.ts
  src/pages/SucessoCliente.tsx → Tabs Projetos | Recebimentos

Integrações
  AprovacaoOrcamentoDialog: registra entrada VhSys após cadastro automático
  PropostaCompletaDialog: idem quando pedido existe
  CondicoesPagamentoForm: campos de vencimento/recebido por parcela
  DetalhesPedidoDialog + ProjetoDetalheDialog: exibem HistoricoVhsysLista
```

Sem mudanças em regras de cálculo monetário; arredondamento em BRL continua via `arredondarReais`. Datas em ISO `YYYY-MM-DD`. Não toca em ofuscação de ingredientes.
