

## Plano: Remover "Status do Pedido" manual + Corrigir filtro de data no ranking

### 1. Remover "Status do Pedido" e derivar status do acompanhamento

**Arquivo: `src/pages/Pedidos.tsx`**

- Remover o bloco do `Select` de "Status do Pedido:" (linhas 371-395) — o status manual deixa de existir
- Criar função `getStatusFromAcompanhamento(acomp)`: se todos os 5 campos de processo estiverem em "entregue" ou "nao_necessario", retorna `'concluido'`; caso contrário mantém o status atual do pedido
- Atualizar o badge do card header (linha 334) para usar essa derivação: quando todos os processos estão concluídos, o card exibe badge verde "Concluído"
- No callback `onUpdate` do `AcompanhamentoProcessos`, além de salvar o acompanhamento, automaticamente atualizar o `status` do pedido para `'concluido'` quando todos os processos estiverem finalizados (e reverter para `'aguardando_producao'` se algum voltar a pendente)

**Arquivo: `src/hooks/usePedidos.ts`**
- Ajustar `updateAcompanhamento` para também atualizar o campo `status` do pedido baseado nos processos

### 2. Corrigir filtro de data no ranking do dashboard

**Arquivo: `src/hooks/useDashboardComercial.ts`**

O problema: `data_pagamento` no snapshot está em formato ISO com timezone UTC (ex: `2026-04-08T04:00:00+00:00`). A comparação com `startOfDay` pode gerar inconsistência dependendo do fuso do navegador.

**Correção:** extrair apenas a parte da data (YYYY-MM-DD) como string e comparar diretamente, eliminando qualquer efeito de timezone:

```text
const dataPgtoStr = snap.data_pagamento.substring(0, 10); // "2026-04-08"
const inicioStr = format(filtros.dataInicio, 'yyyy-MM-dd');
const fimStr = format(filtros.dataFim, 'yyyy-MM-dd');
return dataPgtoStr >= inicioStr && dataPgtoStr <= fimStr;
```

Isso garante que a data de pagamento do cliente seja comparada corretamente independente do fuso horário, e o ranking de consultores, KPIs e todas as métricas reflitam o período customizado selecionado.

### Arquivos modificados
- `src/pages/Pedidos.tsx`
- `src/hooks/usePedidos.ts`
- `src/hooks/useDashboardComercial.ts`

