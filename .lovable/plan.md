# Entregável avulso: Página de Vendas (Landing Page)

## O que muda

No Passo 3 (Custo de Setup), abaixo dos cards de planos, entra um novo bloco **"Entregáveis avulsos"** com um item:

**Página de vendas completa de alta conversão (Landing Page) + integração com link de vendas da plataforma**
- Copy estratégica da página
- Design da página (UI/UX)
- Integração da página (botões de venda)
- Não incluso: domínio e hospedagem

Preço: **R$ 1.199,90**. Quando o orçamento incluir o **Plano Black**, o preço muda automaticamente para **R$ 499,90**, com um selo "Desconto Plano Black aplicado" no card.

O item tem contador de quantidade igual aos planos e soma no **Total do Setup**.

## Onde aparece depois

O avulso é tratado como um serviço de setup normal, então já flui para:
- Orçamento gerado (PDF) — nome, valor e entregáveis
- Proposta / Projeto para contrato
- Pedido, na seção "Setup Contratado — Entregáveis"

## Detalhes técnicos

- Dados: nova linha em `setup_planos` (perfil `novo_produtor`, ordem após os planos) com nome "Página de Vendas (Landing Page) + Integração", `preco_fixo = 1199.90`, `descricao_curta = "Entregável avulso"` e `entregaveis_md` com os itens inclusos + a linha de "não incluso". O item é identificado pelo nome/ordem, sem mudança de schema.
- UI: em `src/components/orcamento/SetupPlanosStep.tsx`, separar a lista em planos e avulsos, renderizando os avulsos em bloco próprio abaixo. O preço exibido do avulso é R$ 499,90 se houver quantidade > 0 do Plano Black, senão R$ 1.199,90.
- Total: `totalSetup` passa a usar o preço efetivo (com desconto) em vez de `preco_fixo` puro.
- Persistência: `buildPlanosSelecionados` recebe o preço efetivo, para que `preco_unitario` gravado em `orcamentos.servicos_marca` já reflita o desconto — sem alterar `GerarOrcamentoDialog.tsx`, PDFs ou a tela de Pedido.