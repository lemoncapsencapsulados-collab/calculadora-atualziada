## Reformular Passo 3 (Custo de Setup) — Novo Produtor x Produtor Experiente

### 1. Tela inicial do Passo 3 (seleção do perfil)

Antes de mostrar qualquer item, exibir 2 cards grandes lado a lado:

- **NOVO PRODUTOR** — "Para clientes que estão começando a marca"
- **PRODUTOR EXPERIENTE** — "Para clientes com histórico de vendas dos produtos orçados"
  - Inclui badge/observação: *"Obs: Precisa ter histórico de vendas do(s) produto(s) orçado(s)"*

Botão "Voltar" na lateral permite trocar de perfil depois de escolhido.

### 2. Caminho PRODUTOR EXPERIENTE

Mostra os 4 planos de Produtor Experiente como cards selecionáveis com quantidade (input numérico por plano), permitindo combinações como "1 Start + 1 Branding". A lista mostrada virá de uma tabela configurável (ver §4).

- Subtotal de setup = soma de (preço fixo do plano × quantidade)
- Os itens atuais (Código de barras, Design, Página de vendas, INPI, Impressão) **deixam de aparecer neste caminho** — substituídos pelos planos.

### 3. Caminho NOVO PRODUTOR

Mostra os 3 planos fixos como cards selecionáveis (mesma UX de quantidade por plano):

| Plano | Preço |
|---|---|
| FAÇA VOCÊ MESMO | R$ 1.999,90 |
| START | R$ 2.999,90 |
| BRANDING | R$ 7.999,90 |
| PREMIUM | R$ 11.999,90 |

> Obs: o usuário descreveu 4 planos (incluindo "FAÇA VOCÊ MESMO"). Trataremos como 4 planos no caminho Novo Produtor. Caso queira somente 3, basta desativar um na config.

Cada card é expansível mostrando os entregáveis (lista com checkmarks idêntica ao texto enviado).

### 4. Origem dos dados dos planos

Nova tabela `setup_planos` armazenando os planos de ambos os perfis, com:
- `perfil` (`novo_produtor` | `produtor_experiente`)
- `nome`, `preco_fixo`, `descricao_curta`
- `entregaveis_md` (texto markdown formatado)
- `ativo`, `ordem`

Seed inicial com os 4 planos de Novo Produtor (textos exatos enviados). Para Produtor Experiente entrará vazio até você informar os planos (mensagem combinada: *"na tela aparecerá somente os planos que eu envie"*) — após o plano aprovado, faremos o seed inicial dos planos que você passar.

Tela de administração simples em `ConfiguracaoContratos` (ou nova subpágina `ConfiguracaoPlanosSetup`) para criar/editar/desativar planos sem precisar de deploy.

### 5. Cálculo e fluxo de preço

- Modo "preço fixo" passa a ser **padrão** para ambos os caminhos.
- `precoVendaSetup = Σ (plano.preco_fixo × qtd)`.
- Sem aplicação de margem por cima (você confirmou: substitui o cálculo).
- Mantém a senha admin para overrides manuais já existente.

### 6. Persistência no Orçamento

Em `servicos_marca`, o item "Setup" passa a guardar:

```json
{
  "nome_plano": "Setup",
  "valor": <total>,
  "setup_detalhes": {
    "perfil": "novo_produtor",
    "planos_selecionados": [
      { "plano_id": "...", "nome": "START", "quantidade": 1, "preco_unitario": 2999.90, "entregaveis_md": "..." }
    ],
    "modo_calculo": "valor_fixo"
  }
}
```

A descrição renderizada no PDF/visualização do orçamento e do pedido lista cada plano com sua quantidade e entregáveis (markdown → bullets), tudo dentro de uma única linha "Setup — Plano X (qtd)".

### 7. Pedido Gerado

Como o pedido faz snapshot do orçamento (`orcamento_snapshot`), os detalhes do plano fluem automaticamente para o pedido. Vamos:
- Renderizar a seção "Detalhes do Setup" em `DetalhesPedidoDialog` e no PDF de pedido com o plano + entregáveis.
- Manter `DemandasSetupResumo` funcionando: se o plano selecionado contém entregáveis mapeáveis (rótulos, página de vendas, INPI), criamos automaticamente as demandas correspondentes ao gerar o pedido (mapping por palavras-chave nos entregáveis do plano).

### 8. Detalhes técnicos

**Arquivos a alterar:**
- `src/components/GerarOrcamentoDialog.tsx` — substituir a UI do passo 3 pelo novo fluxo (perfil → planos com quantidade).
- Novo `src/components/orcamento/SetupPerfilPicker.tsx` e `src/components/orcamento/PlanoCard.tsx`.
- Novo hook `src/hooks/useSetupPlanos.ts` (lista planos ativos por perfil).
- `src/lib/orcamentoGenerator.ts` / `src/lib/pdfGenerator.ts` / `src/lib/propostaGenerator.ts` — renderizar entregáveis do plano.
- `src/components/DetalhesPedidoDialog.tsx` — mostrar plano de setup escolhido.
- `src/lib/entregaveis.ts` — função `derivarDemandasDePlano(plano)` para auto-popular demandas no pedido.

**Migration:**
- Tabela `setup_planos` com GRANTs + RLS (SELECT para `authenticated`/`anon` para leitura na UI pública do orçamento, INSERT/UPDATE/DELETE só para `authenticated`).
- Seed dos 4 planos de Novo Produtor com os textos enviados.

**Compatibilidade:** orçamentos antigos continuam funcionando porque a leitura de `setup_detalhes` faz fallback para o formato anterior (items + impressao).

### Pendente para depois do plano aprovado
Você me envia os planos de **Produtor Experiente** (nomes, preços, entregáveis) para eu fazer o seed deles.