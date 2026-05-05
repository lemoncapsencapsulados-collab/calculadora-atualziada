## Nova aba "Sucesso do Cliente"

Página dedicada (`/sucesso-cliente`) para o time de CS acompanhar **cada pedido como um projeto**, mostrando obrigações, prazos por etapa, responsáveis e satisfação. Ela é **alimentada automaticamente pela aba Pedidos** (mesmo banco), sem cadastro duplicado. Cada cliente pode ter vários pedidos — cada pedido é um "projeto" listado.

### Estrutura da página

```
[ Filtros: busca | consultor | status geral | atraso | satisfação ]
[ KPIs: Projetos ativos | No prazo | Em atraso | Concluídos | NPS médio ]

[ Lista de Projetos (1 card por pedido) ]
  ┌──────────────────────────────────────────────────────────┐
  │ #PED-001 · Cliente X · Consultor Y                       │
  │ Status geral: Em Andamento  ·  Pgto: 12/05  ·  +18d      │
  │ ▸ Página de Vendas    [Pendente]  prazo: 22/05 · Rodrigo │
  │ ▸ Rótulos/Arte        [Concluído] em 10/05 · Jean        │
  │ ▸ Registro INPI       [Não nec.]                         │
  │ ▸ Impressão Rótulo    [Em produção] gráfica · Jean       │
  │ ▸ Código de Barras    [Concluído] 11/05                  │
  │ ▸ Produção            [Aguardando] prazo VHSYS · Diego   │
  │ ▸ Rotulagem           [Aguardando rótulo]                │
  │ ▸ Logística           [Aguardando envio · 48h] · Thiago  │
  │ ⭐ Satisfação: — (libera ao concluir tudo)               │
  │ [Abrir detalhes]                                         │
  └──────────────────────────────────────────────────────────┘
```

### Visão "Detalhes do Projeto" (Drawer/Dialog)

- Cabeçalho: cliente + contatos (e-mail, telefone, WhatsApp), consultor, data do pedido, data de pagamento, valor.
- Linha do tempo das 8 etapas (Página de Vendas, Rótulos, INPI, Impressão, Código de Barras, Produção, Rotulagem, Logística) com:
  - Status atual (com as opções específicas pedidas para cada etapa).
  - Prazo previsto calculado conforme regras abaixo + dias restantes/atraso.
  - **Responsável** fixo por etapa (Jean, Rodrigo, Diego, Thiago).
  - Data de conclusão quando aplicável.
  - Campo de observação por etapa (ex.: "consultar Jean — gráfica X").
- Bloco de Satisfação (NPS 0–10 + comentários) liberado quando todas as etapas estiverem `entregue`/`não_necessário`.
- Botão "Copiar resumo p/ WhatsApp" (igual ao já existente em Pedidos, mas formatado para CS).

### Regras de status por etapa (conforme briefing)

| Etapa | Opções de status | Responsável | Prazo padrão |
|---|---|---|---|
| Página de Vendas | Não Necessário · Pendente (mostra prazo) · Concluído (data) | Rodrigo | +10 dias úteis após Rótulo concluído |
| Rótulos/Arte | Faça Você Mesmo · Pendente (prazo) · Concluído | Jean | 7 dias úteis após briefing; revisão 3 dias úteis |
| Registro INPI | Não Necessário · Pendente (prazo) · Concluído (data) | Jean | configurável (default 60 dias) |
| Impressão Rótulo | Pendente (falta pagamento) · Em Produção (gráfica) · Concluído (na Lemon) | Jean | 10–15 dias úteis após pagamento do rótulo |
| Código de Barras | Não Necessário · Pendente (prazo) · Concluído (data) | Jean | configurável |
| Produção | Sem pedido (VHSYS) · Aguardando produção (com data) · Produzido | Diego | informado manualmente por pedido |
| Rotulagem | Aguardando rótulo · Rótulo na Lemon · Produto rotulado | Diego | derivado |
| Logística | Aguardando envio · Enviado | Thiago | 48h após produto rotulado |

> "Status geral" do projeto = derivado das 8 etapas (Aguardando início / Em andamento / Em atraso / Concluído).

### Filtros e ordenação

- Busca por cliente, nº pedido, consultor.
- Filtro por status geral, etapa em atraso, responsável, satisfação (com/sem nota).
- Ordenação por: maior atraso, prazo mais próximo, data de pagamento, alfabético.
- Atalhos: "Apenas em atraso", "Aguardando minha ação (Jean/Rodrigo/Diego/Thiago)".

### Detalhes técnicos

**Fonte de dados (sem nova tabela):**
- Lê de `pedidos` + `orcamento_snapshot` (já contém `data_pagamento`, `servicos_marca`, `dados_cliente`, `consultor_responsavel`).
- Reutiliza `usePedidos`, `extrairTodasDemandas` e `classificarEntregavel` em `src/lib/entregaveis.ts` para identificar quais entregáveis o pedido contratou.
- Reutiliza `acompanhamento_processos` (já tem campos `criacao_marca`, `producao`, `integracao_logistica`, `pagina_venda`, `envio_produto`, `registro_inpi`, `impressao_rotulos`, `codigo_barras`).

**Migração mínima** (`supabase/migrations/...sql`): adiciona colunas opcionais a `pedidos.acompanhamento_processos` via `jsonb` (sem alterar schema) para guardar:
- `prazos_por_etapa` (datas previstas/concluídas por etapa)
- `observacoes_por_etapa`
- `rotulagem_status` ('aguardando_rotulo' | 'rotulo_na_lemon' | 'produto_rotulado')
- `producao_status` ('sem_pedido_vhsys' | 'aguardando_producao' | 'produzido') + `producao_prazo_vhsys`
- `impressao_rotulo_pago_em`
- `briefing_preenchido_em` (para calcular o prazo de 7 dias úteis do Jean)

Como `acompanhamento_processos` já é `jsonb`, **não é necessária migração de schema** — apenas estendemos o tipo TypeScript (`AcompanhamentoProcessos` em `src/types/formula.ts`) com os campos opcionais.

**Arquivos a criar:**
- `src/pages/SucessoCliente.tsx` — página principal (KPIs + filtros + lista de projetos).
- `src/components/sucesso-cliente/ProjetoCard.tsx` — card de cada pedido.
- `src/components/sucesso-cliente/ProjetoDetalheDialog.tsx` — drawer com todas as etapas editáveis.
- `src/components/sucesso-cliente/EtapaRow.tsx` — linha por etapa (status, prazo, responsável, observação).
- `src/lib/sucessoCliente.ts` — helpers: cálculo de dias úteis, prazos por etapa, status geral derivado, responsáveis fixos.
- `src/hooks/useProjetosSucesso.ts` — agrega pedidos + entregáveis + prazos calculados.

**Arquivos a editar:**
- `src/types/formula.ts` — estender `AcompanhamentoProcessos` com os campos opcionais acima.
- `src/components/Navigation.tsx` — adicionar item "Sucesso do Cliente" (ícone `HeartHandshake`).
- `src/App.tsx` — registrar rota `/sucesso-cliente`.
- `src/hooks/usePedidos.ts` — apenas se precisar expor um helper para atualizar etapas (já tem `updateAcompanhamento`).

### Notas

- A página é **read+write**: o time de CS atualiza diretamente os status e prazos por etapa, refletindo de volta no card do pedido em `/pedidos`.
- Nenhum cálculo de preço é tocado; respeita o "Prazo de Preços" já implementado.
- Cálculo de "dias úteis" feito com `date-fns` + lista fixa de feriados nacionais (helper local), sem nova dependência.
- Responsabilidades (Jean/Rodrigo/Diego/Thiago) ficam num mapa em `src/lib/sucessoCliente.ts` para fácil ajuste futuro.
