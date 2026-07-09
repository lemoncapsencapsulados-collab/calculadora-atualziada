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
      idempotencyKey,
      templateData: {
        consultorNome: consultorNome || '',
        razaoSocial: razaoSocial || '',
        cnpj: cnpj || '',
        cliente: cliente || '',
        valorTotal: valorTotal || '',
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

  return new Response(JSON.stringify({ success: true, url: signed.signedUrl, invoke: invData }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})