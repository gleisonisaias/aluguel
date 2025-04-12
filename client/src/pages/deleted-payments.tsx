import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, File, User, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface DeletedPayment {
  id: number;
  originalId: number;
  contractId: number;
  value: number;
  dueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  interestAmount: number;
  latePaymentFee: number;
  paymentMethod: string | null;
  receiptNumber: string | null;
  observations: string | null;
  deletedBy: number;
  originalCreatedAt: Date | null;
  deletedAt: Date;
  createdAt: Date | null;
}

interface User {
  id: number;
  name: string;
  username: string;
}

export default function DeletedPayments() {
  const [searchFilter, setSearchFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Buscar todos os pagamentos excluídos
  const { data: deletedPayments, isLoading, error } = useQuery<DeletedPayment[]>({
    queryKey: ["/api/deleted-payments"],
    retry: 1,
  });
  
  // Buscar todos os usuários para o filtro
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: 1,
  });
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-bold text-red-500">Erro ao carregar dados</h2>
          <p className="text-gray-600">Não foi possível carregar o histórico de pagamentos excluídos.</p>
          <Button className="mt-4" onClick={() => queryClient.invalidateQueries({queryKey: ["/api/deleted-payments"]})}>
            Tentar novamente
          </Button>
        </div>
      </Layout>
    );
  }
  
  // Removido o array columns para usar uma tabela HTML direta
  
  // Filtragem de dados
  const filteredData = deletedPayments?.filter(payment => {
    const searchTerms = searchFilter.toLowerCase();
    const matchesSearch = 
      (payment.receiptNumber?.toLowerCase().includes(searchTerms) || false) ||
      (payment.observations?.toLowerCase().includes(searchTerms) || false) ||
      String(payment.originalId).includes(searchTerms) ||
      String(payment.value).includes(searchTerms);
    
    const matchesContract = contractFilter ? String(payment.contractId) === contractFilter : true;
    const matchesUser = userFilter ? String(payment.deletedBy) === userFilter : true;
    
    return matchesSearch && matchesContract && matchesUser;
  }) || [];
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Histórico de Pagamentos Excluídos</h1>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtre os dados para encontrar pagamentos específicos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="search" className="text-sm font-medium">Busca geral</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar por ID, valor, obs..."
                    className="pl-8"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="contract" className="text-sm font-medium">Contrato</label>
                <Select value={contractFilter} onValueChange={setContractFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all-contracts" value="">Todos os contratos</SelectItem>
                    {Array.from(new Set(deletedPayments?.map(p => p.contractId))).map(contractId => (
                      <SelectItem key={contractId} value={String(contractId)}>
                        Contrato #{contractId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="user" className="text-sm font-medium">Usuário</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all-users" value="">Todos os usuários</SelectItem>
                    {users?.map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="bg-white rounded-md shadow overflow-x-auto">
          {filteredData.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-gray-500">Nenhum pagamento excluído encontrado</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">ID Original</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Contrato</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Valor</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Data de Vencimento</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Excluído por</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Data de Exclusão</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(payment => (
                  <tr key={payment.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">#{payment.originalId}</td>
                    <td className="py-3 px-4 text-sm">#{payment.contractId}</td>
                    <td className="py-3 px-4 text-sm font-medium">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(payment.value)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {format(new Date(payment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={payment.isPaid ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                        {payment.isPaid ? "Pago" : "Agendado"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {users?.find(u => u.id === payment.deletedBy)?.name || `Usuário #${payment.deletedBy}`}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {format(new Date(payment.deletedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => navigate(`/contracts/${payment.contractId}`)}
                          title="Ver contrato"
                        >
                          <File className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => navigate(`/users/${payment.deletedBy}`)}
                          title="Ver usuário"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}