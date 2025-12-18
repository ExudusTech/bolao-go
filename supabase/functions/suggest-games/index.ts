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
  
  // Category 1: Games with MOST VOTED numbers
  for (const size of targetSizes) {
    if (suggestions.filter(s => s.reason.includes('mais votados')).length >= 3) break;
    const price = lotteryConfig.prices[size];
    if (!price || price > remainingBudget) continue;
    
    const numbers = generateFromMostVoted(size, analysis, lotteryConfig.numberRange);
    const gameKey = numbers.sort((a, b) => a - b).join(',');
    if (existingNumbers.has(gameKey)) continue;
    
    existingNumbers.add(gameKey);
    suggestions.push({
      id: `suggestion-${gameIndex}`,
      numbers: numbers.sort((a, b) => a - b),
      cost: price,
      type: `${size} dezenas`,
      reason: `Jogo com os ${size} números MAIS VOTADOS pelos participantes`,
    });
    
    remainingBudget -= price;
    gameIndex++;
  }
  
  // Category 2: Games with LEAST VOTED numbers
  for (const size of targetSizes) {
    if (suggestions.filter(s => s.reason.includes('menos votados')).length >= 3) break;
    const price = lotteryConfig.prices[size];
    if (!price || price > remainingBudget) continue;
    
    const numbers = generateFromLeastVoted(size, analysis, lotteryConfig.numberRange);
    const gameKey = numbers.sort((a, b) => a - b).join(',');
    if (existingNumbers.has(gameKey)) continue;
    
    existingNumbers.add(gameKey);
    suggestions.push({
      id: `suggestion-${gameIndex}`,
      numbers: numbers.sort((a, b) => a - b),
      cost: price,
      type: `${size} dezenas`,
      reason: `Jogo com os ${size} números MENOS VOTADOS pelos participantes`,
    });
    
    remainingBudget -= price;
    gameIndex++;
  }
  
  // Category 3: Games with NOT VOTED numbers
  if (analysis.notVoted.length >= 6) {
    for (const size of targetSizes) {
      if (suggestions.filter(s => s.reason.includes('NÃO VOTADOS')).length >= 3) break;
      const price = lotteryConfig.prices[size];
      if (!price || price > remainingBudget) continue;
      if (analysis.notVoted.length < size) continue;
      
      const numbers = generateFromNotVoted(size, analysis);
      if (!numbers) continue;
      
      const gameKey = numbers.sort((a, b) => a - b).join(',');
      if (existingNumbers.has(gameKey)) continue;
      
      existingNumbers.add(gameKey);
      suggestions.push({
        id: `suggestion-${gameIndex}`,
        numbers: numbers.sort((a, b) => a - b),
        cost: price,
        type: `${size} dezenas`,
        reason: `Jogo com ${size} números NÃO VOTADOS por nenhum participante`,
      });
      
      remainingBudget -= price;
      gameIndex++;
    }
  }
  
  return suggestions;
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