// Format currency to Brazilian Real (R$)
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Format date to Brazilian format (DD/MM/YYYY)
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat("pt-BR").format(date);
};

// Format date to ISO format (YYYY-MM-DD) for input fields
export const formatDateToISO = (dateString: string | Date): string => {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toISOString().split("T")[0];
};

// Calculate end date based on start date and duration (months)
export const calculateEndDate = (startDate: string, durationMonths: number): string => {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + durationMonths);
  return formatDateToISO(date);
};

// Format property type to display name
export const formatPropertyType = (type: string): string => {
  const types: Record<string, string> = {
    apartamento: "Apartamento",
    casa: "Casa",
    comercial: "Comercial",
    terreno: "Terreno",
  };
  
  return types[type] || type;
};

// Format contract status to display name
export const formatContractStatus = (status: string): string => {
  const statuses: Record<string, string> = {
    ativo: "Ativo",
    pendente: "Pendente",
    encerrado: "Encerrado",
  };
  
  return statuses[status] || status;
};

// Format property address for display
export const formatPropertyAddress = (address: any): string => {
  if (!address) return "";
  
  const parts = [
    address.street,
    address.number && `${address.number}`,
    address.complement && `${address.complement}`,
    address.neighborhood && `- ${address.neighborhood}`,
    address.city && address.state && `${address.city}/${address.state}`,
  ].filter(Boolean);
  
  return parts.join(", ");
};

// Check if a payment is overdue
export const isPaymentOverdue = (dueDate: string, isPaid: boolean | null): boolean => {
  if (isPaid) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time portion for accurate comparison
  
  const paymentDueDate = new Date(dueDate);
  paymentDueDate.setHours(0, 0, 0, 0);
  
  return paymentDueDate < today;
};
