

## Plano: Botões "Anexar Contrato" e "Anexar Comprovante de Pagamento" nos Pedidos

### Objetivo
Cada pedido terá dois botões para upload de arquivos. Após anexar, os botões mudam para "Ver Contrato" e "Ver Comprovante(s)". Comprovantes de pagamento aceitam múltiplos uploads.

### Alterações

**1. Storage bucket (migração SQL)**
- Criar bucket `pedidos-anexos` (público para leitura autenticada)
- Criar políticas RLS no `storage.objects` para autenticados fazerem upload/download/delete

**2. Tabela `pedido_anexos` (migração SQL)**
```sql
CREATE TABLE pedido_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  tipo text NOT NULL, -- 'contrato' ou 'comprovante'
  arquivo_url text NOT NULL,
  arquivo_nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE pedido_anexos ENABLE ROW LEVEL SECURITY;
-- Políticas CRUD para authenticated
```
- `tipo = 'contrato'`: máximo 1 por pedido
- `tipo = 'comprovante'`: múltiplos por pedido

**3. `src/hooks/usePedidoAnexos.ts`** (novo)
- Hook com funções: `uploadAnexo(pedidoId, tipo, file)`, `deleteAnexo(id)`, `getAnexos(pedidoId)`
- Upload para `pedidos-anexos/{pedidoId}/{tipo}/{filename}`
- Query reativa dos anexos por pedido

**4. `src/pages/Pedidos.tsx`** — Botões no card
- Após a linha de botões existente (linha ~547), adicionar dois botões:
  - Se não tem contrato: "Anexar Contrato" (ícone `Upload`) → input file hidden
  - Se tem contrato: "Ver Contrato" (ícone `FileText`) → abre URL em nova aba
  - Se não tem comprovante: "Anexar Comprovante" (ícone `Upload`)
  - Se tem comprovante(s): "Ver Comprovante(s)" (ícone `Wallet`) → abre dialog listando todos com opção de adicionar mais
- State para controlar qual pedido está com dialog de comprovantes aberto

**5. Dialog de Comprovantes** (inline ou componente separado)
- Lista comprovantes existentes com nome e data
- Botão "Adicionar Comprovante"
- Botão de excluir em cada comprovante

### Arquivos modificados/criados
- 1 migração SQL (bucket + tabela)
- `src/hooks/usePedidoAnexos.ts` (novo)
- `src/pages/Pedidos.tsx`

