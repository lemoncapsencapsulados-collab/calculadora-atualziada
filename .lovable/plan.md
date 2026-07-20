## Objetivo

Adicionar margem de lucro por faixa de volume mensal na precificação POD, com override protegido por senha `0212` por orçamento, e aplicar 12% de imposto sobre o subtotal.

---

## 1. Fórmula de preço POD

Base por envio, calculada por plano/produto:

```
base       = taxa_manuseio + frete_medio
margem_val = base * (margem_% / 100)
subtotal   = base + margem_val
preco_final = subtotal * 1.12         ← 12% de imposto sobre o subtotal
```

`preco_final` substitui o valor hoje salvo em `frete_cotacoes.pod_preco_por_envio` e o que aparece na tabela de planos da "Nova Cotação" e no PNG exportado.

## 2. Faixas padrão de margem (por envios/mês)

| Envios/mês | Margem |
|---|---|
| 0–50 | 15% |
| 51–100 | 13% |
| 101–200 | 11% |
| 201–1.000 | 9% |
| > 1.000 | 8% |

A faixa é escolhida a partir de `pod_quantidade_envios_estimada` do orçamento. Sem estimativa preenchida → assume faixa 0–50 (15%) e exibe aviso "estimativa ausente".

## 3. Configuração das faixas (Painel Administrador → Logística)

Nova tabela `frete_margem_faixas` com colunas: `envios_min`, `envios_max` (nullable = infinito), `margem_percentual`, `ativo`. Seed com as 5 faixas acima.

Bloco novo em `LogisticaConfigCard.tsx` acima da tabela de planos: lista editável das faixas (min, max, %). Mesmo padrão de UX dos demais cards. Sem senha para editar aqui (é área admin já protegida).

## 4. Override por orçamento (com senha)

Em `frete_cotacoes`, adicionar:
- `margem_percentual numeric(6,3) NULL` — margem efetivamente aplicada
- `margem_override boolean NOT NULL DEFAULT false` — indica edição manual
- `imposto_percentual numeric(6,3) NOT NULL DEFAULT 12`

Em `src/pages/Logistica.tsx` (dialog Nova Cotação, por produto):
- Mostrar a margem calculada da faixa (ex.: "Margem: 13% — faixa 51–100 envios/mês") acima da tabela de planos.
- Botão "Editar margem" abre um `AdminPasswordDialog` (senha `0212`). Após liberar, campo numérico permite alterar a margem só daquele produto/orçamento, marcando `margem_override = true`.
- A tabela de planos recalcula em tempo real usando a fórmula da seção 1.

Ao salvar a cotação POD, persistir `margem_percentual`, `margem_override` e `imposto_percentual` (12) junto com `pod_preco_por_envio` já com o preço final.

## 5. Exibição

- Tabela de planos na cotação: colunas **Frete médio**, **Taxa manuseio**, **Margem (R$)**, **Imposto 12% (R$)**, **Preço final/envio**.
- PNG exportado (`freteImageExport.ts`): incluir a linha de margem aplicada e imposto no rodapé de cada produto.
- PDF do orçamento / linha de frete em `freteHelpers.ts`: mantém apenas o `preco_final` (usuário final não vê breakdown), sem mudanças de layout.

## 6. Fora de escopo

- Recalcular cotações antigas: seguem com o valor salvo.
- Alterar precificação de produto/fórmula (calculadora principal) — mudança é somente no fluxo de frete POD.

## Detalhes técnicos

- Migrações: `frete_margem_faixas` (com GRANTs + RLS `authenticated`), colunas novas em `frete_cotacoes`, seed das 5 faixas.
- Novo hook `useFreteMargemFaixas` (CRUD) e helper `resolverMargemPorEnvios(envios, faixas)`.
- Helper puro `calcularPrecoPod({ frete, manuseio, margemPct, impostoPct })` reutilizado no dialog e no PNG export.
- Reaproveitar `AdminPasswordDialog` existente (senha `0212`) para o gate de edição da margem.
