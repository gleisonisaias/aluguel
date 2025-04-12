import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/dashboard";
import Owners from "@/pages/owners";
import Tenants from "@/pages/tenants";
import Properties from "@/pages/properties";
import Contracts from "@/pages/contracts";
import Payments from "@/pages/payments";
import Reports from "@/pages/reports";
import UserAdmin from "@/pages/user-admin";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Rotas protegidas que exigem autenticação */}
      <ProtectedRoute path="/" component={() => (
        <Layout>
          <Dashboard />
        </Layout>
      )} />
      <ProtectedRoute path="/proprietarios" component={() => (
        <Layout>
          <Owners />
        </Layout>
      )} />
      <ProtectedRoute path="/inquilinos" component={() => (
        <Layout>
          <Tenants />
        </Layout>
      )} />
      <ProtectedRoute path="/imoveis" component={() => (
        <Layout>
          <Properties />
        </Layout>
      )} />
      <ProtectedRoute path="/contratos" component={() => (
        <Layout>
          <Contracts />
        </Layout>
      )} />
      <ProtectedRoute path="/pagamentos" component={() => (
        <Layout>
          <Payments />
        </Layout>
      )} />
      <ProtectedRoute path="/relatorios" component={() => (
        <Layout>
          <Reports />
        </Layout>
      )} />
      
      <ProtectedRoute path="/pagamentos-excluidos" component={() => {
        // Redirecionamento para a página de relatórios com o filtro de pagamentos excluídos
        window.location.href = "/relatorios?tipo=deleted-payments";
        return null;
      }} />
      
      {/* Rota de administração de usuários (apenas para administradores) */}
      <ProtectedRoute path="/admin/usuarios" component={() => (
        <Layout>
          <UserAdmin />
        </Layout>
      )} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
