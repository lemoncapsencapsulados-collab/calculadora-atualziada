

# Plano: PDF completo com dados do cliente, produção e pagamento + correção CEP/CNPJ

## Problemas identificados

### 1. PDF incompleto (`renderDadosCliente` em `orcamentoGenerator.ts`)
A função `renderDadosCliente` (linhas 199-248) só renderiza campos básicos: email, telefone, CPF, CNPJ, razão social e endereço. Faltam:
- **PJ**: Inscrições estadual/municipal, responsável PJ (QSA) com todos os dados pessoais
- **PF**: Lista de pessoas físicas com CPF, RG, estado civil, endereço, etc.
- **Detalhes de produção** por item (cor pote/tampa, sabor, cor conteúdo)
- **Condições de pagamento novas** (metodo_principal: avista/cartao/fracionado/dois_cartoes) — o `renderCondicoesPagamento` só suporta o formato legado (valor_entrada/valor_termino)

### 2. CEP não armazenado no endereço PJ
O campo `cep_cnpj` existe no tipo `DadosCliente` e no formulário, mas o `formatEndereco` no PDF já o inclui. O problema é que o formulário PJ no `PropostaCompletaDialog` pode não ter o campo CEP visível (preciso verificar). Verificado: o campo CEP PJ existe (linha ~461 do PropostaCompletaDialog).

### 3. CNPJ API coloca bairro no endereço
Na linha 259 do `PropostaCompletaDialog`, o `handleBuscarCnpj` monta: `[data.logradouro, data.numero, data.complemento, data.bairro]`. Isso está correto em princípio (inclui rua + número + complemento + bairro). Porém, a BrasilAPI pode retornar campos vazios para `logradouro` e preencher apenas `bairro`, resultando em apenas o bairro no endereço. O mesmo ocorre no `AprovacaoOrcamentoDialog`.

## Mudanças

### 1. `src/lib/orcamentoGenerator.ts` — Expandir renderização

**`renderDadosCliente`**: Reescrever para incluir:
- Seção PJ: CNPJ, Razão Social, Inscrições, Endereço com CEP, Cidade/UF
- Seção PJ + QSA: Dados do responsável (nome, CPF, RG, estado civil, endereço, telefone, email)
- Seção PF: Cada pessoa física com todos os campos
- Canal de venda

**`renderProdutos`**: Adicionar detalhes de produção por item (cor pote, cor tampa, sabor, cor conteúdo, observação) quando `detalhes_producao` estiver presente.

**`renderCondicoesPagamento`**: Adicionar suporte ao novo formato:
- `avista`: forma à vista (PIX/transferência/débito/boleto)
- `cartao_credito`: número de parcelas com juros
- `fracionado`: valor à vista + parcelas cartão
- `dois_cartoes`: dois cartões com parcelas independentes

### 2. `src/components/PropostaCompletaDialog.tsx` e `AprovacaoOrcamentoDialog.tsx`

Ajustar `handleBuscarCnpj` para montar o endereço de forma mais robusta, separando logradouro de bairro (ex: `"Rua X, 123 - Bairro Y"`), e garantir que o CEP retornado pela API seja preenchido no campo `cep_cnpj`.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/orcamentoGenerator.ts` | Expandir renderDadosCliente, renderProdutos (detalhes produção), renderCondicoesPagamento (novo formato) |
| `src/components/PropostaCompletaDialog.tsx` | Corrigir montagem endereço CNPJ |
| `src/components/AprovacaoOrcamentoDialog.tsx` | Mesma correção de endereço CNPJ |

