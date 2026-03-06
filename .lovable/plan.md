

# Auto-preenchimento de características do produto no GerarOrcamentoDialog

## Contexto
O campo `quantidade_por_dose` no `ItemProducao` deve vir diretamente do campo `unidades_por_dose` da fórmula (armazenado no banco como `unidades_por_dose`). A nomenclatura no orçamento será padronizada como `quantidade_por_dose`.

## Implementação

### Arquivo: `src/components/GerarOrcamentoDialog.tsx`

**1. Expandir query da fórmula** (linha 130)
Na `handleAddPrecificacoes`, buscar campos adicionais:
```sql
SELECT itens, tipo_produto, quantidade_por_pote, unidades_por_dose, unidade_soluvel
```

**2. Preencher campos automaticamente** (linhas 143-152)
Ao construir o `ItemProducao`, derivar:
- `tipo_produto` ← `formula.tipo_produto`
- `quantidade_por_pote` ← `formula.quantidade_por_pote`
- `unidade_por_pote` ← derivado do tipo (Encapsulados→"capsulas", Gummy→"gummies", Líquido→"ml", Solúvel→`formula.unidade_soluvel || "g"`)
- `quantidade_por_dose` ← `formula.unidades_por_dose`
- `unidade_por_dose` ← mesmo que `unidade_por_pote`
- `quantidade_doses` ← `Math.floor(quantidade_por_pote / unidades_por_dose)`
- `dose_diaria_sugerida` ← texto gerado para compatibilidade (ex: "2 cápsulas/dia")

**3. Campos read-only para itens de precificação** (linhas 654-693)
- Se `item.tipo === 'precificacao'`: inputs com `readOnly`, `disabled`, estilo `bg-muted`
- Se `item.tipo === 'avulso'`: mantém editável

### Arquivo modificado
- `src/components/GerarOrcamentoDialog.tsx`

