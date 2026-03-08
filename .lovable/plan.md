

# Remover opção de criar conta da tela de login

Remover o toggle de signup e toda a lógica associada em `src/pages/Login.tsx`, mantendo apenas o formulário de login.

## Alterações

**`src/pages/Login.tsx`**
- Remover estado `isSignup` e função `signup`
- Remover botão "Não tem conta? Criar conta"
- Remover lógica condicional de signup no `handleSubmit`
- Manter apenas o fluxo de login com email/senha

