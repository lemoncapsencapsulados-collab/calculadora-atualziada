## Objetivo
Tornar os dados do cliente obrigatórios no fluxo de "Gerar Orçamento" e exigir explicitamente **Número** e **Bairro** no fluxo de "Projeto para Contrato".

## 1. Gerar Orçamento (`src/components/GerarOrcamentoDialog.tsx`)

Hoje o bloco "Info Cliente" é opcional (texto "Adicionar informações (opcional)" + botão que abre inline).

Mudanças no passo 6 (revisão/salvar):
- Remover o card "Adicionar informações (opcional)" para o Info Cliente — deixar o formulário sempre aberto e obrigatório (Frete permanece opcional).
- Adicionar seletor **Tipo de Pessoa** (PJ / PF) no topo do formulário, gravando em `dadosClienteTemp.tipo_pessoa`.
- Campos obrigatórios exibidos com asterisco:
  - **PJ**: CNPJ, Razão Social, Email, Telefone
  - **PF**: Nome Completo, CPF, Email, Telefone
- Calcular `clientePendencias` (useMemo) listando o que falta.
- Bloquear o botão "Salvar Orçamento" (`disabled`) quando houver pendências, mostrando um Alert acima do rodapé listando os campos faltantes (mesmo padrão visual do Projeto para Contrato).
- Manter os dados legados já preenchidos (não quebrar orçamentos existentes em edição).

## 2. Projeto para Contrato (`src/components/PropostaCompletaDialog.tsx` + `src/types/orcamento.ts`)

Hoje o endereço é um único campo livre ("Rua, número, bairro"). Vamos separar Número e Bairro:

- **Tipos** (`src/types/orcamento.ts`):
  - `DadosCliente`: adicionar `numero_cnpj?: string` e `bairro_cnpj?: string`.
  - `PessoaFisicaResponsavel`: adicionar `numero?: string` e `bairro?: string`.
- **UI** — na seção de dados do cliente do Projeto para Contrato:
  - PJ: dividir o grid de endereço em Logradouro (existente `endereco_cnpj`) + Número* + Bairro* + CEP/Cidade/Estado (existentes).
  - PF (`PessoaFisicaForm`): idem — Logradouro + Número* + Bairro*.
  - Auto-preenchimento via BrasilAPI/ViaCEP já retorna `bairro`/`numero` — popular os novos campos.
- **Validação** — adicionar ao `camposPendentes`:
  - PJ: "Número do endereço", "Bairro"
  - PF: "Número do endereço", "Bairro"
- **PDF/Contrato/VhSys**: montar o endereço a partir dos novos campos quando presentes (ex.: `logradouro, numero - bairro`) em `zapSignCampos.endereco`, resumo do PDF (linha 1452/1463) e `cadastrarClienteVhSys` já usa splits internos — passar os campos estruturados diretamente.

## Detalhes técnicos
- Não alterar migrations (campos ficam no JSONB `dados_cliente`).
- Dados antigos sem `numero_cnpj`/`bairro_cnpj` continuam sendo lidos, mas o botão de envio ficará bloqueado até preencher.
- Reutilizar o componente `Alert` já usado hoje para pendências no `PropostaCompletaDialog`.
