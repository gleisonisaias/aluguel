import { useState } from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm flex items-center justify-between p-4 md:py-2">
      <div className="flex md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-neutral-700 hover:text-primary-500">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>
      
      <div className="flex items-center ml-auto">
        <Button 
          variant="ghost" 
          size="icon"
          className="ml-3 relative rounded-full text-neutral-700 hover:text-primary-500"
        >
          <Bell className="h-6 w-6" />
          <span className="sr-only">Notificações</span>
        </Button>
        
        <div className="ml-3 relative">
          <Avatar className="h-8 w-8 bg-primary-100 text-primary-700">
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
};

export default Header;
