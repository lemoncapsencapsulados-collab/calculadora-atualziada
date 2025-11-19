import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/unitConversion';
import { cn } from '@/lib/utils';
import { Insumo } from '@/types/formula';

interface InsumoAutocompleteProps {
  insumos: Insumo[];
  value: string;
  onSelect: (insumo: Insumo) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function InsumoAutocomplete({
  insumos,
  value,
  onSelect,
  placeholder = 'Selecione um insumo...',
  disabled = false,
}: InsumoAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredInsumos = useMemo(() => {
    if (!search) return insumos.slice(0, 10);
    
    const searchLower = search.toLowerCase();
    return insumos
      .filter(
        (insumo) =>
          insumo.nome.toLowerCase().includes(searchLower) ||
          insumo.categoria?.toLowerCase().includes(searchLower)
      )
      .slice(0, 10);
  }, [insumos, search]);

  const selectedInsumo = insumos.find((i) => i.nome === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar insumo..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum insumo encontrado.</CommandEmpty>
            <CommandGroup>
              {filteredInsumos.map((insumo) => (
                <CommandItem
                  key={insumo.id}
                  value={insumo.nome}
                  onSelect={() => {
                    onSelect(insumo);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === insumo.nome ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{insumo.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {insumo.categoria} • {formatCurrency(insumo.preco_por_unidade_compra)}/{insumo.unidade_compra}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
