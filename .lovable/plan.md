

## Plano: Sistema de Acompanhamento de Processos nos Pedidos

### Objetivo
Adicionar dentro de cada card de pedido um painel de acompanhamento por etapas operacionais, agrupadas por tema. Quando todas as etapas estiverem concluídas, exibir avaliação de satisfação (0-10) e campo de observações.

### Estrutura dos processos

```text
Criação de Marca:
  └ Designer: pendente | entregue

Produção:
  └ Produto: pendente | entregue

Integração Logística:
  └ Status: pendente | entregue | nao_necessario

Criação de Página de Venda:
  └ Status: pendente | entregue

Envio do Produto (Modelo Estoque):
  └ Status: pendente | entregue
```

Satisfação (aparece quando tudo entregue/não necessário):
  - Nota de 0 a 10 (slider ou select)
  - Campo de observações de satisfação

### Alterações

**1. Migração de banco — nova coluna `acompanhamento_processos` na tabela `pedidos`**

```sql
ALTER TABLE pedidos ADD COLUMN acompanhamento_processos jsonb DEFAULT '{
  "criacao_marca": "pendente",
  "producao": "pendente",
  "integracao_logistica": "pendente",
  "pagina_venda": "pendente",
  "envio_produto": "pendente",
  "satisfacao_nota": null,
  "satisfacao_observacoes": null
}'::jsonb;
```

**2. Arquivo: `src/types/formula.ts`**
- Adicionar interface `AcompanhamentoProcessos` com os campos acima
- Adicionar `acompanhamento_processos?: AcompanhamentoProcessos` ao tipo `Pedido`

**3. Arquivo: `src/hooks/usePedidos.ts`**
- Mapear o novo campo na query de leitura
- Criar mutation `updateAcompanhamento` que faz update parcial do JSONB no banco e notifica webhook

**4. Novo componente: `src/components/AcompanhamentoProcessos.tsx`**
- Recebe `acompanhamento` (dados atuais) e `onUpdate` (callback)
- Renderiza cada grupo temático com label + Select inline para trocar status
- Cores: pendente = amarelo, entregue = verde, não necessário = cinza
- Quando todos os processos estiverem em "entregue" ou "nao_necessario", exibe seção de satisfação:
  - Slider 0-10 com número visível
  - Textarea para observações
  - Botão salvar satisfação

**5. Arquivo: `src/pages/Pedidos.tsx`**
- Dentro de cada card, após a seção de status do pedido, adicionar `<Collapsible>` com título "Acompanhamento de Processos ▸"
- Dentro do collapsible, renderizar `<AcompanhamentoProcessos>`
- Passar callback que chama `updateAcompanhamento`

### Detalhes técnicos
- O JSONB permite evolução futura sem migrações (adicionar etapas)
- Cada mudança de status persiste imediatamente no banco
- O webhook existente é notificado nas atualizações para integração com n8n

