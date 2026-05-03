# Plano: Enviado com data, Observações e atalho "Ver Orçamento" nos Insights

## Objetivo
Permitir registrar a data exata de envio de um orçamento, anexar observações livres por orçamento, refletir tudo isso em "Insights e Alertas" do Dashboard, garantir que orçamentos recusados saiam dos alertas de atenção, e adicionar atalho para abrir o orçamento direto da notificação.

## Mudanças no banco
Adicionar duas colunas na tabela `orcamentos`:
- `data_envio` (timestamptz, nullable) — data/hora em que o orçamento foi marcado como enviado.
- `observacoes_internas` (text, nullable) — texto livre do consultor sobre o orçamento (separado de `observacoes` que já existe e é exibido no PDF para o cliente).

Migração simples via ALTER TABLE; sem alterar RLS (já cobertas pelas políticas existentes).

## Página "Orçamentos" (`src/pages/Orcamentos.tsx` + Kanban)
1. **Botão "Enviado"** em cada card:
   - Marca o status como `enviado` e grava `data_envio = now()`.
   - Abre um pequeno popover/dialog perguntando a data de envio (default: hoje) caso o usuário queira registrar uma data diferente.
   - Se o status for trocado pelo Select para `enviado`, também grava `data_envio` automaticamente (apenas na primeira vez ou quando o usuário editar).
   - Exibe a data de envio no card (linha de metadados, junto de "Criado/Editado/Pgto").

2. **Botão "Observação"** em cada card:
   - Abre um dialog com textarea pré-preenchido com `observacoes_internas` atual.
   - Salva via novo mutation `updateObservacoesInternas`.
   - Indicador visual no card quando há observação registrada (ícone + preview).

3. **Status "Recusado"**: já existe — apenas garantir que ao mudar para `recusado` os insights deixem de listá-lo (tratado no hook do Dashboard).

## Hook de orçamentos (`src/hooks/useOrcamentos.ts`)
- Estender `updateStatus` para aceitar e gravar `data_envio` quando `status === 'enviado'`.
- Adicionar mutation `updateObservacoesInternas({ id, texto })`.
- Atualizar `parseOrcamento` e tipos para os novos campos.

## Tipos (`src/types/orcamento.ts` e `src/types/dashboard.ts`)
- `Orcamento`: incluir `data_envio?: string | null` e `observacoes_internas?: string | null`.
- `InsightDashboard`: incluir campos opcionais para deep-link e nota:
  - `orcamento_id?: string`
  - `numero_orcamento?: string`
  - `observacao?: string`
  - `data_envio?: string`

## Hook do Dashboard (`src/hooks/useDashboardComercial.ts`)
1. Selecionar `data_envio` e `observacoes_internas` no query de `orcamentos-dashboard`.
2. Trocar a base de cálculo de "enviado há X dias" de `updated_at` para `data_envio` (fallback para `updated_at` em registros antigos).
3. Garantir que orçamentos com `status === 'recusado'` não geram nenhum insight de atenção/alerta (já é o caso da lógica de "enviado", basta confirmar). Adicionar insight `positivo`/`atencao` resumindo recusas se relevante (já existe).
4. Em todo `resultado.push({...})` referente a um orçamento específico, anexar `orcamento_id` e `numero_orcamento` para permitir o botão "Ver Orçamento".
5. Novo bloco de insights: **Observações de orçamentos**
   - Para cada orçamento (não recusado/concluído) que possua `observacoes_internas`, gerar um insight tipo `oportunidade` com a mensagem "Obs: {texto curto}" e os campos de deep-link.
6. Para orçamentos enviados, incluir `data_envio` formatada na mensagem ("enviado em dd/mm/aaaa - X dias atrás").

## Componente de Insights (`src/components/dashboard/DashboardInsights.tsx`)
1. Renderizar botão **"Ver Orçamento"** quando o insight tiver `orcamento_id`.
   - Ao clicar: navegar para `/orcamentos?focus={orcamento_id}` (ou abrir dialog de edição). Solução mais simples: usar `react-router` `useNavigate` para `/orcamentos` com query param e `Orcamentos.tsx` lê o param para abrir o `GerarOrcamentoDialog` com aquele orçamento.
2. Mostrar a `data_envio` quando presente.
3. Mostrar `observacao` em itálico abaixo da mensagem quando o insight a contiver.

## Página Orçamentos – deep-link
- Em `src/pages/Orcamentos.tsx`, ler `useSearchParams()` para `focus`. Quando presente, buscar o orçamento (já carregado na lista paginada — se não estiver na página atual, fazer fetch direto por id) e abrir `editandoOrcamento`.

## Resultado para o usuário
- Botão "Enviado" registra data e mostra no card e nos insights.
- Botão "Observação" permite anotar contexto comercial visível no Dashboard.
- Cada notificação no Dashboard tem botão "Ver Orçamento" que abre o orçamento correspondente.
- Quando o status vira "Recusado", o orçamento desaparece dos alertas de atenção/alerta automaticamente.
