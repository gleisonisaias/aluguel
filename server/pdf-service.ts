// Serviço de geração de PDF do servidor
import PDFDocument from 'pdfkit';
import { Contract, Owner, Property, Tenant } from '@shared/schema';
import { formatCPF, formatPhone } from '../client/src/utils/validation';
import { Request, Response } from 'express';
import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Declaração para PDFKit namespace
declare namespace PDFKit {
  interface PDFDocument {
    font(name: string): PDFDocument;
    fontSize(size: number): PDFDocument;
    text(text: string, options?: any): PDFDocument;
    text(text: string, x: number, y: number, options?: any): PDFDocument;
    moveDown(lines?: number): PDFDocument;
    addPage(options?: any): PDFDocument;
    end(): void;
    pipe(destination: any): any;
    y: number;
    page: {
      width: number;
      height: number;
      margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    };
  }
}

// Tipos para melhorar a legibilidade
interface ContractData {
  contract: Contract;
  owner: Owner;
  tenant: Tenant;
  property: Property;
}

interface PaymentReceiptData {
  paymentId: number;
  contractNumber: number;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  paymentValue: number;
  paymentDate: string;
  paymentMonth: string;
}

/**
 * Converte um valor numérico para texto por extenso em português
 * @param value Valor a ser convertido (já em reais, não em centavos)
 */
function valueToWords(value: number): string {
  // Se o valor for fornecido como centavos (ex: 115000 representando R$ 1.150,00), 
  // dividimos por 100 para obter o valor em reais
  if (value > 9999 && Number.isInteger(value)) {
    value = value / 100;
  }
  
  if (value === 0) return 'zero reais';
  
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  
  let result = '';
  
  // Trata reais (parte inteira)
  const intValue = Math.floor(value);
  if (intValue > 0) {
    // Milhares
    if (intValue >= 1000) {
      const thousands = Math.floor(intValue / 1000);
      if (thousands === 1) {
        result += 'mil ';
      } else {
        if (thousands < 10) {
          result += units[thousands] + ' mil ';
        } else if (thousands < 20) {
          result += teens[thousands - 10] + ' mil ';
        } else {
          const tenDigit = Math.floor(thousands / 10);
          const unitDigit = thousands % 10;
          result += tens[tenDigit];
          if (unitDigit > 0) {
            result += ' e ' + units[unitDigit];
          }
          result += ' mil ';
        }
      }
    }
    
    // Centenas
    const remainder = intValue % 1000;
    if (remainder >= 100) {
      const hundred = Math.floor(remainder / 100);
      if (remainder === 100) {
        result += 'cem';
      } else {
        result += hundreds[hundred];
      }
      
      const remainderTens = remainder % 100;
      if (remainderTens > 0) {
        result += ' e ';
      }
    }
    
    // Dezenas e Unidades
    const remainderTens = remainder % 100;
    if (remainderTens > 0) {
      if (remainderTens < 10) {
        result += units[remainderTens];
      } else if (remainderTens < 20) {
        result += teens[remainderTens - 10];
      } else {
        const tenDigit = Math.floor(remainderTens / 10);
        const unitDigit = remainderTens % 10;
        result += tens[tenDigit];
        if (unitDigit > 0) {
          result += ' e ' + units[unitDigit];
        }
      }
    }
    
    result += intValue === 1 ? ' real' : ' reais';
  }
  
  // Trata centavos
  const cents = Math.round((value - intValue) * 100);
  if (cents > 0) {
    if (intValue > 0) {
      result += ' e ';
    }
    
    if (cents < 10) {
      result += units[cents];
    } else if (cents < 20) {
      result += teens[cents - 10];
    } else {
      const tenDigit = Math.floor(cents / 10);
      const unitDigit = cents % 10;
      result += tens[tenDigit];
      if (unitDigit > 0) {
        result += ' e ' + units[unitDigit];
      }
    }
    
    result += cents === 1 ? ' centavo' : ' centavos';
  }
  
  return result;
}

/**
 * Adiciona o cabeçalho ao documento PDF
 */
function addHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .text(title, { align: 'center' });
  
  doc.moveDown();
  
  // Adiciona a data atual
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  doc.fontSize(10)
     .text(`Data de emissão: ${formattedDate}`, { align: 'right' });
  
  doc.moveDown(2);
}

/**
 * Adiciona as informações das partes contratantes ao documento PDF
 */
function addParties(doc: PDFKit.PDFDocument, owner: Owner, tenant: Tenant) {
  // Formatando as informações do Locador (proprietário)
  const ownerAddress = typeof owner.address === 'string' 
    ? JSON.parse(owner.address) 
    : owner.address;
  
  const ownerAddressStr = `${ownerAddress.street}, ${ownerAddress.number}${ownerAddress.complement ? ', ' + ownerAddress.complement : ''}, ${ownerAddress.neighborhood}, ${ownerAddress.city} - ${ownerAddress.state}, CEP: ${ownerAddress.zipCode}`;
  
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('LOCADOR:');
  
  doc.font('Helvetica')
     .fontSize(11)
     .text(`Nome: ${owner.name}`)
     .text(`CPF/CNPJ: ${owner.document}`)
     .text(`Endereço: ${ownerAddressStr}`)
     .text(`Telefone: ${owner.phone}`)
     .text(`E-mail: ${owner.email}`);
  
  doc.moveDown();
  
  // Formatando as informações do Locatário (inquilino)
  const tenantAddress = typeof tenant.address === 'string' 
    ? JSON.parse(tenant.address) 
    : tenant.address;
  
  const tenantAddressStr = `${tenantAddress.street}, ${tenantAddress.number}${tenantAddress.complement ? ', ' + tenantAddress.complement : ''}, ${tenantAddress.neighborhood}, ${tenantAddress.city} - ${tenantAddress.state}, CEP: ${tenantAddress.zipCode}`;
  
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('LOCATÁRIO:');
  
  doc.font('Helvetica')
     .fontSize(11)
     .text(`Nome: ${tenant.name}`)
     .text(`CPF/CNPJ: ${tenant.document}`)
     .text(`RG: ${tenant.rg || 'Não informado'}`)
     .text(`Endereço: ${tenantAddressStr}`)
     .text(`Telefone: ${tenant.phone}`)
     .text(`E-mail: ${tenant.email}`);
  
  // Informações do fiador, se existir
  const guarantor = tenant.guarantor 
    ? (typeof tenant.guarantor === 'string' ? JSON.parse(tenant.guarantor) : tenant.guarantor) 
    : null;
  
  if (guarantor && guarantor.name) {
    doc.moveDown();
    
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .text('FIADOR:');
    
    doc.font('Helvetica')
       .fontSize(11)
       .text(`Nome: ${guarantor.name}`)
       .text(`CPF/CNPJ: ${guarantor.document || 'Não informado'}`)
       .text(`Telefone: ${guarantor.phone || 'Não informado'}`)
       .text(`E-mail: ${guarantor.email || 'Não informado'}`);
    
    if (guarantor.address) {
      const guarantorAddressStr = `${guarantor.address.street}, ${guarantor.address.number}${guarantor.address.complement ? ', ' + guarantor.address.complement : ''}, ${guarantor.address.neighborhood}, ${guarantor.address.city} - ${guarantor.address.state}, CEP: ${guarantor.address.zipCode}`;
      
      doc.text(`Endereço: ${guarantorAddressStr}`);
    }
  }
  
  doc.moveDown(2);
}

/**
 * Adiciona as informações do imóvel ao documento PDF
 */
function addPropertyInfo(doc: PDFKit.PDFDocument, property: Property, contract?: Contract) {
  const propertyAddress = typeof property.address === 'string' 
    ? JSON.parse(property.address) 
    : property.address;
  
  const propertyAddressStr = `${propertyAddress.street}, ${propertyAddress.number}${propertyAddress.complement ? ', ' + propertyAddress.complement : ''}, ${propertyAddress.neighborhood}, ${propertyAddress.city} - ${propertyAddress.state}, CEP: ${propertyAddress.zipCode}`;
  
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('OBJETO DA LOCAÇÃO:');
  
  // Usar o valor do contrato (se disponível) ou o valor do imóvel
  const rentValue = contract ? contract.rentValue : property.rentValue;
  
  doc.font('Helvetica')
     .fontSize(11)
     .text(`Imóvel: ${property.type.charAt(0).toUpperCase() + property.type.slice(1)}`)
     .text(`Endereço: ${propertyAddressStr}`)
     .text(`Valor do Aluguel: R$ ${rentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
     .text(`Área: ${property.area || 'Não informada'} m²`)
     .text(`Quartos: ${property.bedrooms || 'Não informado'}`)
     .text(`Banheiros: ${property.bathrooms || 'Não informado'}`);
  
  // Adicionar informações de concessionárias, se disponíveis
  if (property.waterCompany || property.electricityCompany) {
    doc.moveDown();
    doc.font('Helvetica-Bold')
       .text('INFORMAÇÕES DE CONCESSIONÁRIAS:');
    
    doc.font('Helvetica');
    
    if (property.waterCompany) {
      doc.text(`Companhia de Água: ${property.waterCompany}`);
      
      if (property.waterAccountNumber) {
        doc.text(`Número da Conta de Água: ${property.waterAccountNumber}`);
      }
    }
    
    if (property.electricityCompany) {
      doc.text(`Companhia de Energia: ${property.electricityCompany}`);
      
      if (property.electricityAccountNumber) {
        doc.text(`Número da Conta de Energia: ${property.electricityAccountNumber}`);
      }
    }
  }
  
  doc.moveDown(2);
}

/**
 * Adiciona cláusulas de contrato residencial ao documento PDF
 */
function addResidentialContractClauses(doc: PDFKit.PDFDocument, contract: Contract, property: Property) {
  const startDate = new Date(contract.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(contract.endDate).toLocaleDateString('pt-BR');
  // Todos os valores no sistema estão armazenados em reais
  const rentValueNum = Number(contract.rentValue);
  // Usamos o valor diretamente, sem conversão
  const valueForDisplay = rentValueNum;
  // Converter para formato de moeda brasileira (R$ 1.150,00)
  const rentValue = valueForDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('CLÁUSULAS E CONDIÇÕES:');
  
  doc.font('Helvetica')
     .fontSize(11);
  
  // Cláusula 1 - Prazo
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 1ª - PRAZO', { underline: true });
  
  doc.font('Helvetica')
     .text(`A locação terá início em ${startDate} e término em ${endDate}, pelo período de ${contract.duration} meses. Ao término deste prazo, não havendo manifestação por escrito de qualquer das partes, o contrato será prorrogado por prazo indeterminado.`, { align: 'justify' });
  
  // Cláusula 2 - Valor e forma de pagamento
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 2ª - VALOR E FORMA DE PAGAMENTO', { underline: true });
  
  doc.font('Helvetica')
     .text(`O aluguel mensal é de R$ ${rentValue} (${valueToWords(valueForDisplay)}), a ser pago até o dia ${contract.paymentDay} de cada mês, mediante depósito bancário ou outra forma a ser acordada entre as partes.`, { align: 'justify' })
     .text(`Parágrafo Único: O atraso no pagamento acarretará multa de 10% (dez por cento) sobre o valor do aluguel, além de juros de 1% (um por cento) ao mês, calculados pro rata die.`, { align: 'justify' });
  
  // Cláusula 3 - Reajuste
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 3ª - REAJUSTE', { underline: true });
  
  doc.font('Helvetica')
     .text(`O valor do aluguel será reajustado anualmente, de acordo com a variação do Índice Geral de Preços - Mercado (IGP-M) da Fundação Getúlio Vargas, ou outro índice que vier a substituí-lo.`, { align: 'justify' });
  
  // Cláusula 4 - Destinação do imóvel
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 4ª - DESTINAÇÃO DO IMÓVEL', { underline: true });
  
  doc.font('Helvetica')
     .text(`O imóvel objeto deste contrato destina-se exclusivamente para fins residenciais, não podendo o LOCATÁRIO utilizá-lo para outros fins sem prévia autorização por escrito do LOCADOR.`, { align: 'justify' });
  
  // Cláusula 5 - Despesas e encargos
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 5ª - DESPESAS E ENCARGOS', { underline: true });
  
  doc.font('Helvetica')
     .text(`Correrão por conta do LOCATÁRIO as despesas com taxas de luz, água, telefone, gás, condomínio e outras taxas que incidam ou venham a incidir sobre o imóvel, bem como o Imposto Predial e Territorial Urbano (IPTU).`, { align: 'justify' });
  
  // Cláusula 6 - Conservação e restituição do imóvel
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 6ª - CONSERVAÇÃO E RESTITUIÇÃO DO IMÓVEL', { underline: true });
  
  doc.font('Helvetica')
     .text(`O LOCATÁRIO obriga-se a conservar o imóvel e a devolvê-lo, ao final da locação, em perfeitas condições de uso e conservação, inclusive com pintura nova, responsabilizando-se pelos danos que porventura sobrevierem ao imóvel durante a locação.`, { align: 'justify' });
  
  // Cláusula 7 - Benfeitorias
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 7ª - BENFEITORIAS', { underline: true });
  
  doc.font('Helvetica')
     .text(`O LOCATÁRIO não poderá fazer no imóvel, sem prévia autorização por escrito do LOCADOR, benfeitorias ou modificações de qualquer natureza. As benfeitorias úteis ou voluptuárias realizadas pelo LOCATÁRIO, ainda que autorizadas, não serão indenizáveis e ficarão incorporadas ao imóvel.`, { align: 'justify' });
  
  // Adicionando mais cláusulas se necessário, verificando o espaço disponível na página
  if (doc.y > 700) {
    doc.addPage();
  }
  
  // Cláusula 8 - Garantia
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 8ª - GARANTIA', { underline: true });
  
  doc.font('Helvetica')
     .text(`Para garantir as obrigações assumidas neste contrato, o LOCATÁRIO apresenta como garantia a fiança prestada por pessoa idônea, qualificada no preâmbulo deste instrumento, que responderá solidariamente por todas as obrigações do LOCATÁRIO.`, { align: 'justify' });
  
  // Cláusula 9 - Rescisão
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 9ª - RESCISÃO', { underline: true });
  
  doc.font('Helvetica')
     .text(`O presente contrato poderá ser rescindido a qualquer tempo, por iniciativa de qualquer das partes, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias, ou imediatamente, no caso de descumprimento de qualquer cláusula contratual.`, { align: 'justify' });
  
  // Cláusula 10 - Foro
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 10ª - FORO', { underline: true });
  
  doc.font('Helvetica')
     .text(`Fica eleito o foro da comarca onde se localiza o imóvel para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`, { align: 'justify' });
  
  doc.moveDown();
  doc.text(`E por estarem justos e contratados, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas, para que produza seus efeitos legais.`, { align: 'justify' });
  
  doc.moveDown(2);
}

/**
 * Adiciona cláusulas de contrato comercial ao documento PDF
 */
function addCommercialContractClauses(doc: PDFKit.PDFDocument, contract: Contract, property: Property) {
  const startDate = new Date(contract.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(contract.endDate).toLocaleDateString('pt-BR');
  // Todos os valores no sistema estão armazenados em reais
  const rentValueNum = Number(contract.rentValue);
  // Usamos o valor diretamente, sem conversão
  const valueForDisplay = rentValueNum;
  // Converter para formato de moeda brasileira (R$ 1.150,00)
  const rentValue = valueForDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('CLÁUSULAS E CONDIÇÕES:');
  
  doc.font('Helvetica')
     .fontSize(11);
  
  // Cláusula 1 - Prazo
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 1ª - PRAZO', { underline: true });
  
  doc.font('Helvetica')
     .text(`A locação terá início em ${startDate} e término em ${endDate}, pelo período de ${contract.duration} meses. Ao término deste prazo, não havendo manifestação por escrito de qualquer das partes, o contrato será prorrogado por prazo indeterminado.`, { align: 'justify' });
  
  // Cláusula 2 - Valor e forma de pagamento
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 2ª - VALOR E FORMA DE PAGAMENTO', { underline: true });
  
  doc.font('Helvetica')
     .text(`O aluguel mensal é de R$ ${rentValue} (${valueToWords(valueForDisplay)}), a ser pago até o dia ${contract.paymentDay} de cada mês, mediante depósito bancário ou outra forma a ser acordada entre as partes.`, { align: 'justify' })
     .text(`Parágrafo Único: O atraso no pagamento acarretará multa de 10% (dez por cento) sobre o valor do aluguel, além de juros de 1% (um por cento) ao mês, calculados pro rata die.`, { align: 'justify' });
  
  // Cláusula 3 - Reajuste
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 3ª - REAJUSTE', { underline: true });
  
  doc.font('Helvetica')
     .text(`O valor do aluguel será reajustado anualmente, de acordo com a variação do Índice Geral de Preços - Mercado (IGP-M) da Fundação Getúlio Vargas, ou outro índice que vier a substituí-lo.`, { align: 'justify' });
  
  // Cláusula 4 - Destinação do imóvel
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 4ª - DESTINAÇÃO DO IMÓVEL', { underline: true });
  
  doc.font('Helvetica')
     .text(`O imóvel objeto deste contrato destina-se exclusivamente para fins comerciais, não podendo o LOCATÁRIO utilizá-lo para outros fins sem prévia autorização por escrito do LOCADOR.`, { align: 'justify' });
  
  // Cláusula 5 - Despesas e encargos
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 5ª - DESPESAS E ENCARGOS', { underline: true });
  
  doc.font('Helvetica')
     .text(`Correrão por conta do LOCATÁRIO as despesas com taxas de luz, água, telefone, gás, condomínio e outras taxas que incidam ou venham a incidir sobre o imóvel, bem como o Imposto Predial e Territorial Urbano (IPTU).`, { align: 'justify' });
  
  // Cláusula 6 - Conservação e restituição do imóvel
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 6ª - CONSERVAÇÃO E RESTITUIÇÃO DO IMÓVEL', { underline: true });
  
  doc.font('Helvetica')
     .text(`O LOCATÁRIO obriga-se a conservar o imóvel e a devolvê-lo, ao final da locação, em perfeitas condições de uso e conservação, inclusive com pintura nova, responsabilizando-se pelos danos que porventura sobrevierem ao imóvel durante a locação.`, { align: 'justify' });
  
  // Cláusula 7 - Benfeitorias
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 7ª - BENFEITORIAS', { underline: true });
  
  doc.font('Helvetica')
     .text(`O LOCATÁRIO não poderá fazer no imóvel, sem prévia autorização por escrito do LOCADOR, benfeitorias ou modificações de qualquer natureza. As benfeitorias úteis ou voluptuárias realizadas pelo LOCATÁRIO, ainda que autorizadas, não serão indenizáveis e ficarão incorporadas ao imóvel.`, { align: 'justify' });
  
  // Adicionando mais cláusulas se necessário, verificando o espaço disponível na página
  if (doc.y > 700) {
    doc.addPage();
  }
  
  // Cláusula 8 - Garantia
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 8ª - GARANTIA', { underline: true });
  
  doc.font('Helvetica')
     .text(`Para garantir as obrigações assumidas neste contrato, o LOCATÁRIO apresenta como garantia a fiança prestada por pessoa idônea, qualificada no preâmbulo deste instrumento, que responderá solidariamente por todas as obrigações do LOCATÁRIO.`, { align: 'justify' });
  
  // Cláusula 9 - Rescisão
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 9ª - RESCISÃO', { underline: true });
  
  doc.font('Helvetica')
     .text(`O presente contrato poderá ser rescindido a qualquer tempo, por iniciativa de qualquer das partes, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias, ou imediatamente, no caso de descumprimento de qualquer cláusula contratual.`, { align: 'justify' });
  
  // Cláusula 10 - Foro
  doc.moveDown();
  doc.font('Helvetica-Bold')
     .text('CLÁUSULA 10ª - FORO', { underline: true });
  
  doc.font('Helvetica')
     .text(`Fica eleito o foro da comarca onde se localiza o imóvel para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`, { align: 'justify' });
  
  doc.moveDown();
  doc.text(`E por estarem justos e contratados, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas, para que produza seus efeitos legais.`, { align: 'justify' });
  
  doc.moveDown(2);
}

/**
 * Adiciona campos para assinatura ao documento PDF
 */
function addSignatureFields(doc: PDFKit.PDFDocument, owner: Owner, tenant: Tenant) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / 2;
  
  // Garantir que as assinaturas e testemunhas fiquem na mesma página
  // Se estiver próximo do final da página, adicionar nova página
  // Senão, apenas adicionar espaço suficiente
  if (doc.y > 500) {
    doc.addPage();
  } else {
    doc.moveDown(2);
  }
  
  // Adicionar local e data
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  
  doc.fontSize(11)
     .text(`Local e data: ___________________________, ${formattedDate}`, { align: 'center' });
  
  doc.moveDown(2);
  
  doc.fontSize(11);
  
  doc.moveDown(2);
  
  // Assinaturas
  doc.text('_______________________________', doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
  doc.text('Locador', doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
  doc.text(`${owner.name}`, doc.page.margins.left, doc.y, { width: colWidth, align: 'center' });
  
  doc.text('_______________________________', doc.page.margins.left + colWidth, doc.y - 20, { width: colWidth, align: 'center' });
  doc.text('Locatário', doc.page.margins.left + colWidth, doc.y, { width: colWidth, align: 'center' });
  doc.text(`${tenant.name}`, doc.page.margins.left + colWidth, doc.y, { width: colWidth, align: 'center' });
  
  doc.moveDown(3);
  
  // Testemunhas
  doc.text('TESTEMUNHAS:', { align: 'left' });
  
  doc.moveDown(1);
  
  // Primeira testemunha (à esquerda)
  doc.text('1) _______________________________', doc.page.margins.left, doc.y, { width: colWidth, align: 'left' });
  doc.text('Nome: _____________________________', doc.page.margins.left, doc.y, { width: colWidth, align: 'left' });
  doc.text('CPF: ______________________________', doc.page.margins.left, doc.y, { width: colWidth, align: 'left' });
  
  // Segunda testemunha (à direita)
  const yPosAfterFirstWitness = doc.y;
  doc.text('2) _______________________________', doc.page.margins.left + colWidth, yPosAfterFirstWitness - 30, { width: colWidth, align: 'left' });
  doc.text('Nome: _____________________________', doc.page.margins.left + colWidth, doc.y, { width: colWidth, align: 'left' });
  doc.text('CPF: ______________________________', doc.page.margins.left + colWidth, doc.y, { width: colWidth, align: 'left' });
}

// Endpoints para PDFs

export async function generateResidentialContractPDF(req: Request, res: Response) {
  try {
    const contractId = Number(req.params.id);
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }
    
    const [owner, tenant, property] = await Promise.all([
      storage.getOwner(contract.ownerId),
      storage.getTenant(contract.tenantId),
      storage.getProperty(contract.propertyId)
    ]);
    
    if (!owner || !tenant || !property) {
      return res.status(404).json({ error: 'Dados relacionados não encontrados' });
    }
    
    // Criar um arquivo temporário para o PDF
    const tempFilePath = path.join(tmpdir(), `contrato_residencial_${contractId}_${Date.now()}.pdf`);
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      info: {
        Title: `Contrato de Locação Residencial - ${owner.name} e ${tenant.name}`,
        Author: 'Sistema de Gestão de Contratos de Aluguel',
        Subject: 'Contrato de Locação Residencial',
        Keywords: 'aluguel, contrato, locação, residencial',
        CreationDate: new Date(),
      }
    });
    
    // Pipe o PDF para o arquivo temporário
    const writeStream = fs.createWriteStream(tempFilePath);
    doc.pipe(writeStream);
    
    // Adicionar conteúdo ao PDF
    addHeader(doc, 'CONTRATO DE LOCAÇÃO RESIDENCIAL');
    addParties(doc, owner, tenant);
    addPropertyInfo(doc, property, contract);
    addResidentialContractClauses(doc, contract, property);
    addSignatureFields(doc, owner, tenant);
    
    // Finalizar o documento
    doc.end();
    
    // Quando o stream terminar, envie o arquivo para o cliente
    writeStream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contrato_residencial_${contractId}.pdf"`);
      
      const readStream = fs.createReadStream(tempFilePath);
      readStream.pipe(res);
      
      // Limpar o arquivo temporário após o envio
      readStream.on('end', () => {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Erro ao excluir arquivo temporário:', err);
        });
      });
    });
  } catch (error) {
    console.error('Erro ao gerar PDF do contrato residencial:', error);
    res.status(500).json({ error: 'Erro ao gerar PDF do contrato residencial' });
  }
}

export async function generateCommercialContractPDF(req: Request, res: Response) {
  try {
    const contractId = Number(req.params.id);
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }
    
    const [owner, tenant, property] = await Promise.all([
      storage.getOwner(contract.ownerId),
      storage.getTenant(contract.tenantId),
      storage.getProperty(contract.propertyId)
    ]);
    
    if (!owner || !tenant || !property) {
      return res.status(404).json({ error: 'Dados relacionados não encontrados' });
    }
    
    // Criar um arquivo temporário para o PDF
    const tempFilePath = path.join(tmpdir(), `contrato_comercial_${contractId}_${Date.now()}.pdf`);
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      info: {
        Title: `Contrato de Locação Comercial - ${owner.name} e ${tenant.name}`,
        Author: 'Sistema de Gestão de Contratos de Aluguel',
        Subject: 'Contrato de Locação Comercial',
        Keywords: 'aluguel, contrato, locação, comercial',
        CreationDate: new Date(),
      }
    });
    
    // Pipe o PDF para o arquivo temporário
    const writeStream = fs.createWriteStream(tempFilePath);
    doc.pipe(writeStream);
    
    // Adicionar conteúdo ao PDF
    addHeader(doc, 'CONTRATO DE LOCAÇÃO COMERCIAL');
    addParties(doc, owner, tenant);
    addPropertyInfo(doc, property, contract);
    addCommercialContractClauses(doc, contract, property);
    addSignatureFields(doc, owner, tenant);
    
    // Finalizar o documento
    doc.end();
    
    // Quando o stream terminar, envie o arquivo para o cliente
    writeStream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contrato_comercial_${contractId}.pdf"`);
      
      const readStream = fs.createReadStream(tempFilePath);
      readStream.pipe(res);
      
      // Limpar o arquivo temporário após o envio
      readStream.on('end', () => {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Erro ao excluir arquivo temporário:', err);
        });
      });
    });
  } catch (error) {
    console.error('Erro ao gerar PDF do contrato comercial:', error);
    res.status(500).json({ error: 'Erro ao gerar PDF do contrato comercial' });
  }
}

export async function generatePaymentReceiptPDF(req: Request, res: Response) {
  try {
    const paymentId = Number(req.params.id);
    const payment = await storage.getPayment(paymentId);
    
    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    
    const contract = await storage.getContract(payment.contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }
    
    const [owner, tenant, property] = await Promise.all([
      storage.getOwner(contract.ownerId),
      storage.getTenant(contract.tenantId),
      storage.getProperty(contract.propertyId)
    ]);
    
    if (!owner || !tenant || !property) {
      return res.status(404).json({ error: 'Dados relacionados não encontrados' });
    }
    
    // Formatar o endereço da propriedade
    const propertyAddress = typeof property.address === 'string' 
      ? JSON.parse(property.address) 
      : property.address;
    
    const propertyAddressStr = `${propertyAddress.street}, ${propertyAddress.number}${propertyAddress.complement ? ', ' + propertyAddress.complement : ''}, ${propertyAddress.neighborhood}, ${propertyAddress.city} - ${propertyAddress.state}, CEP: ${propertyAddress.zipCode}`;
    
    // Formatar data de pagamento e mês de referência
    const paymentDate = payment.paymentDate 
      ? new Date(payment.paymentDate).toLocaleDateString('pt-BR') 
      : 'Data não informada';
    
    const dueDate = new Date(payment.dueDate);
    const paymentMonth = dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    // Criar um arquivo temporário para o PDF
    const tempFilePath = path.join(tmpdir(), `recibo_pagamento_${paymentId}_${Date.now()}.pdf`);
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      info: {
        Title: `Recibo de Pagamento de Aluguel - ${paymentMonth}`,
        Author: 'Sistema de Gestão de Contratos de Aluguel',
        Subject: 'Recibo de Pagamento',
        Keywords: 'aluguel, recibo, pagamento',
        CreationDate: new Date(),
      }
    });
    
    // Pipe o PDF para o arquivo temporário
    const writeStream = fs.createWriteStream(tempFilePath);
    doc.pipe(writeStream);
    
    // Adicionar cabeçalho
    addHeader(doc, 'RECIBO DE PAGAMENTO DE ALUGUEL');
    
    // Adicionar informações do recibo
    doc.moveDown(2);
    doc.fontSize(12);
    
    doc.text(`Recibo Nº: ${paymentId}`, { align: 'left' });
    doc.text(`Contrato Nº: ${contract.id}`, { align: 'left' });
    doc.text(`Data de Pagamento: ${paymentDate}`, { align: 'left' });
    doc.moveDown();
    
        // Todos os valores no sistema estão armazenados em reais
    const paymentValueNum = Number(payment.value);
    // Usamos o valor diretamente, sem conversão
    const valueForDisplay = paymentValueNum;
    // Converter para formato de moeda brasileira (R$ 1.150,00)
    const paymentValue = valueForDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.text(`Recebi de ${tenant.name} a importância de R$ ${paymentValue} (${valueToWords(valueForDisplay)}), referente ao aluguel do imóvel situado em ${propertyAddressStr}, relativo ao mês de ${paymentMonth}.`, { align: 'justify' });
    
    doc.moveDown(2);
    doc.text(`Para maior clareza, firmo o presente recibo para que produza os seus jurídicos e legais efeitos.`, { align: 'justify' });
    
    doc.moveDown(4);
    doc.text(`_________________________________________`, { align: 'center' });
    doc.text(`${owner.name}`, { align: 'center' });
    doc.text(`Proprietário`, { align: 'center' });
    
    // Finalizar o documento
    doc.end();
    
    // Quando o stream terminar, envie o arquivo para o cliente
    writeStream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo_pagamento_${paymentId}.pdf"`);
      
      const readStream = fs.createReadStream(tempFilePath);
      readStream.pipe(res);
      
      // Limpar o arquivo temporário após o envio
      readStream.on('end', () => {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Erro ao excluir arquivo temporário:', err);
        });
      });
    });
  } catch (error) {
    console.error('Erro ao gerar PDF do recibo de pagamento:', error);
    res.status(500).json({ error: 'Erro ao gerar PDF do recibo de pagamento' });
  }
}