import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Contract, Owner, Property, Tenant } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface ContractPDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number;
}

export const ContractPDFDialog = ({ isOpen, onClose, contractId }: ContractPDFDialogProps) => {
  const [contractType, setContractType] = useState<"residential" | "commercial">("residential");
  const [isGenerating, setIsGenerating] = useState(false);

  // Buscar dados do contrato
  const { data: contract, isLoading: isLoadingContract } = useQuery({
    queryKey: ['/api/contracts', contractId],
    queryFn: async () => {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (!response.ok) throw new Error("Erro ao buscar contrato");
      return response.json();
    },
    enabled: isOpen && !!contractId,
  });

  // Buscar dados do proprietário
  const { data: owner, isLoading: isLoadingOwner } = useQuery({
    queryKey: ['/api/owners', contract?.ownerId],
    queryFn: async () => {
      const response = await fetch(`/api/owners/${contract.ownerId}`);
      if (!response.ok) throw new Error("Erro ao buscar proprietário");
      return response.json();
    },
    enabled: isOpen && !!contract?.ownerId,
  });

  // Buscar dados do inquilino
  const { data: tenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ['/api/tenants', contract?.tenantId],
    queryFn: async () => {
      const response = await fetch(`/api/tenants/${contract.tenantId}`);
      if (!response.ok) throw new Error("Erro ao buscar inquilino");
      return response.json();
    },
    enabled: isOpen && !!contract?.tenantId,
  });

  // Buscar dados do imóvel
  const { data: property, isLoading: isLoadingProperty } = useQuery({
    queryKey: ['/api/properties', contract?.propertyId],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${contract.propertyId}`);
      if (!response.ok) throw new Error("Erro ao buscar imóvel");
      return response.json();
    },
    enabled: isOpen && !!contract?.propertyId,
  });

  const isLoading = isLoadingContract || isLoadingOwner || isLoadingTenant || isLoadingProperty;

  const handleGeneratePDF = async () => {
    if (!contract) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários para gerar o contrato.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Determinar o tipo de contrato a ser gerado
      const pdfType = contractType === "residential" ? "residential" : "commercial";
      const fileName = contractType === "residential" ? `contrato_residencial_${contractId}.pdf` : `contrato_comercial_${contractId}.pdf`;
      
      // Usar o endpoint do servidor para gerar o PDF
      const response = await fetch(`/api/contracts/${contractId}/pdf/${pdfType}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Erro na geração do PDF: ${response.status} ${response.statusText}`);
      }
      
      // Obter o blob do PDF
      const pdfBlob = await response.blob();
      
      // Criar um URL para o blob
      const url = window.URL.createObjectURL(pdfBlob);
      
      // Criar um elemento <a> para download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      
      // Adicionar o link ao DOM, clicar nele e depois removê-lo
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Liberar o URL do objeto
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Sucesso",
        description: "Contrato gerado com sucesso!",
      });

      onClose();
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao gerar o contrato. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Selecione o tipo de contrato</DialogTitle>
          <DialogDescription>
            Escolha o tipo de contrato para gerar o PDF apropriado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando dados do contrato...</span>
          </div>
        ) : (
          <div className="py-4">
            <RadioGroup
              value={contractType}
              onValueChange={(value) => setContractType(value as "residential" | "commercial")}
              className="flex flex-col space-y-4"
            >
              <div className="flex items-center space-x-2 rounded-md border p-4 bg-card hover:bg-accent cursor-pointer">
                <RadioGroupItem value="residential" id="residential" className="mt-0" />
                <Label htmlFor="residential" className="flex flex-col cursor-pointer flex-1">
                  <span className="font-medium">Contrato Residencial</span>
                  <span className="text-sm text-muted-foreground">
                    Para locação de imóveis residenciais.
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2 rounded-md border p-4 bg-card hover:bg-accent cursor-pointer">
                <RadioGroupItem value="commercial" id="commercial" className="mt-0" />
                <Label htmlFor="commercial" className="flex flex-col cursor-pointer flex-1">
                  <span className="font-medium">Contrato Comercial</span>
                  <span className="text-sm text-muted-foreground">
                    Para locação de imóveis comerciais.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGeneratePDF} disabled={isLoading || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              "Gerar PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};