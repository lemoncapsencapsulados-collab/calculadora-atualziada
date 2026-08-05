# Planos de Setup — Novo Produtor

## O que muda

### 1. Catálogo de planos (Novo Produtor)
Substituir os planos atuais por 5 planos, nesta ordem:

| # | Plano | Valor | SKUs |
|---|-------|-------|------|
| 1 | Plano Iniciante (antigo START) | R$ 2.999,90 | — |
| 2 | Plano Start | R$ 3.999,00 | 1 SKU |
| 3 | Plano Branding | R$ 6.999,00 | até 2 SKU |
| 4 | Plano Premium | R$ 11.999,00 | até 3 SKU |
| 5 | Plano Black | R$ 4.999,90 | pacote completo |

Entregáveis conforme os prints, **apenas os itens inclusos** (itens riscados não entram):

- **Start:** 1 rótulo, 1 logo, mockups 3D, banner de checkout horizontal e vertical, planos de venda com links Monetizze/Braip, 1 criativo Instagram, 1 criativo Ads.
- **Branding:** tudo do Start + página de vendas personalizada por SKU + integração da página com Monetizze/Braip + taxa especial na Monetizze.
- **Premium:** tudo do Branding + banner de apresentação em PDF da marca + reunião de alinhamento e estratégia.
- **Black:** 100 potes fabricados com a marca, rótulo e identidade profissionais, link de venda integrado à plataforma de pagamento, banners e criativos para Instagram/WhatsApp, QR Code de venda, suporte de lançamento.
- **Iniciante:** mantém os entregáveis atuais do START.

Todos os emojis (check verde, X, aperto de mão) saem dos textos; os entregáveis viram bullets limpos.

### 2. Tela "Custo de Setup" (Passo 3 do orçamento)
Novo layout em cards, um por plano, no estilo dos prints:
- Título do plano + selo de SKU
- Preço em destaque no rodapé do card
- Lista de entregáveis com marcador de check, fácil de ler
- Contador de quantidade e destaque visual quando o plano está selecionado
- Total do setup consolidado ao final

### 3. Orçamento gerado / Proposta para contrato
O PDF de orçamento e o de projeto para contrato já recebem os serviços de setup; a saída passa a mostrar, para cada plano: nome, valor e a lista completa de entregáveis em bloco próprio e bem espaçado. A pré-visualização da proposta exibe o mesmo bloco.

### 4. Pedido (quando pago)
Nova seção **"Setup Contratado — Entregáveis"** nos detalhes do pedido (somente leitura):
- Um card por plano contratado com nome, valor e todos os entregáveis
- Total do setup no topo da seção

## Detalhes técnicos

- Dados: atualização da tabela `setup_planos` (perfil `novo_produtor`) — renomear START para "Plano Iniciante" (ordem 1) e criar/atualizar Start, Branding, Premium e Black com preços, `descricao_curta` (SKUs) e `entregaveis_md` limpos. Planos antigos não usados ficam `ativo = false`.
- UI: reescrita do bloco de listagem em `src/components/orcamento/SetupPlanosStep.tsx` (cards + preço + entregáveis). Sem mudança na assinatura do componente nem em `buildPlanosSelecionados`.
- Persistência já existente é mantida: cada plano vira um `ServicoMarca` com `entregaveis[]` e `setup_detalhes` em `orcamentos.servicos_marca` (`GerarOrcamentoDialog.tsx`), e é copiado para `pedidos.orcamento_snapshot`.
- PDF: ajuste de formatação do bloco de entregáveis em `src/lib/orcamentoGenerator.ts` (`renderServicos`).
- Pedido: seção nova em `src/components/DetalhesPedidoDialog.tsx`, lendo `orcamento_snapshot.servicos_marca`.