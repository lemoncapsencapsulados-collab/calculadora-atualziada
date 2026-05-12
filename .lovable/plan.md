## 1) Loading e toasts na exclusão de pedido

**`src/hooks/usePedidos.ts`**
- Expor o estado da mutação: trocar `deletePedido: deletePedido.mutate` por `deletePedido: deletePedido.mutate` mais `deletandoPedido: deletePedido.isPending`. Toasts de sucesso/erro já existem (`toast.success('Pedido excluído com sucesso')` / `toast.error('Erro ao excluir pedido')`) — manter.

**`src/components/pedidos/ConfirmarExclusaoPedidoDialog.tsx`**
- Aceitar prop opcional `loading?: boolean`.
- Enquanto `loading` for `true`:
  - desabilitar botão "Excluir" (mostrar `Loader2` + "Excluindo...")
  - desabilitar botão "Cancelar" e o input de senha
  - bloquear fechamento via `onOpenChange` (ignorar se loading)
- NÃO fechar o dialog imediatamente ao clicar em Excluir; aguardar a callback resolver. Para isso, mudar `onConfirm` para poder retornar `Promise<void>` e só fechar (`setOpen(false)`) após sucesso.

**`src/pages/Pedidos.tsx`**
- Consumir `deletandoPedido` e passar para o dialog global como `loading={deletandoPedido}`.
- Trocar `onConfirm={() => deletePedido(pedidoParaExcluir.id)}` por uma versão async que usa `deletePedido` em modo `mutateAsync` e só limpa `pedidoParaExcluir` no `finally`.

Resultado: o usuário vê o spinner no botão "Excluir", os toasts já cadastrados disparam em sucesso/erro, e o popup permanece aberto até a operação terminar.

## 2) Cadastro automático no VhSys ao confirmar pagamento

**`src/components/AprovacaoOrcamentoDialog.tsx`** (fluxo de aprovação que muda o status para `pago` e cria o pedido)

- Em `handleSubmit`, logo após `await createPedidoFromOrcamento(orcamentoCompleto)`, disparar automaticamente `cadastrarClienteVhSys(...)` (a mesma função já usada hoje pelo botão manual). Não exigir clique do vendedor.
- Guardar em estado:
  - `vhsysResultado: { success: boolean; error?: string }`
  - `vhsysPayload`: o objeto `body` enviado para a edge function (nome, nome_fantasia, tipo_pessoa, cnpj_cpf, email, telefone, cep, logradouro, número, bairro, cidade, uf, contato, inscrições). Hoje esse `body` é montado dentro de `cadastrarClienteVhSys`; refatorar para também retorná-lo (ver seção técnica).
- Trocar o atual `setShowVhsysModal(true)` por exibição de um **popup informativo** (não decisório):

  - Título: "Cliente cadastrado no VhSys" (sucesso) ou "Falha ao cadastrar no VhSys" (erro).
  - Conteúdo (sucesso): nome/razão social, CPF ou CNPJ, e‑mail, telefone, cidade/UF, e um bloco "Resumo do envio" listando os campos efetivamente enviados (formatação chave: valor, ocultando vazios). Texto curto: "Cliente X foi gerado automaticamente no VhSys com os dados abaixo."
  - Conteúdo (erro): mensagem retornada + botão "Tentar novamente" que reexecuta `cadastrarClienteVhSys` com o mesmo payload.
  - Único botão principal: "Fechar", que chama `handleFecharPosPagamento()` (mantém o comportamento atual de `onSuccess()` + `onClose()`).

- Remover o botão manual "Cadastrar Cliente no VhSys" e o estado `vhsysCadastrado` que só servia para o fluxo manual.

**`src/lib/vhsysCliente.ts`**
- Refatorar `cadastrarClienteVhSys` para também retornar o `payload` enviado e os dados normalizados:
  ```ts
  return { success, error?, payload, data? }
  ```
  onde `payload` é o `body` montado e `data` é o retorno da edge function (caso traga `id_cliente` ou similar). Sem mudanças na edge function.

**`src/components/PropostaCompletaDialog.tsx`** (também usa `cadastrarClienteVhSys`)
- Apenas adaptar à nova assinatura (campos extras opcionais). Comportamento existente preservado.

## Resumo técnico

```text
Pedidos.tsx
  pedidoParaExcluir → ConfirmarExclusaoPedidoDialog
    loading={deletandoPedido}
    onConfirm={async () => { await deletePedido(id) }}

AprovacaoOrcamentoDialog.tsx
  handleSubmit():
    ...updates + createPedidoFromOrcamento
    const r = await cadastrarClienteVhSys(...)   // automático
    setVhsysResultado(r); setShowVhsysModal(true)
  Modal pós-pagamento: read-only com dados do cliente + resumo do payload
```

Sem mudanças em banco de dados, edge functions, regras de cálculo, RLS, ou no fluxo de exclusão em si (apenas UX/loading).
