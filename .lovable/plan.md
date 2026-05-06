## Bloqueio de senha para excluir pedidos

Adicionar um gate com senha "021200" antes de permitir a exclusão de qualquer pedido na aba **Pedidos**.

### Mudanças

1. **Novo componente `src/components/pedidos/ConfirmarExclusaoPedidoDialog.tsx`**
   - `AlertDialog` com:
     - Título "Confirmar exclusão"
     - Descrição com o número do pedido
     - Campo `Input type="password"` obrigatório
     - Botão "Excluir" desabilitado até o texto bater com `"021200"`
   - Ao confirmar com senha correta, chama `onConfirm()` (que executa `deletePedido(pedido.id)`).
   - Senha incorreta: `toast.error('Senha incorreta')` e mantém o dialog aberto.
   - Limpa o campo ao abrir/fechar.

2. **`src/pages/Pedidos.tsx`** (linhas ~956-974)
   - Substitui o `AlertDialog` inline atual pelo novo componente.
   - Mantém o ícone `Trash2` no `Button variant="destructive"` como trigger.

### Notas
- Senha hardcoded `"021200"` apenas como gate de UX no client (RLS do Supabase continua exigindo autenticação). Nada de armazenar em localStorage — pede a senha a cada exclusão.
- Não afeta exclusão em outros lugares (precificações, orçamentos) — escopo é apenas Pedidos, conforme solicitado.