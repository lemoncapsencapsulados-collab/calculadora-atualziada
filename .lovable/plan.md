## Problema

No `GerarOrcamentoDialog` (Passo 2 — Custos de Produção), o campo "Preço unit." valida e dispara a senha de margem baixa a cada tecla digitada (`onChange` chama `handleUpdateItemPreco` imediatamente). Resultado: ao tentar digitar um valor novo (ex.: apagar `14,5` para digitar `18`), o primeiro dígito já cai abaixo da margem mínima, o sistema abre o diálogo de senha / bloqueia, e o usuário nunca consegue terminar de digitar o novo preço.

## Mudança proposta (somente UI / front-end, sem alterar regras de negócio)

Arquivo único: `src/components/GerarOrcamentoDialog.tsx`.

### 1. Input controlado por rascunho local
- Adicionar estado `precoDraft: Record<number, string>` (chave = índice do item).
- O `<Input>` de "Preço unit." passa a ler de `precoDraft[index] ?? String(item.preco_unitario)` e apenas atualiza o rascunho no `onChange`. Nenhuma validação, nenhum cálculo de margem nessa digitação.
- Permite apagar tudo, digitar livremente, inclusive valores temporariamente abaixo do mínimo.

### 2. Confirmação explícita
- Adicionar um botão "Confirmar" ao lado do input (ícone Check, `size="icon"`, `variant="default"`), visível apenas quando o rascunho difere do `item.preco_unitario` atual.
- Confirmar também ao pressionar **Enter** no input ou ao perder o foco (`onBlur`) — todos chamam o mesmo `confirmarPrecoDraft(index)`.
- `confirmarPrecoDraft` faz o parse do número e chama o já existente `handleUpdateItemPreco(index, novoPreco)`, que mantém intacta a lógica de:
  - aplicar livremente se não há custo conhecido;
  - validar margem mínima via `validarMargemPorTipo`;
  - abrir `senhaPrecoDialog` quando abaixo do mínimo;
  - aplicar o preço após senha correta.
- Após confirmação bem-sucedida, limpar `precoDraft[index]`.

### 3. Pré-visualização da nova margem enquanto digita
- Logo abaixo do badge atual de margem, quando `precoDraft[index]` difere do preço aplicado e há custo conhecido, exibir uma linha discreta:
  - "Nova margem: X.X% — {mensagem da validacao}" calculada com `calcMargemItem(draftNumber, custoUnit)` + `validarMargemPorTipo`.
  - Cor segundo o status (verde/amarelo/vermelho), sem bloquear nada.
- Assim o usuário vê em tempo real qual será a nova margem antes de clicar em Confirmar.

### 4. Bloqueio para avançar continua igual
- A regra existente em `canProceed` (passo 2) que bloqueia avanço quando há margem baixa não liberada permanece intocada. Adicionalmente, bloquear avanço também enquanto houver `precoDraft` pendente (não confirmado) para evitar perda do valor digitado — exibir toast: "Confirme os preços editados antes de avançar."

### 5. Diálogo de senha (já existente)
- Nenhuma mudança na UI do `senhaPrecoDialog`. Continua exigindo `SENHA_LIBERACAO_MARGEM` para liberar o preço abaixo do mínimo, e o badge "Liberado por senha" + nova margem já são mostrados após confirmação.

## Fora de escopo
- Não alterar `handleUpdateItemPreco`, `calcMargemItem`, `validarMargemPorTipo`, nem a lógica de senha/margem.
- Não mexer em precificações salvas/catálogo da listagem superior.
- Não alterar cálculos de impostos, subtotais, setup, PDFs ou banco.

## Verificação
- Editar o preço do item de catálogo "Foco e Concentração" para um valor maior (ex.: 20,00) digitando livremente; confirmar; ver nova margem positiva.
- Editar para valor abaixo do mínimo (ex.: 10,00); confirmar; ver diálogo de senha; com senha correta, aplicar e mostrar badge "Liberado por senha" + nova margem.
- Confirmar que o avanço para Passo 3 funciona após confirmação e fica bloqueado se houver rascunho pendente.
