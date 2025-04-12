import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOwnerSchema, 
  insertTenantSchema, 
  insertPropertySchema, 
  insertContractSchema, 
  insertPaymentSchema,
  ownerValidationSchema,
  tenantValidationSchema,
  propertyValidationSchema,
  contractValidationSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  generateResidentialContractPDF,
  generateCommercialContractPDF,
  generatePaymentReceiptPDF
} from "./pdf-service";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configura autenticação
  setupAuth(app);
  // Dashboard Statistics
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter estatísticas do dashboard" });
    }
  });

  // Owner Routes
  app.get("/api/owners", async (req, res) => {
    try {
      const showInactive = req.query.showInactive === 'true';
      const owners = await storage.getOwners(showInactive);
      res.json(owners);
    } catch (error) {
      console.error("Erro ao buscar proprietários:", error);
      res.status(500).json({ message: "Erro ao obter proprietários" });
    }
  });
  
  // Rota para ativar/desativar proprietário
  app.patch("/api/owners/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "O campo isActive deve ser um booleano" });
      }
      
      const owner = await storage.updateOwner(id, { isActive });
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      
      res.json(owner);
    } catch (error) {
      console.error("Erro ao atualizar status do proprietário:", error);
      res.status(500).json({ message: "Erro ao atualizar status do proprietário" });
    }
  });

  app.get("/api/owners/:id", async (req, res) => {
    try {
      const owner = await storage.getOwner(Number(req.params.id));
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      res.json(owner);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter proprietário" });
    }
  });

  app.post("/api/owners", async (req, res) => {
    try {
      const data = await ownerValidationSchema.parseAsync(req.body);
      
      // Verifica se já existe proprietário com o mesmo CPF
      const existingOwner = await storage.findOwnerByDocument(data.document);
      if (existingOwner) {
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: [{ message: "CPF já cadastrado em outro proprietário" }]
        });
      }
      
      const owner = await storage.createOwner(data);
      res.status(201).json(owner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      console.error("Erro ao criar proprietário:", error);
      res.status(500).json({ message: "Erro ao criar proprietário" });
    }
  });

  app.patch("/api/owners/:id", async (req, res) => {
    try {
      // Partial validation for update
      const data = await insertOwnerSchema.partial().parseAsync(req.body);
      const owner = await storage.updateOwner(Number(req.params.id), data);
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      res.json(owner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao atualizar proprietário" });
    }
  });

  app.delete("/api/owners/:id", async (req, res) => {
    try {
      const success = await storage.deleteOwner(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar proprietário" });
    }
  });

  // Tenant Routes
  app.get("/api/tenants", async (req, res) => {
    try {
      const showInactive = req.query.showInactive === 'true';
      const tenants = await storage.getTenants(showInactive);
      res.json(tenants);
    } catch (error) {
      console.error("Erro ao buscar inquilinos:", error);
      res.status(500).json({ message: "Erro ao obter inquilinos" });
    }
  });
  
  // Rota para ativar/desativar inquilino
  app.patch("/api/tenants/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "O campo isActive deve ser um booleano" });
      }
      
      const tenant = await storage.updateTenant(id, { isActive });
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      
      res.json(tenant);
    } catch (error) {
      console.error("Erro ao atualizar status do inquilino:", error);
      res.status(500).json({ message: "Erro ao atualizar status do inquilino" });
    }
  });

  app.get("/api/tenants/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenant(Number(req.params.id));
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter inquilino" });
    }
  });

  app.post("/api/tenants", async (req, res) => {
    try {
      const data = await tenantValidationSchema.parseAsync(req.body);
      
      // Verifica se já existe inquilino com o mesmo CPF
      const existingTenant = await storage.findTenantByDocument(data.document);
      if (existingTenant) {
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: [{ message: "CPF já cadastrado em outro inquilino" }]
        });
      }
      
      const tenant = await storage.createTenant(data);
      res.status(201).json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      console.error("Erro ao criar inquilino:", error);
      res.status(500).json({ message: "Erro ao criar inquilino" });
    }
  });

  app.patch("/api/tenants/:id", async (req, res) => {
    try {
      const data = await insertTenantSchema.partial().parseAsync(req.body);
      const tenant = await storage.updateTenant(Number(req.params.id), data);
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao atualizar inquilino" });
    }
  });

  app.delete("/api/tenants/:id", async (req, res) => {
    try {
      const success = await storage.deleteTenant(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar inquilino" });
    }
  });

  // Property Routes
  app.get("/api/properties", async (req, res) => {
    try {
      // Converter o parâmetro de string para booleano
      const showInactive = req.query.showInactive === 'true';
      const properties = await storage.getProperties(showInactive);
      res.json(properties);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
      res.status(500).json({ message: "Erro ao obter imóveis" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(Number(req.params.id));
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter imóvel" });
    }
  });

  app.get("/api/properties/owner/:ownerId", async (req, res) => {
    try {
      const properties = await storage.getPropertiesByOwner(Number(req.params.ownerId));
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter imóveis do proprietário" });
    }
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const data = await propertyValidationSchema.parseAsync(req.body);
      const property = await storage.createProperty(data);
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao criar imóvel" });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const data = await insertPropertySchema.partial().parseAsync(req.body);
      const property = await storage.updateProperty(Number(req.params.id), data);
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao atualizar imóvel" });
    }
  });

  app.delete("/api/properties/:id", async (req, res) => {
    try {
      const success = await storage.deleteProperty(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar imóvel" });
    }
  });
  
  // Rotas para ativar/desativar imóveis
  app.post("/api/properties/:id/activate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const property = await storage.getProperty(id);
      
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      
      // Ativa o imóvel
      const updatedProperty = await storage.updateProperty(id, { isActive: true });
      res.json(updatedProperty);
    } catch (error) {
      console.error("Erro ao ativar imóvel:", error);
      res.status(500).json({ message: "Erro ao ativar imóvel" });
    }
  });
  
  app.post("/api/properties/:id/deactivate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const property = await storage.getProperty(id);
      
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      
      // Desativa o imóvel
      const updatedProperty = await storage.updateProperty(id, { isActive: false });
      res.json(updatedProperty);
    } catch (error) {
      console.error("Erro ao desativar imóvel:", error);
      res.status(500).json({ message: "Erro ao desativar imóvel" });
    }
  });

  // Contract Routes
  app.get("/api/contracts", async (_req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter contratos" });
    }
  });

  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(Number(req.params.id));
      if (!contract) {
        return res.status(404).json({ message: "Contrato não encontrado" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter contrato" });
    }
  });

  app.get("/api/contracts/owner/:ownerId", async (req, res) => {
    try {
      const contracts = await storage.getContractsByOwner(Number(req.params.ownerId));
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter contratos do proprietário" });
    }
  });

  app.get("/api/contracts/tenant/:tenantId", async (req, res) => {
    try {
      const contracts = await storage.getContractsByTenant(Number(req.params.tenantId));
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter contratos do inquilino" });
    }
  });

  app.get("/api/contracts/property/:propertyId", async (req, res) => {
    try {
      const contracts = await storage.getContractsByProperty(Number(req.params.propertyId));
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter contratos do imóvel" });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const data = await contractValidationSchema.parseAsync(req.body);
      const contract = await storage.createContract(data);
      
      // Gerar as parcelas automaticamente com base na duração do contrato
      const startDate = new Date(contract.startDate);
      const paymentDay = contract.paymentDay;
      
      console.log(`Gerando ${contract.duration} parcelas para o contrato #${contract.id}`);
      
      // Criando um array de promessas para a inserção de todas as parcelas
      const paymentPromises = [];
      
      for (let i = 0; i < contract.duration; i++) {
        // Calculando a data de vencimento para cada parcela
        // Aumenta o mês em i, mantendo o dia de pagamento definido no contrato
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        dueDate.setDate(paymentDay);
        
        // Formatando a data para string YYYY-MM-DD
        const formattedDueDate = dueDate.toISOString().split('T')[0];
        
        const payment = {
          contractId: contract.id,
          dueDate: formattedDueDate,
          value: contract.rentValue,
          isPaid: false,
          paymentDate: null,
          interestAmount: 0,
          latePaymentFee: 0,
          paymentMethod: null,
          receiptNumber: null,
          observations: `Parcela ${i+1}/${contract.duration}`
        };
        
        // Adiciona a promessa de criação do pagamento
        paymentPromises.push(storage.createPayment(payment));
      }
      
      // Espera todas as promessas serem resolvidas
      await Promise.all(paymentPromises);
      console.log(`${contract.duration} parcelas geradas com sucesso para o contrato #${contract.id}`);
      
      res.status(201).json(contract);
    } catch (error) {
      console.error("Erro ao criar contrato ou gerar parcelas:", error);
      
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao criar contrato ou gerar parcelas" });
    }
  });

  app.patch("/api/contracts/:id", async (req, res) => {
    try {
      const data = await insertContractSchema.partial().parseAsync(req.body);
      const contract = await storage.updateContract(Number(req.params.id), data);
      if (!contract) {
        return res.status(404).json({ message: "Contrato não encontrado" });
      }
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao atualizar contrato" });
    }
  });

  app.delete("/api/contracts/:id", async (req, res) => {
    try {
      const success = await storage.deleteContract(Number(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Contrato não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar contrato" });
    }
  });

  // Payment Routes
  app.get("/api/payments", async (_req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter pagamentos" });
    }
  });

  app.get("/api/payments/:id", async (req, res) => {
    try {
      const payment = await storage.getPayment(Number(req.params.id));
      if (!payment) {
        return res.status(404).json({ message: "Pagamento não encontrado" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter pagamento" });
    }
  });
  
  // Nova rota para obter todos os dados necessários para o recibo em uma única chamada
  app.get("/api/payments/:id/receipt-data", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const payment = await storage.getPayment(id);
      
      if (!payment) {
        return res.status(404).json({ message: "Pagamento não encontrado" });
      }
      
      // Obter contrato
      const contract = await storage.getContract(payment.contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contrato não encontrado" });
      }
      
      // Obter proprietário
      const owner = await storage.getOwner(contract.ownerId);
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      
      // Obter inquilino
      const tenant = await storage.getTenant(contract.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      
      // Obter imóvel
      const property = await storage.getProperty(contract.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      
      // Retornar todos os dados necessários em um único objeto
      res.json({
        payment,
        contract,
        owner,
        tenant,
        property
      });
    } catch (error) {
      console.error("Erro ao buscar dados para recibo:", error);
      res.status(500).json({ message: "Erro ao obter dados para recibo" });
    }
  });

  app.get("/api/payments/contract/:contractId", async (req, res) => {
    try {
      const payments = await storage.getPaymentsByContract(Number(req.params.contractId));
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Erro ao obter pagamentos do contrato" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const data = await insertPaymentSchema.parseAsync(req.body);
      const payment = await storage.createPayment(data);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao criar pagamento" });
    }
  });

  app.patch("/api/payments/:id", async (req, res) => {
    try {
      const data = await insertPaymentSchema.partial().parseAsync(req.body);
      const payment = await storage.updatePayment(Number(req.params.id), data);
      if (!payment) {
        return res.status(404).json({ message: "Pagamento não encontrado" });
      }
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          message: "Erro de validação", 
          errors: validationError.details
        });
      }
      res.status(500).json({ message: "Erro ao atualizar pagamento" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const success = await storage.deletePayment(Number(req.params.id), req.user.id);
      if (!success) {
        return res.status(404).json({ message: "Pagamento não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir pagamento:", error);
      res.status(500).json({ message: "Erro ao deletar pagamento" });
    }
  });
  
  // Rotas para histórico de pagamentos excluídos
  app.get("/api/deleted-payments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const deletedPayments = await storage.getDeletedPayments();
      res.json(deletedPayments);
    } catch (error) {
      console.error("Erro ao consultar pagamentos excluídos:", error);
      res.status(500).json({ message: "Erro ao consultar pagamentos excluídos" });
    }
  });
  
  app.get("/api/deleted-payments/contract/:contractId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const deletedPayments = await storage.getDeletedPaymentsByContract(Number(req.params.contractId));
      res.json(deletedPayments);
    } catch (error) {
      console.error("Erro ao consultar pagamentos excluídos do contrato:", error);
      res.status(500).json({ message: "Erro ao consultar pagamentos excluídos do contrato" });
    }
  });
  
  app.get("/api/deleted-payments/user/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const deletedPayments = await storage.getDeletedPaymentsByUser(Number(req.params.userId));
      res.json(deletedPayments);
    } catch (error) {
      console.error("Erro ao consultar pagamentos excluídos pelo usuário:", error);
      res.status(500).json({ message: "Erro ao consultar pagamentos excluídos pelo usuário" });
    }
  });

  // API para listar usuários (usado para exibir nomes nas páginas do sistema)
  app.get("/api/users", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // CEP Lookup API
  app.get("/api/cep/:cep", async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, "");
      if (cep.length !== 8) {
        return res.status(400).json({ message: "CEP inválido" });
      }

      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        return res.status(404).json({ message: "CEP não encontrado" });
      }

      const addressData = {
        zipCode: data.cep,
        street: data.logradouro,
        complement: data.complemento,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf
      };

      res.json(addressData);
    } catch (error) {
      res.status(500).json({ message: "Erro ao consultar CEP" });
    }
  });

  // PDF Generation Routes
  app.get("/api/contracts/:id/pdf/residential", generateResidentialContractPDF);
  
  app.get("/api/contracts/:id/pdf/commercial", generateCommercialContractPDF);
  
  app.get("/api/payments/:id/pdf/receipt", generatePaymentReceiptPDF);

  // Novas rotas para ativar/desativar proprietários e inquilinos
  // Rotas para toggle de status via PATCH (manter para compatibilidade)
  app.patch("/api/owners/:id/toggle-status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const owner = await storage.getOwner(id);
      
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      
      // Inverte o status atual
      const updatedOwner = await storage.updateOwner(id, { isActive: !owner.isActive });
      res.json(updatedOwner);
    } catch (error) {
      console.error("Erro ao alterar status do proprietário:", error);
      res.status(500).json({ message: "Erro ao alterar status do proprietário" });
    }
  });

  // Rotas para ativar/desativar via POST (novas)
  app.post("/api/owners/:id/activate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const owner = await storage.getOwner(id);
      
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      
      // Ativa o proprietário
      const updatedOwner = await storage.updateOwner(id, { isActive: true });
      res.json(updatedOwner);
    } catch (error) {
      console.error("Erro ao ativar proprietário:", error);
      res.status(500).json({ message: "Erro ao ativar proprietário" });
    }
  });

  app.post("/api/owners/:id/deactivate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const owner = await storage.getOwner(id);
      
      if (!owner) {
        return res.status(404).json({ message: "Proprietário não encontrado" });
      }
      
      // Desativa o proprietário
      const updatedOwner = await storage.updateOwner(id, { isActive: false });
      res.json(updatedOwner);
    } catch (error) {
      console.error("Erro ao desativar proprietário:", error);
      res.status(500).json({ message: "Erro ao desativar proprietário" });
    }
  });

  app.patch("/api/tenants/:id/toggle-status", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const tenant = await storage.getTenant(id);
      
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      
      // Inverte o status atual
      const updatedTenant = await storage.updateTenant(id, { isActive: !tenant.isActive });
      res.json(updatedTenant);
    } catch (error) {
      console.error("Erro ao alterar status do inquilino:", error);
      res.status(500).json({ message: "Erro ao alterar status do inquilino" });
    }
  });

  // Rotas para ativar/desativar inquilinos
  app.post("/api/tenants/:id/activate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const tenant = await storage.getTenant(id);
      
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      
      // Ativa o inquilino
      const updatedTenant = await storage.updateTenant(id, { isActive: true });
      res.json(updatedTenant);
    } catch (error) {
      console.error("Erro ao ativar inquilino:", error);
      res.status(500).json({ message: "Erro ao ativar inquilino" });
    }
  });

  app.post("/api/tenants/:id/deactivate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const tenant = await storage.getTenant(id);
      
      if (!tenant) {
        return res.status(404).json({ message: "Inquilino não encontrado" });
      }
      
      // Desativa o inquilino
      const updatedTenant = await storage.updateTenant(id, { isActive: false });
      res.json(updatedTenant);
    } catch (error) {
      console.error("Erro ao desativar inquilino:", error);
      res.status(500).json({ message: "Erro ao desativar inquilino" });
    }
  });

  // Rotas para ativar/desativar imóveis
  app.post("/api/properties/:id/toggle-available", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const id = Number(req.params.id);
      const property = await storage.getProperty(id);
      
      if (!property) {
        return res.status(404).json({ message: "Imóvel não encontrado" });
      }
      
      // Inverte a disponibilidade
      const updatedProperty = await storage.updateProperty(id, 
        { availableForRent: !property.availableForRent });
      res.json(updatedProperty);
    } catch (error) {
      console.error("Erro ao alterar disponibilidade do imóvel:", error);
      res.status(500).json({ message: "Erro ao alterar disponibilidade do imóvel" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
