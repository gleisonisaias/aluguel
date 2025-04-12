import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserRound,
  Home,
  FileText,
  BanknoteIcon,
  BarChart3,
  LogOut,
  UserCog,
  HistoryIcon,
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Proprietários", href: "/proprietarios", icon: Users },
  { name: "Inquilinos", href: "/inquilinos", icon: UserRound },
  { name: "Imóveis", href: "/imoveis", icon: Home },
  { name: "Contratos", href: "/contratos", icon: FileText },
  { name: "Pagamentos", href: "/pagamentos", icon: BanknoteIcon },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

const Sidebar = () => {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  // Função para obter as iniciais do nome do usuário
  const getUserInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-64 bg-white border-r border-neutral-200 flex-shrink-0 hidden md:flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-neutral-800">ImovelGest</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul>
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name} className="mb-1">
                <Link href={item.href}>
                  <a
                    className={cn(
                      "flex items-center px-6 py-3 text-neutral-700 hover:bg-primary-50 hover:text-primary-600 rounded-md group transition-colors",
                      isActive && "border-l-4 border-primary-500 bg-primary-50 text-primary-600"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 mr-3", isActive && "text-primary-500")} />
                    <span>{item.name}</span>
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-neutral-200">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between px-3 hover:bg-primary-50">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium truncate max-w-[150px]">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span>
                  </div>
                </div>
                <UserCog className="h-4 w-4 text-neutral-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.role === 'admin' && (
                <>
                  <Link href="/admin/usuarios">
                    <a className="w-full">
                      <DropdownMenuItem className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Gerenciar Usuários</span>
                      </DropdownMenuItem>
                    </a>
                  </Link>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/auth">
            <a className="w-full">
              <Button variant="outline" className="w-full">
                Entrar
              </Button>
            </a>
          </Link>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
