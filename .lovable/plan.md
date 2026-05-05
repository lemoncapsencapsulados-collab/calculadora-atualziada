## Objetivo

Após clicar em **"Confirmar Pagamento"** no dialog `AprovacaoOrcamentoDialog`, exibir um **modal intermediário** oferecendo a opção de **Cadastrar o cliente no VhSys** antes de fechar o fluxo.

## Comportamento atual

- Hoje, o botão **"Cadastrar Cliente no VhSys"** só existe dentro do `PropostaCompletaDialog`, na tela de preview do PDF do resumo de contrato (linhas 639-650).
- No `AprovacaoOrcamentoDialog`, ao clicar em "Confirmar Pagamento": cria o pedido, chama `onSuccess()` e fecha o dialog imediatamente — sem oferecer cadastro no VhSys.

## Comportamento desejado

1. Usuário clica em **"Confirmar Pagamento"** no popup atual.
2. Pedido é criado normalmente (mesma lógica de hoje).
3. Em vez de fechar imediatamente, abre um **novo modal de sucesso** com:
   - Mensagem: "Pagamento confirmado e pedido criado com sucesso!"
   - Botão **"Cadastrar Cliente no VhSys"** (com loading/spinner)
   - Botão **"Fechar"** (pular cadastro e finalizar)
4. Ao clicar em "Cadastrar Cliente no VhSys": chama a edge function `vhsys-create-cliente` usando os dados do cliente já preenchidos no fluxo (mesma lógica do `handleCadastrarVhSys` existente). Mostra toast de sucesso/erro.
5. Após sucesso (ou clicar em "Fechar"), fecha tudo e dispara `onSuccess()`.

## Mudanças técnicas

### `src/components/AprovacaoOrcamentoDialog.tsx`

1. **Extrair a função `handleCadastrarVhSys`** já existente em `PropostaCompletaDialog.tsx` (linhas 177-279) para um helper compartilhado em `src/lib/vhsysCliente.ts` que receba `{ orcamento, dadosCliente, tipoPessoa, pessoasFisicas, responsavelPJ }` e retorne `{ success, error? }`. Refatorar `PropostaCompletaDialog.tsx` para usar esse helper (sem mudança de comportamento lá).

2. **Adicionar novo estado** no `AprovacaoOrcamentoDialog`:
   - `showVhsysModal: boolean` — controla o modal pós-confirmação
   - `vhsysLoading: boolean` — loading do botão de cadastro

3. **Modificar `handleConfirmAprovacao`** (linha 369):
   - Após `createPedidoFromOrcamento(orcamentoCompleto)` com sucesso, em vez de chamar `onSuccess()` + `onClose()`, setar `showVhsysModal = true` e manter o dialog principal "por trás" oculto (ou substituir o conteúdo).

4. **Renderizar o novo modal** (condicional `showVhsysModal`):
   - Substitui o conteúdo do `DialogContent` atual por uma tela de sucesso com os dois botões.
   - Botão "Cadastrar Cliente no VhSys" → chama o helper compartilhado, mostra toast, mantém o modal aberto até usuário fechar.
   - Botão "Fechar" → chama `onSuccess()` + `onClose()`.

### `src/lib/vhsysCliente.ts` (novo arquivo)

- Exporta `cadastrarClienteVhSys(params)` com toda a lógica de montagem do payload (nome, CNPJ/CPF, endereço, observação com produtos do orçamento) e a chamada `supabase.functions.invoke('vhsys-create-cliente', ...)` exatamente como hoje.

### `src/components/PropostaCompletaDialog.tsx`

- Substituir as linhas 177-279 por uma chamada ao novo helper `cadastrarClienteVhSys(...)`. Comportamento visual do botão existente permanece igual.

## Arquivos afetados

- **Novo**: `src/lib/vhsysCliente.ts`
- **Editado**: `src/components/AprovacaoOrcamentoDialog.tsx` (modal pós-confirmação + integração com helper)
- **Editado**: `src/components/PropostaCompletaDialog.tsx` (refatoração para usar helper, sem mudança visual)

## Não muda

- Edge function `vhsys-create-cliente` permanece inalterada.
- Validação da data de pagamento, criação de pedido, fluxos de proposta/orçamento permanecem iguais.
- Botão de VhSys no `PropostaCompletaDialog` continua existindo (não é removido).
