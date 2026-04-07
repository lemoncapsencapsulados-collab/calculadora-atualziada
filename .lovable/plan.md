

## Plano: Remover obrigatoriedade do QSA no fluxo Pago

### Alteração única

**Arquivo:** `src/components/AprovacaoOrcamentoDialog.tsx`

**Linha ~382** — Remover a validação obrigatória do Responsável QSA:
```typescript
// REMOVER esta linha:
camposFaltando.push(...validatePF(responsavelPJ, 'Responsável QSA'));
```

Os campos do QSA continuam sendo exibidos e preenchíveis (e serão salvos se preenchidos), mas não bloqueiam mais a confirmação de pagamento. A obrigatoriedade permanece inalterada no `InformacoesClienteDialog` (Resumo para Contrato).

