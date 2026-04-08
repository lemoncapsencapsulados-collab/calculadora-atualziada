ALTER TABLE pedidos ADD COLUMN acompanhamento_processos jsonb DEFAULT '{
  "criacao_marca": "pendente",
  "producao": "pendente",
  "integracao_logistica": "pendente",
  "pagina_venda": "pendente",
  "envio_produto": "pendente",
  "satisfacao_nota": null,
  "satisfacao_observacoes": null
}'::jsonb;