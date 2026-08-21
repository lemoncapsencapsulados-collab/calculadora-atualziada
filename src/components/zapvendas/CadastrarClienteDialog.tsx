import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useClientes } from '@/hooks/useClientes';
import { jidParaTelefone, normalizarTelefone } from '@/hooks/useZapVendas';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface Erros {
  nome?: string;
  telefone?: string;
}

/**
 * Formata dígitos (DDD + número, já sem o `55` do país) num telefone
 * brasileiro legível. Só reconhece 10 (fixo) ou 11 (celular) dígitos —
 * exatamente os formatos que `normalizarTelefone` devolve; qualquer outro
 * comprimento (número incompleto, sem DDD) volta cru, sem tentar adivinhar.
 */
function formatarTelefoneBR(digitos: string): string {
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return digitos;
}

/**
 * Aplica a mesma máscara progressivamente, para o campo ficar legível
 * enquanto o usuário ainda está digitando (antes de completar 10/11 dígitos).
 */
function mascararTelefoneParcial(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (!digitos) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  if (digitos.length <= 10) {
    // Fixo (ou celular ainda incompleto): agrupa 4+4.
    return resto.length > 4 ? `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}` : `(${ddd}) ${resto}`;
  }
  // 11 dígitos completos: celular, agrupa 5+4.
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

interface CadastrarClienteDialogProps {
  /** `remoteJid` da conversa selecionada — vira o telefone pré-preenchido. */
  remoteJid: string;
  /** Nome do contato no WhatsApp, quando o aparelho o informa. */
  pushName?: string;
}

/**
 * Botão + diálogo para cadastrar, a partir de uma conversa sem cliente
 * casado, um cliente novo já preenchido com o que a conversa sabe (nome do
 * WhatsApp e telefone). Reaproveita a mutation `criarCliente` de
 * `useClientes` — nenhum insert novo em `clientes` aqui.
 *
 * O telefone pré-preenchido é calculado do mesmo jeito que
 * `encontrarClientePorJid` (em `ZapVendas.tsx`) normaliza o lado do WhatsApp,
 * e é isso que é gravado (a menos que o usuário edite o campo) — assim o
 * cliente recém-criado é reconhecido pelo casamento exato assim que a lista
 * de clientes recarrega, sem precisar do fallback por sufixo.
 */
export function CadastrarClienteDialog({ remoteJid, pushName }: CadastrarClienteDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const nomeInputRef = useRef<HTMLInputElement>(null);

  const { criarCliente } = useClientes();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Recalcula os valores padrão toda vez que o diálogo abre — cobre o caso
  // de o usuário abrir para conversas diferentes sem desmontar o componente.
  useEffect(() => {
    if (!open) return;

    const nomeInicial = (pushName || '').trim();
    const digitosJid = normalizarTelefone(jidParaTelefone(remoteJid));

    setNome(nomeInicial);
    setTelefone(formatarTelefoneBR(digitosJid));
    setErros({});

    if (!nomeInicial) {
      const id = requestAnimationFrame(() => nomeInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open, remoteJid, pushName]);

  const handleSalvar = () => {
    const nomeTrim = nome.trim();
    const digitosTelefone = telefone.replace(/\D/g, '');

    const novosErros: Erros = {};
    if (!nomeTrim) novosErros.nome = 'Informe o nome do cliente.';
    if (digitosTelefone.length < 10) {
      novosErros.telefone = 'Informe um telefone com DDD (mínimo 10 dígitos).';
    }
    setErros(novosErros);
    if (novosErros.nome || novosErros.telefone) return;

    criarCliente.mutate(
      {
        nome: nomeTrim,
        telefone: normalizarTelefone(digitosTelefone),
        tipo_pessoa: 'pf',
      },
      {
        onSuccess: () => {
          // O painel de CRM do ZapVendas deriva o cliente casado (e os
          // orçamentos/pedidos dele) destas três queries — invalidar as três
          // é o que faz o painel mostrar o cliente recém-criado sem reload.
          queryClient.invalidateQueries({ queryKey: ['clientes'] });
          queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
          queryClient.invalidateQueries({ queryKey: ['pedidos'] });
          toast({
            title: 'Cliente cadastrado',
            description: `${nomeTrim} foi adicionado ao CRM.`,
          });
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Cadastrar como cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cadastrar cliente</DialogTitle>
          <DialogDescription>
            Cria o cliente no CRM com os dados desta conversa. Você pode editar antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cadastrar-cliente-nome">Nome</Label>
            <Input
              id="cadastrar-cliente-nome"
              ref={nomeInputRef}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente"
              aria-invalid={!!erros.nome}
            />
            {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cadastrar-cliente-telefone">Telefone</Label>
            <Input
              id="cadastrar-cliente-telefone"
              className="num"
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefoneParcial(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              aria-invalid={!!erros.telefone}
            />
            {erros.telefone && <p className="text-xs text-destructive">{erros.telefone}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={criarCliente.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={criarCliente.isPending}>
            {criarCliente.isPending ? 'Salvando…' : 'Salvar cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
