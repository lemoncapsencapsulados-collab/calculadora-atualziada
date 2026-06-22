import { Link, useLocation } from 'react-router-dom';
import { Package, Calculator, FlaskConical, FileText, ClipboardList, DollarSign, Receipt, LayoutDashboard, LogOut, Menu, Users, Shield, HeartHandshake, FileSignature, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavigationProps {
  onLogout?: () => void;
}

export function Navigation({ onLogout }: NavigationProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  const links = [
    { to: '/', label: 'Criação de Produto', short: 'Criação', icon: Calculator },
    { to: '/precificacao', label: 'Precificação de Produto', short: 'Precificação', icon: DollarSign },
    { to: '/orcamentos', label: 'Orçamentos', short: 'Orçamentos', icon: Receipt },
    { to: '/leads-orcamento', label: 'Leads Orçamento', short: 'Leads', icon: Users },
    { to: '/pedidos', label: 'Pedidos', short: 'Pedidos', icon: ClipboardList },
    { to: '/sucesso-cliente', label: 'Sucesso do Cliente', short: 'Sucesso', icon: HeartHandshake },
    { to: '/inventario', label: 'Inventário', short: 'Inventário', icon: Package },
    { to: '/dashboard', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard },
    { to: '/painel-administrador', label: 'Painel Administrador', short: 'Admin', icon: Shield },
    { to: '/configuracao-contratos', label: 'Config. Contratos', short: 'Contratos', icon: FileSignature },
    { to: '/vhsys-logs', label: 'Logs VHSys', short: 'VHSys', icon: Webhook },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between gap-3 h-14 lg:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                <FlaskConical className="w-5 h-5 lg:w-[22px] lg:h-[22px] text-primary-foreground" />
              </div>
              <div className="hidden sm:block min-w-0">
                <h1 className="text-sm lg:text-base font-bold text-foreground leading-tight whitespace-nowrap">Calculadora de Fórmulas</h1>
                <p className="text-[11px] text-muted-foreground leading-tight hidden md:block">Sistema de Cotação</p>
              </div>
            </Link>

            {/* Desktop nav (lg+): icon-only with tooltips. At 2xl: shows short label too */}
            <div className="hidden lg:flex items-center gap-0.5 ml-auto">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Tooltip key={link.to}>
                    <TooltipTrigger asChild>
                      <Link
                        to={link.to}
                        aria-label={link.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 2xl:px-3 h-10 rounded-md font-medium transition-all whitespace-nowrap',
                          'hover:bg-secondary text-muted-foreground hover:text-foreground',
                          isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm',
                        )}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className="hidden 2xl:inline text-[13px]">{link.short}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="2xl:hidden">{link.label}</TooltipContent>
                  </Tooltip>
                );
              })}

              {onLogout && (
                <>
                  <div className="w-px h-6 bg-border mx-1.5" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onLogout}
                        aria-label="Sair"
                        className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <LogOut className="w-[18px] h-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Sair</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Mobile/Tablet hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile/Tablet Sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-80 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                  <FlaskConical className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold leading-tight">Calculadora de Fórmulas</div>
                  <div className="text-[11px] text-muted-foreground font-normal">Sistema de Cotação</div>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-2">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-md font-medium transition-all text-sm',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
            {onLogout && (
              <div className="border-t p-3">
                <button
                  onClick={() => { onLogout(); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-md font-medium transition-all text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-sm"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </nav>
    </TooltipProvider>
  );
}
