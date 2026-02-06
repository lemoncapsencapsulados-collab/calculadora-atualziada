

## Plano: Detalhamento de Pagamento no Fluxo de Orcamento

### Objetivo

Adicionar campos estruturados de pagamento no fluxo de "Gerar Orcamento" a partir de "Precificacoes Salvas", permitindo:
- Preenchimento opcional durante a criacao do orcamento
- Preenchimento obrigatorio quando gerar "Proposta Completa"
- Exibicao formatada nos PDFs gerados

---

### Novos Campos de Pagamento

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `valor_entrada` | number | Valor pago de entrada |
| `forma_pagamento_entrada` | string | Como sera pago (PIX, Cartao, Boleto, etc) |
| `valor_termino` | number | Valor pago no termino dos produtos |
| `forma_pagamento_termino` | string | Como sera pago no termino |

---

### Estrutura de Dados

Criar nova interface `CondicoesPagamento` no tipo `orcamento.ts`:

```typescript
export interface CondicoesPagamento {
  valor_entrada?: number;
  forma_pagamento_entrada?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'outro';
  descricao_entrada?: string;  // Detalhes adicionais (ex: "em 3x")
  
  valor_termino?: number;
  forma_pagamento_termino?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'outro';
  descricao_termino?: string;  // Detalhes adicionais
}
```

---

### Interface de Usuario (UX)

#### Step 1 do GerarOrcamentoDialog - Apos "Forma de Pagamento"

Adicionar uma secao colapsavel "Detalhamento de Pagamento" com layout amigavel:

```text
┌─────────────────────────────────────────────────────────────┐
│  DETALHAMENTO DE PAGAMENTO (opcional)                       │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─ ENTRADA ─────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  Qual e o valor da entrada?                           │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ R$  [________________]                         │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                       │  │
│  │  Como sera pago?                                      │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │  │
│  │  │   PIX   │ │ Cartao  │ │ Boleto  │ │ Transf. │      │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │  │
│  │                                                       │  │
│  │  Detalhes adicionais (opcional):                      │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ Ex: "em 3x sem juros"                          │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ PAGAMENTO NO TERMINO ────────────────────────────────┐  │
│  │                                                       │  │
│  │  Qual e o valor no termino da producao?               │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ R$  [________________]  ou  [ ] Restante       │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │                                                       │  │
│  │  Como sera pago?                                      │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │  │
│  │  │   PIX   │ │ Cartao  │ │ Boleto  │ │ Transf. │      │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │  │
│  │                                                       │  │
│  │  Detalhes adicionais (opcional):                      │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ Ex: "apos aprovacao da arte"                   │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Validacao na Proposta Completa

No `PropostaCompletaDialog.tsx`, adicionar validacao:

1. Se os campos de pagamento NAO estiverem preenchidos, mostrar secao para preenchimento obrigatorio
2. Destacar visualmente que esses campos sao necessarios para gerar a proposta
3. Bloquear geracao ate que os campos estejam completos

---

### Exibicao no PDF

#### Formato no PDF (orcamentoGenerator.ts e propostaGenerator.ts):

```text
─────────────────────────────────────────────────
CONDICOES DE PAGAMENTO
─────────────────────────────────────────────────

ENTRADA
  Valor: R$ 5.000,00
  Forma: PIX
  Detalhes: Pagamento imediato apos aprovacao

NO TERMINO DA PRODUCAO
  Valor: R$ 7.345,67 (restante)
  Forma: Cartao de Credito
  Detalhes: Em 3x sem juros apos entrega
```

---

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/types/orcamento.ts` | Adicionar interface `CondicoesPagamento` e campo no `Orcamento` |
| `src/components/GerarOrcamentoDialog.tsx` | Adicionar secao de detalhamento de pagamento no Step 1 |
| `src/components/PropostaCompletaDialog.tsx` | Adicionar validacao e campos de pagamento obrigatorios |
| `src/lib/orcamentoGenerator.ts` | Adicionar renderizacao das condicoes de pagamento no PDF |
| `src/lib/propostaGenerator.ts` | Sincronizar exibicao do pagamento |
| Migracao no banco de dados | Adicionar campo `condicoes_pagamento JSONB` na tabela `orcamentos` |

---

### Detalhes Tecnicos

#### 1. Nova Interface (orcamento.ts)

```typescript
export interface CondicoesPagamento {
  valor_entrada?: number;
  forma_pagamento_entrada?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'outro';
  descricao_entrada?: string;
  
  valor_termino?: number;
  usa_valor_restante?: boolean;  // Se true, calcula automaticamente
  forma_pagamento_termino?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'outro';
  descricao_termino?: string;
}

export interface Orcamento {
  // ... campos existentes
  condicoes_pagamento?: CondicoesPagamento;
}
```

#### 2. Componente de Selecao de Forma de Pagamento

```typescript
const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cartao_credito', label: 'Cartao de Credito', icon: CreditCard },
  { value: 'cartao_debito', label: 'Cartao de Debito', icon: CreditCard },
  { value: 'boleto', label: 'Boleto', icon: FileText },
  { value: 'transferencia', label: 'Transferencia', icon: Building },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal },
];
```

#### 3. Logica de Validacao

```typescript
function validarCondicoesPagamento(condicoes?: CondicoesPagamento, valorTotal?: number): string[] {
  const erros: string[] = [];
  
  if (!condicoes?.valor_entrada && condicoes?.valor_entrada !== 0) {
    erros.push('Informe o valor da entrada');
  }
  if (!condicoes?.forma_pagamento_entrada) {
    erros.push('Selecione a forma de pagamento da entrada');
  }
  if (!condicoes?.valor_termino && !condicoes?.usa_valor_restante) {
    erros.push('Informe o valor no termino ou marque "Restante"');
  }
  if (!condicoes?.forma_pagamento_termino) {
    erros.push('Selecione a forma de pagamento no termino');
  }
  
  return erros;
}
```

#### 4. Renderizacao no PDF

```typescript
function renderCondicoesPagamento(doc: jsPDF, orcamento: Orcamento, yPos: number): number {
  const condicoes = orcamento.condicoes_pagamento;
  if (!condicoes) return yPos;
  
  yPos = checkPageBreak(doc, yPos, 60);
  
  // Titulo da secao
  renderSectionTitle(doc, 'CONDICOES DE PAGAMENTO', yPos);
  yPos += 12;
  
  // Entrada
  if (condicoes.valor_entrada !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.text('ENTRADA', LAYOUT.margin, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Valor: ${formatCurrency(condicoes.valor_entrada)}`, LAYOUT.margin + 5, yPos);
    yPos += 5;
    
    doc.text(`Forma: ${getFormaPagamentoLabel(condicoes.forma_pagamento_entrada)}`, LAYOUT.margin + 5, yPos);
    yPos += 5;
    
    if (condicoes.descricao_entrada) {
      doc.text(`Detalhes: ${condicoes.descricao_entrada}`, LAYOUT.margin + 5, yPos);
      yPos += 5;
    }
  }
  
  // Termino
  yPos += 4;
  // ... similar para termino
  
  return yPos + LAYOUT.sectionGap;
}
```

---

### Fluxo de Uso

```text
Precificacoes Salvas
        │
        ▼
   [Gerar Orcamento]
        │
        ▼
┌───────────────────────────────────────┐
│ Step 1: Informacoes Basicas           │
│ ─────────────────────────────────────│
│ • Consultor                           │
│ • Cliente                             │
│ • Validade                            │
│ • Forma de Pagamento (texto livre)    │
│                                       │
│ ▼ DETALHAMENTO DE PAGAMENTO           │
│   (Colapsavel - OPCIONAL)             │
│   • Valor/Forma da Entrada            │
│   • Valor/Forma no Termino            │
└───────────────────────────────────────┘
        │
        ▼
    (Steps 2, 3, 4)
        │
        ▼
  [Salvar Orcamento]
        │
        ▼
┌───────────────────────────────────────┐
│ Na tela de Orcamentos:                │
│                                       │
│ [Gerar Orcamento] → PDF simples       │
│                                       │
│ [Proposta Completa] → Exige dados     │
│   • Se pagamento NAO preenchido:      │
│     → Mostra formulario obrigatorio   │
│   • Se pagamento JA preenchido:       │
│     → Usa dados existentes            │
└───────────────────────────────────────┘
```

---

### Migracao do Banco de Dados

```sql
ALTER TABLE orcamentos
ADD COLUMN IF NOT EXISTS condicoes_pagamento JSONB DEFAULT NULL;

COMMENT ON COLUMN orcamentos.condicoes_pagamento IS 'Detalhamento das condicoes de pagamento: entrada e termino';
```

---

### Resultado Esperado

1. **UX Amigavel**: Campos organizados de forma logica e intuitiva
2. **Flexibilidade**: Preenchimento opcional no orcamento, obrigatorio na proposta
3. **Clareza nos PDFs**: Condicoes de pagamento bem formatadas e legais
4. **Compatibilidade**: Campo `forma_pagamento` existente continua funcionando como texto livre

