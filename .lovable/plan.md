## Objetivo
Antes de enviar para ZapSign, abrir um **editor estilo Word** com o contrato renderizado (texto + logo + campos), permitir editar tudo, e ter um botão **"Enviar para ZapSign"** que dispara as assinaturas usando o documento editado.

## Limitação técnica (importante)
A API do ZapSign **não devolve** o conteúdo do template (.docx/texto). Para abrir um editor WYSIWYG com o conteúdo real, precisamos ter o `.docx` **no nosso lado**. Solução: cadastrar o `.docx` do modelo uma vez no Painel Admin → Configuração de Contratos. A partir daí, todo envio passa pelo editor.

No envio, deixamos de usar o template do ZapSign (`template_id`) e passamos a usar o endpoint de **"documento avulso"** (`/docs/`) enviando o `.docx` final editado + lista de signatários. ZapSign converte em PDF, mescla as assinaturas e devolve o token normalmente (o webhook atual continua funcionando sem mudanças).

## Mudanças

### 1. Banco
- `contrato_modelos`: adicionar colunas
  - `docx_path text` (caminho no bucket `contratos`)
  - `docx_nome text`
  - `docx_size_bytes int`
  - `variaveis jsonb` (lista de placeholders detectados, ex: `["{{cliente_nome}}", "{{valor_total}}"]`)
- Bucket `contratos`: já existe; adicionar subpasta `modelos/`.

### 2. Painel Admin — Configuração de Contratos
Na tela de cadastro de modelo, novo bloco **"Documento Word do contrato"**:
- Upload de `.docx`
- Detecta automaticamente placeholders no formato `{{variavel}}`
- Mostra lista das variáveis encontradas e exemplos de mapeamento
- Botão "Substituir documento" / "Baixar atual"

### 3. Novo componente — `EditorContratoDocxDialog.tsx`
Aberto a partir do `EnviarContratoZapSignPedidoDialog` (botão **"Editar contrato"** antes de "Enviar para ZapSign"):
- Carrega o `.docx` do modelo padrão (ou do modelo selecionado)
- Substitui variáveis pelo dado real do orçamento/cliente (cliente_nome, cnpj, valor, data, etc)
- Renderiza com **SuperDoc** (`@harbour-enterprises/superdoc`) — editor open-source estilo Word para .docx no navegador, com edição rica, imagens, tabelas, logo
- Permite trocar/posicionar o logo (upload local)
- Botões: **"Salvar rascunho"** (guarda o .docx editado no storage vinculado ao orçamento), **"Enviar para ZapSign"** (exporta o .docx final e chama a edge function)

### 4. Edge function `criar-contrato-zapsign`
Adicionar novo modo `documento_avulso`:
- Recebe `docx_base64` + signatários
- Chama `POST {ZAPSIGN_BASE_URL}/docs/` (em vez de `/models/create-doc/`) com `base64_pdf` ou `base64_docx`
- Salva o token retornado em `contratos_zapsign` como hoje
- Mantém o fluxo de webhook intacto

### 5. Dependências
- `@harbour-enterprises/superdoc` (editor docx no browser, MIT)
- `docxtemplater` + `pizzip` (substituição de variáveis no .docx server-less)

## Fluxo do usuário
1. Admin sobe o `.docx` do contrato uma vez (Configuração de Contratos)
2. No orçamento → "Enviar para ZapSign" abre o diálogo de signatários como hoje
3. Novo botão **"Editar contrato antes de enviar"** abre o editor full-screen com o documento já preenchido
4. Usuário edita texto, logo, números — vê exatamente como vai ficar
5. Clica **"Enviar para ZapSign"** → contrato vai com o conteúdo editado, signatários recebem por e-mail/WhatsApp

## Fora de escopo
- Edição colaborativa em tempo real
- Comentários/revisões estilo Word
- Versionamento histórico de cada edição (salvamos apenas a última versão por orçamento)

## Arquivos afetados
- **Migração** nova (colunas em `contrato_modelos`)
- `src/hooks/useContratoModelos.ts` (campos novos)
- `src/pages/ConfiguracaoContratos.tsx` (upload .docx)
- `src/components/contrato/EditorContratoDocxDialog.tsx` (**novo**)
- `src/components/pedidos/EnviarContratoZapSignPedidoDialog.tsx` (botão "Editar antes de enviar")
- `src/components/PropostaCompletaDialog.tsx` (mesmo botão no fluxo do orçamento)
- `supabase/functions/criar-contrato-zapsign/index.ts` (modo documento avulso)
