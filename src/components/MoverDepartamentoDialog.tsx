import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ArrowRightLeft, BookmarkCheck, FileText, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ClienteSelector from '@/components/ClienteSelector';
import SenhaAdminDialog from '@/components/SenhaAdminDialog';
import type { Cliente } from '@/hooks/useClientes';
import {
  CLIENTE_SELECAO,
  type Departamento,
  DEPARTAMENTO_LABEL,
  departamentoDoCliente,
} from '@/lib/linhaProduto';
import { CLIENTE_CATALOGO } from '@/components/SalvarCalculoDialog';
import { NICHOS, NICHO_TEMA, type NichoLoja } from '@/lib/catalogoLoja';

interface Props {
  formulaId: string;
  nomeFormula: string;
  clienteAtual: string | null | undefined;
  nichoAtual?: string | null;
  onFechar: () => void;
  onMovido?: () => void;
}

const OPCOES: { valor: Departamento; icone: typeof FileText; descricao: string }[] = [
  {
    valor: 'private_label',
    icone: FileText,
    descricao: 'Fórmula personalizada, vinculada a um cliente.',
  },
  {
    valor: 'white_label',
    icone: Star,
    descricao: 'Catálogo Lemon, disponível para qualquer cliente.',
  },
  {
    valor: 'selecao_lemoncaps',
    icone: BookmarkCheck,
    descricao: 'Prateleira escolhida a dedo, separada do catálogo.',
  },
];

/**
 * Move uma fórmula já precificada de uma prateleira para outra.
 *
 * A prateleira é o nome do cliente da fórmula, então mover é trocar esse nome.
 * Nos dois sentidos da casa é direto -- o nome é constante. Voltar para Private
 * Label não é: o nome do cliente original se perdeu quando a fórmula virou
 * catálogo, então é preciso dizer de quem ela passa a ser. Sem isso a fórmula
 * ficaria sem dono, com o preço de catálogo, no meio das personalizadas.
 */
export default function MoverDepartamentoDialog({
  formulaId,
  nomeFormula,
  clienteAtual,
  nichoAtual,
  onFechar,
  onMovido,
}: Props) {
  const atual = departamentoDoCliente(clienteAtual);
  const [destino, setDestino] = useState<Departamento>(atual);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nicho, setNicho] = useState<NichoLoja | null>((nichoAtual as NichoLoja) || null);
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vaiParaCasa = destino === 'white_label' || destino === 'selecao_lemoncaps';
  const faltaCliente = destino === 'private_label' && !cliente;
  const faltaNicho = vaiParaCasa && !nicho;
  const semMudanca = destino === atual;

  const mover = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const nomeCliente =
        destino === 'white_label'
          ? CLIENTE_CATALOGO
          : destino === 'selecao_lemoncaps'
            ? CLIENTE_SELECAO
            : cliente?.nome || '';

      const { error } = await supabase
        .from('formulas')
        .update({
          cliente: nomeCliente,
          // Prateleira da casa não pertence a cliente nenhum; Private Label sim.
          cliente_id: destino === 'private_label' ? cliente?.id ?? null : null,
          nicho: vaiParaCasa ? nicho : null,
        })
        .eq('id', formulaId);
      if (error) throw error;

      onMovido?.();
      onFechar();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível mover a fórmula.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Mover de prateleira
          </DialogTitle>
          <DialogDescription>
            {nomeFormula} — hoje em <strong>{DEPARTAMENTO_LABEL[atual]}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {OPCOES.map(({ valor, icone: Icone, descricao }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setDestino(valor)}
                className={cn(
                  'rounded-lg border-2 p-3 text-left transition-all',
                  destino === valor
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icone className="h-4 w-4" />
                  {DEPARTAMENTO_LABEL[valor].replace(/ \(.*\)$/, '')}
                  {valor === atual && (
                    <span className="text-[10px] font-normal text-muted-foreground">(atual)</span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{descricao}</span>
              </button>
            ))}
          </div>

          {destino === 'private_label' && (
            <div className="space-y-1">
              <Label className="text-sm font-semibold">
                De qual cliente passa a ser? <span className="text-destructive">*</span>
              </Label>
              <ClienteSelector
                modo="basico"
                clienteSelecionado={cliente}
                onSelect={setCliente}
                onClear={() => setCliente(null)}
              />
              <p className="text-xs text-muted-foreground">
                O nome do cliente original se perdeu quando a fórmula foi para a prateleira da
                casa, então é preciso dizer de quem ela passa a ser.
              </p>
            </div>
          )}

          {vaiParaCasa && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Nicho <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {NICHOS.map(({ id, nome }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNicho(id)}
                    className={cn(
                      'rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all',
                      nicho === id ? NICHO_TEMA[id].chipAtivo : NICHO_TEMA[id].chipInativo,
                    )}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{erro}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={() => setPedindoSenha(true)}
            disabled={semMudanca || faltaCliente || faltaNicho || salvando}
          >
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Movendo…
              </>
            ) : semMudanca ? (
              'Escolha outra prateleira'
            ) : faltaCliente ? (
              'Escolha o cliente'
            ) : faltaNicho ? (
              'Escolha o nicho'
            ) : (
              `Mover para ${DEPARTAMENTO_LABEL[destino].replace(/ \(.*\)$/, '')}`
            )}
          </Button>
        </DialogFooter>

        <SenhaAdminDialog
          open={pedindoSenha}
          onOpenChange={setPedindoSenha}
          descricao={`Mover "${nomeFormula}" de ${DEPARTAMENTO_LABEL[atual]} para ${DEPARTAMENTO_LABEL[destino]} muda o que os consultores enxergam, e precisa de senha de administrador.`}
          onConfirmar={() => void mover()}
        />
      </DialogContent>
    </Dialog>
  );
}
