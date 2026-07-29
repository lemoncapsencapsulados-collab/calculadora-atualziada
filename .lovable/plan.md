## Objetivo

Na página de Pedidos, cada linha de cliente ganha um botão **"Demandas de Marca"**. Ao clicar, abre um pop-up para criar/visualizar demandas de 4 tipos: **Rótulo**, **Criativos**, **Banner** e **Conta Monetizze**. Cada demanda fica salva no banco (com data de criação e status) e pode ser baixada como briefing em PDF para enviar no WhatsApp.

## Pop-up "Demandas de Marca"

Cabeçalho fixo com **Cliente**, **Vendedor responsável** (do orçamento vinculado) e número do pedido — obrigatórios em toda demanda e impressos no PDF.

Abaixo, 4 botões/abas de serviço. Cada um pode ser preenchido ou deixado de fora. Uma lista das demandas já criadas aparece embaixo, com tipo, data de criação, status (Pendente / Em andamento / Concluída) e ações (ver, editar, baixar PDF).

### 1. RÓTULO — Demanda Designer
- Tipo de papel: Metalizado, Perolizado, Transparente
- Nome da marca: campo de texto + opção "Sem marca ainda"
- Posicionamento da marca: Premium, Intermediária, Popular
- Estrutura de rótulo: Minimalista, Moderno, Clássico
- Upload: arquivo de referência (múltiplos) e arquivo da marca/logo (preferência vetor)
- **Lista de produtos** (adicionar quantos precisar), cada um com:
  - Tipo de produto: Encapsulado, Líquido, Gummy, Solúvel
  - Nome do produto (ou "Nome indefinido ainda")
  - Quantidade de potes
  - Segmento (Emagrecimento, Libido, Foco e concentração, Sono, Imunidade, Beleza/Cabelo-pele-unha, Energia, Saúde intestinal, Outro)
- Os produtos vêm pré-preenchidos a partir dos itens do pedido (tipo, nome e quantidade), podendo ser editados/removidos.

### 2. CRIATIVOS — Demanda Designer
- Por produto do pedido: quantidade desejada (1 a 3, máximo 3)
- Um objetivo por criativo: Venda de produto, Informações do produto, Lançamento da marca/produto
- Validação impede passar de 3 criativos por produto

### 3. BANNER — Demanda Designer
- Lista de produtos com checkbox de seleção
- Para cada produto selecionado, gera automaticamente a demanda de **1 banner vertical + 1 banner horizontal** (checkboxes marcados por padrão, podendo desmarcar um dos formatos)

### 4. CRIAÇÃO DE CONTA MONETIZZE — Demanda T.I
Checklist de etapas, pré-marcadas como pendentes:
- Criar a conta
- Criar cada produto do pedido (lista os produtos individualmente)
- Criar 1 plano para cada produto
- Criar checkout do plano
- Colocar banner no checkout
- Gerar link de divulgação e enviar ao vendedor responsável (campo para colar o link gerado)

## Saída e acompanhamento

- Tudo visível dentro do sistema, na lista do pop-up, com data de criação e status editável.
- Botão **"Baixar briefing (PDF)"** por demanda e **"Baixar todas as demandas do pedido (PDF)"** — layout limpo, com cabeçalho de cliente/vendedor/pedido, seções por serviço e links dos arquivos anexados, pronto para enviar no WhatsApp.

## Detalhes técnicos

- Nova tabela `demandas_marca`: `id`, `pedido_id`, `tipo` (`rotulo` | `criativos` | `banner` | `monetizze`), `status`, `cliente_nome`, `vendedor_nome`, `dados jsonb` (todo o formulário específico do tipo), `arquivos jsonb` (paths no storage), `created_at`, `updated_at`, `created_by`. Com GRANTs para `authenticated`/`service_role` e RLS para usuários autenticados.
- Novo bucket privado `demandas-marca` + políticas em `storage.objects`; uploads em `demandas-marca/{pedido_id}/{demanda_id}/...` e download via URL assinada.
- Novos arquivos: `src/hooks/useDemandasMarca.ts`, `src/types/demandaMarca.ts`, `src/components/pedidos/DemandasMarcaDialog.tsx` (shell com abas/lista) e formulários `FormRotulo.tsx`, `FormCriativos.tsx`, `FormBanner.tsx`, `FormMonetizze.tsx` em `src/components/pedidos/demandas/`.
- `src/lib/demandasMarcaPdf.ts` para o briefing em PDF, reutilizando o padrão jsPDF já usado em `relatoriosPedidos.ts`.
- Em `src/pages/Pedidos.tsx`: botão "Demandas de Marca" na linha do pedido (com badge de contagem de pendentes) abrindo o dialog; produtos e vendedor lidos de `orcamento_snapshot` (`itens_producao`, `consultor_responsavel`).
- Nada muda fora da página de Pedidos.
