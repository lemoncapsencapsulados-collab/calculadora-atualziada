

## Plano: Melhorias no Sistema de Orcamentos

### Objetivo
Adicionar ao sistema de orcamentos:
1. Campo de consultor responsavel (substitui numero do orcamento na exibicao)
2. Destaque verde para orcamentos aprovados
3. Popup "Informacoes do Cliente" com preenchimento automatico via CNPJ
4. Popup "Detalhamento de Frete" com tabelas de precos e opcoes customizadas
5. Inclusao dessas informacoes no PDF final

---

### 1. Alteracoes no Banco de Dados

Adicionar novas colunas na tabela `orcamentos`:

```sql
ALTER TABLE orcamentos ADD COLUMN consultor_responsavel TEXT;
ALTER TABLE orcamentos ADD COLUMN dados_cliente JSONB DEFAULT '{}'::jsonb;
ALTER TABLE orcamentos ADD COLUMN detalhamento_frete JSONB DEFAULT '{}'::jsonb;
```

Estrutura de `dados_cliente`:
```json
{
  "nome_completo": "Joao da Silva",
  "email": "joao@empresa.com",
  "telefone": "11999998888",
  "cpf": "123.456.789-00",
  "cnpj": "12.345.678/0001-00",
  "razao_social": "Empresa LTDA",
  "endereco_cnpj": "Rua ABC, 123",
  "cep_cnpj": "01234-000",
  "cidade": "Sao Paulo",
  "estado": "SP"
}
```

Estrutura de `detalhamento_frete`:
```json
{
  "frete_lemon_caps": true,
  "usa_tabela_tradicional": true,
  "planos_customizados": [
    {
      "tipo_produto": "Soluvel",
      "plano": "2 POTES",
      "valor": 56.00
    }
  ]
}
```

---

### 2. Tabelas de Frete Padrao (Constantes no Codigo)

```typescript
const TABELA_FRETE = {
  'Encapsulados': [
    { plano: 'Ate 5 POTES', valor: 34.80 },
    { plano: '6 a 9 POTES', valor: 47.60 },
    { plano: '10 a 12 POTES', valor: 54.60 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ],
  'Liquido': [
    { plano: 'Ate 5 POTES', valor: 34.80 },
    { plano: '6 a 9 POTES', valor: 47.60 },
    { plano: '10 a 12 POTES', valor: 54.60 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ],
  'Po': [
    { plano: '1 POTE', valor: 48.50 },
    { plano: '2 POTES', valor: 51.50 },
    { plano: '3 a 5 POTES', valor: 54.40 },
    { plano: '6 a 7 POTES', valor: 62.90 },
    { plano: '8 a 10 POTES', valor: 65.90 },
    { plano: '10+ POTES', valor: null, customizado: true }
  ],
  'Gummy': [
    { plano: '1 POTE', valor: 48.70 },
    { plano: '2 a 3 POTES', valor: 50.20 },
    { plano: '4 a 7 POTES', valor: 54.50 },
    { plano: '8 a 10 POTES', valor: 63.40 },
    { plano: '10 a 12 POTES', valor: 67.10 },
    { plano: '12+ POTES', valor: null, customizado: true }
  ]
};
```

---

### 3. Novos Componentes a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/InformacoesClienteDialog.tsx` | Popup para dados do cliente com consulta CNPJ |
| `src/components/DetalhamentoFreteDialog.tsx` | Popup para configurar frete |

---

### 4. Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/types/orcamento.ts` | Adicionar tipos para DadosCliente e DetalhamentoFrete |
| `src/hooks/useOrcamentos.ts` | Incluir novos campos nas operacoes CRUD |
| `src/pages/Orcamentos.tsx` | Destaque verde, botoes de cliente/frete, mostrar consultor |
| `src/components/GerarOrcamentoDialog.tsx` | Adicionar campo de consultor no passo 1 |
| `src/lib/orcamentoGenerator.ts` | Adicionar secoes de cliente e frete no PDF |

---

### 5. Fluxo da Interface

#### Card do Orcamento (Aprovado = Verde)

```text
+--------------------------------------------------+
|  ██████ FUNDO VERDE DESTAQUE ████████████████████ |
|                                                   |
|  Consultor: Maria Silva        [Aprovado] ✓       |
|  Cliente: Farmacia ABC                            |
|  31/01/2025 | 3 produtos | 2 servicos             |
|  TOTAL: R$ 15.400,00                              |
|                                                   |
|  [Info Cliente] [Frete] [Editar] [PDF] [Excluir]  |
+--------------------------------------------------+
```

#### Popup "Informacoes do Cliente"

```text
+--------------------------------------------------+
|        INFORMACOES DO CLIENTE                    |
+--------------------------------------------------+
|                                                  |
|  Nome Completo: [_________________________]      |
|  Email:         [_________________________]      |
|  Telefone:      [_________________________]      |
|  CPF:           [_________________________]      |
|                                                  |
|  CNPJ:          [_____________] [Buscar]         |
|  (Preenchimento automatico apos busca CNPJ)      |
|                                                  |
|  Razao Social:  [_________________________]      |
|  Endereco:      [_________________________]      |
|  CEP:           [_____________]                  |
|  Cidade/Estado: [____________] [__]              |
|                                                  |
|              [Cancelar]  [Salvar]                |
+--------------------------------------------------+
```

#### Popup "Detalhamento de Frete"

```text
+--------------------------------------------------+
|        DETALHAMENTO DE FRETE                     |
+--------------------------------------------------+
|                                                  |
|  Frete com a Lemon Caps fazendo direto           |
|  para o cliente final do produtor?               |
|                                                  |
|  ( ) Sim    ( ) Nao                              |
|                                                  |
|  [SE SIM]:                                       |
|  Usar tabela tradicional de envio?               |
|  (X) Sim - Tabela padrao aplicada                |
|  ( ) Nao - Definir valores personalizados        |
|                                                  |
|  [SE NAO OU VALORES PERSONALIZADOS]:             |
|  +--------------------------------------------+  |
|  | Tipo Produto  | Plano        | Valor       |  |
|  |---------------|--------------|-------------|  |
|  | [Soluvel v]   | [2 POTES v]  | R$ [56,00]  |  |
|  | [+ Adicionar Plano]                        |  |
|  +--------------------------------------------+  |
|                                                  |
|              [Cancelar]  [Salvar]                |
+--------------------------------------------------+
```

---

### 6. Consulta Automatica de CNPJ

Usar API gratuita BrasilAPI para consultar CNPJ:

```typescript
async function consultarCNPJ(cnpj: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`
  );
  if (!response.ok) throw new Error('CNPJ nao encontrado');
  return await response.json();
}

// Retorno da API:
// razao_social, nome_fantasia, logradouro, numero, complemento,
// bairro, municipio, uf, cep, email, telefone
```

Campos preenchidos automaticamente apos busca:
- Razao Social
- Endereco completo (logradouro + numero + complemento + bairro)
- CEP
- Cidade
- Estado

---

### 7. Atualizacao do PDF

Nova estrutura do PDF incluindo:

```text
+--------------------------------------------------+
|  ██████████████ LEMON CAPS ██████████████████████ |
|  ORCAMENTO COMERCIAL                              |
|  Consultor: Maria Silva        31/01/2025         |
+--------------------------------------------------+
|                                                  |
|  ================================================|
|  DADOS DO CLIENTE                                |
|  ================================================|
|  Nome: Joao da Silva                             |
|  Email: joao@empresa.com | Tel: (11) 99999-8888  |
|  CPF: 123.456.789-00                             |
|  CNPJ: 12.345.678/0001-00                        |
|  Endereco: Rua ABC, 123 - Sao Paulo/SP           |
|  CEP: 01234-000                                  |
|                                                  |
|  ================================================|
|  CUSTOS DE PRODUCAO                              |
|  ================================================|
|  ... (tabela de produtos) ...                    |
|                                                  |
|  ================================================|
|  SERVICOS DE MARCA                               |
|  ================================================|
|  ... (tabela de servicos) ...                    |
|                                                  |
|  ================================================|
|  DETALHAMENTO DE FRETE                           |
|  ================================================|
|  Frete via Lemon Caps: SIM                       |
|  Tabela Aplicada: Tradicional                    |
|  OU                                              |
|  Planos Personalizados:                          |
|  • Soluvel - 2 POTES: R$ 56,00                   |
|  • Liquido - Ate 5 POTES: R$ 36,00               |
|                                                  |
|  ================================================|
|  VALOR TOTAL: R$ 15.400,00                       |
|  ================================================|
+--------------------------------------------------+
```

---

### 8. Tipos TypeScript Atualizados

```typescript
// src/types/orcamento.ts

export interface DadosCliente {
  nome_completo?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  cnpj?: string;
  razao_social?: string;
  endereco_cnpj?: string;
  cep_cnpj?: string;
  cidade?: string;
  estado?: string;
}

export interface PlanoFreteCustomizado {
  tipo_produto: string;
  plano: string;
  valor: number;
}

export interface DetalhamentoFrete {
  frete_lemon_caps: boolean;
  usa_tabela_tradicional: boolean;
  planos_customizados: PlanoFreteCustomizado[];
}

export interface Orcamento {
  // ... campos existentes ...
  consultor_responsavel?: string;
  dados_cliente?: DadosCliente;
  detalhamento_frete?: DetalhamentoFrete;
}
```

---

### 9. Sequencia de Implementacao

1. **Migration SQL** - Adicionar colunas ao banco
2. **Atualizar tipos** - `src/types/orcamento.ts`
3. **Atualizar hook** - `src/hooks/useOrcamentos.ts`
4. **Criar InformacoesClienteDialog** - Popup com consulta CNPJ
5. **Criar DetalhamentoFreteDialog** - Popup com tabelas de frete
6. **Atualizar GerarOrcamentoDialog** - Campo de consultor
7. **Atualizar Orcamentos.tsx** - Botoes, destaque verde, exibir consultor
8. **Atualizar orcamentoGenerator.ts** - Incluir novas secoes no PDF

---

### Resumo Visual das Mudancas

```text
ANTES:
+------------------+
| ORC-001          |  <- Numero do orcamento
| Cliente: ABC     |
| [Editar] [PDF]   |
+------------------+

DEPOIS:
+------------------+    VERDE SE APROVADO
| Maria Silva      |  <- Nome do consultor
| Cliente: ABC     |
| [Info] [Frete] [Editar] [PDF]  <- Novos botoes
+------------------+
```

