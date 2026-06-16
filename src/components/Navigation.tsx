import { Link, useLocation } from 'react-router-dom';
import { Package, Calculator, FlaskConical, FileText, ClipboardList, DollarSign, Receipt, LayoutDashboard, LogOut, Menu, Users, Shield, HeartHandshake, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  onLogout?: () => void;
}

export function Navigation({ onLogout }: NavigationProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  const links = [
    { to: '/', label: 'Criação de Produto', icon: Calculator },
    { to: '/precificacao', label: 'Precificação de Produto', icon: DollarSign },
    { to: '/orcamentos', label: 'Orçamentos', icon: Receipt },
    { to: '/leads-orcamento', label: 'Leads Orçamento', icon: Users },
    { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
    { to: '/sucesso-cliente', label: 'Sucesso do Cliente', icon: HeartHandshake },
    { to: '/inventario', label: 'Inventário', icon: Package },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/painel-administrador', label: 'Painel Administrador', icon: Shield },
    { to: '/configuracao-contratos', label: 'Config. Contratos', icon: FileSignature },
  ];

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 py-3 lg:py-0">
          {/* Logo */}
          <div className="flex items-center gap-3 lg:py-4">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <FlaskConical className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-foreground leading-tight">Calculadora de Fórmulas</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Sistema de Cotação</p>
            </div>
          </div>
          
          {/* Desktop links - hidden below lg */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                    'hover:bg-secondary/80',
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{link.label}</span>
                </Link>
              );
            })}
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-2"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sair</span>
              </button>
            )}
          </div>

          {/* Mobile/Tablet hamburger - shown below lg */}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile/Tablet Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-primary-foreground" />
              </div>
              Calculadora de Fórmulas
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col py-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 font-medium transition-all',
                    'hover:bg-secondary/80',
                    isActive 
                      ? 'bg-primary/10 text-primary border-r-2 border-primary' 
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
          {onLogout && (
            <div className="border-t p-4 mt-auto">
              <button
                onClick={() => { onLogout(); setOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium transition-all text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </nav>
  );
}
