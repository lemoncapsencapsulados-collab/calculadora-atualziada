## Objetivo

Permitir selecionar **múltiplos planos por produto** ao montar a Nova Cotação de Frete, gerando **uma cotação por produto** contendo a lista de planos escolhidos (ex.: 30, 60 e 90 frascos) — exibidos juntos no PNG exportado e no PDF do orçamento como opções para o produtor comparar.

## Mudanças

### 1. Banco (`frete_cotacoes`)
Nova coluna para armazenar múltiplos planos por cotação POD:
- `pod_planos_selecionados jsonb` — array de objetos `{ plano, preco, taxa_manuseio, margem_percentual, preco_final, margem_override }`.
- Mantém `pod_plano` / `pod_preco_por_envio` como "plano principal" (o primeiro selecionado) para compatibilidade com listagens e o PDF existente.

### 2. Tipos (`src/types/frete.ts`)
- Adicionar `PodPlanoSelecionado` interface e campo `pod_planos_selecionados` em `FreteCotacao` / `FreteCotacaoInsert`.

### 3. Dialog "Nova Cotação de Frete" (`src/pages/Logistica.tsx`)
No card de cada produto do orçamento:
- Trocar a linha atual de "plano único" por **checkboxes** ao lado de cada linha da tabela de planos (Plano / Frete / Manuseio / Margem / Preço Final).
- Rodapé do card mostra: nº de planos marcados + soma/média de referência.
- Botão de override de margem (senha `0212`) continua por plano na tabela.
- `handleSubmit` insere **1 cotação por produto** com `pod_planos_selecionados` preenchido; o "plano principal" salvo em `pod_plano`/`pod_preco_por_envio` é o menor plano marcado.

### 4. Exibição / Export
- **Tabela de cotações** em Logística: quando houver múltiplos planos, exibir "3 planos: 30, 60, 90 · a partir de R$ X,XX".
- **PNG export** (`src/lib/freteImageExport.ts`): renderizar tabela comparativa com todas as linhas de `pod_planos_selecionados`.
- **PDF do orçamento** (`src/lib/orcamentoGenerator.ts` / `freteHelpers.linhaPdfFrete`): quando houver múltiplos planos, listar todas as opções (plano → preço/envio) em vez de uma única linha.

### 5. Retro-compatibilidade
Cotações antigas sem `pod_planos_selecionados` continuam renderizando pelo caminho atual (fallback para `pod_plano` + `pod_preco_por_envio`).

## Detalhes técnicos

- Validação: exigir ≥1 plano marcado por produto antes de habilitar "Salvar cotações".
- Margem: `resolverMargemPorEnvios` é aplicada individualmente por linha; override via `AdminPasswordDialog` afeta apenas a linha editada e marca `margem_override: true` naquele item do array.
- Imposto 12% permanece embutido no `preco_final` de cada linha.
