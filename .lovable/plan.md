

## Plano: Bloquear edição de custos + adicionar validação de margem com senha

### Alterações em `src/components/EditarPrecificacaoDialog.tsx`

**1. Tornar campos de matéria-prima e embalagem somente leitura**
- Remover os estados `custoMP` e `setCustoMP`, `custoEmbalagem` e `setCustoEmbalagem`
- Usar valores fixos de `precificacao.custo_materia_prima` e `precificacao.custo_embalagem` diretamente
- Trocar os `<Input>` desses campos por texto estático ou inputs com `disabled`/`readOnly`
- Atualizar o título da seção de "CUSTOS BASE (Editáveis)" para "CUSTOS BASE"
- Atualizar o `useMemo` de `resultado` para usar os valores fixos da precificação

**2. Adicionar bloqueio de margem mínima com senha**
- Adicionar estados: `senhaMargemDialog`, `senhaMargemInput`, `margemLiberada`
- No `handleSalvar`: se `validacaoMargem?.status === 'baixa'` e `!margemLiberada`, abrir dialog de senha
- Senha de liberação: `0B%s8QP2Z+Do`
- Se senha correta, setar `margemLiberada = true` e prosseguir com salvamento
- Resetar `margemLiberada` quando preço de venda mudar
- Botão salvar: quando margem baixa e não liberada, exibir "Liberar com senha" com ícone de cadeado
- Adicionar Dialog de senha (input + botão confirmar)

### Arquivo
- `src/components/EditarPrecificacaoDialog.tsx`

