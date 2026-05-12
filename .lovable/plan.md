## Problema

Ao clicar no botão da lixeira em `Pedidos`, o popup de confirmação com senha não aparece (e em alguns casos o card "some" da tela sem confirmar a exclusão). O componente `ConfirmarExclusaoPedidoDialog` já existe e usa a senha `021200`, mas o trigger via `AlertDialogTrigger asChild` aninhado dentro de uma `<div>` flex de ações está falhando em abrir o diálogo de forma confiável.

## Solução

Refatorar o fluxo de exclusão para um diálogo **controlado no nível da página** `src/pages/Pedidos.tsx`, garantindo que o clique na lixeira sempre abra o popup de senha antes de qualquer chamada a `deletePedido`.

### Alterações

1. **`src/pages/Pedidos.tsx`**
   - Adicionar estado `pedidoParaExcluir: { id: string; numero: string } | null`.
   - Substituir o `<ConfirmarExclusaoPedidoDialog trigger={...}>` por um `<Button>` simples com `onClick={(e) => { e.stopPropagation(); setPedidoParaExcluir({ id: pedido.id, numero: pedido.numero_pedido }); }}`.
   - Renderizar **uma única instância** de `ConfirmarExclusaoPedidoDialog` (modo controlado) fora do `.map()` dos pedidos, ligada a `pedidoParaExcluir`.

2. **`src/components/pedidos/ConfirmarExclusaoPedidoDialog.tsx`**
   - Suportar modo controlado: aceitar props opcionais `open`, `onOpenChange` e tornar `trigger` opcional.
   - Manter senha `021200` e o comportamento atual (Enter envia, mostra erro em senha incorreta, limpa campo ao fechar).
   - Ao confirmar, chamar `onConfirm()` e fechar via `onOpenChange(false)`.

3. **Sem mudanças** em `usePedidos.deletePedido`, RLS, schema ou outros componentes.

### Resultado esperado

- Clicar na lixeira sempre abre o popup centralizado pedindo a senha `021200`.
- A exclusão só ocorre após senha correta digitada e botão "Excluir" clicado.
- Senha errada mostra toast "Senha incorreta" e mantém o popup aberto.