
## Plano: Adicionar Campo de Forma de Pagamento no Step 1

### Objetivo
Adicionar um campo descritivo de "Forma de Pagamento" no Step 1 do dialog de criação de orçamento, entre "Validade (dias)" e "Observações", com exemplo de descrição para orientar o consultor.

---

### Alterações no Tipo Orcamento

Adicionar campo `forma_pagamento` nas interfaces:

```typescript
// Em src/types/orcamento.ts
export interface Orcamento {
  // campos existentes...
  forma_pagamento?: string;
}

export interface OrcamentoInsert {
  // campos existentes...
  forma_pagamento?: string;
}

export interface OrcamentoUpdate {
  // campos existentes...
  forma_pagamento?: string;
}
```

---

### Migração do Banco de Dados

Adicionar coluna `forma_pagamento` na tabela `orcamentos`:

```sql
ALTER TABLE orcamentos 
ADD COLUMN forma_pagamento TEXT;
```

---

### Modificar GerarOrcamentoDialog.tsx

Adicionar no Step 1 o novo campo entre "Validade" e "Observações":

```text
STEP 1 - INFORMAÇÕES BÁSICAS (ATUALIZADO)
+--------------------------------------------------+
|  Consultor Responsável *                         |
|  [_______________________]                       |
|                                                  |
|  Nome do Cliente *                               |
|  [_______________________]                       |
|                                                  |
|  Validade (dias)                                 |
|  [30]                                            |
|                                                  |
|  Forma de Pagamento                              |
|  +----------------------------------------------+|
|  | [Textarea com placeholder de exemplo]        ||
|  | Ex: "50% do valor total na entrada pago      ||
|  | via Pix e 50% pago no final da produção      ||
|  | pago via cartão de crédito em 3x sem juros"  ||
|  +----------------------------------------------+|
|                                                  |
|  Observações                                     |
|  [_______________________]                       |
+--------------------------------------------------+
```

---

### Atualizar PDF Generator

Adicionar seção de "Forma de Pagamento" no PDF (antes de Observações):

```typescript
// Em src/lib/orcamentoGenerator.ts
if (orcamento.forma_pagamento) {
  doc.setTextColor(...COLORS.textDark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO:', margin, yPos);
  yPos += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const pagLines = doc.splitTextToSize(orcamento.forma_pagamento, pageWidth - 2 * margin);
  doc.text(pagLines, margin, yPos);
  yPos += pagLines.length * 4 + 10;
}
```

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/types/orcamento.ts` | Adicionar `forma_pagamento?: string` nas interfaces Orcamento, OrcamentoInsert e OrcamentoUpdate |
| `src/components/GerarOrcamentoDialog.tsx` | Adicionar estado e campo textarea no Step 1, incluir no handleSubmit |
| `src/lib/orcamentoGenerator.ts` | Adicionar seção de Forma de Pagamento no PDF |
| **Migração SQL** | Adicionar coluna `forma_pagamento` na tabela `orcamentos` |

---

### Detalhes Técnicos

#### GerarOrcamentoDialog.tsx

```typescript
// Novo estado
const [formaPagamento, setFormaPagamento] = useState('');

// Carregar ao editar
useEffect(() => {
  if (orcamentoExistente) {
    // ... estados existentes ...
    setFormaPagamento(orcamentoExistente.forma_pagamento || '');
  }
}, [orcamentoExistente]);

// No Step 1, entre Validade e Observações:
<div className="space-y-2">
  <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
  <Textarea
    id="formaPagamento"
    value={formaPagamento}
    onChange={(e) => setFormaPagamento(e.target.value)}
    placeholder='Ex: "50% do valor total na entrada pago via Pix e 50% pago no final da produção pago via cartão de crédito em 3x sem juros"'
    rows={3}
  />
</div>

// No handleSubmit, incluir:
forma_pagamento: formaPagamento || undefined,
```

---

### Sequência de Implementação

1. **Migração SQL** - Adicionar coluna `forma_pagamento`
2. **Atualizar tipos** - `src/types/orcamento.ts`
3. **Atualizar GerarOrcamentoDialog** - Adicionar campo no Step 1
4. **Atualizar PDF Generator** - Incluir forma de pagamento no PDF
