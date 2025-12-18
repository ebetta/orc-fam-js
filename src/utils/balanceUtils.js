
export const calculateAccountBalanceAndDetails = async (account, allTransactions, accountsData, convertCurrencyFn) => {
    let currentBalanceInAccountCurrency = parseFloat(account.initial_balance) || 0;
    const accountCurrency = account.currency;

    const accountCurrencyMap = new Map(accountsData.map(acc => [acc.id, acc.currency]));

    for (const transaction of allTransactions) {
        const transactionAmount = parseFloat(transaction.amount);
        if (isNaN(transactionAmount)) continue;

        let amountEffect = 0;
        let transactionConsidered = false;

        if (transaction.account_id === account.id) {
            transactionConsidered = true;
            const transactionCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL';
            let amountInAccountCurrency = transactionAmount;
            if (transactionCurrency !== accountCurrency) {
                amountInAccountCurrency = await convertCurrencyFn(transactionAmount, transactionCurrency, accountCurrency, transaction.transaction_date);
            }
            if (transaction.transaction_type === "income") amountEffect = amountInAccountCurrency;
            else if (transaction.transaction_type === "expense") amountEffect = -amountInAccountCurrency;
            else if (transaction.transaction_type === "transfer") amountEffect = -amountInAccountCurrency;
        } else if (transaction.destination_account_id === account.id && transaction.transaction_type === "transfer") {
            transactionConsidered = true;
            const sourceAccountCurrency = accountCurrencyMap.get(transaction.account_id) || 'BRL';
            let amountInAccountCurrency = transactionAmount;
            if (sourceAccountCurrency !== accountCurrency) {
                amountInAccountCurrency = await convertCurrencyFn(transactionAmount, sourceAccountCurrency, accountCurrency, transaction.transaction_date);
            }
            amountEffect = amountInAccountCurrency;
        }

        if (transactionConsidered) {
            currentBalanceInAccountCurrency += amountEffect;
        }
    }

    let balanceInBRL = currentBalanceInAccountCurrency;
    if (accountCurrency !== "BRL") {
        balanceInBRL = await convertCurrencyFn(currentBalanceInAccountCurrency, accountCurrency, "BRL", null);
    }

    return {
        balanceInBRL, // Saldo final para exibição principal (sempre em BRL)
        original_balance: currentBalanceInAccountCurrency, // Saldo na moeda original da conta
        original_currency: accountCurrency, // Moeda original da conta
        account_type: account.account_type, // Tipo da conta para o ícone
    };
};
