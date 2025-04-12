import { db } from './db';
import { owners, tenants, properties } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function runMigrations() {
  console.log("Iniciando migrações...");
  
  try {
    // Verifica se a coluna is_active já existe na tabela owners
    const ownerColumnsQuery = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'owners' AND column_name = 'is_active'
    `);
    
    // Se não existir, adiciona a coluna
    if (ownerColumnsQuery.rows.length === 0) {
      console.log("Adicionando coluna is_active na tabela owners...");
      await db.execute(sql`
        ALTER TABLE owners ADD COLUMN is_active boolean NOT NULL DEFAULT true
      `);
      console.log("Coluna is_active adicionada com sucesso na tabela owners.");
    } else {
      console.log("Coluna is_active já existe na tabela owners.");
    }

    // Verifica se a coluna is_active já existe na tabela tenants
    const tenantColumnsQuery = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name = 'is_active'
    `);
    
    // Se não existir, adiciona a coluna
    if (tenantColumnsQuery.rows.length === 0) {
      console.log("Adicionando coluna is_active na tabela tenants...");
      await db.execute(sql`
        ALTER TABLE tenants ADD COLUMN is_active boolean NOT NULL DEFAULT true
      `);
      console.log("Coluna is_active adicionada com sucesso na tabela tenants.");
    } else {
      console.log("Coluna is_active já existe na tabela tenants.");
    }

    // Verifica se a coluna is_active já existe na tabela properties
    const propertiesColumnsQuery = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'properties' AND column_name = 'is_active'
    `);
    
    // Se não existir, adiciona a coluna
    if (propertiesColumnsQuery.rows.length === 0) {
      console.log("Adicionando coluna is_active na tabela properties...");
      await db.execute(sql`
        ALTER TABLE properties ADD COLUMN is_active boolean NOT NULL DEFAULT true
      `);
      console.log("Coluna is_active adicionada com sucesso na tabela properties.");
    } else {
      console.log("Coluna is_active já existe na tabela properties.");
    }

    console.log("Migrações concluídas com sucesso!");
  } catch (error) {
    console.error("Erro ao executar migrações:", error);
    throw error;
  }
}

export default runMigrations;