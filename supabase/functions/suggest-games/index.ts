import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LotteryConfig {
  name: string;
  minNumbers: number;
  maxNumbers: number;
  numberRange: number;
  prices: Record<number, number>;
}

interface Aposta {
  apelido: string;
  dezenas: number[];
}

interface SuggestedGame {
  id: string;
  numbers: number[];
  cost: number;
  type: string;
  reason: string;
}

interface NumberAnalysis {
  mostVoted: Array<{ number: number; count: number }>;
  leastVoted: Array<{ number: number; count: number }>;
  notVoted: number[];
}

function analyzeNumbers(apostas: Aposta[], numberRange: number): NumberAnalysis {
  const frequency: Record<number, number> = {};
  
  for (let i = 1; i <= numberRange; i++) {
    frequency[i] = 0;
  }
  
  apostas.forEach(a => {
    a.dezenas.forEach(n => {
      frequency[n] = (frequency[n] || 0) + 1;
    });
  });
  
  const entries = Object.entries(frequency).map(([num, count]) => ({
    number: parseInt(num),
    count
  }));
  
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const mostVoted = sorted.filter(e => e.count > 0).slice(0, 10);
  const leastVoted = sorted.filter(e => e.count > 0).reverse().slice(0, 10);
  const notVoted = entries.filter(e => e.count === 0).map(e => e.number);
  
  return { mostVoted, leastVoted, notVoted };
}

function generateGameSuggestions(
  availableBudget: number,
  analysis: NumberAnalysis,
  lotteryConfig: LotteryConfig,
  existingNumbers: Set<string>,
  excludeIds: string[] = []
): SuggestedGame[] {
  const suggestions: SuggestedGame[] = [];
  let remainingBudget = availableBudget;
  
  // Start gameIndex after the highest excluded ID to avoid conflicts
  const excludedNumbers = excludeIds
    .filter(id => id.startsWith('suggestion-'))
    .map(id => parseInt(id.replace('suggestion-', ''), 10))
    .filter(n => !isNaN(n));
  let gameIndex = excludedNumbers.length > 0 ? Math.max(...excludedNumbers) + 1 : 1;
  
  const targetSizes = [10, 9, 8, 7];
  const excludeSet = new Set(excludeIds);
  
  // Keep generating until budget is exhausted
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loop
  
  while (remainingBudget >= lotteryConfig.prices[7] && attempts < maxAttempts) {
    attempts++;
    let addedGame = false;
    
    // Try to add a game from each category in rotation
    const categories = [
      { name: 'mais votados', generator: generateFromMostVoted, count: suggestions.filter(s => s.reason.includes('mais votados')).length },
      { name: 'menos votados', generator: generateFromLeastVoted, count: suggestions.filter(s => s.reason.includes('menos votados')).length },
      { name: 'NÃO VOTADOS', generator: generateFromNotVoted, count: suggestions.filter(s => s.reason.includes('NÃO VOTADOS')).length },
    ];
    
    // Sort by count to balance categories
    categories.sort((a, b) => a.count - b.count);
    
    for (const category of categories) {
      if (addedGame) break;
      
      // Try larger games first, then smaller
      for (const size of targetSizes) {
        const price = lotteryConfig.prices[size];
        if (!price || price > remainingBudget) continue;
        
        // For NOT VOTED, check if we have enough numbers
        if (category.name === 'NÃO VOTADOS' && analysis.notVoted.length < size) continue;
        
        let numbers: number[] | null = null;
        if (category.name === 'NÃO VOTADOS') {
          numbers = generateFromNotVoted(size, analysis);
        } else if (category.name === 'mais votados') {
          numbers = generateFromMostVoted(size, analysis, lotteryConfig.numberRange);
        } else {
          numbers = generateFromLeastVoted(size, analysis, lotteryConfig.numberRange);
        }
        
        if (!numbers) continue;
        
        const gameKey = numbers.sort((a, b) => a - b).join(',');
        const gameId = `suggestion-${gameIndex}`;
        
        if (existingNumbers.has(gameKey) || excludeSet.has(gameId)) continue;
        
        existingNumbers.add(gameKey);
        
        const reasonPrefix = category.name === 'mais votados' 
          ? `Jogo com os ${size} números MAIS VOTADOS pelos participantes`
          : category.name === 'menos votados'
            ? `Jogo com os ${size} números MENOS VOTADOS pelos participantes`
            : `Jogo com ${size} números NÃO VOTADOS por nenhum participante`;
        
        suggestions.push({
          id: gameId,
          numbers: numbers.sort((a, b) => a - b),
          cost: price,
          type: `${size} dezenas`,
          reason: reasonPrefix,
        });
        
        remainingBudget -= price;
        gameIndex++;
        addedGame = true;
        break;
      }
    }
    
    // If no game could be added in any category, try mixed approach
    if (!addedGame) {
      for (const size of targetSizes) {
        const price = lotteryConfig.prices[size];
        if (!price || price > remainingBudget) continue;
        
        const numbers = generateMixedGame(size, analysis, lotteryConfig.numberRange);
        const gameKey = numbers.sort((a, b) => a - b).join(',');
        const gameId = `suggestion-${gameIndex}`;
        
        if (existingNumbers.has(gameKey) || excludeSet.has(gameId)) continue;
        
        existingNumbers.add(gameKey);
        suggestions.push({
          id: gameId,
          numbers: numbers.sort((a, b) => a - b),
          cost: price,
          type: `${size} dezenas`,
          reason: `Jogo MISTO combinando números mais e menos votados`,
        });
        
        remainingBudget -= price;
        gameIndex++;
        addedGame = true;
        break;
      }
    }
    
    // If still no game added, break to avoid infinite loop
    if (!addedGame) break;
  }
  
  return suggestions;
}

function generateMixedGame(size: number, analysis: NumberAnalysis, numberRange: number): number[] {
  const numbers: Set<number> = new Set();
  
  // Take some from most voted
  const mostVotedCount = Math.ceil(size / 2);
  const sortedMostVoted = [...analysis.mostVoted].sort((a, b) => b.count - a.count);
  for (const item of sortedMostVoted) {
    if (numbers.size >= mostVotedCount) break;
    numbers.add(item.number);
  }
  
  // Take some from least voted
  const sortedLeastVoted = [...analysis.leastVoted].sort((a, b) => a.count - b.count);
  for (const item of sortedLeastVoted) {
    if (numbers.size >= size) break;
    if (!numbers.has(item.number)) {
      numbers.add(item.number);
    }
  }
  
  // Fill with random if needed
  while (numbers.size < size) {
    const randomNum = Math.floor(Math.random() * numberRange) + 1;
    numbers.add(randomNum);
  }
  
  return Array.from(numbers);
}

function generateFromMostVoted(size: number, analysis: NumberAnalysis, numberRange: number): number[] {
  const numbers: Set<number> = new Set();
  
  // Prioritize most voted numbers
  const sortedMostVoted = [...analysis.mostVoted].sort((a, b) => b.count - a.count);
  for (const item of sortedMostVoted) {
    if (numbers.size >= size) break;
    numbers.add(item.number);
  }
  
  // Fill remaining with random numbers if needed
  while (numbers.size < size) {
    const randomNum = Math.floor(Math.random() * numberRange) + 1;
    numbers.add(randomNum);
  }
  
  return Array.from(numbers);
}

function generateFromLeastVoted(size: number, analysis: NumberAnalysis, numberRange: number): number[] {
  const numbers: Set<number> = new Set();
  
  // Prioritize least voted numbers (that were voted at least once)
  const sortedLeastVoted = [...analysis.leastVoted].sort((a, b) => a.count - b.count);
  for (const item of sortedLeastVoted) {
    if (numbers.size >= size) break;
    numbers.add(item.number);
  }
  
  // Fill remaining with random numbers if needed
  while (numbers.size < size) {
    const randomNum = Math.floor(Math.random() * numberRange) + 1;
    numbers.add(randomNum);
  }
  
  return Array.from(numbers);
}

function generateFromNotVoted(size: number, analysis: NumberAnalysis): number[] | null {
  if (analysis.notVoted.length < size) return null;
  
  const shuffled = [...analysis.notVoted].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      totalArrecadado, 
      lotteryConfig, 
      apostas, 
      excludeIds = [], 
      alreadySelectedCost = 0,
      customRequest 
    } = body as {
      totalArrecadado: number;
      lotteryConfig: LotteryConfig;
      apostas: Aposta[];
      excludeIds?: string[];
      alreadySelectedCost?: number;
      customRequest?: {
        size: number;
        criteria: "mais_votados" | "menos_votados" | "nao_votados" | "misto";
      };
    };

    const analysis = analyzeNumbers(apostas, lotteryConfig.numberRange);
    
    const individualGamesCost = apostas.length * lotteryConfig.prices[lotteryConfig.minNumbers];
    const availableBudget = totalArrecadado - individualGamesCost - alreadySelectedCost;
    
    const existingGames = new Set<string>(
      apostas.map(a => a.dezenas.sort((x, y) => x - y).join(','))
    );
    
    // Handle custom single game request
    if (customRequest) {
      const { size, criteria } = customRequest;
      const price = lotteryConfig.prices[size];
      
      if (!price || price > availableBudget) {
        return new Response(
          JSON.stringify({ 
            customGame: null,
            error: "Orçamento insuficiente para este jogo" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let numbers: number[] | null = null;
      let reason = "";
      
      switch (criteria) {
        case "mais_votados":
          numbers = generateFromMostVoted(size, analysis, lotteryConfig.numberRange);
          reason = `Jogo personalizado com ${size} números MAIS VOTADOS`;
          break;
        case "menos_votados":
          numbers = generateFromLeastVoted(size, analysis, lotteryConfig.numberRange);
          reason = `Jogo personalizado com ${size} números MENOS VOTADOS`;
          break;
        case "nao_votados":
          if (analysis.notVoted.length >= size) {
            numbers = generateFromNotVoted(size, analysis);
            reason = `Jogo personalizado com ${size} números NÃO VOTADOS`;
          }
          break;
        case "misto":
          numbers = generateMixedGame(size, analysis, lotteryConfig.numberRange);
          reason = `Jogo personalizado MISTO com ${size} números`;
          break;
      }
      
      if (!numbers) {
        return new Response(
          JSON.stringify({ 
            customGame: null,
            error: "Não há números suficientes para este critério" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const gameId = `custom-${Date.now()}`;
      const customGame: SuggestedGame = {
        id: gameId,
        numbers: numbers.sort((a, b) => a - b),
        cost: price,
        type: `${size} dezenas`,
        reason,
      };
      
      console.log(`Generated custom game: ${size} numbers, criteria: ${criteria}`);
      
      return new Response(
        JSON.stringify({ customGame }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Regular suggestions generation
    const suggestions = generateGameSuggestions(
      availableBudget,
      analysis,
      lotteryConfig,
      existingGames,
      excludeIds
    );
    
    console.log(`Generated ${suggestions.length} game suggestions for budget R$ ${availableBudget.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        analysis,
        suggestions,
        individualGamesCost,
        availableBudget: totalArrecadado - individualGamesCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-games:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});