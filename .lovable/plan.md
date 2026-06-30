## Puxar setups vendidos a partir dos Pedidos

### Diagnóstico
- Hoje, a "Análise Apurada do Vendedor" lê `orcamentos.servicos_marca`. Vários orçamentos do Emmanuel já convertidos em pedido têm `servicos_marca = []` (ex.: ORC-177, ORC-174, ORC-168) — provavelmente porque o setup foi ajustado depois ou o orçamento antigo foi reaproveitado/editado.
- Os pedidos correspondentes guardam `orcamento_snapshot` (jsonb) — quando o orçamento original tinha setup, ele está lá. Quando não tinha, o snapshot também vem vazio.
- Hoje a tela de Pedidos não mostra explicitamente os setups vendidos de cada pedido (só aparece dentro do detalhamento via `DetalhesPedidoDialog`).

### O que vou implementar

**1. Análise do vendedor passa a usar Pedidos como fonte de verdade das vendas**
- `src/lib/analiseVendedor.ts`: além de orçamentos, carregar `pedidos` filtrando pelo consultor (via `orcamento_snapshot.consultor_responsavel` ou via JOIN no orçamento).
- Para cada pedido do mês, ler `orcamento_snapshot.servicos_marca` e contabilizar setups (nome, quantidade, valor).
- Itens de produção e potes continuam saindo dos pedidos (snapshot), garantindo que toda venda real entre na análise — mesmo se o orçamento foi editado depois.
- Fallback: se um pedido não tiver snapshot, usar o orçamento vinculado.

**2. Garantir snapshot atualizado quando o orçamento é editado depois de virar pedido**
- `src/hooks/useOrcamentos.ts` (mutation de update): se o orçamento já tem `pedido_id_gerado`, também atualizar o `orcamento_snapshot` do pedido vinculado com os novos `servicos_marca` e `itens_producao`. Assim qualquer ajuste no setup feito após a conversão flui para o pedido.

**3. Mostrar setups vendidos na lista de Pedidos**
- `src/pages/Pedidos.tsx`: adicionar uma coluna/linha "Setups" no card/linha de cada pedido, listando os `nome_plano` (badges) e o valor total de setup. Já existe a função que lê `snap.servicos_marca` — só falta exibi-la no resumo.
- No `DetalhesPedidoDialog`, manter o detalhamento completo (já existe).

**4. Backfill (uma vez)**
- Migração leve via insert tool para preencher `pedidos.orcamento_snapshot` com os `servicos_marca` do orçamento original quando o snapshot estiver vazio mas o orçamento atual tiver setup. Isso recupera vendas antigas como as do Emmanuel.

### Resultado esperado
- Todos os setups que o Emmanuel vendeu aparecem na "Análise Apurada do Vendedor".
- Cada pedido mostra na própria listagem quais setups foram vendidos.
- Edições futuras de setup no orçamento sincronizam automaticamente para o pedido.
