
## Plano: Detalhamento completo do Setup (Passo 3)

### O que muda
Expandir o card de resumo no Passo 3 de `GerarOrcamentoDialog.tsx` para exibir duas seções: detalhamento do custo por item e composição do preço de venda. Remover a fórmula explicativa.

### Layout

```text
┌─────────────────────────────────────────────────┐
│ Detalhamento do Custo                           │
│   Código de barras (3x)              R$ 17,10   │
│   Design de rótulos (3x)           R$ 600,00    │
│   Impressão - Gummy (2x)         R$ 2.680,00    │
│ ─────────────────────────────────────────────── │
│   Custo Total do Setup             R$ 5.350,00  │
│                                                 │
│ Margem de Lucro (%)  [  25  ] %                 │
│ ✅ Excelente! Margem ideal atingida!            │
│                                                 │
│ Composição do Preço de Venda                    │
│   Custo Base                       R$ 5.350,00  │
│   Taxa de Antecipação (6%)           R$ 544,07  │
│   Imposto (5%)                       R$ 453,39  │
│   Comissão (5%)                      R$ 453,39  │
│   Margem de Lucro (25%)           R$ 2.266,95   │
│ ─────────────────────────────────────────────── │
│   Preço de Venda do Setup          R$ 9.067,80  │
└─────────────────────────────────────────────────┘
```

### Implementacao

**Arquivo:** `src/components/GerarOrcamentoDialog.tsx`

1. Calcular variáveis de composição a partir do `precoVendaSetup` existente:
   - `taxaAntecipacao = precoVendaSetup * 0.06`
   - `impostoSetup = precoVendaSetup * 0.05`
   - `comissaoSetup = precoVendaSetup * 0.05`
   - `margemLucroValor = precoVendaSetup * (margemSetup / 100)`

2. Seção "Detalhamento do Custo": listar cada item ativo (`setupItems` + `setupImpressaoItens`) com nome, quantidade e subtotal. Separador antes do total.

3. Manter input de margem e validação (cor/mensagem) como está.

4. Seção "Composição do Preço de Venda": tabela com 5 linhas (Custo Base, Antecipação 6%, Imposto 5%, Comissão 5%, Margem X%) + linha de total em destaque.

5. Remover a linha da fórmula explicativa que existia anteriormente.
