

## Plano: Corrigir filtro de data + Separar valor bruto vs entrada financeira

### Problema 1: Filtro de data com inconsistência de timezone

No hook `useDashboardComercial.ts` (linha 94), `parseISO(dataPgto)` retorna a data em UTC, mas `filtros.dataInicio` e `filtros.dataFim` são criados com `startOfMonth(hoje)` / `endOfMonth(hoje)` em horário local. Isso causa divergência nos limites do mês (ex: pagamento em 01/04 às 21h BRT = 02/04 00h UTC, sai do filtro de março).

**Correção no `useDashboardComercial.ts`:** normalizar a comparação de datas extraindo apenas ano-mês-dia (ignorando horário/timezone), usando `startOfDay` nas datas parseadas antes de comparar.

### Problema 2: Dois indicadores financeiros distintos

O usuário precisa distinguir:
- **Valor Bruto de Contratos**: soma de `valor_total` dos orçamentos pagos no período (já existe como "Faturamento Total")
- **Entrada Financeira Real**: apenas o valor da primeira parcela (entrada) que de fato entrou no caixa na data de pagamento

**Lógica para calcular a entrada financeira:**
A partir de `condicoes_pagamento` no snapshot do pedido:
- Se `metodo_principal === 'pix_boleto'`: primeira parcela de `parcelas_pix_boleto`
- Se `metodo_principal === 'cartao_credito'`: primeiro cartão de `cartoes`
- Se `metodo_principal === 'misto'`: primeira parcela pix/boleto de `misto_parcelas_pix_boleto`
- Se legado com `valor_entrada`: usar diretamente
- Se nenhuma condição definida ou apenas 1 parcela: considerar `valor_total` como entrada integral

Cada parcela tem `tipo_valor` (`percentual` ou `fixo`) e `valor`. Se percentual, calcular sobre o `valor_total`.

### Alterações

**Arquivo: `src/hooks/useDashboardComercial.ts`**
1. Criar função auxiliar `calcularEntradaFinanceira(snap)` que extrai o valor da primeira parcela do `condicoes_pagamento`
2. Corrigir comparação de datas no `pedidosFiltrados`: normalizar para início do dia antes de comparar
3. Adicionar `entradaFinanceira` ao cálculo dos KPIs (soma das entradas de todos os pedidos filtrados)

**Arquivo: `src/types/dashboard.ts`**
4. Adicionar campo `entradaFinanceira: number` à interface `KPIsGerais`

**Arquivo: `src/components/dashboard/DashboardKPIs.tsx`**
5. Renomear o card "Faturamento Total" para "Valor Bruto Contratos"
6. Adicionar novo card "Entrada Financeira" com ícone e cor distintos (ex: Wallet, azul-petróleo)
7. Ajustar grid para 7 cards (`lg:grid-cols-7`)

Nenhuma alteração de banco de dados necessária — os dados já estão no snapshot.

