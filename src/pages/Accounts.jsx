import React, { useState, useEffect } from "react";
// import { Account } from "@/api/entities"; // Remove old entity
import { supabase } from "@/lib/supabaseClient"; // Import Supabase client
import { Button } from "@/components/ui/button";
// import { Plus } from "lucide-react"; // Plus is not directly used here
import { motion } from "framer-motion";

import AccountsHeader from "../components/accounts/AccountsHeader";
import AccountsGrid from "../components/accounts/AccountsGrid";
import AccountForm from "../components/accounts/AccountForm";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Erro ao carregar contas:", error.message);
      // Consider setting an error state to display to the user
    }
    setIsLoading(false);
  };

  const handleCreateAccount = async (accountData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { error } = await supabase.from("accounts").insert([
        { ...accountData, user_id: user.id }, // initial_balance should be part of accountData from form
      ]);

      if (error) throw error;
      setShowForm(false);
      loadAccounts(); // Reload accounts to show the new one
    } catch (error) {
      console.error("Erro ao criar conta:", error.message);
      // Consider setting an error state to display to the user
    }
  };

  const handleDeleteAccount = async (accountId) => {
    // Optional: Add a confirmation dialog before deleting
    // if (!window.confirm("Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.")) {
    //   return;
    // }

    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
      loadAccounts(); // Reload accounts to reflect the deletion
    } catch (error) {
      console.error("Erro ao excluir conta:", error.message);
      // Consider setting an error state to display to the user
    }
  };

  const handleUpdateAccount = async (accountData) => {
    try {
      const { error } = await supabase
        .from("accounts")
        .update(accountData)
        .eq("id", editingAccount.id);

      if (error) throw error;
      setShowForm(false);
      setEditingAccount(null);
      loadAccounts(); // Reload accounts to show the updated one
    } catch (error) {
      console.error("Erro ao atualizar conta:", error.message);
      // Consider setting an error state to display to the user
    }
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAccount(null);
  };

  const filteredAccounts = filterType === "all" 
    ? accounts 
    : accounts.filter(account => account.account_type === filterType);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <AccountsHeader
          onAddAccount={() => setShowForm(true)}
          filterType={filterType}
          onFilterChange={setFilterType}
          accountsCount={accounts.length}
        />
      </motion.div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AccountForm
            account={editingAccount}
            onSave={editingAccount ? handleUpdateAccount : handleCreateAccount}
            onCancel={handleCancelForm}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AccountsGrid
          accounts={filteredAccounts}
          isLoading={isLoading}
          onEditAccount={handleEditAccount}
          onDeleteAccount={handleDeleteAccount} // Pass delete handler
        />
      </motion.div>
    </div>
  );
}