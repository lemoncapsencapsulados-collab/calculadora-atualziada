## Objetivo

Fazer com que o popup "Demandas de Marca" já traga os produtos fechados do pedido, com todos os detalhes (nome, tipo, segmento, dose diária, doses por pote, quantidade por dose, cor do pote/tampa, quantidade de potes), e que Rótulo, Criativos, Banner e Monetizze usem esses produtos já preenchidos.

## O que muda

### 1. Extração completa dos produtos do pedido
Hoje só são lidos 3 campos do snapshot do orçamento (nome, tipo, quantidade). O snapshot já guarda muito mais: segmento, `quantidade_doses`, `quantidade_por_pote`, `quantidade_por_dose`, `unidade_por_dose`, `dose_diaria_sugerida`, `detalhes_producao` (cor do pote e da tampa), preço unitário e insumos da fórmula.

Passa a ser lido tudo isso e disponibilizado para todos os formulários.

### 2. Novo painel "Produtos do pedido" no popup
Logo abaixo do cabeçalho (Cliente / Vendedor), um bloco recolhível listando cada produto fechado com:
- Nome do produto e badge do tipo (Encapsulado, Gummy, Solúvel, Líquido)
- Segmento
- Quantidade de potes/unidades contratada
- Dose diária sugerida, unidades por dose e por pote, doses por pote
- Cor do pote e da tampa
- Botão "Ver detalhes" abrindo a ficha completa do produto (incluindo composição, com a regra de ofuscação de ingredientes confidenciais aplicada)

### 3. Pré-preenchimento dos formulários
- **Rótulo:** produtos já criados com nome, tipo e quantidade de potes vindos do pedido; **segmento também pré-preenchido** a partir do snapshot (hoje vem vazio). Cada card de produto mostra um resumo somente-leitura (dose diária, unidades por pote, cores) para o designer. Campos continuam editáveis e é possível adicionar/remover produtos.
- **Criativos:** cada produto listado já com tipo, segmento e dose diária visíveis junto ao nome.
- **Banner:** mesmos produtos do pedido pré-carregados com resumo.
- **Monetizze:** checklist já gerado por produto (como hoje), agora com o resumo do produto exibido para conferência na criação do plano/checkout.

### 4. Briefing em PDF
Os PDFs (individual, "Baixar todas" e o consolidado do painel de acompanhamento) passam a incluir a ficha dos produtos do pedido (nome, tipo, segmento, dose diária, unidades por pote, cores, quantidade), para o designer/T.I ter tudo sem abrir o sistema.

## Detalhes técnicos

- `src/components/pedidos/DemandasMarcaDialog.tsx`: ampliar o `useMemo` de `produtosPedido` para mapear todos os campos do snapshot; novo tipo `ProdutoPedido` estendido.
- Mover o tipo `ProdutoPedido` de `FormRotulo.tsx` para `src/types/demandaMarca.ts` (campos novos opcionais, mantendo compatibilidade com demandas já salvas).
- Novo componente `src/components/pedidos/demandas/ProdutosPedidoResumo.tsx` (painel + card de resumo reutilizado nos formulários).
- Ajustes de pré-preenchimento em `FormRotulo.tsx`, `FormCriativos.tsx`, `FormBanner.tsx`, `FormMonetizze.tsx`.
- `src/lib/demandasMarcaPdf.ts`: nova seção "Produtos do pedido"; os dados dos produtos são gravados no `dados` da demanda no momento do salvamento, garantindo que o PDF de demandas antigas continue funcionando.
- Sem alteração de banco de dados.
