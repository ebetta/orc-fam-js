import React, { useState, useEffect } from "react";
import { Account } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
      const data = await Account.list("-updated_date");
      setAccounts(data);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    }
    setIsLoading(false);
  };

  const handleCreateAccount = async (accountData) => {
    try {
      await Account.create({
        ...accountData,
        current_balance: accountData.initial_balance
      });
      setShowForm(false);
      loadAccounts();
    } catch (error) {
      console.error("Erro ao criar conta:", error);
    }
  };

  const handleUpdateAccount = async (accountData) => {
    try {
      await Account.update(editingAccount.id, accountData);
      setShowForm(false);
      setEditingAccount(null);
      loadAccounts();
    } catch (error) {
      console.error("Erro ao atualizar conta:", error);
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
        />
      </motion.div>
    </div>
  );
}