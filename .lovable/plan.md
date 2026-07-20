## Objetivo

Trocar a "Taxa de Manuseio" por tipo de produto por uma **taxa de manuseio própria de cada plano**. A taxa por tipo deixa de existir.

---

## 1. Banco de dados

- `frete_pod_precos`: adicionar coluna `taxa_manuseio numeric(15,6) NOT NULL DEFAULT 0`.
- `frete_pod_precos_historico`: adicionar `taxa_manuseio_anterior` e `taxa_manuseio_nova` para rastrear alterações (opcional mas coerente com o histórico atual de preço).
- `frete_logistica_config`: **remover** (drop table) — não é mais usada.
- Backfill: para cada plano existente, copiar a taxa atual do respectivo tipo (se houver em `frete_logistica_config`) antes do drop.

## 2. Painel Administrador → aba "Logística"

`LogisticaConfigCard.tsx`:
- Remover o bloco `TaxaManuseioEditor` (taxa por tipo).
- Na tabela de planos, transformar a coluna "+ Manuseio" numa coluna **"Taxa Manuseio"** editável e mostrar também "Total por envio" (frete médio + taxa).
- `PlanoDialog`: adicionar campo obrigatório "Taxa de manuseio (R$)" ao lado de "Frete médio".

Hooks:
- `useFretePodPrecos`: `upsertPodPreco` passa a persistir `taxa_manuseio`.
- Excluir `useFreteLogisticaConfig.ts` (e usos).

Tipos:
- `FretePodPreco`: adicionar `taxa_manuseio: number`.
- Remover `FreteLogisticaConfig` de `src/types/frete.ts`.

## 3. Nova Cotação de Frete (POD) — `src/pages/Logistica.tsx`

- Remover leitura de `useTaxaManuseioMap`.
- A tabela de planos por produto passa a usar `plano.taxa_manuseio` diretamente. Preço salvo em `pod_preco_por_envio` continua sendo `preco + taxa_manuseio` (agora do próprio plano).
- Export PNG (`freteImageExport.ts`): passar a exibir a taxa vinda do plano; sem mudança na assinatura além de remover o parâmetro `taxaByTipo`.

## 4. Compatibilidade

- Cotações já salvas seguem válidas (só usam `pod_preco_por_envio`).
- Planos existentes ficam com `taxa_manuseio` migrada do tipo antigo (ou 0 se não havia).

## Fora de escopo

- Alterações em PDF, contrato ou modo "Estoque Próprio".