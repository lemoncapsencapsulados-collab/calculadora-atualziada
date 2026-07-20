## Objetivo

Reformular a lógica de preços POD para exibir **todos os planos de cada produto** já precificados dentro de "Nova Cotação de Frete", com uma nova seção de **Logística** no Painel Administrador para configurar Taxa de Manuseio + Preços por Plano por Tipo de Produto, e permitir **exportar imagem (PNG)** com o resumo por produtor.

---

## 1. Painel Administrador → Nova aba "Logística"

Substitui a aba atual "Preços POD" por uma seção mais completa organizada por **Tipo de Produto** (Encapsulado, Líquido, Solúvel, Gummy):

Para cada tipo:
- **Taxa de Manuseio** (R$) — valor único por tipo
- **Planos cadastrados** (lista editável): cada plano tem `nº de frascos` + `preço do frete médio`
- Botões: "Adicionar plano", "Editar", "Remover", "Editar Taxa de Manuseio"

O usuário pode criar planos novos (ex: 15 frascos, 25 frascos) que passam a aparecer automaticamente em "Nova Cotação".

### Alterações de banco
- Nova tabela `frete_logistica_config` (tipo_produto único, taxa_manuseio numeric)
- Manter tabela `frete_pod_precos` já existente para os planos (adicionar mais planos livres — remover restrição do array fixo `FRETE_POD_PLANOS` no frontend, aceitar qualquer número inteiro)
- Manter `frete_pod_precos_historico`

---

## 2. "Nova Cotação de Frete" — modo POD

Ao selecionar orçamento, para **cada produto**:
- Detecta o tipo automaticamente (como já faz hoje)
- Em vez de um `<Select>` de plano único, renderiza uma **tabela com TODOS os planos cadastrados** para aquele tipo:

```text
Produto: Whey Protein (Encapsulado)     Taxa Manuseio: R$ 2,50
┌────────┬──────────────┬────────────────┬──────────┐
│ Plano  │ Frete Médio  │ + Manuseio     │ Escolher │
├────────┼──────────────┼────────────────┼──────────┤
│  1     │ R$ 12,00     │ R$ 14,50       │ ( )      │
│  3     │ R$ 18,00     │ R$ 20,50       │ (•)      │
│  5     │ R$ 24,00     │ R$ 26,50       │ ( )      │
│ 10     │ R$ 35,00     │ R$ 37,50       │ ( )      │
└────────┴──────────────┴────────────────┴──────────┘
```

- Coluna "Escolher" (radio) marca qual plano será salvo como cotação ativa daquele produto
- Preço final salvo = frete médio + taxa de manuseio (armazenado em `pod_preco_por_envio`)
- Campo "envios estimados" continua editável por linha

### Botão "Baixar imagem (PNG)" dentro do popup
Gera uma imagem com:
- Cabeçalho: Nome do produtor (nome_produtor do orçamento) + nº orçamento + data
- Para cada produto: nome, tipo, tabela completa de planos com preço por envio (frete + manuseio)
- Usa `html2canvas` (já provável no projeto; senão instalar) sobre um `<div ref>` oculto/estilizado

---

## 3. Detalhes técnicos

### Arquivos a alterar/criar
- **Migration**: criar `frete_logistica_config` + GRANTs + RLS + trigger updated_at
- **`src/types/frete.ts`**: adicionar `FreteLogisticaConfig`, remover const rígida `FRETE_POD_PLANOS` (ou marcar como sugestões)
- **`src/hooks/useFreteLogisticaConfig.ts`** (novo): CRUD de taxa de manuseio
- **`src/hooks/useFretePodPrecos.ts`**: aceitar planos livres
- **`src/components/admin/LogisticaConfigCard.tsx`** (novo): substitui `FretePodPrecosCard` na aba admin — mostra por tipo com taxa manuseio + planos
- **`src/pages/PainelAdministrador.tsx`**: renomear aba "Preços POD" → "Logística"
- **`src/pages/Logistica.tsx`**: refatorar diálogo POD para renderizar tabela de todos os planos + radio de seleção + botão "Baixar imagem"
- **`src/lib/freteImageExport.ts`** (novo): gera PNG via html2canvas
- **`package.json`**: adicionar `html2canvas` se ausente

### Compatibilidade
- Cotações POD já salvas continuam válidas (mesmos campos `pod_plano`, `pod_preco_por_envio`)
- Preço salvo agora sempre inclui manuseio embutido — sem migração de dados antigos

---

## Fora de escopo
- Alterar cálculo de PDF/contrato (mantém `pod_preco_por_envio` como está)
- Alterar modo "Estoque Próprio"
