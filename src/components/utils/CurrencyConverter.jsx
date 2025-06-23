import React, { useState, useEffect } from 'react';
// import { InvokeLLM } from "@/api/integrations"; // Removed
// import { ExchangeRate } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added

// Cache em memória para cotações já buscadas na sessão atual
const memoryCache = new Map();

export const getCurrencyExchangeRate = async (fromCurrency, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;
  
  const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  const cacheKey = `${fromCurrency}_${toCurrency}_${today}`; // Include date in cacheKey for daily rates
  
  // 1. Verificar cache em memória primeiro
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    // 2. Buscar na base de dados (Supabase)
    // Prioritize user-specific rate for today, then global rate for today.
    // This example assumes a simple structure; extend as needed for user vs global logic.
    // For now, just fetch any rate for today.
    const { data: rateData, error: rateError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .eq('rate_date', today)
      // .is('user_id', null) // Example: for global rates. Add user_id logic if needed.
      .order('created_at', { ascending: false }) // Get the latest if multiple for same day (e.g. user vs global)
      .limit(1)
      .maybeSingle();

    if (rateError) {
      console.error(`Erro ao buscar cotação ${fromCurrency}->${toCurrency} do DB:`, rateError.message);
      // Do not throw here, proceed to fallback
    }

    if (rateData && rateData.rate) {
      memoryCache.set(cacheKey, rateData.rate);
      return rateData.rate;
    }

    // 3. External fetching and saving to DB is REMOVED for this iteration.
    console.warn(`Cotação externa para ${fromCurrency} -> ${toCurrency} não implementada nesta versão. Buscando fallback.`);

    // 4. Fallback: tentar buscar cotação mais recente na base (qualquer data)
    const { data: fallbackRateData, error: fallbackError } = await supabase
      .from('exchange_rates')
      .select('rate, source, rate_date')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      // .is('user_id', null) // Example for global rates
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      console.error(`Erro ao buscar cotação fallback ${fromCurrency}->${toCurrency}:`, fallbackError.message);
    }
    
    if (fallbackRateData && fallbackRateData.rate) {
      console.log(`Usando cotação mais recente (${fallbackRateData.rate_date}) como fallback: ${fallbackRateData.rate} (Fonte: ${fallbackRateData.source})`);
      // Cache this fallback but maybe with a different, non-today key or shorter expiry if cache had TTL
      memoryCache.set(`${fromCurrency}_${toCurrency}_fallback_${fallbackRateData.rate_date}`, fallbackRateData.rate);
      return fallbackRateData.rate;
    }
    
    console.warn(`Nenhuma cotação encontrada para ${fromCurrency} -> ${toCurrency}. Usando taxa 1.`);
    return 1; // Último recurso

  } catch (error) { // Catch unexpected errors from the overall try block
    console.error(`Erro geral ao buscar cotação ${fromCurrency} para ${toCurrency}:`, error.message);
    return 1; // Último recurso
  }
};

export const convertCurrency = async (amount, fromCurrency, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return amount;
  
  const rate = await getCurrencyExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
};

export const formatCurrencyWithSymbol = (amount, currency = 'BRL') => {
  const currencyMap = {
    'BRL': { locale: 'pt-BR', currency: 'BRL' },
    'USD': { locale: 'en-US', currency: 'USD' },
    'EUR': { locale: 'de-DE', currency: 'EUR' },
    'GBP': { locale: 'en-GB', currency: 'GBP' },
    'JPY': { locale: 'ja-JP', currency: 'JPY' },
    'CAD': { locale: 'en-CA', currency: 'CAD' },
    'AUD': { locale: 'en-AU', currency: 'AUD' },
    'CHF': { locale: 'de-CH', currency: 'CHF' }
  };

  const config = currencyMap[currency] || currencyMap['BRL'];
  
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency
  }).format(amount);
};

// Hook para conversão de moeda com cache otimizado
export const useCurrencyConversion = () => {
  const [isLoading, setIsLoading] = useState(false); // This hook's loading state seems local and fine.

  const convertToBRL = async (amount, fromCurrency) => {
    if (fromCurrency === 'BRL') return amount;
    
    setIsLoading(true);
    try {
      const convertedAmount = await convertCurrency(amount, fromCurrency, 'BRL');
      setIsLoading(false);
      return convertedAmount;
    } catch (error) {
      setIsLoading(false);
      console.error('Erro na conversão:', error.message);
      return amount; // Fallback
    }
  };

  const preloadExchangeRates = async (currencies = ['USD', 'EUR']) => {
    setIsLoading(true);
    try {
      const promises = currencies.map(currency => 
        getCurrencyExchangeRate(currency, 'BRL')
      );
      await Promise.all(promises);
      console.log('Cotações pré-carregadas (tentativa).');
    } catch (error) {
      console.error('Erro ao pré-carregar cotações:', error.message);
    }
    setIsLoading(false);
  };

  return { convertToBRL, preloadExchangeRates, isLoading };
};

// Função utilitária para limpar cotações antigas (pode ser executada periodicamente)
// This function would ideally be a cron job or Supabase scheduled function.
export const cleanOldExchangeRates = async (daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    // Fetch IDs of rates older than cutoffDateStr
    const { data: ratesToDelete, error: fetchError } = await supabase
      .from('exchange_rates')
      .select('id')
      .lt('rate_date', cutoffDateStr);

    if (fetchError) throw fetchError;

    if (ratesToDelete && ratesToDelete.length > 0) {
      const idsToDelete = ratesToDelete.map(rate => rate.id);
      const { error: deleteError } = await supabase
        .from('exchange_rates')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;
      console.log(`${idsToDelete.length} cotações antigas removidas.`);
    } else {
      console.log("Nenhuma cotação antiga para remover.");
    }
    
  } catch (error) {
    console.error('Erro ao limpar cotações antigas:', error.message);
  }
};