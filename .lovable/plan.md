# Editor de Contratos DOCX no sistema

Nova área **Contratos → Editor de Modelos** que permite subir DOCX, editar visualmente (estilo Word) no navegador, detectar variáveis `{{...}}` automaticamente, preencher com dados do orçamento e exportar DOCX/PDF final — tudo sem depender da ZapSign.

## Fluxo do usuário

1. **Biblioteca de Modelos** (nova aba em Configuração de Contratos)
   - Upload de arquivos `.docx`
   - Lista com nome, descrição, data, botões Editar / Duplicar / Excluir / Usar
2. **Editor Visual** (rich-text estilo Word)
   - Converte o DOCX para HTML editável
   - Barra de ferramentas: negrito, itálico, sublinhado, títulos, listas, alinhamento, tabelas, cor, tamanho de fonte
   - Painel lateral direito: lista de variáveis `{{VARIAVEL}}` detectadas no texto, com botão "Inserir" para colocar novas
   - Salva alterações no modelo (versão do template)
3. **Gerar Contrato a partir de um Orçamento**
   - Escolher orçamento/pedido → escolher modelo → sistema pré-preenche todas as variáveis com os dados existentes (nome, CNPJ, endereço, produtos, valores, condições de pagamento, cores, sabores etc.)
   - Tela de revisão: cada variável em um campo editável (mesma lógica que já existe hoje na revisão ZapSign)
   - Botões: **Baixar DOCX**, **Baixar PDF**, **Salvar cópia no pedido**

## Peças técnicas

**Backend (Supabase)**
- Nova tabela `contrato_modelos_docx` (id, nome, descricao, arquivo_url, html_editado, variaveis_detectadas jsonb, versao, created_at, updated_at)
- Bucket privado `contratos-modelos` para os `.docx` originais
- Bucket `contratos-gerados` para os contratos finais
- Edge function `gerar-contrato-docx`: recebe `{ modelo_id, variaveis }`, aplica no template DOCX usando **docxtemplater**, devolve URL do DOCX preenchido
- Edge function `docx-para-pdf`: converte via LibreOffice headless (ou biblioteca puppeteer no PDF do HTML editado)

**Frontend**
- Bibliotecas: `mammoth` (DOCX → HTML), `@tiptap/react` + extensões (editor rich-text), `docx` (montar DOCX de volta do HTML quando o usuário edita), `docxtemplater` + `pizzip` (merge das variáveis)
- Nova página `/contratos/modelos` com listagem
- Página `/contratos/modelos/:id/editar` com o editor TipTap ocupando a tela
- Componente `PreencherContratoDialog` reutilizando a lógica do `RevisaoContratoZapSignDialog`
- Botão **"Gerar contrato interno"** em Orçamentos e Pedidos, ao lado do "Enviar para ZapSign"

## Detecção automática de variáveis

- Regex `/\{\{\s*([A-Z0-9_]+)\s*\}\}/g` roda toda vez que o modelo é salvo
- Mapeia contra o mesmo dicionário de aliases que já existe em `src/lib/zapsignContrato.ts` — assim os mesmos dados do orçamento (nome, CNPJ, endereço, valor, produtos, condições de pagamento, cores/sabores) preenchem tanto o contrato ZapSign quanto o interno
- Variáveis novas que não estejam no dicionário aparecem no painel para preenchimento manual

## Limitações honestas

- Editor visual **não é 100% fiel ao Word**: formatações muito específicas (numeração multi-nível complexa, campos de mesclagem antigos, quebras de seção incomuns) podem perder no vai-e-vem HTML↔DOCX. Solução: manter o DOCX original intocado e, ao gerar o contrato, aplicar as variáveis no arquivo original (via docxtemplater) — o editor visual serve pra ajustar texto/parágrafos e definir onde ficam as `{{variaveis}}`, não pra recriar layouts complexos
- Conversão DOCX→PDF exata precisa de LibreOffice em edge function (mais pesada). Alternativa mais leve: gerar PDF a partir do HTML do editor com jsPDF/html2pdf, que é fiel ao que o usuário vê no editor mas não ao Word original

## Escopo desta implementação (proposta)

**Fase 1 (agora):** upload de modelo, editor TipTap, detecção de variáveis, biblioteca de modelos, gerar DOCX preenchido, baixar DOCX
**Fase 2 (depois):** exportar PDF, salvar cópia no pedido, versionamento de modelos

Confirma que posso seguir com a Fase 1 assim? Ou quer ajustar algo (ex.: já incluir PDF, remover a biblioteca e deixar só upload avulso, etc.)?
