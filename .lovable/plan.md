## Objetivo
Ajustar a aba **Comissionamento** em duas frentes:
1. Tornar o card **"Comissão por Consultor"** sempre baseado no mês atual por padrão e ter seu próprio filtro de mês independente.
2. Corrigir o **status de pagamento** dos pedidos na tabela "Pedidos no Período" para refletir corretamente "Parcialmente pago" vs "Pago", exigindo confirmação explícita (checkbox) parcela por parcela — inclusive para pagamento único.

## Mudanças

### 1) Card "Comissão por Consultor"
- Adicionar um seletor de mês **dedicado dentro do próprio card**, separado do filtro global, inicializado sempre com o mês atual ao abrir a aba.
- O título passa a mostrar o mês escolhido nesse seletor (ex.: "Comissão por consultor — 06/2026").
- O cálculo do resumo por consultor passa a usar esse mês local, sem depender do filtro global de mês (que continua valendo para "Pedidos no período" e cards de totais).
- Comportamento esperado: ao entrar no painel, esse card já mostra o mês corrente; o usuário pode navegar mês a mês sem mexer nos outros filtros.

### 2) Status do pedido em "Pedidos no Período"
Hoje a regra considera "Pago" apenas quando todas as parcelas estão pagas e "Parcialmente Pago" quando pelo menos uma está paga — a lógica do badge já está correta. O problema real é a **origem do `pago`**:

- Para **pagamento único** (sem parcelas estruturadas), o sistema marca `pago = true` automaticamente sempre que existe `data_pagamento` no pedido. Isso faz o pedido aparecer como "Pago" sem confirmação real.
- Para parcelas estruturadas (Pix/Boleto e Cartão), o campo `pago` só vira `true` via checkbox — está correto, mas o acesso à confirmação está só dentro do diálogo de detalhes.

Ajustes:
- **Remover a marcação automática de pago no pagamento único.** Toda confirmação de pagamento passa a exigir o check manual, mesmo quando há apenas uma parcela integral.
- **Tratar o pagamento único como uma "parcela única" confirmável**, gravando o estado `pago` dentro de `condicoes_pagamento` (criando uma estrutura mínima se não existir), para que o check funcione como nas demais.
- Garantir que a transição de status fique: nenhuma parcela paga → "Em dia"; pelo menos uma paga e nem todas → "Parcialmente Pago"; todas pagas → "Pago"; qualquer parcela vencida não paga → "Atrasado" (mantém prioridade atual).
- **Expor o check de confirmação parcela a parcela diretamente na linha do pedido** na tabela "Pedidos no período", via um pop-over/expansor com a lista de parcelas e checkbox individual — sem precisar abrir o diálogo de Detalhes. O diálogo de Detalhes continua existindo com a mesma funcionalidade.
- Cada toggle de check usa a mutação existente `toggleParcelaPagaAsync`, que já espelha em Pedidos.

## Detalhes técnicos
- `RelatorioComissoes.tsx`: novo estado local `mesResumoConsultor` independente de `mes`; recomputar `resumoPorConsultor` a partir de `todasParcelas` filtrando por esse mês local; adicionar `Input type="month"` dentro do `CardHeader` do card de consultor.
- `src/lib/comissoes.ts`: no caso "pagamento único" (sem `cond.metodo_principal` estruturado), parar de derivar `pago` de `!!baseData`. Passar a ler `cond?.pagamento_unico_pago` (novo flag) ou similar.
- `aplicarStatusPago` ganha suporte ao caso "pagamento único", criando uma estrutura mínima em `condicoes_pagamento` quando não houver, para persistir o flag.
- Adicionar UI inline na linha da tabela "Pedidos no período" (ícone/botão "Confirmar pagamentos" abrindo um Popover) com checkbox por parcela usando `toggleParcelaPagaAsync`.

## Resultado esperado
- O card "Comissão por Consultor" sempre mostra o mês atual ao abrir e tem filtro próprio para navegar entre meses.
- Nenhum pedido aparece como "Pago" sem confirmação manual; status só vira "Pago" quando todas as parcelas (ou a parcela única) estiverem confirmadas via check; até lá fica "Parcialmente Pago" ou "Em dia".
- A confirmação parcela a parcela está disponível direto na linha do pedido em "Pedidos no período".
