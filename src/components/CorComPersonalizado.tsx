import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2 } from 'lucide-react';

/** Valor do item de menu; nunca e' gravado -- so' liga o modo digitado. */
const PERSONALIZADO = '__personalizado__';

interface Props {
  label: string;
  valor: string;
  opcoes: string[];
  onChange: (v: string) => void;
}

/**
 * Cor a partir de uma lista, com escape para digitar uma fora dela.
 *
 * A lista padroniza o comum; o campo livre cobre a cor que o cliente pediu e a
 * fabrica aceita, sem obrigar a cadastrar uma opcao nova para cada pedido.
 * O valor gravado e' sempre o texto da cor -- quem le' depois nao precisa saber
 * se veio da lista ou foi digitado.
 */
export default function CorComPersonalizado({ label, valor, opcoes, onChange }: Props) {
  // Valor fora da lista so' pode ter vindo de um preenchimento personalizado.
  const [digitando, setDigitando] = useState(() => !!valor && !opcoes.includes(valor));

  useEffect(() => {
    if (valor && !opcoes.includes(valor)) setDigitando(true);
  }, [valor, opcoes]);

  if (digitando) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={valor}
            placeholder="Digite a cor"
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Voltar para a lista"
            onClick={() => {
              setDigitando(false);
              onChange('');
            }}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select
        value={opcoes.includes(valor) ? valor : ''}
        onValueChange={(v) => {
          if (v === PERSONALIZADO) {
            setDigitando(true);
            onChange('');
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          <SelectItem value={PERSONALIZADO}>Personalizado…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
