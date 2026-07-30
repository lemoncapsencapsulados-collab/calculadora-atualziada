import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnvioClickUpResultado {
  ok: boolean;
  taskUrl?: string;
  erro?: string;
}

/** Envia uma demanda de marca para o quadro configurado no ClickUp */
export async function enviarDemandaClickUp(
  demandaId: string,
  numeroPedido: string,
): Promise<EnvioClickUpResultado> {
  const { data, error } = await supabase.functions.invoke('clickup-enviar-demanda', {
    body: { demanda_id: demandaId, numero_pedido: numeroPedido },
  });

  if (error) {
    let detalhe = error.message;
    try {
      const ctx: any = (error as any).context;
      if (ctx?.text) {
        const txt = await ctx.text();
        const parsed = JSON.parse(txt);
        detalhe = parsed?.error || txt;
      }
    } catch { /* mantém a mensagem original */ }
    toast.error(`Falha ao enviar para o ClickUp: ${detalhe}`);
    return { ok: false, erro: detalhe };
  }

  if (data?.error) {
    toast.error(`Falha ao enviar para o ClickUp: ${data.error}`);
    return { ok: false, erro: data.error };
  }

  if (Array.isArray(data?.anexosFalhos) && data.anexosFalhos.length) {
    toast.warning(`Task criada, mas alguns anexos falharam: ${data.anexosFalhos.join(', ')}`);
  } else {
    toast.success('Demanda enviada para o ClickUp!');
  }
  return { ok: true, taskUrl: data?.taskUrl };
}
