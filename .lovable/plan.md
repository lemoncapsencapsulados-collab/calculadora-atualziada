## Problema

Hoje a página **Pedidos** já tem o botão "Excluir" (ícone de lixeira) que abre o `ConfirmarExclusaoPedidoDialog` pedindo a senha de administrador (`0212`). Pelo código atual, a exclusão deveria funcionar:
- RLS de `pedidos` permite `DELETE` para qualquer usuário autenticado.
- Não há foreign keys de outras tabelas referenciando `pedidos`, então nada bloqueia o delete no banco.

Como o usuário relata que **não consegue excluir**, o `delete` está falhando silenciosamente ou o toast de erro genérico ("Erro ao excluir pedido") não mostra a causa real. Preciso tornar o fluxo robusto e diagnóstico.

## Mudanças

### 1) `src/hooks/usePedidos.ts` — `deletePedido`
- Antes de deletar o pedido, remover registros dependentes que o app cria mas não têm FK com cascade:
  - `pedido_anexos` (linhas com `pedido_id = id`) — também limpar os arquivos no bucket `pedidos-anexos`, se existirem.
- Logar o erro real do Supabase (`error.message` + `error.details`) no `onError` e exibir no toast (`toast.error(\`Erro ao excluir: ${msg}\`)`), para que qualquer falha futura seja visível.
- Garantir que o erro é re-lançado para que o dialog não feche sem confirmação de sucesso.

### 2) `src/pages/Pedidos.tsx` — fluxo do dialog
- Em `onConfirm` do `ConfirmarExclusaoPedidoDialog`: só fechar o dialog (`setPedidoParaExcluir(null)`) **após sucesso**. Hoje o `finally` fecha mesmo em erro, o que esconde a senha digitada e o feedback. Manter aberto em caso de erro para o usuário ver a mensagem e tentar de novo.
- Nenhuma mudança visual além disso; a senha continua sendo `0212` via `SENHA_EXCLUSAO`.

### 3) Verificação
- Após implementar, testar excluir um pedido com e sem anexos e confirmar que:
  - Popup de senha aparece ao clicar na lixeira ✅ (já existe)
  - Senha errada mostra "Senha incorreta" e mantém dialog aberto ✅ (já existe)
  - Senha correta exclui o pedido definitivamente da tabela `pedidos` e da lista
  - Em caso de erro do backend, toast mostra a causa exata

## Fora de escopo
- Não mexer no painel de Comissionamento (não pediram exclusão lá).
- Sem mudanças de schema ou RLS.