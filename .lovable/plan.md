

## Plano Revisado: Sistema centralizado de clientes

### 1. Tabela `clientes` (migração SQL)

```sql
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,                      -- Nome PF (sempre obrigatório)
  telefone text NOT NULL,                  -- Telefone de contato (obrigatório)
  tipo_pessoa text DEFAULT 'pf',           -- 'pf' | 'pj'
  razao_social text,                       -- Obrigatório apenas no front quando PJ
  cpf text,
  cnpj text,
  rg text,
  email text,
  endereco text,
  cep text,
  cidade text,
  estado text,
  estado_civil text,
  inscricao_estadual text,
  inscricao_municipal text,
  endereco_cnpj text,
  cep_cnpj text,
  cidade_cnpj text,
  estado_cnpj text,
  telefone_cnpj text,
  email_cnpj text,
  forma_venda text,
  responsavel_pj jsonb DEFAULT '{}',       -- QSA (PessoaFisicaResponsavel)
  pessoas_fisicas jsonb DEFAULT '[]',      -- Lista de PFs adicionais
  dados_extras jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated full CRUD (mesma política das demais tabelas)
-- Trigger updated_at
-- ALTER TABLE orcamentos ADD COLUMN cliente_id uuid;
-- ALTER TABLE formulas ADD COLUMN cliente_id uuid;
```

### 2. Hook `useClientes.ts`
- CRUD completo com react-query
- `buscarCliente(termo)`: busca por nome, razão social, telefone, CPF ou CNPJ via `ilike`
- Detecção de duplicata: ao salvar PJ, verifica se existe PF com mesmo telefone → retorna cliente existente para merge

### 3. Componente `ClienteSelector.tsx`

**Props:** `modo: 'basico' | 'completo'`, `clienteId`, `onSelect`, `onClear`

**Modo básico** (Calculator, Precificacao, GerarOrcamentoDialog Passo 1):
- Campos: Nome (obrigatório) + Telefone (obrigatório)
- Autocomplete por nome/telefone
- Botão "Criar novo cliente" inline

**Modo completo** (PropostaCompletaDialog, InformacoesClienteDialog):
- Busca/seleção de cliente existente com auto-preenchimento de TODOS os campos
- Mantém exatamente os mesmos campos já coletados hoje (tipo pessoa, CNPJ com busca BrasilAPI, razão social, inscrições, endereço, CEP, cidade, estado, telefone, email, responsável PJ/QSA, pessoas físicas, forma de venda)
- Razão social obrigatória no front quando tipo_pessoa = 'pj'
- Ao salvar, grava/atualiza na tabela `clientes`

**Fluxo PF→PJ:**
- Ao selecionar PJ e preencher telefone que já existe em cliente PF:
  - Exibe dialog listando campos que serão atualizados (tipo_pessoa, razao_social, cnpj, etc.)
  - Usuário confirma ou edita antes de salvar
  - Atualiza o registro existente (não cria duplicata)

### 4. Pontos de integração

| Local | Arquivo | Modo |
|-------|---------|------|
| Criação de Produto | `Calculator.tsx` | `basico` |
| Precificação | `Precificacao.tsx` | `basico` |
| Orçamento Passo 1 | `GerarOrcamentoDialog.tsx` | `basico` |
| Orçamento → Pago | `PropostaCompletaDialog.tsx` | `completo` |
| Info Cliente | `InformacoesClienteDialog.tsx` | `completo` |

### 5. Retrocompatibilidade
- `nome_cliente` (orcamentos) e `cliente` (formulas) continuam preenchidos com string do nome
- `cliente_id` adicionado como referência opcional
- Dados completos sempre na tabela `clientes`

### Arquivos criados/modificados
- **Criar:** migração SQL, `src/hooks/useClientes.ts`, `src/components/ClienteSelector.tsx`
- **Modificar:** `Calculator.tsx`, `Precificacao.tsx`, `GerarOrcamentoDialog.tsx`, `PropostaCompletaDialog.tsx`, `InformacoesClienteDialog.tsx`

