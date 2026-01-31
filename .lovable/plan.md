
## Plano: Sistema Completo de Geracao de Orcamentos

### Objetivo
Criar um sistema completo de geracao de orcamentos que permite:
1. Selecionar multiplas precificacoes salvas para um mesmo cliente
2. Adicionar produtos avulsos (sem precificacao salva)
3. Incluir servicos de Criacao de Marca Propria (planos customizaveis)
4. Salvar, editar e baixar orcamentos em PDF com identidade visual Lemon Caps

---

### Estrutura do Orcamento

```text
+--------------------------------------------------+
|              ORCAMENTO LEMON CAPS                |
+--------------------------------------------------+
|                                                  |
|  CLIENTE: [Nome do Cliente]                      |
|                                                  |
|  ================================================|
|  CUSTOS DE PRODUCAO                              |
|  ================================================|
|  1. Vitamina C 500mg (Encapsulados)  R$ 45,00    |
|  2. Omega 3 (Gummy)                  R$ 38,00    |
|  3. Produto Avulso XYZ               R$ 25,00    |
|  ------------------------------------------------|
|  Subtotal Producao:                  R$ 108,00   |
|                                                  |
|  ================================================|
|  SERVICO DE CRIACAO DE MARCA PROPRIA             |
|  ================================================|
|  • Plano Premium                     R$ 5.000,00 |
|  • Design de Rotulagem               R$ 1.500,00 |
|  ------------------------------------------------|
|  Subtotal Servicos:                  R$ 6.500,00 |
|                                                  |
|  ================================================|
|  TOTAL DO ORCAMENTO:                R$ 6.608,00  |
|  ================================================|
+--------------------------------------------------+
```

---

### Nova Tabela no Banco de Dados

Tabela: `orcamentos`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| nome_cliente | text | Nome do cliente do orcamento |
| numero_orcamento | text | Numero sequencial (ORC-001) |
| itens_producao | jsonb | Array de produtos (precificacoes + avulsos) |
| servicos_marca | jsonb | Array de planos/servicos de criacao de marca |
| subtotal_producao | numeric | Soma dos custos de producao |
| subtotal_servicos | numeric | Soma dos servicos de marca |
| valor_total | numeric | Total geral do orcamento |
| observacoes | text | Observacoes gerais |
| validade_dias | integer | Dias de validade (default 30) |
| status | text | rascunho, enviado, aprovado, recusado |
| created_at | timestamp | Data de criacao |
| updated_at | timestamp | Data de atualizacao |

Estrutura JSONB de `itens_producao`:
```json
[
  {
    "tipo": "precificacao",
    "precificacao_id": "uuid",
    "nome_produto": "Vitamina C 500mg",
    "segmento": "Encapsulados",
    "preco_unitario": 45.00,
    "quantidade": 100,
    "subtotal": 4500.00
  },
  {
    "tipo": "avulso",
    "nome_produto": "Produto XYZ",
    "segmento": "Gummy",
    "preco_unitario": 25.00,
    "quantidade": 50,
    "subtotal": 1250.00
  }
]
```

Estrutura JSONB de `servicos_marca`:
```json
[
  {
    "nome_plano": "Plano Premium",
    "descricao": "Desenvolvimento completo de marca",
    "valor": 5000.00
  }
]
```

---

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/Orcamentos.tsx` | Pagina principal de orcamentos gerados |
| `src/components/GerarOrcamentoDialog.tsx` | Dialog para criar/editar orcamento |
| `src/components/SelecionarPrecificacoesDialog.tsx` | Dialog para selecionar precificacoes |
| `src/components/AdicionarProdutoAvulsoDialog.tsx` | Dialog para adicionar produto manual |
| `src/components/AdicionarServicoMarcaDialog.tsx` | Dialog para adicionar servico de marca |
| `src/hooks/useOrcamentos.ts` | Hook para CRUD de orcamentos |
| `src/lib/orcamentoGenerator.ts` | Gerador de PDF do orcamento |
| `src/types/orcamento.ts` | Tipos TypeScript |

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/PrecificacoesSalvas.tsx` | Adicionar botao "Gerar Orcamento" |
| `src/components/Navigation.tsx` | Adicionar link para "Orcamentos Gerados" |
| `src/App.tsx` | Adicionar rota /orcamentos |

---

### Fluxo da Interface

#### 1. Botao "Gerar Orcamento" em Precificacoes Salvas

```text
+--------------------------------------------------+
|  [Pesquisar...]                                  |
|                   [+ Gerar Orcamento]  <-- NOVO  |
+--------------------------------------------------+
|  Card Precificacao 1...                          |
|  Card Precificacao 2...                          |
+--------------------------------------------------+
```

#### 2. Dialog de Geracao de Orcamento (Passo a Passo)

**Passo 1: Informacoes Basicas**
```text
+--------------------------------------------------+
|        GERAR ORCAMENTO - Passo 1 de 4            |
+--------------------------------------------------+
|                                                  |
|  Nome do Cliente: [_____________________]        |
|                                                  |
|  Validade (dias):  [30]                          |
|                                                  |
|  Observacoes:                                    |
|  [______________________________________]        |
|  [______________________________________]        |
|                                                  |
|              [Cancelar]  [Proximo ->]            |
+--------------------------------------------------+
```

**Passo 2: Selecionar Produtos de Producao**
```text
+--------------------------------------------------+
|        GERAR ORCAMENTO - Passo 2 de 4            |
+--------------------------------------------------+
|  CUSTOS DE PRODUCAO                              |
|                                                  |
|  [+ Adicionar Precificacao Salva]                |
|  [+ Adicionar Produto Avulso]                    |
|                                                  |
|  +--------------------------------------------+  |
|  | [X] Vitamina C 500mg    Encaps.   R$ 45,00 |  |
|  |     Qtd: [100]          Sub: R$ 4.500,00   |  |
|  +--------------------------------------------+  |
|  | [X] Omega 3 Gummy       Gummy     R$ 38,00 |  |
|  |     Qtd: [50]           Sub: R$ 1.900,00   |  |
|  +--------------------------------------------+  |
|  | [X] Produto Avulso      Custom    R$ 25,00 |  |
|  |     Qtd: [100]          Sub: R$ 2.500,00   |  |
|  +--------------------------------------------+  |
|                                                  |
|  SUBTOTAL PRODUCAO:              R$ 8.900,00     |
|                                                  |
|         [<- Voltar]  [Proximo ->]                |
+--------------------------------------------------+
```

**Passo 3: Servicos de Criacao de Marca (Opcional)**
```text
+--------------------------------------------------+
|        GERAR ORCAMENTO - Passo 3 de 4            |
+--------------------------------------------------+
|  SERVICO DE CRIACAO DE MARCA PROPRIA             |
|                                                  |
|  [+ Adicionar Plano/Servico]                     |
|                                                  |
|  +--------------------------------------------+  |
|  | Nome: [Plano Premium____________]           |  |
|  | Descricao: [Desenvolvimento de marca...]    |  |
|  | Valor: R$ [5.000,00]                        |  |
|  | [Remover]                                   |  |
|  +--------------------------------------------+  |
|  +--------------------------------------------+  |
|  | Nome: [Design de Rotulagem______]           |  |
|  | Valor: R$ [1.500,00]                        |  |
|  | [Remover]                                   |  |
|  +--------------------------------------------+  |
|                                                  |
|  SUBTOTAL SERVICOS:              R$ 6.500,00     |
|                                                  |
|         [<- Voltar]  [Proximo ->]                |
+--------------------------------------------------+
```

**Passo 4: Resumo e Confirmacao**
```text
+--------------------------------------------------+
|        GERAR ORCAMENTO - Passo 4 de 4            |
+--------------------------------------------------+
|  RESUMO DO ORCAMENTO                             |
|                                                  |
|  Cliente: Farmacia ABC                           |
|                                                  |
|  PRODUCAO:                                       |
|  • Vitamina C 500mg (100un)      R$ 4.500,00     |
|  • Omega 3 Gummy (50un)          R$ 1.900,00     |
|  • Produto Avulso (100un)        R$ 2.500,00     |
|  Subtotal:                       R$ 8.900,00     |
|                                                  |
|  SERVICOS DE MARCA:                              |
|  • Plano Premium                 R$ 5.000,00     |
|  • Design de Rotulagem           R$ 1.500,00     |
|  Subtotal:                       R$ 6.500,00     |
|                                                  |
|  +--------------------------------------------+  |
|  |    VALOR TOTAL DO ORCAMENTO               |  |
|  |              R$ 15.400,00                  |  |
|  +--------------------------------------------+  |
|                                                  |
|     [<- Voltar]  [Salvar Orcamento]              |
+--------------------------------------------------+
```

---

### Subpagina de Orcamentos Gerados

Nova rota: `/orcamentos`

```text
+--------------------------------------------------+
|  ORCAMENTOS GERADOS                              |
|  [Pesquisar por cliente...]                      |
+--------------------------------------------------+
|                                                  |
|  +--------------------------------------------+  |
|  | ORC-001 | Farmacia ABC     | 15/01/2025    |  |
|  | 3 produtos + 2 servicos                    |  |
|  | TOTAL: R$ 15.400,00                        |  |
|  | Status: [Rascunho]                         |  |
|  |                                            |  |
|  | [Editar] [Baixar PDF] [Excluir]            |  |
|  +--------------------------------------------+  |
|                                                  |
|  +--------------------------------------------+  |
|  | ORC-002 | Lab XYZ          | 14/01/2025    |  |
|  | 1 produto + 1 servico                      |  |
|  | TOTAL: R$ 8.500,00                         |  |
|  | Status: [Enviado]                          |  |
|  |                                            |  |
|  | [Editar] [Baixar PDF] [Excluir]            |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

---

### Design do PDF

Identidade Visual Lemon Caps:
- **Cores Principais**: 
  - Verde Escuro (fundo): #181A00, #2E3003
  - Amarelo Limao: #CAD400, #F2FF00
- **Logo**: Usar a logo com o limao (copiar para public/images/logo-lemoncaps.jpg)
- **Tipografia**: Sans-serif moderna (Helvetica no PDF)
- **Estilo**: Minimalista, limpo, profissional

Estrutura do PDF A4:

```text
+--------------------------------------------------+
|  ██████████████████████████████████████████████  |
|  ██  [LOGO LEMON CAPS]                       ██  |
|  ██  ORCAMENTO COMERCIAL                     ██  |
|  ██  Data: 31/01/2025      ORC-001           ██  |
|  ██████████████████████████████████████████████  |
|                                                  |
|  CLIENTE: Farmacia ABC                           |
|                                                  |
|  ================================================|
|  CUSTOS DE PRODUCAO                              |
|  ================================================|
|  +-------+-------------------+-----+------------+|
|  | Item  | Produto           | Qtd | Valor      ||
|  +-------+-------------------+-----+------------+|
|  | 1     | Vitamina C 500mg  | 100 | R$ 4.500,00||
|  | 2     | Omega 3 Gummy     | 50  | R$ 1.900,00||
|  +-------+-------------------+-----+------------+|
|  | SUBTOTAL PRODUCAO              | R$ 6.400,00 ||
|  +---------------------------------------------|+|
|                                                  |
|  ================================================|
|  SERVICO DE CRIACAO DE MARCA PROPRIA             |
|  ================================================|
|  +-----------------------------------+----------+|
|  | Plano Premium                     | R$ 5.000 ||
|  | Design de Rotulagem               | R$ 1.500 ||
|  +-----------------------------------+----------+|
|  | SUBTOTAL SERVICOS                 | R$ 6.500 ||
|  +----------------------------------------------+|
|                                                  |
|  ██████████████████████████████████████████████  |
|  ██  VALOR TOTAL DO ORCAMENTO:   R$ 12.900,00 ██ |
|  ██████████████████████████████████████████████  |
|                                                  |
|  Validade: 30 dias a partir da emissao           |
|  ________________________________________________|
|  LEMON CAPS - www.lemoncaps.com.br               |
+--------------------------------------------------+
```

---

### Detalhes Tecnicos

#### Hook useOrcamentos.ts
```typescript
export function useOrcamentos() {
  // listar todos os orcamentos
  // buscar orcamento por ID
  // criar orcamento
  // atualizar orcamento
  // deletar orcamento
  // atualizar status
}
```

#### Tipos TypeScript (orcamento.ts)
```typescript
interface ItemProducao {
  tipo: 'precificacao' | 'avulso';
  precificacao_id?: string;
  nome_produto: string;
  segmento: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
}

interface ServicoMarca {
  nome_plano: string;
  descricao?: string;
  valor: number;
}

interface Orcamento {
  id: string;
  numero_orcamento: string;
  nome_cliente: string;
  itens_producao: ItemProducao[];
  servicos_marca: ServicoMarca[];
  subtotal_producao: number;
  subtotal_servicos: number;
  valor_total: number;
  observacoes?: string;
  validade_dias: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  created_at: string;
  updated_at: string;
}
```

---

### Sequencia de Implementacao

1. **Criar tabela no banco** - Migration SQL
2. **Copiar logos para public/** - Usar lov-copy
3. **Criar tipos TypeScript** - src/types/orcamento.ts
4. **Criar hook de orcamentos** - src/hooks/useOrcamentos.ts
5. **Criar pagina de orcamentos** - src/pages/Orcamentos.tsx
6. **Criar dialog de geracao** - src/components/GerarOrcamentoDialog.tsx
7. **Criar gerador de PDF** - src/lib/orcamentoGenerator.ts
8. **Atualizar navegacao** - Navigation.tsx + App.tsx
9. **Adicionar botao em PrecificacoesSalvas** - Integrar fluxo

---

### RLS Policies

A tabela `orcamentos` tera politicas permissivas (mesmo padrao do projeto):
- SELECT: true
- INSERT: true
- UPDATE: true
- DELETE: true

---

### Resumo

Este sistema permite ao vendedor:
1. Clicar em "Gerar Orcamento" na aba de Precificacoes Salvas
2. Preencher nome do cliente
3. Selecionar uma ou mais precificacoes existentes (com quantidade)
4. Adicionar produtos avulsos manualmente
5. Adicionar servicos de Criacao de Marca Propria (planos customizaveis)
6. Ver o valor total (Producao + Servicos)
7. Salvar o orcamento no banco
8. Ver lista de orcamentos em "/orcamentos"
9. Editar orcamentos existentes
10. Baixar PDF profissional com identidade Lemon Caps
