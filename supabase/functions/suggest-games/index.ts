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
  existingNumbers: Set<string>
): SuggestedGame[] {
  const suggestions: SuggestedGame[] = [];
  let remainingBudget = availableBudget;
  let gameIndex = 1;
  
  const targetSizes = [10, 9, 8, 7];
  
  for (const size of targetSizes) {
    const price = lotteryConfig.prices[size];
    if (!price || price > remainingBudget) continue;
    
    const numbers = generateNumberCombination(size, analysis, existingNumbers);
    if (!numbers) continue;
    
    const gameKey = numbers.sort((a, b) => a - b).join(',');
    if (existingNumbers.has(gameKey)) continue;
    
    existingNumbers.add(gameKey);
    
    suggestions.push({
      id: `suggestion-${gameIndex}`,
      numbers: numbers.sort((a, b) => a - b),
      cost: price,
      type: `${size} dezenas`,
      reason: getReasonForGame(size, numbers, analysis),
    });
    
    remainingBudget -= price;
    gameIndex++;
    
    if (suggestions.length >= 8) break;
  }
  
  while (remainingBudget >= lotteryConfig.prices[7] && suggestions.length < 12) {
    let added = false;
    for (const size of [7, 8, 9, 10]) {
      const price = lotteryConfig.prices[size];
      if (!price || price > remainingBudget) continue;
      
      const numbers = generateNumberCombination(size, analysis, existingNumbers);
      if (!numbers) continue;
      
      const gameKey = numbers.sort((a, b) => a - b).join(',');
      if (existingNumbers.has(gameKey)) continue;
      
      existingNumbers.add(gameKey);
      
      suggestions.push({
        id: `suggestion-${gameIndex}`,
        numbers: numbers.sort((a, b) => a - b),
        cost: price,
        type: `${size} dezenas`,
        reason: getReasonForGame(size, numbers, analysis),
      });
      
      remainingBudget -= price;
      gameIndex++;
      added = true;
      break;
    }
    
    if (!added || suggestions.length >= 12) break;
  }
  
  return suggestions;
}

function generateNumberCombination(
  size: number,
  analysis: NumberAnalysis,
  existingGames: Set<string>
): number[] | null {
  const numbers: Set<number> = new Set();
  
  const mostVotedCount = Math.ceil(size * 0.4);
  const shuffledMostVoted = [...analysis.mostVoted].sort(() => Math.random() - 0.5);
  for (let i = 0; i < mostVotedCount && numbers.size < size; i++) {
    if (shuffledMostVoted[i]) {
      numbers.add(shuffledMostVoted[i].number);
    }
  }
  
  const notVotedCount = Math.ceil(size * 0.3);
  const shuffledNotVoted = [...analysis.notVoted].sort(() => Math.random() - 0.5);
  for (let i = 0; i < notVotedCount && numbers.size < size; i++) {
    if (shuffledNotVoted[i]) {
      numbers.add(shuffledNotVoted[i]);
    }
  }
  
  const shuffledLeastVoted = [...analysis.leastVoted].sort(() => Math.random() - 0.5);
  for (let i = 0; numbers.size < size && i < shuffledLeastVoted.length; i++) {
    numbers.add(shuffledLeastVoted[i].number);
  }
  
  while (numbers.size < size) {
    const randomNum = Math.floor(Math.random() * 60) + 1;
    numbers.add(randomNum);
  }
  
  return Array.from(numbers);
}

function getReasonForGame(size: number, numbers: number[], analysis: NumberAnalysis): string {
  const hotNumbers = numbers.filter(n => 
    analysis.mostVoted.some(m => m.number === n)
  ).length;
  const coldNumbers = numbers.filter(n => 
    analysis.notVoted.includes(n)
  ).length;
  
  if (hotNumbers >= size * 0.5) {
    return `Jogo com ${hotNumbers} números quentes (mais votados pelos participantes)`;
  } else if (coldNumbers >= size * 0.3) {
    return `Jogo diversificado com ${coldNumbers} números frios para aumentar cobertura`;
  } else {
    return `Combinação balanceada entre números populares e oportunidades`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { totalArrecadado, lotteryConfig, apostas } = await req.json() as {
      totalArrecadado: number;
      lotteryConfig: LotteryConfig;
      apostas: Aposta[];
    };

    const analysis = analyzeNumbers(apostas, lotteryConfig.numberRange);
    
    const individualGamesCost = apostas.length * lotteryConfig.prices[lotteryConfig.minNumbers];
    const availableBudget = totalArrecadado - individualGamesCost;
    
    const existingGames = new Set<string>(
      apostas.map(a => a.dezenas.sort((x, y) => x - y).join(','))
    );
    
    const suggestions = generateGameSuggestions(
      availableBudget,
      analysis,
      lotteryConfig,
      existingGames
    );
    
    console.log(`Generated ${suggestions.length} game suggestions for budget R$ ${availableBudget.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        analysis,
        suggestions,
        individualGamesCost,
        availableBudget,
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
