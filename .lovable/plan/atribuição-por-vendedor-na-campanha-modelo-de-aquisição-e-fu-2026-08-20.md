# Atribuição por vendedor na campanha + Modelo de aquisição e funil geral

## 1. Reconhecer o vendedor pelo nome da campanha

Hoje o sistema só identifica o consultor quando a campanha traz algo como `consultor=Nome`. Vou trocar por um reconhecimento inteligente do nome dentro do texto da campanha, ignorando maiúsculas/minúsculas, acentos e apelidos:

- **Emmanuel**: emmanuel, manu, manoel, emanuel, emanoel
- **Guilherme**: guilherme, gui, guillherme
- **Everton**: everton, ton, everton/ton, evert

Regras:
- Comparação sem acento, sem diferenciar maiúscula/minúscula, e por palavra inteira (para "ton" não casar dentro de "Botox", por exemplo — só casa quando aparecer isolado por espaço, hífen, underline, barra ou pontuação).
- Se a campanha citar mais de um nome, vale o primeiro reconhecido.
- Campanha sem nenhum nome reconhecido = **campanha geral** (fica no funil geral, não vai para nenhum vendedor).
- O investimento e os leads da campanha são creditados individualmente ao vendedor reconhecido, como já acontece hoje no painel por consultor.

A regra roda tanto na sincronização (para gravar o vendedor nos dados novos) quanto no cálculo da tela, para que os dados já sincronizados também passem a ser atribuídos sem precisar re-sincronizar. A lista de apelidos fica num único arquivo, fácil de ampliar depois.

## 2. Pergunta "Modelo de aquisição" no orçamento

Em **Gerar Orçamento - Passo 1 de 7**, logo abaixo do Nome do cliente, entra o campo obrigatório **Modelo de aquisição** com as opções:

- Indicação
- Tráfego no WhatsApp
- Funil de formulário
- Página de vendas

O valor é salvo no orçamento (nova coluna no banco) e acompanha o orçamento quando ele vira pedido — o pedido já guarda uma cópia do orçamento, então o modelo aparece automaticamente também nos pedidos pagos.

Orçamentos antigos ficam como "Não informado" e aparecem numa faixa separada nos relatórios.

## 3. Funil geral em "Investimento em Anúncios"

Nova seção na página, abaixo do funil atual:

**Funil por modelo de aquisição** — um bloco por modelo (Indicação, Tráfego no WhatsApp, Funil de formulário, Página de vendas, Não informado) mostrando:

- Orçamentos gerados no período
- Clientes adquiridos (orçamentos que viraram pedido/pago no período)
- Taxa de conversão orçamento → venda
- Valor total vendido

**Bloco de campanhas gerais** (as que não têm nome de vendedor): investimento, leads, e ao lado os orçamentos e vendas dos modelos vindos de anúncio (Tráfego no WhatsApp, Funil de formulário, Página de vendas), com CPL e custo por venda — assim dá para ver o retorno das campanhas que não são de nenhum vendedor específico.

Os filtros de período, canal, consultor e produto/campanha já existentes continuam valendo para essa seção. Os modelos também entram nas exportações CSV/XLSX/PDF.

## Detalhes técnicos

- Novo `src/lib/vendedoresCampanha.ts` com o dicionário de apelidos e `detectarVendedorNaCampanha(nome)` (normaliza acentos + regex de palavra inteira). Usado em `supabase/functions/meta-sync-insights/index.ts` (substitui `consultorDaCampanha`) e em `useAnunciosDados` como fallback sobre `campaign_name`.
- Migração: coluna `modelo_aquisicao text` em `public.orcamentos` (nullable, sem default).
- `GerarOrcamentoDialog.tsx`: estado `modeloAquisicao`, Select após o nome do cliente, validação em `canGoNext` do passo 1, envio no insert/update, e carregamento no modo edição.
- `useAnunciosDados`: consulta passa a trazer `modelo_aquisicao` de orçamentos e do `orcamento_snapshot` dos pedidos; novo agregado `porModeloAquisicao` e `geral` (campanhas sem vendedor).
- Novo componente `src/components/anuncios/FunilAquisicao.tsx`; `anunciosExport.ts` ganha as novas colunas.
