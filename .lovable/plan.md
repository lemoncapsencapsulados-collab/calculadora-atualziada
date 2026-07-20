## Objetivo

Reorganizar a página **Logística** para agrupar cotações POD por **Produtor** (não por produto), com drill-down para ver produtos individualmente, exigir senha `0212` para editar planos, ajustar rótulos e adicionar exportação de imagem também na listagem.

## Mudanças em `src/pages/Logistica.tsx`

### 1. Agrupamento por Produtor (aba POD)
- Substituir a tabela atual (uma linha por cotação/produto) por uma tabela agrupada por produtor (derivado de `orcamento.nome_cliente`).
- Colunas do agrupamento: Produtor · Nº Orçamentos · Nº Produtos · Faixa de preço/envio (menor–maior) · Data mais recente · Ações (Ver produtos / Baixar imagem).
- Botão **"Ver orçamentos por produto"** por linha abre um `Dialog` listando cada produto individualmente (uma linha por cotação), com os botões Editar / Excluir / Baixar PNG por produto.

### 2. Senha `0212` obrigatória para editar
- Ao clicar em **Editar** (tanto na lista agrupada quanto no dialog de produtos), abrir `AdminPasswordDialog` (já existente, senha `0212`). Somente após confirmar, abre o `FreteCotacaoDialog` de edição.
- Aplica-se a POD e Estoque Próprio.

### 3. Ajustes de rótulos e colunas (aba POD)
- Remover coluna **"Total Estimado"** da tabela detalhada (drill-down).
- Renomear **"Qtd Envios"** → **"Quant. Envios Mensais médio"**.
- Adicionar botão **"Baixar imagem"** (ícone `ImageDown`) em cada linha de produto no drill-down, gerando o PNG de custo de frete via `exportElementAsPng` (mesmo template já usado no dialog de criação, renderizado off-screen para essa cotação específica).

### 4. Edição com todos os planos visíveis
- No `FreteCotacaoDialog` em modo edição de uma cotação POD, renderizar a tabela completa de planos do tipo de produto (via `useFretePodPrecos`) com **checkboxes marcados** conforme `pod_planos_selecionados` — permitindo marcar/desmarcar qualquer plano.
- Cada linha continua editável (preço, manuseio, margem via override protegido por senha) e ao salvar reconstrói `pod_planos_selecionados` + define `pod_plano`/`pod_preco_por_envio` a partir do menor plano marcado (mesma regra já usada na criação).

## Retro-compatibilidade

- Estrutura de dados **não muda** — apenas UI/UX.
- Cotações sem `pod_planos_selecionados` continuam renderizando pela lógica atual (fallback ao `pod_plano`/`pod_preco_por_envio`).
- Aba **Estoque Próprio** permanece igual, apenas ganhando o gate de senha na edição.

## Detalhes técnicos

- Agrupamento por produtor usa `orcamento.nome_cliente` (e `cliente_id` quando disponível como chave estável). Cotações sem orçamento vinculado caem em grupo "Sem produtor".
- `AdminPasswordDialog` já existe (`src/components/admin/AdminPasswordDialog.tsx`, senha `0212`) — reutilizar.
- PNG por produto: renderizar container escondido (`position:absolute; left:-99999px`) com layout já usado (`exportRef`) e chamar `exportElementAsPng`.
