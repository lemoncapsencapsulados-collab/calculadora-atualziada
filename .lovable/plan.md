## Objetivo
Permitir clicar em cada linha do card **"Comissão por Consultor"** e abrir um popup que detalhe, parcela por parcela, a composição da comissão daquele consultor no mês selecionado — reforçando que a comissão é apurada pelo **efetivamente recebido**, não pelo parcelamento contratado.

## Mudanças

### 1) Linha do consultor clicável
- Tornar cada linha da tabela "Comissão por consultor" interativa (cursor pointer, hover, foco por teclado).
- Ao clicar, abre um Dialog com o detalhamento do mês ativo daquele card (usa `mesResumoConsultor`).

### 2) Conteúdo do popup "Detalhamento da comissão"
Cabeçalho:
- Nome do consultor + mês de referência.
- Aviso curto: "Comissão calculada sobre parcelas efetivamente recebidas no mês."
- Cards-resumo: Comissão paga, A vencer, Inadimplente, Total previsto (paga + a vencer).

Tabela de parcelas (todas as parcelas do consultor naquele mês, mesmo filtro do card):
- Pedido (nº) · Cliente · Tipo de venda (Nova 5% / Recompra 1%) · Método de pagamento.
- Descrição da parcela · Vencimento · Data de pagamento (quando paga).
- Valor bruto recebido · Valor líquido (base) · % aplicado · Comissão da parcela.
- Status da parcela (Pago / A vencer / Inadimplente / Sem data).

Agrupamento visual:
- Subseção "Pagas no mês" (somatório destacado em verde — base efetiva da comissão).
- Subseção "A vencer no mês" (previsão).
- Subseção "Inadimplentes no mês" (perda potencial).

Rodapé:
- Totais por status com somatórios de comissão.
- Botão "Exportar CSV" do detalhamento daquele consultor/mês.

### 3) Comportamento
- O popup respeita os filtros atuais de tipo de venda e mês do próprio card de consultor (mas ignora os filtros globais de status/mês da seção "Pedidos no período").
- Clicar em uma linha de parcela dentro do popup abre o diálogo de detalhes do pedido correspondente (reusa `DetalhesPedidoComissaoDialog`), permitindo confirmar/desmarcar parcelas direto dali.

## Detalhes técnicos
- `RelatorioComissoes.tsx`: novo estado `consultorDetalhe: string | null`.
- Filtrar `parcelasResumoConsultor` por `p.consultor === consultorDetalhe` para alimentar o popup.
- Novo componente `DetalheConsultorDialog` no mesmo arquivo, recebendo `parcelas`, `consultor`, `mes`, `onAbrirPedido(pedido)`.
- Reaproveitar `fmtBRL`, `fmtDate`, `statusBadge` já existentes.
- Exportação CSV usa o mesmo padrão do `exportarCSV` atual, escopado às parcelas do consultor.

## Resultado esperado
- Em "Comissão por Consultor", o usuário clica num consultor e vê exatamente quais pedidos/parcelas compõem o valor recebido e o que ainda está por receber/inadimplente no mês.
- Fica transparente que a comissão é função do recebimento real, não do parcelamento contratado.
