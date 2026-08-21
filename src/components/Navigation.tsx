import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Package, Calculator, FlaskConical, ClipboardList, DollarSign, Receipt,
  LayoutDashboard, LogOut, Menu, Users, Shield, HeartHandshake, FileSignature,
  Webhook, Mail, CreditCard, Megaphone, FileEdit, Truck, Search, ChevronDown, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTemPapel } from '@/hooks/useTemPapel';
import { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

interface NavigationProps {
  onLogout?: () => void;
}

type NavItem = { to: string; label: string; short: string; icon: typeof Calculator };

/* O fluxo diário — criar, precificar, orçar, pedir — fica sempre a um clique.
   O resto é agrupado por área, para reduzir 16 alvos soltos a 7 com significado. */
const PRIMARY: NavItem[] = [
  { to: '/', label: 'Criação de Produto', short: 'Criação', icon: Calculator },
  { to: '/precificacao', label: 'Precificação de Produto', short: 'Precificação', icon: DollarSign },
  { to: '/orcamentos', label: 'Orçamentos', short: 'Orçamentos', icon: Receipt },
  { to: '/pedidos', label: 'Pedidos', short: 'Pedidos', icon: ClipboardList },
];

/* ZapVendas expõe conversas de WhatsApp dos vendedores: só aparece para quem
   tem o papel. O RLS e a edge function barram de verdade — isto é interface. */
const ITEM_ZAPVENDAS: NavItem = {
  to: '/zapvendas', label: 'ZapVendas', short: 'ZapVendas', icon: MessageCircle,
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operação',
    items: [
      { to: '/leads-orcamento', label: 'Leads Orçamento', short: 'Leads', icon: Users },
      { to: '/logistica', label: 'Logística', short: 'Logística', icon: Truck },
      { to: '/inventario', label: 'Inventário', short: 'Inventário', icon: Package },
      { to: '/sucesso-cliente', label: 'Sucesso do Cliente', short: 'Sucesso', icon: HeartHandshake },
    ],
  },
  {
    label: 'Análise',
    items: [
      { to: '/dashboard', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard },
      { to: '/investimento-anuncios', label: 'Investimento em Anúncios', short: 'Anúncios', icon: Megaphone },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/painel-administrador', label: 'Painel Administrador', short: 'Admin', icon: Shield },
      { to: '/configuracao-contratos', label: 'Configuração de Contratos', short: 'Contratos', icon: FileSignature },
      { to: '/editor-contratos', label: 'Editor de Contratos', short: 'Editor', icon: FileEdit },
      { to: '/vhsys-logs', label: 'Logs VHSys', short: 'VHSys', icon: Webhook },
      { to: '/asaas-logs', label: 'Logs Asaas', short: 'Asaas', icon: CreditCard },
      { to: '/email-logs', label: 'Logs de Email', short: 'Emails', icon: Mail },
    ],
  },
];

export function Navigation({ onLogout }: NavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { temPapel: podeZapVendas } = useTemPapel('zapvendas');

  const grupos = useMemo(
    () =>
      GROUPS.map((g) =>
        g.label === 'Operação' && podeZapVendas
          ? { ...g, items: [...g.items, ITEM_ZAPVENDAS] }
          : g,
      ),
    [podeZapVendas],
  );

  const isActive = (to: string) => location.pathname === to;

  /* Onde estou: usado para marcar o grupo cujo filho está aberto. */
  const activeGroup = useMemo(
    () => grupos.findIndex((g) => g.items.some((i) => i.to === location.pathname)),
    [grupos, location.pathname],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setPaletteOpen(false);
    navigate(to);
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Camada translúcida: o conteúdo corre por baixo em vez de bater numa faixa opaca. */}
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto w-full max-w-[1600px] px-4 lg:px-6">
          <div className="flex h-14 items-center gap-2">
            {/* Marca */}
            <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Início">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[image:var(--gradient-accent)] shadow-soft ring-1 ring-inset ring-white/15">
                <FlaskConical className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
              </span>
              <span className="hidden min-w-0 leading-none sm:block">
                <span className="block text-[13px] font-semibold tracking-[-0.015em] text-foreground">
                  Calculadora
                </span>
                <span className="mt-[3px] block text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  LemonCaps
                </span>
              </span>
            </Link>

            <span className="mx-1 hidden h-5 w-px bg-border lg:block" aria-hidden />

            {/* Fluxo diário — sempre visível */}
            <div className="hidden items-center gap-0.5 lg:flex">
              {PRIMARY.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                return (
                  <Tooltip key={link.to}>
                    <TooltipTrigger asChild>
                      <Link
                        to={link.to}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
                          active
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                        <span className="hidden xl:inline">{link.short}</span>
                        {/* Assinatura: o traço citrus marca onde você está. */}
                        {active && (
                          <span
                            className="absolute inset-x-2.5 -bottom-[9px] h-[2px] rounded-full bg-citrus"
                            aria-hidden
                          />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="xl:hidden">{link.label}</TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Áreas agrupadas */}
              {grupos.map((group, gi) => {
                const groupActive = activeGroup === gi;
                return (
                  <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'group relative flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150',
                          'data-[state=open]:bg-secondary data-[state=open]:text-foreground',
                          groupActive
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        {group.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" strokeWidth={2.4} />
                        {groupActive && (
                          <span className="absolute inset-x-2.5 -bottom-[9px] h-[2px] rounded-full bg-citrus" aria-hidden />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={10} className="w-60 p-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.to);
                        return (
                          <DropdownMenuItem key={item.to} asChild>
                            <Link
                              to={item.to}
                              className={cn(
                                'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]',
                                active && 'bg-primary-soft font-medium text-primary',
                              )}
                            >
                              <Icon className="h-[16px] w-[16px] shrink-0 opacity-70" strokeWidth={2} />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>

            {/* Ações */}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card/60 pl-2.5 pr-2 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground md:flex"
                aria-label="Buscar telas"
              >
                <Search className="h-[15px] w-[15px]" strokeWidth={2.2} />
                <span className="hidden lg:inline">Buscar</span>
                <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline">
                  ⌘K
                </kbd>
              </button>

              {onLogout && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onLogout}
                      aria-label="Sair"
                      className="hidden h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive lg:grid"
                    >
                      <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Sair</TooltipContent>
                </Tooltip>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Paleta de comandos: 16 telas alcançáveis por digitação, sem caçar ícone. */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Ir para..." />
        <CommandList>
          <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
          <CommandGroup heading="Fluxo diário">
            {PRIMARY.map((item) => (
              <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)} className="gap-2.5">
                <item.icon className="h-4 w-4 opacity-70" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {grupos.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)} className="gap-2.5">
                  <item.icon className="h-4 w-4 opacity-70" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      {/* Mobile / tablet — mesmos grupos, para o mapa mental não mudar entre telas. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-[19rem] flex-col p-0">
          <SheetHeader className="border-b border-border px-4 py-3.5">
            <SheetTitle className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[image:var(--gradient-accent)] shadow-soft">
                <FlaskConical className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
              </span>
              <span className="text-left leading-none">
                <span className="block text-[13px] font-semibold">Calculadora</span>
                <span className="mt-[3px] block text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  LemonCaps
                </span>
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <p className="eyebrow px-3 pb-1.5">Fluxo diário</p>
            {PRIMARY.map((link) => (
              <MobileLink key={link.to} link={link} active={isActive(link.to)} onGo={() => setOpen(false)} />
            ))}
            {grupos.map((group) => (
              <div key={group.label} className="mt-4">
                <p className="eyebrow px-3 pb-1.5">{group.label}</p>
                {group.items.map((link) => (
                  <MobileLink key={link.to} link={link} active={isActive(link.to)} onGo={() => setOpen(false)} />
                ))}
              </div>
            ))}
          </div>

          {onLogout && (
            <div className="border-t border-border p-2.5">
              <button
                onClick={() => { onLogout(); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
              >
                <LogOut className="h-[17px] w-[17px]" strokeWidth={2} />
                Sair
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function MobileLink({ link, active, onGo }: { link: NavItem; active: boolean; onGo: () => void }) {
  const Icon = link.icon;
  return (
    <Link
      to={link.to}
      onClick={onGo}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-citrus" aria-hidden />}
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
      {link.label}
    </Link>
  );
}
