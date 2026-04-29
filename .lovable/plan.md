## Plano: Botão WhatsApp em cada pedido com fallback e tooltip

### 1. Helper compartilhado — `src/lib/whatsapp.ts` (novo)
Extrair lógica reaproveitável de `LeadsOrcamento.tsx`:
- `normalizeTelefone(tel)` — remove não-dígitos.
- `isTelefoneValido(tel)` — `length >= 10`.
- `buildWhatsappUrl(telefone, mensagem)` — adiciona DDI 55 e codifica mensagem; retorna `null` se inválido.

### 2. Pedidos — `src/pages/Pedidos.tsx`

**Resolver telefone com fallback (ordem):**
1. `pedido.orcamento_snapshot?.dados_cliente?.telefone`
2. `pedido.orcamento_snapshot?.cliente_telefone`
3. `pedido.formula_snapshot?.telefone` (se houver)
4. Fallback no cadastro `clientes` via `cliente_id` do snapshot — usar hook `useClientes()` (já carrega todos os clientes em cache via React Query) e fazer match por `id` ou por nome normalizado.

Implementação:
- Importar `useClientes` no topo do componente para reaproveitar o cache existente.
- Função `getTelefoneCliente(pedido, clientesById, clientesByNome)` retorna o primeiro telefone válido encontrado.

**Botão WhatsApp no card do pedido:**
- Adicionar entre os botões existentes de ação (linha 750-790, depois do botão "Copiar Relatório WhatsApp").
- Ícone: `MessageCircle` (lucide-react).
- Estilo verde: `className="bg-green-600 hover:bg-green-700 text-white"`.
- `disabled` quando telefone não for válido.
- Mensagem pré-preenchida:
  ```
  Olá {nome_cliente}, tudo bem? Sou da Lemon Caps, entrando em contato sobre o seu pedido {numero_pedido}. Previsão de entrega: {dd/MM/yyyy}.
  ```
- `onClick`: `window.open(url, '_blank')`.

**Tooltip:**
- Envolver o botão em `<Tooltip>` (`@/components/ui/tooltip`) — TooltipProvider já existe globalmente; caso não exista no escopo, embrulhar localmente.
- Quando habilitado: tooltip "Abrir conversa no WhatsApp".
- Quando desabilitado: tooltip "Telefone do cliente indisponível". Como `disabled` bloqueia eventos de hover no `<button>`, embrulhar em um `<span>` para o `TooltipTrigger` capturar o hover mesmo com botão desabilitado.

### 3. LeadsOrcamento — `src/pages/LeadsOrcamento.tsx`
Refatorar para usar o novo helper de `src/lib/whatsapp.ts` (remove duplicação). Mensagem mantida.

### Arquivos afetados
- **Criado:** `src/lib/whatsapp.ts`
- **Editado:** `src/pages/Pedidos.tsx` — botão WhatsApp + fallback de telefone via `useClientes`.
- **Editado:** `src/pages/LeadsOrcamento.tsx` — usar helper compartilhado.

Sem mudanças no banco de dados.
