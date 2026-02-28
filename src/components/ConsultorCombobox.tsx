import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useUsuarios } from '@/hooks/useUsuarios';
import GerenciarUsuariosDialog from '@/components/GerenciarUsuariosDialog';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function ConsultorCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [gerenciarOpen, setGerenciarOpen] = useState(false);
  const { data: usuarios = [] } = useUsuarios(true);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
          >
            {value || 'Selecione o consultor...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar consultor..." />
            <CommandList>
              <CommandEmpty>Nenhum consultor encontrado.</CommandEmpty>
              <CommandGroup>
                {usuarios.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.nome}
                    onSelect={() => {
                      onChange(u.nome);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === u.nome ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{u.nome}</span>
                      <span className="text-xs text-muted-foreground">{u.cargo}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setGerenciarOpen(true)}
        title="Gerenciar usuários"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <GerenciarUsuariosDialog
        open={gerenciarOpen}
        onOpenChange={setGerenciarOpen}
        onUsuarioCriado={(nome) => onChange(nome)}
      />
    </div>
  );
}
