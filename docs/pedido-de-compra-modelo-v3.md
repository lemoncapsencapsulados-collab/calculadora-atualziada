# Pedido de Compra Lemoncaps v3 — modelo de referência

Transcrição do PDF `Pedido_de_Compra_Lemoncaps_v3.pdf` enviado em 08/09/2026.
Serve de fonte para o template de contrato e para o mapeamento de campos do
fluxo Pedidos > Pedidos de Compra.

## Cabeçalho

- `PEDIDO DE COMPRA Nº [____]` — gerado pelo sistema: `{numero_contrato}-{sequencial}`,
  onde o sequencial é (quantidade de pedidos de compra daquele CNPJ) + 1.
- `Vinculado ao Contrato de Fabricação de Produtos nº [____]` — preenchido pelo
  consultor, solicitado ao financeiro.

## 1. Identificação

| Campo | Origem |
| --- | --- |
| CONTRATANTE (nome / razão social) | `clientes.razao_social` ou `clientes.nome` |
| CNPJ / CPF | `clientes.cnpj` ou `clientes.cpf` |
| Faturamento em | mesma pessoa do contrato, ou outro CNPJ |
| Data do pedido | data de criação do pedido de compra |
| Canal formal | grupo de WhatsApp ou e-mail |

## 2. Produtos

Tabela: DESCRIÇÃO | APRESENTAÇÃO | PREÇO UNIT. | QTD. | TOTAL, mais VALOR TOTAL DO PEDIDO.

## 3. Condições comerciais

- Plano de marca: Faça Você Mesmo | Start | Branding | Premium | não contratado
- Entregáveis do plano: ficha técnica | logo | N rótulo(s) | mockups | material de
  apoio | call | marca guarda-chuva | impressão
- Etapas e valores: setup/rótulo R$ ___ | produção R$ ___
- Prazo do rótulo: 7 dias úteis para a 1ª versão | 4 dias úteis por correção
- Prazo de produção: 40 dias corridos após aprovação da arte
- Prazo de entrega: até 7 dias úteis após o pagamento do frete
- Quantidade: entrega integral, conforme tabela do item 1
- Entrada mínima: 45% do valor total — condição para início da produção
- Armazenagem: 90 dias corridos sem custo; após, 10% ao mês sobre o valor da nota
- Endereço de entrega (completo, com complemento e ponto de referência)
- Contato no local (nome e telefone)

## 4. Condições de pagamento

Tabela por parcela: PARCELA | MEIO DE PAGAMENTO (PIX / cartão / boleto) | VENCIMENTO | VALOR, mais TOTAL.
Nota fixa: o frete não está incluído e é cobrado à parte, conforme a transportadora.

## 5. Especificação técnica

Produto, quantidade por frasco, dose diária sugerida e composição da fórmula
(ativos em mg + excipiente q.s.p.).

## 6. Descrição da embalagem

- Apresentação: cápsula | comprimido | gummy | pó | líquido | sachê
- Cápsula / comprimido: tipo | cor | tamanho nº
- Pote / frasco: material (PET / PEAD / vidro / outro) | capacidade (mL/g) | cor
- Tampa: tipo (rosca / flip-top / pump / outro) | cor | lacre de indução sim/não
- Dosador / acessório: não | dosador N mL | colher medida | conta-gotas | válvula pump
- Rótulo: material | acabamento | quantidade
- Embalagem secundária: não | cartucho | caixa
- Fornecimento da embalagem: por conta da CONTRATADA ou da CONTRATANTE

Fecha com a declaração de que a CONTRATANTE conferiu e aprovou composição,
dosagem e especificações de embalagem.

## 7. Declarações e aceite (texto fixo)

6.1 a 6.5 — adesão ao Contrato de Fabricação de Produtos, prevalência do Pedido
quanto a produto/quantidade/preço/prazo/pagamento, aceite por assinatura ou
confirmação no canal formal ou pagamento parcial, ciência das cláusulas
limitativas, e assinatura eletrônica (MP 2.200-2/2001 e Lei 14.063/2020),
constituindo título executivo extrajudicial (art. 784, III e §4º, CPC).

Local fixo: Cuiabá/MT.

## Assinaturas

- CONTRATANTE: razão social / nome, CNPJ/CPF, nome do representante legal, CPF.
- CONTRATADA (fixo): LEMONCAPS INDÚSTRIA E COMÉRCIO LTDA, CNPJ 55.836.075/0001-07,
  JOÃO VICTOR GOMES FERRARI, CPF 054.883.221-83.
