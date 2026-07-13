import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let payload: any
  try { payload = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const {
    docxBase64,
    filename,
    emailFinanceiro,
    nomeFinanceiro,
    modeloNome,
    consultorNome,
    razaoSocial,
    cnpj,
    cliente,
    valorTotal,
    orcamentoId,
    orcamentoNumero,
    pedidoId,
  } = payload || {}

  if (!docxBase64) {
    return new Response(JSON.stringify({ error: 'docxBase64 é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const to = (emailFinanceiro || '').trim()
  if (!to) {
    return new Response(JSON.stringify({ error: 'emailFinanceiro é obrigatório (configure no Editor de Contratos)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const raw = docxBase64.includes(',') ? docxBase64.split(',')[1] : docxBase64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const safeName = (filename || `contrato-${orcamentoId || pedidoId || 'sem-id'}.docx`).replace(/[^\w.\-]/g, '_')
  const path = `contratos-internos/${orcamentoId || pedidoId || 'sem-id'}-${Date.now()}-${safeName}`

  const { error: upErr } = await supabase.storage.from('contratos').upload(path, bytes, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  })
  if (upErr) {
    console.error('upload error', upErr)
    return new Response(JSON.stringify({ error: 'Falha ao subir DOCX: ' + upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: signed, error: sErr } = await supabase.storage.from('contratos').createSignedUrl(path, 60 * 60 * 24 * 14)
  if (sErr || !signed?.signedUrl) {
    return new Response(JSON.stringify({ error: 'Falha ao gerar link assinado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const idempotencyKey = `contrato-docx-${orcamentoId || pedidoId || 'x'}-${Date.now()}`

  const { data: invData, error: invErr } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'projeto-contrato-financeiro',
      recipientEmail: to,
      recipientName: nomeFinanceiro || undefined,
      messageId: idempotencyKey,
      idempotencyKey,
      templateData: {
        consultorNome: consultorNome || '',
        razaoSocial: razaoSocial || '',
        cnpj: cnpj || '',
        cliente: cliente || '',
        valorTotal: valorTotal || '',
        documentoUrl: signed.signedUrl,
        pdfUrl: signed.signedUrl,
        orcamentoNumero: orcamentoNumero || '',
        modeloNome: modeloNome || '',
      },
    },
  })

  if (invErr) {
    console.error('send email error', invErr)
    return new Response(JSON.stringify({ error: 'Falha ao enviar email: ' + invErr.message, url: signed.signedUrl }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (invData && typeof invData === 'object' && 'success' in invData && !invData.success) {
    return new Response(JSON.stringify({ error: 'Email não foi enfileirado para envio', url: signed.signedUrl, invoke: invData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let finalStatus = 'pending'
  let finalError = ''
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: logs, error: logErr } = await supabase
      .from('email_send_log')
      .select('status,error_message,created_at')
      .eq('message_id', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!logErr && logs?.[0]) {
      finalStatus = logs[0].status || 'pending'
      finalError = logs[0].error_message || ''
      if (['sent', 'dlq', 'failed', 'suppressed'].includes(finalStatus)) break
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  if (finalStatus !== 'sent') {
    const detail = finalStatus === 'pending'
      ? 'O email foi colocado na fila, mas ainda não confirmou envio. Tente novamente em instantes.'
      : `Status do envio: ${finalStatus}${finalError ? ` — ${finalError}` : ''}`
    return new Response(JSON.stringify({ error: detail, url: signed.signedUrl, invoke: invData, emailStatus: finalStatus }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ success: true, url: signed.signedUrl, invoke: invData, emailStatus: finalStatus }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})