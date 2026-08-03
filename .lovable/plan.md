# Orçamento de rótulos por produto (com regra de +50%)

Hoje os campos "Orçamento de marca pensado em (rótulos comprados)" e "Orçamento de rótulo pensado na produção feita em" são únicos para toda a demanda de Rótulo. Vão passar a ser por produto do pedido.

## Como fica

Cada produto listado no briefing de Rótulo ganha, além de nome/tipo/segmento/Quantidade de Potes Vendidos:

- **Orçamento de rótulos comprados** (número) — pré-preenchido com o mínimo válido (potes vendidos x 1,5).
- **Produção pensada em** — Cuiabá / Sergio / São Paulo Premium (múltipla escolha), por produto.
- **Indicador ao lado do campo**: mostra o mínimo exigido e alerta em vermelho quando o valor digitado for menor.

## Regra de validação

Para cada produto: orçamento de rótulos >= quantidade de potes vendidos x 1,5.

Exemplo: 100 potes do produto A exigem no mínimo 150 rótulos; 200 potes do produto B exigem no mínimo 300. Se algum produto ficar abaixo, o salvamento é bloqueado com mensagem indicando o produto e o mínimo. Também é obrigatório ao menos um local de produção por produto.

## Detalhes técnicos

- `src/types/demandaMarca.ts`: mover `orcamento_qtd_rotulos` e `locais_producao` de `DadosRotulo` para `ProdutoRotulo`; manter os campos antigos como opcionais em `DadosRotulo` para compatibilidade com demandas já salvas.
- `src/components/pedidos/demandas/FormRotulo.tsx`: remover o bloco global desses dois campos; renderizá-los dentro de cada linha de produto; helper `minimoRotulos(potes) = Math.ceil(potes * 1.5)`; validação por produto no `submeter`.
- Compatibilidade: ao abrir uma demanda salva com os valores no nível global, replicar para cada produto.
- `src/lib/demandasMarcaPdf.ts`: imprimir orçamento de rótulos e locais de produção por produto, em vez de linha única no cabeçalho do briefing.
- `supabase/functions/clickup-enviar-demanda/index.ts`: mesma mudança na descrição em markdown da task.