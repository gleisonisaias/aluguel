import { 
  users, owners, tenants, properties, contracts, payments, deletedPayments,
  type User, type InsertUser,
  type Owner, type InsertOwner,
  type Tenant, type InsertTenant,
  type Property, type InsertProperty,
  type Contract, type InsertContract,
  type Payment, type InsertPayment,
  type DeletedPayment, type InsertDeletedPayment
} from "@shared/schema";

import { db } from "./db";
import { eq, and, lt, lte, gte, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  updateLastLogin(id: number): Promise<User | undefined>;

  // Owners
  getOwners(): Promise<Owner[]>;
  getOwner(id: number): Promise<Owner | undefined>;
  findOwnerByDocument(document: string): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: number, owner: Partial<InsertOwner>): Promise<Owner | undefined>;
  deleteOwner(id: number): Promise<boolean>;

  // Tenants
  getTenants(): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  findTenantByDocument(document: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<boolean>;

  // Properties
  getProperties(showInactive?: boolean): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  getPropertiesByOwner(ownerId: number): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;

  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: number): Promise<Contract | undefined>;
  getContractsByOwner(ownerId: number): Promise<Contract[]>;
  getContractsByTenant(tenantId: number): Promise<Contract[]>;
  getContractsByProperty(propertyId: number): Promise<Contract[]>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: number, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: number): Promise<boolean>;

  // Payments
  getPayments(): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentsByContract(contractId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number, userId: number): Promise<boolean>;
  
  // Deleted Payments
  getDeletedPayments(): Promise<DeletedPayment[]>;
  getDeletedPaymentsByContract(contractId: number): Promise<DeletedPayment[]>;
  getDeletedPaymentsByUser(userId: number): Promise<DeletedPayment[]>;

  // Dashboard statistics
  getDashboardStats(): Promise<{
    expiredContracts: number;
    expiringContracts: number;
    totalContracts: number;
    pendingPayments: number;
    overduePayments: number;
  }>;
}

export class MemStorage implements IStorage {
  // Implementações para findOwnerByDocument e findTenantByDocument
  async findOwnerByDocument(document: string): Promise<Owner | undefined> {
    const owner = Array.from(this.owners.values()).find(
      (owner) => owner.document === document,
    );
    if (!owner) return undefined;
    
    return {
      ...owner,
      address: typeof owner.address === 'string' 
        ? JSON.parse(owner.address) 
        : owner.address
    };
  }
  
  async findTenantByDocument(document: string): Promise<Tenant | undefined> {
    const tenant = Array.from(this.tenants.values()).find(
      (tenant) => tenant.document === document,
    );
    if (!tenant) return undefined;
    
    return {
      ...tenant,
      address: typeof tenant.address === 'string' 
        ? JSON.parse(tenant.address) 
        : tenant.address,
      guarantor: tenant.guarantor && typeof tenant.guarantor === 'string'
        ? JSON.parse(tenant.guarantor)
        : tenant.guarantor
    };
  }
  private users: Map<number, User>;
  private owners: Map<number, Owner>;
  private tenants: Map<number, Tenant>;
  private properties: Map<number, Property>;
  private contracts: Map<number, Contract>;
  private payments: Map<number, Payment>;
  private deletedPayments: Map<number, DeletedPayment>;
  
  private userId: number = 1;
  private ownerId: number = 1;
  private tenantId: number = 1;
  private propertyId: number = 1;
  private contractId: number = 1;
  private paymentId: number = 1;
  private deletedPaymentId: number = 1;

  constructor() {
    this.users = new Map();
    this.owners = new Map();
    this.tenants = new Map();
    this.properties = new Map();
    this.contracts = new Map();
    this.payments = new Map();
    this.deletedPayments = new Map();
  }

  // USER METHODS
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...insertUser, 
      id,
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUser(id: number, partialUser: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...partialUser };
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }
  
  async updateLastLogin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, lastLogin: new Date() };
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // OWNER METHODS
  async getOwners(showInactive: boolean = false): Promise<Owner[]> {
    const owners = Array.from(this.owners.values());
    if (!showInactive) {
      return owners.filter(owner => owner.isActive !== false);
    }
    return owners;
  }

  async getOwner(id: number): Promise<Owner | undefined> {
    return this.owners.get(id);
  }

  async createOwner(insertOwner: InsertOwner): Promise<Owner> {
    const id = this.ownerId++;
    const owner: Owner = {
      ...insertOwner,
      id,
      address: typeof insertOwner.address === 'string' 
        ? JSON.parse(insertOwner.address) 
        : insertOwner.address,
      createdAt: new Date()
    };
    // Convert address to string for storage
    this.owners.set(id, {
      ...owner,
      address: typeof owner.address === 'object'
        ? JSON.stringify(owner.address)
        : owner.address
    } as any);
    return owner;
  }

  async updateOwner(id: number, partialOwner: Partial<InsertOwner>): Promise<Owner | undefined> {
    const owner = this.owners.get(id);
    if (!owner) return undefined;

    const updatedOwner = {
      ...owner,
      ...partialOwner,
      address: partialOwner.address 
        ? (typeof partialOwner.address === 'string' 
          ? partialOwner.address 
          : JSON.stringify(partialOwner.address))
        : owner.address
    };

    this.owners.set(id, updatedOwner as any);
    
    return {
      ...updatedOwner,
      address: typeof updatedOwner.address === 'string' 
        ? JSON.parse(updatedOwner.address) 
        : updatedOwner.address
    };
  }

  async deleteOwner(id: number): Promise<boolean> {
    return this.owners.delete(id);
  }

  // TENANT METHODS
  async getTenants(showInactive: boolean = false): Promise<Tenant[]> {
    const tenants = Array.from(this.tenants.values());
    
    // Filtra inquilinos ativos se showInactive for false
    const filteredTenants = !showInactive 
      ? tenants.filter(tenant => tenant.isActive !== false)
      : tenants;
    
    // Retorna os inquilinos com os dados processados
    return filteredTenants.map(tenant => ({
      ...tenant,
      address: typeof tenant.address === 'string' 
        ? JSON.parse(tenant.address) 
        : tenant.address,
      guarantor: tenant.guarantor && typeof tenant.guarantor === 'string'
        ? JSON.parse(tenant.guarantor)
        : tenant.guarantor
    }));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    
    return {
      ...tenant,
      address: typeof tenant.address === 'string' 
        ? JSON.parse(tenant.address) 
        : tenant.address,
      guarantor: tenant.guarantor && typeof tenant.guarantor === 'string'
        ? JSON.parse(tenant.guarantor)
        : tenant.guarantor
    };
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const id = this.tenantId++;
    const tenant: Tenant = {
      ...insertTenant,
      id,
      address: typeof insertTenant.address === 'string' 
        ? JSON.parse(insertTenant.address) 
        : insertTenant.address,
      guarantor: insertTenant.guarantor 
        ? (typeof insertTenant.guarantor === 'string' 
          ? insertTenant.guarantor 
          : JSON.stringify(insertTenant.guarantor))
        : undefined,
      createdAt: new Date()
    };
    
    // Store with stringified objects
    this.tenants.set(id, {
      ...tenant,
      address: typeof tenant.address === 'object'
        ? JSON.stringify(tenant.address)
        : tenant.address,
      guarantor: tenant.guarantor && typeof tenant.guarantor === 'object'
        ? JSON.stringify(tenant.guarantor)
        : tenant.guarantor
    } as any);
    
    return tenant;
  }

  async updateTenant(id: number, partialTenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;

    const updatedTenant = {
      ...tenant,
      ...partialTenant,
      address: partialTenant.address 
        ? (typeof partialTenant.address === 'string' 
          ? partialTenant.address 
          : JSON.stringify(partialTenant.address))
        : tenant.address,
      guarantor: partialTenant.guarantor 
        ? (typeof partialTenant.guarantor === 'string' 
          ? partialTenant.guarantor 
          : JSON.stringify(partialTenant.guarantor))
        : tenant.guarantor
    };

    this.tenants.set(id, updatedTenant as any);
    
    return {
      ...updatedTenant,
      address: typeof updatedTenant.address === 'string' 
        ? JSON.parse(updatedTenant.address) 
        : updatedTenant.address,
      guarantor: updatedTenant.guarantor && typeof updatedTenant.guarantor === 'string'
        ? JSON.parse(updatedTenant.guarantor)
        : updatedTenant.guarantor
    };
  }

  async deleteTenant(id: number): Promise<boolean> {
    return this.tenants.delete(id);
  }

  // PROPERTY METHODS
  async getProperties(showInactive: boolean = false): Promise<Property[]> {
    return Array.from(this.properties.values())
      .filter(property => showInactive || property.isActive !== false) // Mostrar apenas ativos, a menos que showInactive seja true
      .map(property => ({
        ...property,
        address: typeof property.address === 'string' 
          ? JSON.parse(property.address) 
          : property.address
      }));
  }

  async getProperty(id: number): Promise<Property | undefined> {
    const property = this.properties.get(id);
    if (!property) return undefined;
    
    return {
      ...property,
      address: typeof property.address === 'string' 
        ? JSON.parse(property.address) 
        : property.address
    };
  }

  async getPropertiesByOwner(ownerId: number): Promise<Property[]> {
    return Array.from(this.properties.values())
      .filter(property => property.ownerId === ownerId)
      .map(property => ({
        ...property,
        address: typeof property.address === 'string' 
          ? JSON.parse(property.address) 
          : property.address
      }));
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const id = this.propertyId++;
    const property: Property = {
      ...insertProperty,
      id,
      address: typeof insertProperty.address === 'string' 
        ? JSON.parse(insertProperty.address) 
        : insertProperty.address,
      createdAt: new Date()
    };
    
    // Store with stringified address
    this.properties.set(id, {
      ...property,
      address: typeof property.address === 'object'
        ? JSON.stringify(property.address)
        : property.address
    } as any);
    
    return property;
  }

  async updateProperty(id: number, partialProperty: Partial<InsertProperty>): Promise<Property | undefined> {
    const property = this.properties.get(id);
    if (!property) return undefined;

    const updatedProperty = {
      ...property,
      ...partialProperty,
      address: partialProperty.address 
        ? (typeof partialProperty.address === 'string' 
          ? partialProperty.address 
          : JSON.stringify(partialProperty.address))
        : property.address
    };

    this.properties.set(id, updatedProperty as any);
    
    return {
      ...updatedProperty,
      address: typeof updatedProperty.address === 'string' 
        ? JSON.parse(updatedProperty.address) 
        : updatedProperty.address
    };
  }

  async deleteProperty(id: number): Promise<boolean> {
    return this.properties.delete(id);
  }

  // CONTRACT METHODS
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async getContract(id: number): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getContractsByOwner(ownerId: number): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter(contract => contract.ownerId === ownerId);
  }

  async getContractsByTenant(tenantId: number): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter(contract => contract.tenantId === tenantId);
  }

  async getContractsByProperty(propertyId: number): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter(contract => contract.propertyId === propertyId);
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = this.contractId++;
    const contract: Contract = {
      ...insertContract,
      id,
      createdAt: new Date()
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: number, partialContract: Partial<InsertContract>): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;

    const updatedContract = {
      ...contract,
      ...partialContract,
    };

    this.contracts.set(id, updatedContract);
    return updatedContract;
  }

  async deleteContract(id: number): Promise<boolean> {
    return this.contracts.delete(id);
  }

  // PAYMENT METHODS
  async getPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentsByContract(contractId: number): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(payment => payment.contractId === contractId);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = this.paymentId++;
    const payment: Payment = {
      ...insertPayment,
      id,
      createdAt: new Date()
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: number, partialPayment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;

    const updatedPayment = {
      ...payment,
      ...partialPayment,
    };

    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async deletePayment(id: number, userId: number): Promise<boolean> {
    const payment = this.payments.get(id);
    if (!payment) {
      return false;
    }
    
    const deletedId = this.deletedPaymentId++;
    const deletedPayment: DeletedPayment = {
      id: deletedId,
      originalId: payment.id,
      contractId: payment.contractId,
      dueDate: payment.dueDate,
      value: payment.value,
      isPaid: payment.isPaid || false,
      paymentDate: payment.paymentDate,
      interestAmount: payment.interestAmount || 0,
      latePaymentFee: payment.latePaymentFee || 0,
      paymentMethod: payment.paymentMethod,
      receiptNumber: payment.receiptNumber,
      observations: payment.observations,
      deletedBy: userId,
      originalCreatedAt: payment.createdAt,
      deletedAt: new Date(),
      createdAt: new Date()
    };
    
    this.deletedPayments.set(deletedId, deletedPayment);
    return this.payments.delete(id);
  }
  
  // DELETED PAYMENTS METHODS
  async getDeletedPayments(): Promise<DeletedPayment[]> {
    return Array.from(this.deletedPayments.values())
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }
  
  async getDeletedPaymentsByContract(contractId: number): Promise<DeletedPayment[]> {
    return Array.from(this.deletedPayments.values())
      .filter(payment => payment.contractId === contractId)
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }
  
  async getDeletedPaymentsByUser(userId: number): Promise<DeletedPayment[]> {
    return Array.from(this.deletedPayments.values())
      .filter(payment => payment.deletedBy === userId)
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }

  // DASHBOARD STATISTICS
  async getDashboardStats(): Promise<{
    expiredContracts: number;
    expiringContracts: number;
    totalContracts: number;
    pendingPayments: number;
    overduePayments: number;
  }> {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const contracts = Array.from(this.contracts.values());
    const payments = Array.from(this.payments.values());

    const expiredContracts = contracts.filter(contract => {
      const endDate = new Date(contract.endDate);
      return endDate < today && contract.status !== 'encerrado';
    }).length;

    const expiringContracts = contracts.filter(contract => {
      const endDate = new Date(contract.endDate);
      return endDate >= today && endDate <= thirtyDaysFromNow && contract.status !== 'encerrado';
    }).length;

    const totalContracts = contracts.filter(contract => 
      contract.status === 'ativo'
    ).length;

    const pendingPayments = payments.filter(payment => 
      !payment.isPaid && new Date(payment.dueDate) > today
    ).length;
    
    const overduePayments = payments.filter(payment => 
      !payment.isPaid && new Date(payment.dueDate) <= today
    ).length;

    return {
      expiredContracts,
      expiringContracts,
      totalContracts,
      pendingPayments,
      overduePayments
    };
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        isActive: true,
        createdAt: new Date()
      })
      .returning();
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async updateUser(id: number, partialUser: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(partialUser)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }
  
  async updateLastLogin(id: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getOwners(showInactive: boolean = false): Promise<Owner[]> {
    try {
      console.log("Buscando proprietários do banco de dados");
      let query = db.select().from(owners);
      
      // Se não mostrar inativos, filtra apenas os ativos
      if (!showInactive) {
        query = query.where(eq(owners.isActive, true));
      }
      
      const ownersData = await query;
      console.log("Proprietários encontrados:", ownersData.length);
      
      return ownersData.map(owner => ({
        ...owner,
        address: typeof owner.address === 'string' ? JSON.parse(owner.address) : owner.address
      }));
    } catch (error) {
      console.error("Erro ao buscar proprietários:", error);
      throw error;
    }
  }

  async getOwner(id: number): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    if (!owner) return undefined;
    
    return {
      ...owner,
      address: typeof owner.address === 'string' ? JSON.parse(owner.address) : owner.address
    };
  }
  
  async findOwnerByDocument(document: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.document, document));
    if (!owner) return undefined;
    
    return {
      ...owner,
      address: typeof owner.address === 'string' ? JSON.parse(owner.address) : owner.address
    };
  }

  async createOwner(insertOwner: InsertOwner): Promise<Owner> {
    try {
      console.log("Criando proprietário:", JSON.stringify(insertOwner, null, 2));
      
      const addressJson = JSON.stringify(insertOwner.address);
      console.log("Address JSON:", addressJson);
      
      const insertValues = {
        name: insertOwner.name,
        document: insertOwner.document,
        email: insertOwner.email,
        phone: insertOwner.phone,
        address: addressJson,
      };
      console.log("Valores para inserção:", JSON.stringify(insertValues, null, 2));
      
      const [owner] = await db
        .insert(owners)
        .values(insertValues)
        .returning();
      
      console.log("Proprietário criado:", JSON.stringify(owner, null, 2));
      
      return {
        ...owner,
        address: typeof owner.address === 'string' ? JSON.parse(owner.address) : owner.address
      };
    } catch (error) {
      console.error("Erro ao criar proprietário:", error);
      throw error;
    }
  }

  async updateOwner(id: number, partialOwner: Partial<InsertOwner>): Promise<Owner | undefined> {
    // Ensure we have the current owner
    const currentOwner = await this.getOwner(id);
    if (!currentOwner) return undefined;

    const updateData: any = { ...partialOwner };
    
    // Handle the address field if it's being updated
    if (partialOwner.address) {
      updateData.address = JSON.stringify(partialOwner.address);
    }

    const [updatedOwner] = await db
      .update(owners)
      .set(updateData)
      .where(eq(owners.id, id))
      .returning();
    
    if (!updatedOwner) return undefined;
    
    return {
      ...updatedOwner,
      address: typeof updatedOwner.address === 'string' ? JSON.parse(updatedOwner.address) : updatedOwner.address
    };
  }

  async deleteOwner(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(owners)
        .where(eq(owners.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting owner:", error);
      return false;
    }
  }

  async getTenants(showInactive: boolean = false): Promise<Tenant[]> {
    let query = db.select().from(tenants);
      
    // Se não mostrar inativos, filtra apenas os ativos
    if (!showInactive) {
      query = query.where(eq(tenants.isActive, true));
    }
    
    const tenantsData = await query;
    return tenantsData.map(tenant => ({
      ...tenant,
      address: typeof tenant.address === 'string' ? JSON.parse(tenant.address) : tenant.address,
      guarantor: tenant.guarantor ? 
        (typeof tenant.guarantor === 'string' ? JSON.parse(tenant.guarantor) : tenant.guarantor) 
        : undefined
    }));
  }

  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!tenant) return undefined;
    
    return {
      ...tenant,
      address: typeof tenant.address === 'string' ? JSON.parse(tenant.address) : tenant.address,
      guarantor: tenant.guarantor ? 
        (typeof tenant.guarantor === 'string' ? JSON.parse(tenant.guarantor) : tenant.guarantor) 
        : undefined
    };
  }
  
  async findTenantByDocument(document: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.document, document));
    if (!tenant) return undefined;
    
    return {
      ...tenant,
      address: typeof tenant.address === 'string' ? JSON.parse(tenant.address) : tenant.address,
      guarantor: tenant.guarantor ? 
        (typeof tenant.guarantor === 'string' ? JSON.parse(tenant.guarantor) : tenant.guarantor) 
        : undefined
    };
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    try {
      console.log("Criando inquilino:", JSON.stringify(insertTenant, null, 2));
      
      const addressJson = JSON.stringify(insertTenant.address);
      console.log("Address JSON:", addressJson);
      
      const guarantorJson = insertTenant.guarantor ? JSON.stringify(insertTenant.guarantor) : null;
      console.log("Guarantor JSON:", guarantorJson);
      
      const insertValues = {
        ...insertTenant,
        address: addressJson,
        guarantor: guarantorJson,
      };
      console.log("Valores para inserção:", JSON.stringify(insertValues, null, 2));
      
      const [tenant] = await db
        .insert(tenants)
        .values(insertValues)
        .returning();
      
      console.log("Inquilino criado:", JSON.stringify(tenant, null, 2));
      
      return {
        ...tenant,
        address: typeof tenant.address === 'string' ? JSON.parse(tenant.address) : tenant.address,
        guarantor: tenant.guarantor ? 
          (typeof tenant.guarantor === 'string' ? JSON.parse(tenant.guarantor) : tenant.guarantor) 
          : undefined
      };
    } catch (error) {
      console.error("Erro ao criar inquilino:", error);
      throw error;
    }
  }

  async updateTenant(id: number, partialTenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    // Ensure we have the current tenant
    const currentTenant = await this.getTenant(id);
    if (!currentTenant) return undefined;

    const updateData: any = { ...partialTenant };
    
    // Handle the address field if it's being updated
    if (partialTenant.address) {
      updateData.address = JSON.stringify(partialTenant.address);
    }
    
    // Handle the guarantor field if it's being updated
    if (partialTenant.guarantor !== undefined) {
      updateData.guarantor = partialTenant.guarantor ? JSON.stringify(partialTenant.guarantor) : null;
    }

    const [updatedTenant] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning();
    
    if (!updatedTenant) return undefined;
    
    return {
      ...updatedTenant,
      address: typeof updatedTenant.address === 'string' ? JSON.parse(updatedTenant.address) : updatedTenant.address,
      guarantor: updatedTenant.guarantor ? 
        (typeof updatedTenant.guarantor === 'string' ? JSON.parse(updatedTenant.guarantor) : updatedTenant.guarantor) 
        : undefined
    };
  }

  async deleteTenant(id: number): Promise<boolean> {
    try {
      await db
        .delete(tenants)
        .where(eq(tenants.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting tenant:", error);
      return false;
    }
  }

  async getProperties(showInactive: boolean = false): Promise<Property[]> {
    try {
      let query = db.select().from(properties);
      
      // Se não mostrar inativos, filtra apenas os ativos
      if (!showInactive) {
        query = query.where(eq(properties.isActive, true));
      }
      
      const propertiesData = await query;
      
      return propertiesData.map(property => ({
        ...property,
        address: typeof property.address === 'string' ? JSON.parse(property.address) : property.address
      }));
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
      throw error;
    }
  }

  async getProperty(id: number): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    if (!property) return undefined;
    
    return {
      ...property,
      address: typeof property.address === 'string' ? JSON.parse(property.address) : property.address
    };
  }

  async getPropertiesByOwner(ownerId: number): Promise<Property[]> {
    const propertiesData = await db
      .select()
      .from(properties)
      .where(eq(properties.ownerId, ownerId));
    
    return propertiesData.map(property => ({
      ...property,
      address: typeof property.address === 'string' ? JSON.parse(property.address) : property.address
    }));
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    try {
      console.log("Criando imóvel:", JSON.stringify(insertProperty, null, 2));
      
      const addressJson = JSON.stringify(insertProperty.address);
      console.log("Address JSON:", addressJson);
      
      // Separando as propriedades para garantir que apenas os campos corretos são enviados
      const insertValues = {
        ownerId: insertProperty.ownerId,
        type: insertProperty.type,
        address: addressJson,
        rentValue: insertProperty.rentValue,
        bedrooms: insertProperty.bedrooms || null,
        bathrooms: insertProperty.bathrooms || null,
        area: insertProperty.area || null,
        description: insertProperty.description || null,
        availableForRent: insertProperty.availableForRent === undefined ? true : insertProperty.availableForRent,
        waterCompany: insertProperty.waterCompany || null,
        waterAccountNumber: insertProperty.waterAccountNumber || null,
        electricityCompany: insertProperty.electricityCompany || null,
        electricityAccountNumber: insertProperty.electricityAccountNumber || null
      };
      
      console.log("Valores para inserção:", JSON.stringify(insertValues, null, 2));
      
      const [property] = await db
        .insert(properties)
        .values(insertValues)
        .returning();
      
      console.log("Imóvel criado:", JSON.stringify(property, null, 2));
      
      return {
        ...property,
        address: typeof property.address === 'string' ? JSON.parse(property.address) : property.address
      };
    } catch (error) {
      console.error("Erro ao criar imóvel:", error);
      throw error;
    }
  }

  async updateProperty(id: number, partialProperty: Partial<InsertProperty>): Promise<Property | undefined> {
    // Ensure we have the current property
    const currentProperty = await this.getProperty(id);
    if (!currentProperty) return undefined;

    const updateData: any = { ...partialProperty };
    
    // Handle the address field if it's being updated
    if (partialProperty.address) {
      updateData.address = JSON.stringify(partialProperty.address);
    }

    const [updatedProperty] = await db
      .update(properties)
      .set(updateData)
      .where(eq(properties.id, id))
      .returning();
    
    if (!updatedProperty) return undefined;
    
    return {
      ...updatedProperty,
      address: typeof updatedProperty.address === 'string' ? JSON.parse(updatedProperty.address) : updatedProperty.address
    };
  }

  async deleteProperty(id: number): Promise<boolean> {
    try {
      await db
        .delete(properties)
        .where(eq(properties.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting property:", error);
      return false;
    }
  }

  async getContracts(): Promise<Contract[]> {
    const contractsData = await db.select().from(contracts);
    return contractsData;
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, id));
    
    return contract || undefined;
  }

  async getContractsByOwner(ownerId: number): Promise<Contract[]> {
    const contractsData = await db
      .select()
      .from(contracts)
      .where(eq(contracts.ownerId, ownerId));
    
    return contractsData;
  }

  async getContractsByTenant(tenantId: number): Promise<Contract[]> {
    const contractsData = await db
      .select()
      .from(contracts)
      .where(eq(contracts.tenantId, tenantId));
    
    return contractsData;
  }

  async getContractsByProperty(propertyId: number): Promise<Contract[]> {
    const contractsData = await db
      .select()
      .from(contracts)
      .where(eq(contracts.propertyId, propertyId));
    
    return contractsData;
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    try {
      console.log("Criando contrato:", JSON.stringify(insertContract, null, 2));
      
      const insertValues = {
        ownerId: insertContract.ownerId,
        tenantId: insertContract.tenantId,
        propertyId: insertContract.propertyId,
        startDate: insertContract.startDate,
        endDate: insertContract.endDate,
        duration: insertContract.duration,
        rentValue: insertContract.rentValue,
        paymentDay: insertContract.paymentDay,
        status: insertContract.status || 'ativo',
        observations: insertContract.observations || null
      };
      
      console.log("Valores para inserção:", JSON.stringify(insertValues, null, 2));
      
      const [contract] = await db
        .insert(contracts)
        .values(insertValues)
        .returning();
      
      console.log("Contrato criado:", JSON.stringify(contract, null, 2));
      
      return contract;
    } catch (error) {
      console.error("Erro ao criar contrato:", error);
      throw error;
    }
  }

  async updateContract(id: number, partialContract: Partial<InsertContract>): Promise<Contract | undefined> {
    const [updatedContract] = await db
      .update(contracts)
      .set(partialContract)
      .where(eq(contracts.id, id))
      .returning();
    
    return updatedContract || undefined;
  }

  async deleteContract(id: number): Promise<boolean> {
    try {
      await db
        .delete(contracts)
        .where(eq(contracts.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting contract:", error);
      return false;
    }
  }

  async getPayments(): Promise<Payment[]> {
    const paymentsData = await db.select().from(payments);
    return paymentsData;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id));
    
    return payment || undefined;
  }

  async getPaymentsByContract(contractId: number): Promise<Payment[]> {
    const paymentsData = await db
      .select()
      .from(payments)
      .where(eq(payments.contractId, contractId));
    
    return paymentsData;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    try {
      console.log("Criando pagamento:", JSON.stringify(insertPayment, null, 2));
      
      const insertValues = {
        contractId: insertPayment.contractId,
        dueDate: insertPayment.dueDate,
        value: insertPayment.value,
        isPaid: insertPayment.isPaid !== undefined ? insertPayment.isPaid : false,
        paymentDate: insertPayment.paymentDate || null,
        interestAmount: insertPayment.interestAmount || 0,
        latePaymentFee: insertPayment.latePaymentFee || 0,
        paymentMethod: insertPayment.paymentMethod || null,
        receiptNumber: insertPayment.receiptNumber || null,
        observations: insertPayment.observations || null
      };
      
      console.log("Valores para inserção:", JSON.stringify(insertValues, null, 2));
      
      const [payment] = await db
        .insert(payments)
        .values(insertValues)
        .returning();
      
      console.log("Pagamento criado:", JSON.stringify(payment, null, 2));
      
      return payment;
    } catch (error) {
      console.error("Erro ao criar pagamento:", error);
      throw error;
    }
  }

  async updatePayment(id: number, partialPayment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set(partialPayment)
      .where(eq(payments.id, id))
      .returning();
    
    return updatedPayment || undefined;
  }

  async deletePayment(id: number, userId: number): Promise<boolean> {
    try {
      // Primeiro, recupera o pagamento para armazenar os detalhes
      const [payment] = await db.select().from(payments).where(eq(payments.id, id));
      
      if (!payment) {
        return false;
      }
      
      // Insere o registro na tabela de pagamentos excluídos
      await db.insert(deletedPayments).values({
        originalId: payment.id,
        contractId: payment.contractId,
        dueDate: payment.dueDate,
        value: payment.value,
        isPaid: payment.isPaid || false,
        paymentDate: payment.paymentDate,
        interestAmount: payment.interestAmount || 0,
        latePaymentFee: payment.latePaymentFee || 0,
        paymentMethod: payment.paymentMethod,
        receiptNumber: payment.receiptNumber,
        observations: payment.observations,
        deletedBy: userId,
        originalCreatedAt: payment.createdAt,
        deletedAt: new Date()
      });
      
      // Remove o pagamento original
      await db.delete(payments).where(eq(payments.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting payment:", error);
      return false;
    }
  }
  
  // Métodos para pagamentos excluídos
  async getDeletedPayments(): Promise<DeletedPayment[]> {
    return await db.select().from(deletedPayments)
      .orderBy(desc(deletedPayments.deletedAt));
  }
  
  async getDeletedPaymentsByContract(contractId: number): Promise<DeletedPayment[]> {
    return await db.select().from(deletedPayments)
      .where(eq(deletedPayments.contractId, contractId))
      .orderBy(desc(deletedPayments.deletedAt));
  }
  
  async getDeletedPaymentsByUser(userId: number): Promise<DeletedPayment[]> {
    return await db.select().from(deletedPayments)
      .where(eq(deletedPayments.deletedBy, userId))
      .orderBy(desc(deletedPayments.deletedAt));
  }

  async getDashboardStats(): Promise<{
    expiredContracts: number;
    expiringContracts: number;
    totalContracts: number;
    pendingPayments: number;
    overduePayments: number;
  }> {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    const formattedToday = today.toISOString().split('T')[0];
    const formattedThirtyDaysFromNow = thirtyDaysFromNow.toISOString().split('T')[0];

    // Get total contracts
    const allContracts = await db.select().from(contracts);
    const totalContracts = allContracts.length;
    
    // Get expired contracts
    const expiredContractsData = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.status, 'ativo'),
          lt(contracts.endDate, formattedToday)
        )
      );
    const expiredContracts = expiredContractsData.length;
    
    // Get expiring contracts
    const expiringContractsData = await db
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.status, 'ativo'),
          gte(contracts.endDate, formattedToday),
          lte(contracts.endDate, formattedThirtyDaysFromNow)
        )
      );
    const expiringContracts = expiringContractsData.length;
    
    // Get overdue payments (past due date and unpaid)
    const overduePaymentsData = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.isPaid, false),
          lt(payments.dueDate, formattedToday)
        )
      );
    const overduePayments = overduePaymentsData.length;
    
    // Get pending payments (future due date and unpaid)
    const pendingPaymentsData = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.isPaid, false),
          gte(payments.dueDate, formattedToday)
        )
      );
    const pendingPayments = pendingPaymentsData.length;
    
    return {
      expiredContracts,
      expiringContracts,
      totalContracts,
      pendingPayments,
      overduePayments
    };
  }
}

export const storage = new DatabaseStorage();
