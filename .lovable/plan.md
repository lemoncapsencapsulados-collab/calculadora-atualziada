

## Plano: Popup de confirmacao apos importar dose

### O que sera feito

Ao clicar no botao "IMPORTAR DOSE", em vez de importar diretamente, sera exibido um AlertDialog de confirmacao com o seguinte conteudo:

- Icone de atencao (triangulo amarelo/laranja)
- Titulo: **ATENCAO**
- Mensagem: "Os precos, insumos e suas quantidades podem estar errados, CONFIRA UM A UM ANTES SEMPRE."
- Botao de confirmacao: **VOU CONFERIR**

Ao clicar em "VOU CONFERIR", a importacao sera executada normalmente.

### Detalhes tecnicos

**Arquivo:** `src/components/ImportarDoseDialog.tsx`

1. Adicionar um estado `showConfirmacao` (boolean) ao componente
2. Alterar `handleImport` para apenas abrir o popup de confirmacao (`setShowConfirmacao(true)`)
3. Criar `handleConfirmarImport` que executa a importacao real (logica atual do `handleImport`) e fecha o popup
4. Adicionar um `AlertDialog` estilizado com:
   - Fundo com gradiente laranja/amarelo no icone
   - Texto em destaque para a parte "CONFIRA UM A UM ANTES SEMPRE"
   - Botao "VOU CONFERIR" com estilo primario
   - Animacao suave de entrada
5. Usar os componentes `AlertDialog` ja existentes no projeto (`@/components/ui/alert-dialog`)

Nenhuma alteracao em banco de dados ou outros arquivos sera necessaria.

