import React, { useState, useEffect } from 'react';
// import { InvokeLLM } from "@/api/integrations"; // Removed
// import { ExchangeRate } from "@/api/entities"; // Removed
import { supabase } from "@/lib/supabaseClient"; // Added

// Cache em memória para cotações já buscadas na sessão atual
const memoryCache = new Map(); // General cache
const historicalRateCache = new Map(); // Cache specific for historical rates

// Function to get exchange rate for a specific date or the closest earlier date
export const getHistoricalExchangeRate = async (fromCurrency, targetDate, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;
  if (!targetDate) {
    console.warn('getHistoricalExchangeRate: targetDate is required. Falling back to 1.');
    return 1;
  }

  const formattedTargetDate = typeof targetDate === 'string' ? targetDate.split('T')[0] : targetDate.toISOString().split('T')[0];
  const cacheKey = `${fromCurrency}_${toCurrency}_${formattedTargetDate}`;

  if (historicalRateCache.has(cacheKey)) {
    return historicalRateCache.get(cacheKey);
  }

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate, rate_date')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .lte('rate_date', formattedTargetDate) // Rate date is less than or equal to the target date
      .order('rate_date', { ascending: false }) // Get the closest date
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar cotação histórica ${fromCurrency}->${toCurrency} para data ${formattedTargetDate}:`, error.message);
      return 1; // Fallback in case of error
    }

    if (data && data.rate) {
      console.log(`Cotação histórica encontrada para ${fromCurrency}->${toCurrency} em ${data.rate_date} (solicitado ${formattedTargetDate}): ${data.rate}`);
      historicalRateCache.set(cacheKey, data.rate);
      return data.rate;
    } else {
      console.warn(`Nenhuma cotação histórica encontrada para ${fromCurrency}->${toCurrency} até ${formattedTargetDate}. Verifique se há taxas cadastradas para datas anteriores ou igual à solicitada. Usando taxa 1.`);
      // Cache the fact that no rate was found to avoid repeated lookups for the same missing rate
      historicalRateCache.set(cacheKey, 1);
      return 1; // Fallback if no rate is found
    }
  } catch (err) {
    console.error(`Erro inesperado em getHistoricalExchangeRate para ${fromCurrency}->${toCurrency} data ${formattedTargetDate}:`, err.message);
    return 1; // Fallback
  }
};


export const getCurrencyExchangeRate = async (fromCurrency, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;
  
  const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  const cacheKey = `${fromCurrency}_${toCurrency}_${today}`; // Include date in cacheKey for daily rates
  
  // 1. Verificar cache em memória primeiro
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    // 2. Buscar na base de dados (Supabase) - Rate for TODAY
    const { data: rateData, error: rateError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .eq('rate_date', today) // Busca taxa para a data de HOJE
      .order('created_at', { ascending: false }) // Pega a mais recente inserida para hoje (caso haja múltiplas)
      .limit(1)
      .maybeSingle();

    if (rateError) {
      console.error(`Erro ao buscar cotação ${fromCurrency}->${toCurrency} do DB (hoje):`, rateError.message);
      // Não retorna aqui, continua para o fallback
    }

    if (rateData && typeof rateData.rate === 'number') { // VERIFICAR SE rateData.rate é um número
      memoryCache.set(cacheKey, rateData.rate);
      return rateData.rate;
    }

    // 3. Fallback: tentar buscar cotação mais recente na base (qualquer data ANTERIOR a hoje)
    // This is a general fallback if today's rate isn't available.
    const { data: fallbackRateData, error: fallbackError } = await supabase
      .from('exchange_rates')
      .select('rate, rate_date')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .lt('rate_date', today) // Taxa com data MENOR que hoje
      .order('rate_date', { ascending: false }) // Pega a mais recente dessas datas anteriores
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      console.error(`Erro ao buscar cotação fallback ${fromCurrency}->${toCurrency}:`, fallbackError.message);
      // Não retorna aqui, continua para o fallback final
    }
    
    if (fallbackRateData && typeof fallbackRateData.rate === 'number') { // VERIFICAR SE fallbackRateData.rate é um número
      console.log(`Usando cotação mais recente (${fallbackRateData.rate_date}) como fallback para ${fromCurrency}->${toCurrency}: ${fallbackRateData.rate}`);
      // Cachear o fallback encontrado sob a chave de 'today' para otimizar futuras chamadas no mesmo dia.
      memoryCache.set(cacheKey, fallbackRateData.rate);
      return fallbackRateData.rate;
    }
    
    console.warn(`Nenhuma cotação encontrada para ${fromCurrency} -> ${toCurrency} (nem hoje, nem anterior). Usando taxa 1.`);
    memoryCache.set(cacheKey, 1); // Cachear o fallback de 1 para evitar buscas repetidas
    return 1; // Último recurso

  } catch (error) {
    console.error(`Erro geral ao buscar cotação ${fromCurrency} para ${toCurrency}:`, error.message);
    // Não cacheia em caso de erro geral, para permitir nova tentativa.
    return 1; // Fallback em caso de erro inesperado
  }
};

// This function will now use getHistoricalExchangeRate when a targetDate is provided
export const convertCurrency = async (amount, fromCurrency, toCurrency = 'BRL', targetDate = null) => {
  if (fromCurrency === toCurrency) return amount;
  
  let rate;
  if (targetDate) {
    rate = await getHistoricalExchangeRate(fromCurrency, targetDate, toCurrency);
  } else {
    // Fallback to current/latest rate if no specific date is given for conversion
    rate = await getCurrencyExchangeRate(fromCurrency, toCurrency);
  }
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