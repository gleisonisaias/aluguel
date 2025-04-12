import { pgTable, text, serial, integer, boolean, date, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Common schema for address
const addressSchema = z.object({
  zipCode: z.string().min(1, "CEP é obrigatório"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado é obrigatório"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"), // admin, user
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull().unique(), // CPF/CNPJ - Agora com unique constraint
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(), // JSON string of the address
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull().unique(), // CPF/CNPJ - Agora com unique constraint
  rg: text("rg"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(), // JSON string of the address
  guarantor: text("guarantor"), // JSON string of the guarantor info
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => owners.id),
  type: text("type").notNull(),
  address: text("address").notNull(), // JSON string of the address
  rentValue: doublePrecision("rent_value").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  area: integer("area"),
  description: text("description"),
  availableForRent: boolean("available_for_rent").default(true),
  waterCompany: text("water_company"), // Empresa de água
  waterAccountNumber: text("water_account_number"), // Número da conta de água
  electricityCompany: text("electricity_company"), // Empresa de energia elétrica
  electricityAccountNumber: text("electricity_account_number"), // Número da conta de energia
  isActive: boolean("is_active").notNull().default(true), // Indica se o imóvel está ativo no sistema
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => owners.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  duration: integer("duration").notNull(), // in months
  rentValue: integer("rent_value").notNull(), // in cents
  paymentDay: integer("payment_day").notNull(),
  status: text("status").notNull(), // ativo, pendente, encerrado
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  dueDate: date("due_date").notNull(),
  value: integer("value").notNull(), // in cents
  isPaid: boolean("is_paid").default(false),
  paymentDate: date("payment_date"),
  interestAmount: integer("interest_amount").default(0), // juros em centavos
  latePaymentFee: integer("late_payment_fee").default(0), // multa em centavos
  paymentMethod: text("payment_method"), // método de pagamento (PIX, dinheiro, etc)
  receiptNumber: text("receipt_number"), // número do recibo
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela para registrar pagamentos excluídos
export const deletedPayments = pgTable("deleted_payments", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id"), // ID original do pagamento excluído
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  dueDate: date("due_date").notNull(),
  value: integer("value").notNull(), // in cents
  isPaid: boolean("is_paid").default(false),
  paymentDate: date("payment_date"),
  interestAmount: integer("interest_amount").default(0),
  latePaymentFee: integer("late_payment_fee").default(0),
  paymentMethod: text("payment_method"),
  receiptNumber: text("receipt_number"),
  observations: text("observations"),
  deletedBy: integer("deleted_by").references(() => users.id), // Usuário que excluiu
  deletedAt: timestamp("deleted_at").defaultNow(), // Data/hora da exclusão
  originalCreatedAt: timestamp("original_created_at"), // Data de criação do pagamento original
});

// Relations
export const ownersRelations = relations(owners, ({ many }) => ({
  properties: many(properties),
  contracts: many(contracts),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  contracts: many(contracts),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(owners, {
    fields: [properties.ownerId],
    references: [owners.id],
  }),
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  owner: one(owners, {
    fields: [contracts.ownerId],
    references: [owners.id],
  }),
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [contracts.propertyId],
    references: [properties.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  contract: one(contracts, {
    fields: [payments.contractId],
    references: [contracts.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
});

export const insertOwnerSchema = createInsertSchema(owners).extend({
  address: addressSchema,
});

export const insertTenantSchema = createInsertSchema(tenants).extend({
  address: addressSchema,
  guarantor: z.object({
    name: z.string(),
    document: z.string(),
    phone: z.string(),
    email: z.string(),
  }).optional(),
});

export const insertPropertySchema = createInsertSchema(properties).extend({
  address: addressSchema,
  waterCompany: z.string().optional(),
  waterAccountNumber: z.string().optional(),
  electricityCompany: z.string().optional(),
  electricityAccountNumber: z.string().optional(),
});

export const insertContractSchema = createInsertSchema(contracts);

export const insertPaymentSchema = createInsertSchema(payments);
export const insertDeletedPaymentSchema = createInsertSchema(deletedPayments);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDeletedPayment = z.infer<typeof insertDeletedPaymentSchema>;
export type DeletedPayment = typeof deletedPayments.$inferSelect;

export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof owners.$inferSelect & { 
  address: z.infer<typeof addressSchema> 
};

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect & { 
  address: z.infer<typeof addressSchema> 
};

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect & { 
  address: z.infer<typeof addressSchema> 
};

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Validation schemas with more specific rules
export const userValidationSchema = insertUserSchema.extend({
  username: z.string().min(4, "Nome de usuário deve ter pelo menos 4 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "user"], {
    errorMap: () => ({ message: "Selecione um papel válido (admin/user)" }),
  }),
});

export const ownerValidationSchema = insertOwnerSchema.extend({
  document: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Formato: 123.456.789-00"),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido. Formato: (11) 98765-4321"),
  email: z.string().email("Email inválido"),
});

export const tenantValidationSchema = insertTenantSchema.extend({
  document: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Formato: 123.456.789-00"),
  phone: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido. Formato: (11) 98765-4321"),
  email: z.string().email("Email inválido"),
});

export const propertyValidationSchema = insertPropertySchema.extend({
  type: z.enum(["apartamento", "casa", "comercial", "terreno"], {
    errorMap: () => ({ message: "Selecione um tipo de imóvel válido" }),
  }),
  rentValue: z.number().min(1, "Valor do aluguel é obrigatório"),
});

export const contractValidationSchema = insertContractSchema.extend({
  ownerId: z.number().min(1, "Selecione um proprietário"),
  tenantId: z.number().min(1, "Selecione um inquilino"),
  propertyId: z.number().min(1, "Selecione um imóvel"),
  duration: z.number().min(1, "Duração mínima de 1 mês"),
  paymentDay: z.number().min(1, "Dia inválido").max(31, "Dia inválido"),
});
