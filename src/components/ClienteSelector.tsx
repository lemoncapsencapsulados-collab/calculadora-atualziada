import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, X, User, Phone, AlertTriangle } from 'lucide-react';
import { useClientes, Cliente, ClienteInsert } from '@/hooks/useClientes';
import { toast } from 'sonner';

interface ClienteSelectorProps {
  modo: 'basico' | 'completo';
  clienteSelecionado?: Cliente | null;
  onSelect: (cliente: Cliente) => void;
  onClear: () => void;
  onNovo?: () => void;
  className?: string;
}

export default function ClienteSelector({ modo, clienteSelecionado, onSelect, onClear, onNovo, className }: ClienteSelectorProps) {
  const { clientes, criarCliente, buscarClientes, buscarPorTelefone, atualizarCliente } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCriarDialog, setShowCriarDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Novo cliente form
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');

  // Merge PF→PJ dialog
  const [mergeDialog, setMergeDialog] = useState<{ clienteExistente: Cliente; novosDados: ClienteInsert } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(async (termo: string) => {
    if (termo.length < 2) {
      setResultados([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await buscarClientes(termo);
      setResultados(results);
      setShowDropdown(results.length > 0 || termo.length >= 2);
    } catch {
      setResultados([]);
    } finally {
      setIsSearching(false);
    }
  }, [buscarClientes]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, handleSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCliente = (cliente: Cliente) => {
    onSelect(cliente);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleCriarNovo = async () => {
    if (!novoNome.trim() || !novoTelefone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    const telLimpo = novoTelefone.replace(/\D/g, '');

    // Check if phone already exists
    const existente = await buscarPorTelefone(telLimpo);
    if (existente) {
      // Same phone - ask to select existing
      toast.info(`Cliente "${existente.nome}" já existe com este telefone.`);
      handleSelectCliente(existente);
      setShowCriarDialog(false);
      setNovoNome('');
      setNovoTelefone('');
      return;
    }

    try {
      const novo = await criarCliente.mutateAsync({
        nome: novoNome.trim(),
        telefone: novoTelefone.trim(),
        tipo_pessoa: 'pf',
      });
      toast.success('Cliente criado com sucesso!');
      handleSelectCliente(novo);
      setShowCriarDialog(false);
      setNovoNome('');
      setNovoTelefone('');
    } catch {
      // error handled in hook
    }
  };

  const formatTelefone = (tel: string) => {
    if (!tel) return '';
    const nums = tel.replace(/\D/g, '');
    if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
    return tel;
  };

  if (clienteSelecionado) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-md border bg-muted/30 ${className || ''}`}>
        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{clienteSelecionado.nome}</p>
          <p className="text-xs text-muted-foreground">
            {formatTelefone(clienteSelecionado.telefone)}
            {clienteSelecionado.razao_social && ` • ${clienteSelecionado.razao_social}`}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] flex-shrink-0">
          {clienteSelecionado.tipo_pessoa === 'pj' ? 'PJ' : 'PF'}
        </Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => { if (searchTerm.length >= 2) setShowDropdown(true); }}
          placeholder="Buscar cliente por nome, telefone, CPF, CNPJ..."
          className="pl-9 pr-24"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
          onClick={() => {
            setNovoNome(searchTerm);
            setShowCriarDialog(true);
          }}
        >
          <Plus className="w-3 h-3 mr-1" /> Novo
        </Button>
      </div>

      {showDropdown && (
        <Card className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto shadow-lg">
          {resultados.length > 0 ? (
            resultados.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 border-b last:border-0"
                onClick={() => handleSelectCliente(c)}
              >
                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatTelefone(c.telefone)}
                    {c.razao_social && ` • ${c.razao_social}`}
                    {c.cpf && ` • CPF: ${c.cpf}`}
                    {c.cnpj && ` • CNPJ: ${c.cnpj}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {c.tipo_pessoa === 'pj' ? 'PJ' : 'PF'}
                </Badge>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {isSearching ? 'Buscando...' : 'Nenhum cliente encontrado'}
            </div>
          )}
        </Card>
      )}

      {/* Dialog para criar novo cliente */}
      <Dialog open={showCriarDialog} onOpenChange={setShowCriarDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Novo Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">Nome <span className="text-destructive">*</span></Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Telefone <span className="text-destructive">*</span></Label>
              <Input
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCriarDialog(false)}>Cancelar</Button>
            <Button onClick={handleCriarNovo} disabled={criarCliente.isPending}>
              {criarCliente.isPending ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
