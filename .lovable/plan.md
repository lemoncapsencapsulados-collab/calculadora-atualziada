
Problema confirmado: o fluxo que você descreveu não passa por `PropostaCompletaDialog`, e sim por `AprovacaoOrcamentoDialog` ao marcar o orçamento como pago. Esse componente ainda está com a lógica antiga e isolada, sem integração com a gestão centralizada de clientes.

O que encontrei:
- O orçamento pago de Micael Ximenes está salvo com `cliente_id = 41568b89-e3e2-4c4c-8892-929d6394d46c`.
- No banco, esse cliente já está como PJ Lemoncaps, então em algum momento os dados acabaram persistindo corretamente no cadastro.
- Porém, no código do fluxo “Pago”, `AprovacaoOrcamentoDialog.tsx`:
  - não usa `ClienteSelector`
  - não usa `useClientes`
  - não pré-carrega `orcamento.cliente_id`
  - não executa a lógica de merge PF→PJ por telefone
  - não atualiza explicitamente o registro do cliente centralizado ao confirmar o pagamento

Conclusão:
- O problema estrutural existe no fluxo “Transformar em pago”.
- O fluxo “Resumo para Contrato” está diferente e mais novo: ele já usa `useClientes`, carrega `cliente_id`, tenta atualizar cliente existente e salvar o vínculo no orçamento.
- Portanto, sim: o comportamento correto no “Resumo para Contrato” tende a continuar funcionando, enquanto o fluxo “Pago” permanece suscetível a inconsistência por estar desatualizado em relação à arquitetura atual.

Plano de correção:
1. Alinhar `AprovacaoOrcamentoDialog.tsx` com a mesma arquitetura dos outros fluxos
   - integrar `ClienteSelector` no modo completo
   - integrar `useClientes`
   - pré-carregar cliente via `orcamento.cliente_id`

2. Aplicar a mesma regra de persistência do fluxo que já funciona
   - se houver `clienteSelecionado`, atualizar esse ID
   - se não houver, buscar por telefone de contato principal
   - se encontrar cliente PF com mesmo telefone e os dados atuais forem PJ, atualizar o mesmo registro
   - se não encontrar, criar novo cliente
   - salvar `cliente_id` final no orçamento

3. Manter os campos obrigatórios atuais do fluxo Pago
   - sem simplificar o formulário
   - apenas conectar o preenchimento atual ao cadastro centralizado

4. Melhorar rastreabilidade e feedback
   - exibir toast quando o cliente for atualizado/criado
   - exibir erro claro se a persistência do cliente falhar
   - evitar falha silenciosa após o orçamento mudar para pago

5. Validar consistência entre os dois fluxos finais
   - garantir que `AprovacaoOrcamentoDialog` e `InformacoesClienteDialog` usem a mesma estratégia de:
     - preload por `cliente_id`
     - merge por telefone
     - atualização PF→PJ
     - persistência de `cliente_id`

Detalhe técnico importante:
Hoje existem dois caminhos finais diferentes:
```text
Enviado -> Resumo para Contrato -> InformacoesClienteDialog
Enviado -> Pago -> AprovacaoOrcamentoDialog
```
O segundo ainda não foi migrado para o modelo centralizado de clientes, e essa é a causa raiz mais provável do que você observou.

Arquivos que precisam entrar na correção:
- `src/components/AprovacaoOrcamentoDialog.tsx`
- possivelmente pequenas harmonizações em `src/hooks/useClientes.ts`
- opcionalmente extrair a lógica de persistência do cliente para utilitário compartilhado, para impedir nova divergência entre “Pago” e “Resumo para Contrato”
