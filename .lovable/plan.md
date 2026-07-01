## Objetivo

Tornar **Teste de Estabilidade** e **Notificação Anvisa** dois itens **independentes e opcionais** no Passo 4 do "Novo Orçamento". Cada um deve ter seu próprio seletor (ligar/desligar), preço discriminado, e só aparecer no resumo do orçamento e no PDF quando estiver selecionado.

## Estado atual

- Passo 4 (`EstabilidadeAnvisaStep`) mostra sempre os dois custos juntos, com um único "Total a embutir".
- Em `GerarOrcamentoDialog.tsx` (linhas 442–501), ambos são adicionados automaticamente como serviços do orçamento sempre que não é Revenda Lemon.
- Já existem duas entradas separadas em `servicos_extras` ("Teste de Estabilidade" e "Notificação Anvisa do Produto"), então o PDF já sabe listar cada uma — só falta poder omitir cada uma.

## Mudanças

### 1) `src/components/orcamento/EstabilidadeAnvisaStep.tsx`
- Adicionar dois novos props booleanos: `estabilidadeAtiva`, `anvisaAtiva`, com callbacks `onToggleEstabilidade`, `onToggleAnvisa`.
- Envolver cada bloco (Estabilidade e Anvisa) num `Card` próprio com um `Switch` no cabeçalho.
- Quando desligado: inputs desabilitados, subtotal do bloco = R$ 0,00 e mostrar aviso "Não será incluído no orçamento".
- Substituir o "Total a embutir" único por **dois subtotais discriminados** + um total geral que só soma o que está ligado.
- Manter regra existente: fórmulas do Catálogo continuam isentas de estabilidade (quando ativa), Anvisa aplica a todos os produtos.

### 2) `src/components/GerarOrcamentoDialog.tsx`
- Novos estados: `estabilidadeAtiva` (default `true`), `anvisaAtiva` (default `true`).
- Persistir os toggles no snapshot do orçamento (dentro de `configuracao_calculo` ou junto de cada `servicos_extras[i].configuracao`) para restauração ao reabrir.
- Ao restaurar (linha 385+): se existir a entrada de estabilidade/anvisa no snapshot, ativa; senão, desativa.
- Em `aplicaEstabilidade` (linha 443): dividir em `aplicaEstabilidade = estabilidadeAtiva && !isRevendaLemon && itensProducao.length > 0` e `aplicaAnvisa = anvisaAtiva && !isRevendaLemon && itensProducao.length > 0`.
- Recalcular `totalEstabilidadeAnvisa` respeitando cada flag.
- No push de `servicos_extras` (linhas 467–501): só adicionar cada entrada se sua flag estiver ativa. Se ambas desligadas, não adicionar nada.
- Passar os novos props para `EstabilidadeAnvisaStep`.
- Se Revenda Lemon: forçar ambos como `false` (já é pulado pelo step, mantém consistência nos cálculos).

### 3) PDF / Resumo do orçamento
- Nenhuma mudança adicional necessária: o PDF já itera `servicos_extras`. Ao omitirmos a entrada correspondente, ela some automaticamente do resumo e do PDF.

## Fora de escopo

- Não alterar preços padrão (`CUSTO_ESTABILIDADE_PADRAO`, `CUSTO_ANVISA_PADRAO`).
- Não alterar a lógica de senha de admin para edição de valores.
- Não mexer em orçamentos já salvos — snapshots antigos continuam sendo interpretados como "ambos ativos" (compatibilidade retroativa).
