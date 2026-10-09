import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Pote ou tampa fora do catálogo, descrito por extenso.
 *
 * Separado da cor de propósito. "PET 250ml âmbar, boca larga, com lacre de
 * indução" não é uma cor, e gravar isso em `cor_pote` faria o contrato
 * imprimir a frase inteira na linha "Cor do pote". São campos diferentes
 * porque dizem coisas diferentes, e o anexo do contrato tem linha própria
 * para cada um.
 *
 * O "marcado" é estado local, e não um booleano a mais no banco: o que vale
 * para o contrato é haver ou não descrição. Um booleano separado abriria a
 * chance de salvar "personalizado = sim" com o texto vazio, e o contrato
 * sairia com a linha em branco.
 */
export default function ItemPersonalizado({
  label,
  descricao,
  valor,
  placeholder,
  onChange,
}: {
  /** "Potes Personalizados" / "Tampas Personalizadas". */
  label: string;
  /** O que entra aqui, em uma linha. */
  descricao: string;
  valor: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [marcado, setMarcado] = useState(() => valor.trim().length > 0);

  // Texto que chega de fora (carregar um orçamento já salvo) abre a caixa.
  useEffect(() => {
    if (valor.trim().length > 0) setMarcado(true);
  }, [valor]);

  const id = `personalizado-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3">
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={marcado}
          onCheckedChange={(c) => {
            const ligado = c === true;
            setMarcado(ligado);
            // Desmarcar apaga o texto. Guardá-lo escondido o traria de volta
            // na próxima vez que alguém marcasse, e ele iria para o contrato
            // sem ninguém ter relido.
            if (!ligado) onChange('');
          }}
          className="mt-0.5"
        />
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>

      {marcado && (
        <Textarea
          autoFocus
          rows={2}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      )}
    </div>
  );
}
