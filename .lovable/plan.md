
# Plano: Responsividade Completa do Sistema

## Objetivo
Garantir que todo o sistema funcione bem em três faixas:
- **Mobile** (≤640px) — iPhone/Android
- **Tablet** (641–1024px) — iPad e similares
- **Desktop** (≥1025px) — Macbook/PC

Prioridade máxima no módulo de **Orçamentos**, que está desalinhado.

---

## Escopo por Página

### 1. Orçamentos (prioridade alta)
Arquivos: `src/pages/Orcamentos.tsx`, `src/components/OrcamentoKanbanView.tsx`, `src/components/GerarOrcamentoDialog.tsx`, `src/components/AprovacaoOrcamentoDialog.tsx`, `src/components/CondicoesPagamentoForm.tsx`, `src/components/PropostaCompletaDialog.tsx`, `src/components/DetalhamentoFreteDialog.tsx`

Ajustes:
- Cabeçalho da página: empilhar título + filtros + botões em mobile (`flex-col md:flex-row`), botões `w-full sm:w-auto`.
- Filtros (busca, status, consultor): grid responsivo `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Alternância Tabela/Kanban: tornar tabela rolável horizontalmente (`overflow-x-auto`) e Kanban com `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` (já está, validar gap/spacing em tablet).
- Cards do Kanban: reduzir padding em mobile, quebrar linha de botões de ação, manter ícones acessíveis.
- Diálogos (Gerar/Aprovar/Proposta): `max-w-[95vw] md:max-w-3xl`, `max-h-[90vh] overflow-y-auto`, formulários em `grid-cols-1 md:grid-cols-2`.
- Tabelas internas dos diálogos: wrapper `overflow-x-auto` + larguras mínimas das colunas.

### 2. Navegação Global
Arquivo: `src/components/Navigation.tsx`
- Verificar/ativar menu hambúrguer em mobile (Sheet lateral), itens em coluna.
- Logo e ações compactas em mobile.

### 3. Demais páginas (varredura)
- `Precificacao.tsx`, `Calculator.tsx`, `Pedidos.tsx`, `Inventario.tsx`, `DashboardComercial.tsx`, `SucessoCliente.tsx`, `LeadsOrcamento.tsx`, `PainelAdministrador.tsx`, `Index.tsx`, `Login.tsx`.
- Padrão aplicado a todas:
  - Containers `px-3 sm:px-4 md:px-6 lg:px-8`.
  - Grids KPI: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Tabelas grandes: wrapper `overflow-x-auto` com `min-w-[720px]` (ou similar).
  - Diálogos: `max-w-[95vw]` + `max-h-[90vh] overflow-y-auto`.
  - Tipografia: `text-sm md:text-base`, títulos `text-xl md:text-2xl lg:text-3xl`.
  - Botões em barras de ação: `flex-wrap gap-2`, ícones com label oculto em mobile (`hidden sm:inline`).

### 4. Componentes compartilhados sensíveis
- `EmbalagensHierarchy.tsx`, `LotesPanel.tsx`, `InventarioDashboard.tsx`, `AcompanhamentoProcessos.tsx`, `DetalhesPedidoDialog.tsx`, `HistoricoAlteracoes.tsx`, `VariaveisEstruturaisForm.tsx`, `dashboard/*`, `pedidos/*`, `sucesso-cliente/*`.
- Tabelas → scroll horizontal; grids fixos → responsivos; dialogs → mobile-safe.

---

## Detalhes Técnicos

Breakpoints Tailwind usados: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.

Padrões aplicados consistentemente:
```text
Container:   px-3 sm:px-4 lg:px-6   max-w-7xl mx-auto
Header row:  flex flex-col md:flex-row md:items-center md:justify-between gap-3
Filtros:     grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3
KPIs:        grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
Tabelas:     <div class="overflow-x-auto"><table class="min-w-[720px]">
Dialog:      DialogContent className="max-w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto"
Botões:      w-full sm:w-auto + flex-wrap em barras
```

Sem mudanças em lógica de negócio, hooks, schemas ou cálculos — apenas classes Tailwind, estrutura de wrappers e ajustes de Dialog/Sheet.

---

## Verificação
Após cada bloco de mudanças, conferir com `preview_ui--set_preview_device_viewport` em mobile, tablet e desktop, focando primeiro no fluxo de Orçamentos (listagem, kanban, gerar, aprovar, proposta).

## Fora de escopo
- Alterações funcionais, de banco, cálculos, PDFs ou regras de negócio.
- Redesign visual (cores/tipografia da marca permanecem).
