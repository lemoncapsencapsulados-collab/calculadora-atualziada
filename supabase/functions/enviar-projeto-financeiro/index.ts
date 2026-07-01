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

  const { pdfBase64, filename, consultorNome, razaoSocial, cnpj, cliente, valorTotal, orcamentoId, orcamentoNumero } = payload || {}
  if (!pdfBase64) {
    return new Response(JSON.stringify({ error: 'pdfBase64 é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Decode base64 → Uint8Array
  const raw = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const safeName = (filename || `projeto-${orcamentoId || 'sem-id'}.pdf`).replace(/[^\w.\-]/g, '_')
  const path = `projetos/${orcamentoId || 'sem-id'}-${Date.now()}-${safeName}`

  const { error: upErr } = await supabase.storage.from('contratos').upload(path, bytes, {
    contentType: 'application/pdf', upsert: true,
  })
  if (upErr) {
    console.error('upload error', upErr)
    return new Response(JSON.stringify({ error: 'Falha ao subir PDF: ' + upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: signed, error: sErr } = await supabase.storage.from('contratos').createSignedUrl(path, 60 * 60 * 24 * 7)
  if (sErr || !signed?.signedUrl) {
    return new Response(JSON.stringify({ error: 'Falha ao gerar link assinado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const idempotencyKey = `projeto-financeiro-${orcamentoId || 'x'}-${Date.now()}`

  const { data: invData, error: invErr } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'projeto-contrato-financeiro',
      recipientEmail: 'financeiro@lemoncaps.com.br',
      idempotencyKey,
      templateData: {
        consultorNome: consultorNome || '',
        razaoSocial: razaoSocial || '',
        cnpj: cnpj || '',
        cliente: cliente || '',
        valorTotal: valorTotal || '',
        pdfUrl: signed.signedUrl,
        orcamentoNumero: orcamentoNumero || '',
      },
    },
  })

  if (invErr) {
    console.error('send email error', invErr)
    return new Response(JSON.stringify({ error: 'Falha ao enviar email: ' + invErr.message, pdfUrl: signed.signedUrl }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ success: true, pdfUrl: signed.signedUrl, invoke: invData }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})