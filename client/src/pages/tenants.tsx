import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Plus, Search, Pencil, Trash2, X, UserRound, 
  Eye, EyeOff, ToggleLeft, ToggleRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tenant } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tenantFormSchema } from "@/utils/validation";
import { z } from "zod";
import AddressForm from "@/components/ui/address-form";
import { formatCPF, formatPhone } from "@/utils/validation";
import { Switch } from "@/components/ui/switch";

type TenantFormValues = z.infer<typeof tenantFormSchema>;

const Tenants = () => {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGuarantor, setShowGuarantor] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for new/edit tenant
  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "",
      document: "",
      rg: "",
      email: "",
      phone: "",
      address: {
        zipCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      guarantor: {
        name: "",
        document: "",
        phone: "",
        email: "",
      },
    },
  });

  // Get all tenants
  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['/api/tenants', { showInactive }],
    queryFn: async () => {
      const res = await fetch(`/api/tenants${showInactive ? '?showInactive=true' : ''}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar inquilinos');
      }
      return res.json();
    },
    onError: () => {
      toast({
        title: "Erro ao carregar inquilinos",
        description: "Não foi possível carregar a lista de inquilinos",
        variant: "destructive",
      });
    }
  });
  
  // Activate tenant mutation
  const activateTenantMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/tenants/${id}/activate`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Inquilino ativado",
        description: "O inquilino foi ativado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao ativar inquilino",
        description: error.message || "Ocorreu um erro ao ativar o inquilino",
        variant: "destructive",
      });
    }
  });
  
  // Deactivate tenant mutation
  const deactivateTenantMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/tenants/${id}/deactivate`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Inquilino desativado",
        description: "O inquilino foi desativado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao desativar inquilino",
        description: error.message || "Ocorreu um erro ao desativar o inquilino",
        variant: "destructive",
      });
    }
  });

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (data: TenantFormValues) => {
      const response = await apiRequest('POST', '/api/tenants', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Inquilino adicionado",
        description: "O inquilino foi adicionado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      resetFormAndState();
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar inquilino",
        description: error.message || "Ocorreu um erro ao adicionar o inquilino",
        variant: "destructive",
      });
    }
  });

  // Update tenant mutation
  const updateTenantMutation = useMutation({
    mutationFn: async (data: { id: number; data: TenantFormValues }) => {
      const response = await apiRequest('PATCH', `/api/tenants/${data.id}`, data.data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Inquilino atualizado",
        description: "O inquilino foi atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      resetFormAndState();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar inquilino",
        description: error.message || "Ocorreu um erro ao atualizar o inquilino",
        variant: "destructive",
      });
    }
  });

  // Delete tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/tenants/${id}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Inquilino removido",
        description: "O inquilino foi removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      setIsDeleteAlertOpen(false);
      setSelectedTenant(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover inquilino",
        description: error.message || "Ocorreu um erro ao remover o inquilino",
        variant: "destructive",
      });
    }
  });

  // Reset form and state
  const resetFormAndState = () => {
    form.reset({
      name: "",
      document: "",
      rg: "",
      email: "",
      phone: "",
      address: {
        zipCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      },
      guarantor: {
        name: "",
        document: "",
        phone: "",
        email: "",
      },
    });
    setShowForm(false);
    setIsEditing(false);
    setSelectedTenant(null);
    setShowGuarantor(false);
  };

  // Submit handler for new/edit tenant
  const onSubmit = (data: TenantFormValues) => {
    // If guarantor section is hidden or empty, remove guarantor data
    if (!showGuarantor || !data.guarantor?.name) {
      data.guarantor = undefined;
    }

    if (isEditing && selectedTenant) {
      updateTenantMutation.mutate({ id: selectedTenant.id, data });
    } else {
      createTenantMutation.mutate(data);
    }
  };

  // Handle document (CPF) input mask
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCPF = formatCPF(e.target.value);
    form.setValue("document", formattedCPF);
  };

  // Handle phone input mask
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhone(e.target.value);
    form.setValue("phone", formattedPhone);
  };

  // Handle guarantor document input mask
  const handleGuarantorDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCPF = formatCPF(e.target.value);
    form.setValue("guarantor.document", formattedCPF);
  };

  // Handle guarantor phone input mask
  const handleGuarantorPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhone(e.target.value);
    form.setValue("guarantor.phone", formattedPhone);
  };
  
  // Handle toggling tenant active status
  const handleToggleTenantStatus = (tenant: Tenant) => {
    if (tenant.isActive) {
      deactivateTenantMutation.mutate(tenant.id);
    } else {
      activateTenantMutation.mutate(tenant.id);
    }
  };

  // Open edit form with selected tenant data
  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsEditing(true);
    
    // Format the data to match the form structure
    const address = typeof tenant.address === 'string' 
      ? JSON.parse(tenant.address) 
      : tenant.address;
    
    // Parse guarantor from string if needed
    const guarantor = tenant.guarantor && typeof tenant.guarantor === 'string'
      ? JSON.parse(tenant.guarantor)
      : tenant.guarantor || {
          name: "",
          document: "",
          phone: "",
          email: "",
        };
    
    setShowGuarantor(!!tenant.guarantor);
    
    form.reset({
      ...tenant,
      address,
      guarantor,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open delete confirmation
  const handleDeleteTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDeleteAlertOpen(true);
  };

  // Show new tenant form
  const handleAddNewTenant = () => {
    resetFormAndState();
    setShowForm(true);
    setIsEditing(false);
  };

  // Filter tenants based on search query
  const filteredTenants = tenants?.filter(tenant => 
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.document.includes(searchQuery) ||
    tenant.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="mb-1 text-sm text-neutral-500">Gerenciar cadastros</div>
        <h1 className="text-2xl font-semibold text-neutral-900">Inquilinos</h1>
        <p className="text-neutral-600 mt-1">Gerenciar cadastros de inquilinos</p>
      </div>

      {/* Form Card */}
      {showForm && (
        <Card className="border border-neutral-200 shadow-sm mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{isEditing ? "Editar Inquilino" : "Adicionar Inquilino"}</CardTitle>
                <CardDescription>
                  {isEditing 
                    ? "Atualize as informações do inquilino" 
                    : "Cadastre um novo inquilino no sistema"}
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetFormAndState}
                title="Fechar formulário"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="José Silva" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="document"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="123.456.789-00" 
                            onChange={handleDocumentChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="12.345.678-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="(11) 98765-4321" 
                            onChange={handlePhoneChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="jose@exemplo.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <AddressForm control={form.control} namePrefix="address" />
                
                <div className="flex flex-row items-center space-x-2 py-4">
                  <Switch 
                    checked={showGuarantor} 
                    onCheckedChange={setShowGuarantor} 
                    id="add-guarantor"
                  />
                  <label
                    htmlFor="add-guarantor"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Adicionar fiador
                  </label>
                </div>
                
                {showGuarantor && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 p-4 bg-slate-50 rounded-md border border-slate-200">
                    <div className="sm:col-span-2 mb-2">
                      <h3 className="font-medium text-slate-900">Dados do Fiador</h3>
                      <p className="text-sm text-slate-500">Preencha os dados do fiador/garantidor</p>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="guarantor.name"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Nome do Fiador</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="João Silva" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="guarantor.document"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF do Fiador</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="123.456.789-00" 
                              onChange={handleGuarantorDocumentChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="guarantor.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone do Fiador</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="(11) 98765-4321" 
                              onChange={handleGuarantorPhoneChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="guarantor.email"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Email do Fiador</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="joao@exemplo.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFormAndState}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createTenantMutation.isPending || updateTenantMutation.isPending}
                  >
                    {(createTenantMutation.isPending || updateTenantMutation.isPending) 
                      ? "Salvando..." 
                      : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:justify-between gap-4 items-start md:items-center mb-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <Input
              placeholder="Buscar inquilinos..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              id="show-inactive-tenants" 
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <label 
              htmlFor="show-inactive-tenants" 
              className="text-sm cursor-pointer text-neutral-600"
            >
              {showInactive ? (
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" /> Mostrando inativos
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <EyeOff className="h-4 w-4" /> Mostrar inativos
                </span>
              )}
            </label>
          </div>
        </div>
        <Button 
          onClick={handleAddNewTenant}
          disabled={showForm}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar Inquilino
        </Button>
      </div>

      {/* Tenants List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="border border-neutral-200 shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <div className="flex justify-end mt-4">
                  <Skeleton className="h-9 w-20 mr-2" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card className="border border-neutral-200 shadow-sm">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-neutral-100 p-3 mb-4">
              <UserRound className="h-6 w-6 text-neutral-500" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Nenhum inquilino encontrado</h3>
            <p className="text-neutral-500 max-w-md">
              {searchQuery 
                ? "Não foram encontrados inquilinos correspondentes à sua pesquisa. Tente com outros termos."
                : "Você ainda não cadastrou nenhum inquilino. Clique no botão 'Adicionar Inquilino' para começar."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const address = typeof tenant.address === 'string' 
              ? JSON.parse(tenant.address) 
              : tenant.address;
              
            const isInactive = tenant.isActive === false;
            
            return (
              <Card 
                key={tenant.id} 
                className={`border shadow-sm ${
                  isInactive 
                    ? "border-neutral-200 bg-neutral-50" 
                    : "border-neutral-200"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`text-lg font-medium ${
                      isInactive ? "text-neutral-500" : "text-neutral-900"
                    }`}>
                      {tenant.name}
                    </h3>
                    <div className={`text-xs rounded-full px-2 py-1 font-medium ${
                      isInactive 
                        ? "bg-neutral-100 text-neutral-500" 
                        : "bg-green-50 text-green-700"
                    }`}>
                      {isInactive ? "Inativo" : "Ativo"}
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 mb-1"><strong>CPF/CNPJ:</strong> {tenant.document}</p>
                  <p className="text-sm text-neutral-600 mb-1"><strong>Email:</strong> {tenant.email}</p>
                  <p className="text-sm text-neutral-600 mb-1"><strong>Telefone:</strong> {tenant.phone}</p>
                  <p className="text-sm text-neutral-600 mb-1 truncate">
                    <strong>Endereço:</strong> {address.street}, {address.number}
                    {address.complement && `, ${address.complement}`} - {address.city}/{address.state}
                  </p>
                  <div className="flex justify-between mt-4">
                    <Button 
                      variant={isInactive ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => handleToggleTenantStatus(tenant)}
                      disabled={activateTenantMutation.isPending || deactivateTenantMutation.isPending}
                      className={`${isInactive ? "text-green-600 border-green-200 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                    >
                      {isInactive ? (
                        <><ToggleRight className="h-4 w-4 mr-1" /> Ativar</>
                      ) : (
                        <><ToggleLeft className="h-4 w-4 mr-1" /> Desativar</>
                      )}
                    </Button>
                    <div className="flex">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mr-2"
                        onClick={() => handleEditTenant(tenant)}
                      >
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteTenant(tenant)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o inquilino {selectedTenant?.name}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedTenant && deleteTenantMutation.mutate(selectedTenant.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTenantMutation.isPending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Tenants;