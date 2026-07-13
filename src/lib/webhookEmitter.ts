import { supabase } from '@/integrations/supabase/client';

export type WebhookEvento =
  | 'pedido.criado'
  | 'pedido.atualizado'
  | 'pedido.concluido'
  | 'contrato.enviado'
  | 'contrato.assinado';

export async function emitWebhookEvent(evento: WebhookEvento, payload: unknown) {
  try {
    await supabase.functions.invoke('emit-webhook-event', { body: { evento, payload } });
  } catch (e) {
    console.warn('[emitWebhookEvent] falhou:', e);
  }
}