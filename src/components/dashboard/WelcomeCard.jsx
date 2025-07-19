import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { useUser } from "@/pages/Layout.jsx";

export default function WelcomeCard() {
  const user = useUser();
  const currentHour = new Date().getHours();
  let greeting = "Boa noite";
  
  if (currentHour < 12) greeting = "Bom dia";
  else if (currentHour < 18) greeting = "Boa tarde";

  return (
    <Card className="bg-gradient-to-r from-green-500 to-green-700 border-0 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 bg-white bg-opacity-10 rounded-full" />
      <div className="absolute bottom-0 left-0 w-24 h-24 transform -translate-x-4 translate-y-4 bg-white bg-opacity-10 rounded-full" />
      
      <CardContent className="p-8 relative z-10">
        <div className="flex justify-between items-start">
          <div className="text-white">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 mb-2"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-green-100 text-sm font-medium">
                {greeting}
              </span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl font-bold mb-2"
            >
              {user?.user_metadata?.full_name || "Usuário"}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-green-100 text-lg"
            >
              Vamos gerenciar suas finanças hoje
            </motion.p>
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link to={createPageUrl("Transactions")}>
              <Button 
                size="lg" 
                className="bg-white text-green-700 hover:bg-green-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nova Transação
              </Button>
            </Link>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}