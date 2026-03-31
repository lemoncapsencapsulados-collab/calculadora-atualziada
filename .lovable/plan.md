

# Plano: Liberar bloqueio de margem mínima com senha

## Contexto
Existem dois bloqueios de margem mínima:
1. **Precificação** (`src/pages/Precificacao.tsx`, linhas 188-192 e 999-1007): impede salvar precificação com margem abaixo do mínimo
2. **Orçamento** (`src/components/GerarOrcamentoDialog.tsx`, linhas 345-353): oculta precificações com margem baixa da lista de produtos disponíveis

Ambos devem manter o bloqueio, mas permitir liberação com senha `0B%s8QP2Z+Do`.

## Alterações

### 1. `src/pages/Precificacao.tsx`
- Adicionar estado `senhaMargemDialog` (boolean) e `senhaMargemInput` (string) e `margemLiberada` (boolean)
- No `handleSalvar`: quando margem é baixa e `margemLiberada` é false, abrir dialog de senha em vez de bloquear direto
- Se senha correta (`0B%s8QP2Z+Do`), setar `margemLiberada = true` e prosseguir com o salvamento
- Resetar `margemLiberada` quando fórmula/preço mudar
- No botão de salvar: quando margem baixa, texto muda para "Liberar com senha" em vez de "Margem abaixo do mínimo", botão fica habilitado
- Adicionar Dialog de senha (campo input + botão confirmar)

### 2. `src/components/GerarOrcamentoDialog.tsx`
- Adicionar estado `senhaMargemOrcDialog` e `margemOrcLiberada`
- Ao invés de ocultar precificações com margem baixa, mostrar com indicador visual (badge vermelho)
- Ao tentar adicionar uma precificação com margem baixa, abrir dialog de senha
- Se senha correta, permitir adição daquela precificação
- Adicionar Dialog de senha similar

### 3. Senha hardcoded
A senha `0B%s8QP2Z+Do` será armazenada como constante nos componentes. Não será salva no banco pois é uma senha de override operacional distinta da senha de proteção de custos.

## Resultado
- Bloqueio continua ativo por padrão
- Usuário pode digitar a senha para liberar tanto o salvamento de precificação com margem baixa quanto a inclusão de produto com margem baixa em orçamento

