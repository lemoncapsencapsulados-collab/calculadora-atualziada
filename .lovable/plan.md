

## Plano: Data de pagamento + Acompanhamento de Processos nos relatórios

### O que falta hoje
1. **WhatsApp**: não envia `Data de Pagamento` por pedido (PDF/Excel já enviam).
2. **PDF/Excel/WhatsApp**: nenhum mostra os status do **Acompanhar Processos** (Criação de Marca, **Produção**, Integração Logística, Página de Venda, Envio do Produto, e Avaliação de Satisfação se houver).

### Alterações

**1. `src/lib/relatoriosPedidos.ts`**
- Em `PedidoReport`: adicionar `acompanhamento_processos?: any`.
- Em `extractData`: extrair `acompanhamento` com 5 status + nota/observações de satisfação.
- Mapeamento de labels de status:
  - `pendente` → "⏳ Pendente"
  - `entregue` → "✅ Entregue"
  - `nao_necessario` → "— Não Necessário"
- Em `addPedidoToPDF`: novo bloco **"Acompanhamento de Processos"** (após Frete, antes de Observações) listando:
  - Criação de Marca: status
  - **Produção: status**
  - Integração Logística: status
  - Página de Venda: status
  - Envio do Produto: status
  - Linha extra de Satisfação (Nota X/10 + observações) se `satisfacao_nota != null`.
- Em `headers` Excel: adicionar 5 colunas de status + 2 de satisfação ao final:
  `Status Criação Marca | Status Produção | Status Integração Logística | Status Página Venda | Status Envio Produto | Satisfação (Nota) | Satisfação (Obs.)`
- Em `buildRows`: preencher essas colunas só na primeira linha de cada pedido.

**2. `src/pages/Pedidos.tsx`** — função `copiarRelatorioWhatsApp` (linha 99)
- Adicionar `Data de Pagamento: dd/MM/yyyy` (de `snap.data_pagamento`) logo após "Tipo de produtor".
- Adicionar bloco final com emoji 🔄:
  ```
  🔄 Acompanhamento de Processos:
  • Criação de Marca: ⏳ Pendente
  • Produção: ✅ Entregue
  • Integração Logística: — Não Necessário
  • Página de Venda: ⏳ Pendente
  • Envio do Produto: ⏳ Pendente
  ⭐ Satisfação: 9/10 — "ótimo atendimento"   (só se houver nota)
  ```
- Bloco só aparece se `pedido.acompanhamento_processos` existir.

### Arquivos modificados
- `src/lib/relatoriosPedidos.ts`
- `src/pages/Pedidos.tsx`

