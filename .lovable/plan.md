

## Plano: Corrigir persistência de cliente no fluxo Pago e Resumo para Contrato

### Problemas identificados

1. **`cliente_id` do orçamento nunca é usado para pré-carregar o cliente selecionado.** Quando o orçamento já tem um `cliente_id` (definido no Passo 1), os diálogos `PropostaCompletaDialog` e `InformacoesClienteDialog` não carregam esse cliente — o `clienteSelecionado` fica `null`.

2. **Sem `clienteSelecionado` e sem telefone preenchido, nenhum cliente é criado/atualizado.** A lógica (linha 368-378 em Proposta, 252-261 em Informacoes) só persiste se `clienteSelecionado` existe OU se `clienteData.telefone` tem valor. Mas o `telefone` em `dadosCliente` é o telefone PJ (inicializado como `''`), e se o usuário não preenche esse campo específico, a condição falha silenciosamente.

3. **`buscarPorTelefone` usa `ilike` com o telefone do formulário PJ**, que pode ser diferente do telefone de contato original do cliente PF. Isso impede a detecção de duplicata PF→PJ.

4. **Erros são capturados silenciosamente** (`catch (err) { console.error(...) }`) — o usuário não recebe feedback.

5. **O `cliente_id` não é atualizado no orçamento** após criar/atualizar o cliente nesses diálogos.

### Correções planejadas

**Arquivo: `PropostaCompletaDialog.tsx`**
- No `useEffect` inicial, se `orcamento.cliente_id` existir, buscar o cliente pelo ID e chamar `setClienteSelecionado` + pré-preencher todos os campos
- Na lógica de persistência: usar o telefone de contato original do cliente (do `orcamento` ou do `clienteSelecionado`) para busca de duplicata, não apenas o telefone PJ do formulário
- Após criar/atualizar cliente, salvar o `cliente_id` resultante no orçamento via `updateOrcamento`
- Mostrar toast de erro ao usuário em vez de capturar silenciosamente

**Arquivo: `InformacoesClienteDialog.tsx`**
- Mesmas correções: pré-carregar `clienteSelecionado` via `orcamento.cliente_id`, corrigir lógica de telefone para duplicata, salvar `cliente_id` de volta, exibir erro ao usuário

**Arquivo: `useClientes.ts`**
- Adicionar função `buscarPorId(id: string)` para carregar cliente pelo UUID

### Detalhes técnicos

```text
Fluxo corrigido:

1. Dialog abre → verifica orcamento.cliente_id
   → Se existe: busca cliente por ID, seta clienteSelecionado, preenche campos
   → Se não: mantém comportamento atual (busca manual)

2. Usuário preenche dados PJ e salva
   → Se clienteSelecionado existe: atualiza por ID ✓
   → Se não existe: busca por telefone de contato (não PJ)
     → Encontrou: exibe alerta de merge, atualiza
     → Não encontrou: cria novo
   → Salva cliente_id resultante no orçamento

3. Feedback: toast de sucesso/erro visível ao usuário
```

### Arquivos modificados
- `src/hooks/useClientes.ts` — adicionar `buscarPorId`
- `src/components/PropostaCompletaDialog.tsx` — pré-carregar cliente, corrigir persistência e feedback
- `src/components/InformacoesClienteDialog.tsx` — mesmas correções

