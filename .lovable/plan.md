## Mudanças no diálogo "Confirmar Pagamento"

Arquivo único: `src/components/AprovacaoOrcamentoDialog.tsx`.

### 1) Busca automática de CNPJ

- Hoje `handleBuscarCnpj` só roda no clique do botão de busca.
- Adicionar `useEffect` observando `dadosCliente.cnpj`: ao detectar 14 dígitos numéricos válidos (`validarCNPJ`), disparar `handleBuscarCnpj()` automaticamente.
- Usar uma `ref` (`cnpjBuscadoRef`) para guardar o último CNPJ já buscado e evitar requisições duplicadas enquanto o usuário continua digitando ou ao reabrir o dialog.
- Mostrar o spinner `isSearchingCnpj` no campo durante a busca (já existe). Manter o botão manual de busca como fallback.

### 2) Campos obrigatórios

**PJ — bloco já existente em `handleConfirmAprovacao`:**
- Manter CNPJ válido + Razão Social + Endereço + CEP + Cidade + Estado + Email válido (já obrigatórios).
- Reforçar que Telefone (WhatsApp da empresa) continua obrigatório (já está; manter mensagem como "Telefone/WhatsApp").
- Marcar visualmente os labels obrigatórios com `*` no formulário PJ (CNPJ, Email, Telefone/WhatsApp).

**PF — manter `validatePF` exatamente como está** (Nome, CPF válido, RG, endereço, CEP, cidade, estado, telefone, email válido, estado civil).
- Apenas reforçar o asterisco visual nos campos Nome, CPF e Telefone/WhatsApp dentro de `PessoaFisicaFields` (o componente já marca com `*` quando `required`; não há mudança funcional, só rotular o telefone como "Telefone/WhatsApp").

**Detalhamento do frete (novo bloco de validação):**
- Exigir `detalhamentoEnvio.tipo` preenchido (`total_lemoncaps` | `parcial` | `total_produtor`).
- Se `tipo === 'parcial'`, exigir `descricao_parcial.trim()` não vazio.
- Exigir definição explícita de `freteLemonCaps` (Sim/Não). Como hoje já tem default `true`, manter o boolean — mas se `tipo === 'total_produtor'`, força `false` (já implementado). Caso contrário, garantir que houve interação: marcar como obrigatório no array de erros somente se nada estiver definido válido para o cenário.
- Marcar o título da seção de frete e o campo de descrição parcial com `*`.

**Condições de pagamento (já validadas, reforçar):**
- `validarCondicoesPagamento(condicoesPagamento, orcamento.valor_total)` continua sendo a fonte da verdade.
- Hoje, quando há erros de pagamento, o submit ainda prossegue se houver outros erros bloqueando — refatorar para que a validação concatene os erros de pagamento ao `camposFaltando` e bloqueie o submit em qualquer caso. O painel `errosPagamento` permanece visível dentro do bloco de pagamento.
- Marcar o título "Condições de Pagamento" com `*`.

**Data de pagamento (já validada):**
- Mantém regra atual: obrigatória, formato DD/MM/AAAA válido, não pode ser futura. Já está em `dataPagamentoValida`. Manter mensagem clara no array.
- Marcar o label "Data de Pagamento" com `*` (e indicador inline em vermelho quando inválida).

### 3) Apresentação dos erros

- Continuar exibindo o toast "Campos obrigatórios não preenchidos" com a lista concatenada.
- Adicionar, abaixo do botão de confirmar, um pequeno bloco `Alert` resumindo os erros atuais quando o usuário tentou enviar (estado novo `erroValidacao: string[]`), para que ele consiga ver sem o toast desaparecer.

### Resumo técnico

```text
AprovacaoOrcamentoDialog.tsx
  + useEffect [dadosCliente.cnpj] → autoBuscarCnpj (debounced via ref)
  ~ handleConfirmAprovacao:
      - PJ: valida campos atuais (sem mudança de regra)
      - PF: validatePF (sem mudança)
      - NOVO: valida detalhamentoEnvio.tipo + descricao_parcial
      - NOVO: erros de validarCondicoesPagamento sempre bloqueiam
      - mantém validação de dataPagamento
      - acumula tudo em camposFaltando + setErroValidacao
  ~ Labels com '*' nos campos novos obrigatórios + Alert inline com lista
```

Sem mudanças em banco de dados, edge functions, hooks ou outros componentes.
