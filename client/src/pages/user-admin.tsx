import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, userValidationSchema } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

// Esquema de validação estendido para o formulário
const userFormSchema = userValidationSchema.extend({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
  passwordConfirm: z.string().optional(),
}).refine((data) => {
  // Se uma senha foi fornecida, a confirmação deve corresponder
  if (data.password) {
    return data.password === data.passwordConfirm;
  }
  return true;
}, {
  message: "As senhas não coincidem",
  path: ["passwordConfirm"]
});

type UserFormSchema = z.infer<typeof userFormSchema>;

export default function UserAdmin() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [confirmPasswordOpen, setConfirmPasswordOpen] = useState(false);

  // Consulta para buscar os usuários
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erro ao carregar usuários");
      return res.json();
    }
  });

  // Formulário
  const form = useForm<UserFormSchema>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      role: "user",
      password: "",
      passwordConfirm: "",
    }
  });

  // Ao editar um usuário, preenche o formulário
  const handleEditUser = (user: User) => {
    setEditUser(user);
    form.reset({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      password: "", // Não exibe a senha
      passwordConfirm: "",
    });
    setOpen(true);
  };

  // Ao adicionar um novo usuário, limpa o formulário
  const handleAddUser = () => {
    setEditUser(null);
    form.reset({
      username: "",
      name: "",
      email: "",
      role: "user",
      password: "",
      passwordConfirm: "",
    });
    setOpen(true);
  };

  // Mutação para criar um novo usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormSchema) => {
      // Remove o campo de confirmação de senha antes de enviar
      const { passwordConfirm, ...dataToSend } = userData;
      const res = await apiRequest("POST", "/api/admin/users", dataToSend);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpen(false);
      toast({
        title: "Usuário criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar um usuário existente
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserFormSchema & { id: number }) => {
      const { id, passwordConfirm, ...dataToSend } = userData;
      
      // Se a senha está vazia, não a envie
      if (!dataToSend.password) {
        delete dataToSend.password;
      }
      
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, dataToSend);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpen(false);
      toast({
        title: "Usuário atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para excluir um usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteUserId(null);
      toast({
        title: "Usuário excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar o status de um usuário
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Status do usuário atualizado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status do usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: UserFormSchema) => {
    if (editUser) {
      updateUserMutation.mutate({ ...values, id: editUser.id });
    } else {
      createUserMutation.mutate(values);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        <Button onClick={handleAddUser}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      <div className="bg-white rounded-md shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Nome de Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Login</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "destructive" : "outline"}>
                      {user.role === "admin" ? "Administrador" : "Usuário"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={user.isActive} 
                        onCheckedChange={(checked) => {
                          toggleUserStatusMutation.mutate({ id: user.id, isActive: checked });
                        }}
                        disabled={user.id === currentUser?.id} // Não permite desativar a si mesmo
                      />
                      <span className={user.isActive ? "text-green-600" : "text-red-600"}>
                        {user.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.lastLogin ? formatDate(new Date(user.lastLogin)) : "Nunca"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      
                      {user.id !== currentUser?.id && (
                        <AlertDialog open={deleteUserId === user.id} onOpenChange={(open) => !open && setDeleteUserId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteUserId(user.id)}>
                              <Trash2Icon className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o usuário <strong>{user.name}</strong>?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUserMutation.mutate(user.id)} className="bg-red-500 hover:bg-red-600">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Formulário para adicionar/editar usuário */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editUser ? "Editar Usuário" : "Adicionar Novo Usuário"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de Usuário</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nome de usuário" 
                          {...field}
                          disabled={!!editUser} // Não permite alterar o username na edição
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
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="mt-4">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  className="mt-4"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  ) : null}
                  {editUser ? "Atualizar Usuário" : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}