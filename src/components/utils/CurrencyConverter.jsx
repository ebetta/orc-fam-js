import React, { useState, useEffect } from 'react';
import { InvokeLLM } from "@/api/integrations";
import { ExchangeRate } from "@/api/entities";

// Cache em memória para cotações já buscadas na sessão atual
const memoryCache = new Map();

export const getCurrencyExchangeRate = async (fromCurrency, toCurrency = 'BRL') => {
  if (fromCurrency === toCurrency) return 1;
  
  const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  const cacheKey = `${fromCurrency}_${toCurrency}`;
  
  // 1. Verificar cache em memória primeiro (mais rápido)
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (cached.date === today) {
      return cached.rate;
    }
  }

  try {
    // 2. Buscar na base de dados
    const existingRates = await ExchangeRate.filter({
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate_date: today
    });

    if (existingRates.length > 0) {
      const rate = existingRates[0].rate;
      // Armazenar no cache em memória
      memoryCache.set(cacheKey, { rate, date: today });
      return rate;
    }

    // 3. Se não encontrou na base, buscar externamente com fontes confiáveis
    console.log(`Buscando cotação externa para ${fromCurrency} -> ${toCurrency}`);
    
    const response = await InvokeLLM({
      prompt: `Get the current official exchange rate from ${fromCurrency} to ${toCurrency} for today's date.

PRIORITY SOURCES (use in this order):
1. Banco Central do Brasil (bcb.gov.br) - OFFICIAL Brazilian rate
2. ExchangeRate-API (exchangerate-api.com)
3. XE.com - widely recognized rates
4. Open Exchange Rates (openexchangerates.org)
5. Fixer.io
6. Investing.com real-time rates
7. Bloomberg or Reuters financial data

For BRL conversions, prioritize Banco Central do Brasil as it's the official source.
For other currencies, use ExchangeRate-API or XE.com as primary sources.

Return the most accurate and current exchange rate available from these reliable sources.
Include the source name in your response.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          exchange_rate: {
            type: "number",
            description: `Current exchange rate from ${fromCurrency} to ${toCurrency}`
          },
          source: {
            type: "string",
            description: "Name of the reliable source used (e.g., 'Banco Central do Brasil', 'ExchangeRate-API', 'XE.com')"
          },
          date: {
            type: "string",
            description: "Date of the exchange rate"
          },
          confidence: {
            type: "string",
            description: "Confidence level: 'high' for official sources, 'medium' for recognized APIs"
          }
        }
      }
    });

    const rate = response.exchange_rate || 1;
    const source = response.source || "External API";
    const confidence = response.confidence || "medium";

    // 4. Salvar na base de dados para uso futuro
    try {
      await ExchangeRate.create({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: rate,
        rate_date: today,
        source: `${source} (${confidence} confidence)`
      });
      console.log(`Cotação ${fromCurrency}/${toCurrency} salva: ${rate} (Fonte: ${source})`);
    } catch (dbError) {
      console.error("Erro ao salvar cotação na base:", dbError);
    }

    // 5. Armazenar no cache em memória
    memoryCache.set(cacheKey, { rate, date: today });

    return rate;

  } catch (error) {
    console.error(`Erro ao buscar cotação ${fromCurrency} para ${toCurrency}:`, error);
    
    // Fallback: tentar buscar cotação mais recente na base
    try {
      const recentRates = await ExchangeRate.filter({
        from_currency: fromCurrency,
        to_currency: toCurrency
      }, '-rate_date', 1); // Mais recente primeiro

      if (recentRates.length > 0) {
        const fallbackRate = recentRates[0].rate;
        console.log(`Usando cotação mais recente como fallback: ${fallbackRate} (Fonte: ${recentRates[0].source})`);
        return fallbackRate;
      }
    } catch (fallbackError) {
      console.error("Erro no fallback:", fallbackError);
    }
    
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
  const [isLoading, setIsLoading] = useState(false);

  const convertToBRL = async (amount, fromCurrency) => {
    if (fromCurrency === 'BRL') return amount;
    
    setIsLoading(true);
    try {
      const convertedAmount = await convertCurrency(amount, fromCurrency, 'BRL');
      setIsLoading(false);
      return convertedAmount;
    } catch (error) {
      setIsLoading(false);
      console.error('Erro na conversão:', error);
      return amount; // Fallback
    }
  };

  const preloadExchangeRates = async (currencies = ['USD', 'EUR']) => {
    setIsLoading(true);
    try {
      // Carregar cotações em paralelo para melhorar performance
      const promises = currencies.map(currency => 
        getCurrencyExchangeRate(currency, 'BRL')
      );
      await Promise.all(promises);
      console.log('Cotações pré-carregadas com sucesso de fontes confiáveis');
    } catch (error) {
      console.error('Erro ao pré-carregar cotações:', error);
    }
    setIsLoading(false);
  };

  return { convertToBRL, preloadExchangeRates, isLoading };
};

// Função utilitária para limpar cotações antigas (pode ser executada periodicamente)
export const cleanOldExchangeRates = async (daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    const oldRates = await ExchangeRate.filter({}, '-rate_date');
    const ratesToDelete = oldRates.filter(rate => rate.rate_date < cutoffDateStr);
    
    for (const rate of ratesToDelete) {
      await ExchangeRate.delete(rate.id);
    }
    
    console.log(`${ratesToDelete.length} cotações antigas removidas`);
  } catch (error) {
    console.error('Erro ao limpar cotações antigas:', error);
  }
};