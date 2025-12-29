import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  categoria: string;
}

interface NumberAnalysis {
  mostVoted: Array<{ number: number; count: number }>;
  leastVoted: Array<{ number: number; count: number }>;
  notVoted: number[];
  fullRanking: Array<{ number: number; count: number }>;
}

// Analyze numbers and create full ranking from most to least voted
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
  
  // Full ranking: sorted by count descending, then by number ascending for ties
  const fullRanking = [...entries].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.number - b.number;
  });
  
  const votedNumbers = fullRanking.filter(e => e.count > 0);
  const mostVoted = votedNumbers.slice(0, 20);
  const leastVoted = [...votedNumbers].sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return a.number - b.number;
  }).slice(0, 20);
  const notVoted = entries.filter(e => e.count === 0).map(e => e.number).sort((a, b) => a - b);
  
  return { mostVoted, leastVoted, notVoted, fullRanking };
}

interface GenerationState {
  usedNumbersByCategory: Record<string, Set<number>>;
  existingGames: Set<string>;
  gameIndex: number;
}

interface SkippedGame {
  size: number;
  categoria: string;
  price: number;
  reason: string;
}

interface GenerationResult {
  suggestions: SuggestedGame[];
  skippedGames: SkippedGame[];
}

// Generate optimal game suggestions following the user's strategy
function generateGameSuggestions(
  availableBudget: number,
  analysis: NumberAnalysis,
  lotteryConfig: LotteryConfig,
  existingNumbers: Set<string>,
  excludeIds: string[] = []
): GenerationResult {
  const suggestions: SuggestedGame[] = [];
  const skippedGames: SkippedGame[] = [];
  let remainingBudget = availableBudget;
  
  // Initialize generation state
  const state: GenerationState = {
    usedNumbersByCategory: {
      mais_votados: new Set(),
      menos_votados: new Set(),
      nao_votados: new Set(),
      misto: new Set(),
    },
    existingGames: new Set(existingNumbers),
    gameIndex: 1,
  };
  
  // Get ranked numbers
  const rankedMostVoted = analysis.fullRanking.filter(e => e.count > 0);
  
  // CORRECT: rankedLeastVoted should include ONLY numbers that received at least 1 vote
  // sorted from least to most voted. Numbers with 0 votes are "não votados", not "menos votados"
  const rankedLeastVoted = [...rankedMostVoted].sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return a.number - b.number;
  });
  
  console.log(`Starting generation with budget R$ ${availableBudget.toFixed(2)}`);
  console.log(`Total voted numbers: ${rankedMostVoted.length}, Not voted: ${analysis.notVoted.length}`);
  console.log(`Least voted (first 10): ${rankedLeastVoted.slice(0, 10).map(e => `${e.number}(${e.count})`).join(', ')}`);
  
  // Strategy: Generate games prioritizing variety of categories and sizes
  // Following Caixa rules: 6-20 numbers per game
  const gameSizes = [10, 9, 8, 7, 6]; // Focus on practical sizes first
  
  // Track how many games of each category we've created
  let maisVotadosCount = 0;
  let menosVotadosCount = 0;
  let naoVotadosCount = 0;
  let mistoCount = 0;
  
  // First, ensure we generate one game of each size for mais_votados (priority)
  // Then menos_votados, then others
  const priorityCategories = ['mais_votados', 'menos_votados'];
  
  for (const catName of priorityCategories) {
    for (const size of gameSizes) {
      const price = lotteryConfig.prices[size];
      if (!price) continue;
      
      // Check if budget is insufficient for this size
      if (price > remainingBudget) {
        // Only add to skipped if we haven't already skipped this combination
        const alreadySkipped = skippedGames.some(
          s => s.size === size && s.categoria === catName
        );
        if (!alreadySkipped) {
          skippedGames.push({
            size,
            categoria: catName,
            price,
            reason: `Orçamento insuficiente (precisa R$ ${price.toFixed(2)}, disponível R$ ${remainingBudget.toFixed(2)})`,
          });
          console.log(`Skipped ${catName} game: ${size} numbers, R$ ${price.toFixed(2)} > available R$ ${remainingBudget.toFixed(2)}`);
        }
        continue;
      }
      
      let numbers: number[] | null = null;
      let reason = '';
      
      if (catName === 'mais_votados') {
        // Get exactly the top N numbers from the ranking
        const topNumbers = rankedMostVoted
          .slice(state.usedNumbersByCategory.mais_votados.size, state.usedNumbersByCategory.mais_votados.size + size)
          .map(e => e.number);
        
        if (topNumbers.length >= size) {
          numbers = topNumbers.slice(0, size);
          maisVotadosCount++;
          const start = state.usedNumbersByCategory.mais_votados.size + 1;
          const end = start + size - 1;
          reason = `Jogo ${maisVotadosCount} com ${size} números MAIS VOTADOS (ranking ${start}º ao ${end}º)`;
        }
      } else if (catName === 'menos_votados') {
        // Get numbers from the least voted ranking
        const leastNumbers = rankedLeastVoted
          .slice(state.usedNumbersByCategory.menos_votados.size, state.usedNumbersByCategory.menos_votados.size + size)
          .map(e => e.number);
        
        if (leastNumbers.length >= size) {
          numbers = leastNumbers.slice(0, size);
          menosVotadosCount++;
          const start = state.usedNumbersByCategory.menos_votados.size + 1;
          const end = start + size - 1;
          reason = `Jogo ${menosVotadosCount} com ${size} números MENOS VOTADOS (ranking ${start}º ao ${end}º)`;
        }
      }
      
      if (numbers && numbers.length === size) {
        const sortedNumbers = [...numbers].sort((a, b) => a - b);
        const gameKey = sortedNumbers.join(',');
        
        if (!state.existingGames.has(gameKey)) {
          numbers.forEach(n => state.usedNumbersByCategory[catName].add(n));
          state.existingGames.add(gameKey);
          
          suggestions.push({
            id: `suggestion-${state.gameIndex}`,
            numbers: sortedNumbers,
            cost: price,
            type: `${size} dezenas`,
            reason,
            categoria: catName,
          });
          
          remainingBudget -= price;
          state.gameIndex++;
          
          console.log(`Added ${catName} game: ${size} numbers, R$ ${price.toFixed(2)}, remaining: R$ ${remainingBudget.toFixed(2)}`);
        }
      }
    }
  }
  
  // Now generate remaining games with available budget
  const maxIterations = 50;
  let iterations = 0;
  let keepGenerating = true;
  
  while (keepGenerating && iterations < maxIterations && remainingBudget >= lotteryConfig.prices[6]) {
    iterations++;
    keepGenerating = false;
    
    for (const size of gameSizes) {
      const price = lotteryConfig.prices[size];
      if (!price || price > remainingBudget) continue;
      
      const categories = [
        { name: 'mais_votados', label: 'MAIS VOTADOS' },
        { name: 'menos_votados', label: 'MENOS VOTADOS' },
        { name: 'nao_votados', label: 'NÃO VOTADOS' },
        { name: 'misto', label: 'MISTO' },
      ];
      
      for (const cat of categories) {
        if (price > remainingBudget) break;
        
        let numbers: number[] | null = null;
        let reason = '';
        
        if (cat.name === 'mais_votados') {
          // Get next available numbers from most voted ranking (sequential from ranking)
          const startIdx = state.usedNumbersByCategory.mais_votados.size;
          const availableNumbers = rankedMostVoted
            .slice(startIdx, startIdx + size)
            .map(e => e.number);
          
          if (availableNumbers.length >= size) {
            numbers = availableNumbers.slice(0, size);
            maisVotadosCount++;
            const start = startIdx + 1;
            const end = start + size - 1;
            reason = `Jogo ${maisVotadosCount} com ${size} números MAIS VOTADOS (ranking ${start}º ao ${end}º)`;
          }
        } else if (cat.name === 'menos_votados') {
          // Get next available numbers from least voted ranking
          const startIdx = state.usedNumbersByCategory.menos_votados.size;
          const availableNumbers = rankedLeastVoted
            .slice(startIdx, startIdx + size)
            .map(e => e.number);
          
          if (availableNumbers.length >= size) {
            numbers = availableNumbers.slice(0, size);
            menosVotadosCount++;
            const start = startIdx + 1;
            const end = start + size - 1;
            reason = `Jogo ${menosVotadosCount} com ${size} números MENOS VOTADOS (ranking ${start}º ao ${end}º)`;
          }
        } else if (cat.name === 'nao_votados') {
          // Get numbers that were not voted by anyone
          const availableNumbers = analysis.notVoted
            .filter(n => !state.usedNumbersByCategory.nao_votados.has(n));
          
          if (availableNumbers.length >= size) {
            numbers = availableNumbers.slice(0, size);
            naoVotadosCount++;
            reason = `Jogo ${naoVotadosCount} com ${size} números NÃO VOTADOS por nenhum participante`;
          }
        } else if (cat.name === 'misto') {
          // Mixed: half from most voted, half from least voted (from remaining pool)
          const halfSize = Math.ceil(size / 2);
          const usedInMisto = state.usedNumbersByCategory.misto;
          
          const fromMostVoted = rankedMostVoted
            .filter(e => !usedInMisto.has(e.number))
            .slice(0, halfSize)
            .map(e => e.number);
          
          const fromLeastVoted = rankedLeastVoted
            .filter(e => !usedInMisto.has(e.number) && !fromMostVoted.includes(e.number))
            .slice(0, size - fromMostVoted.length)
            .map(e => e.number);
          
          const combined = [...fromMostVoted, ...fromLeastVoted];
          
          if (combined.length >= size) {
            numbers = combined.slice(0, size);
            mistoCount++;
            reason = `Jogo ${mistoCount} MISTO com ${size} números (mais e menos votados combinados)`;
          }
        }
        
        // Validate and add game
        if (numbers && numbers.length === size) {
          const sortedNumbers = [...numbers].sort((a, b) => a - b);
          const gameKey = sortedNumbers.join(',');
          
          if (!state.existingGames.has(gameKey)) {
            // Mark numbers as used for this category
            numbers.forEach(n => state.usedNumbersByCategory[cat.name].add(n));
            state.existingGames.add(gameKey);
            
            suggestions.push({
              id: `suggestion-${state.gameIndex}`,
              numbers: sortedNumbers,
              cost: price,
              type: `${size} dezenas`,
              reason,
              categoria: cat.name,
            });
            
            remainingBudget -= price;
            state.gameIndex++;
            keepGenerating = true;
            
            console.log(`Added ${cat.name} game: ${size} numbers, R$ ${price.toFixed(2)}, remaining: R$ ${remainingBudget.toFixed(2)}`);
            break; // Move to next size
          }
        }
      }
    }
  }
  
  // Sort suggestions by category and then by size (descending)
  const categoryOrder = ['mais_votados', 'menos_votados', 'nao_votados', 'misto'];
  suggestions.sort((a, b) => {
    const catOrderA = categoryOrder.indexOf(a.categoria);
    const catOrderB = categoryOrder.indexOf(b.categoria);
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;
    return b.numbers.length - a.numbers.length;
  });
  
  console.log(`Generated ${suggestions.length} suggestions, total cost: R$ ${(availableBudget - remainingBudget).toFixed(2)}`);
  console.log(`Skipped ${skippedGames.length} games due to budget constraints`);
  
  return { suggestions, skippedGames };
}

// Generate a custom game with specific criteria
function generateCustomGame(
  size: number,
  criteria: string,
  analysis: NumberAnalysis,
  lotteryConfig: LotteryConfig,
  existingGames: Set<string>,
  usedNumbersInCriteria: Set<number>
): { numbers: number[]; reason: string } | null {
  const rankedMostVoted = analysis.fullRanking.filter(e => e.count > 0);
  
  // CORRECT: Only numbers with at least 1 vote - numbers with 0 are "não votados"
  const rankedLeastVoted = [...rankedMostVoted].sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return a.number - b.number;
  });
  
  let numbers: number[] | null = null;
  let reason = '';
  
  // Try multiple variations to find a unique game
  const maxAttempts = 30;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const skipCount = attempt * Math.floor(size / 2); // Skip more numbers each attempt
    
    if (criteria === 'mais_votados') {
      const available = rankedMostVoted
        .slice(skipCount)
        .filter(e => !usedNumbersInCriteria.has(e.number))
        .slice(0, size)
        .map(e => e.number);
      
      if (available.length >= size) {
        numbers = available.slice(0, size);
        const start = skipCount + 1;
        reason = `Jogo personalizado com ${size} números MAIS VOTADOS (a partir do ${start}º no ranking)`;
      }
    } else if (criteria === 'menos_votados') {
      const available = rankedLeastVoted
        .slice(skipCount)
        .filter(e => !usedNumbersInCriteria.has(e.number))
        .slice(0, size)
        .map(e => e.number);
      
      if (available.length >= size) {
        numbers = available.slice(0, size);
        const start = skipCount + 1;
        reason = `Jogo personalizado com ${size} números MENOS VOTADOS (a partir do ${start}º no ranking)`;
      }
    } else if (criteria === 'nao_votados') {
      const available = analysis.notVoted
        .filter(n => !usedNumbersInCriteria.has(n));
      
      // Shuffle for variation
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      
      if (shuffled.length >= size) {
        numbers = shuffled.slice(0, size);
        reason = `Jogo personalizado com ${size} números NÃO VOTADOS`;
      }
    } else if (criteria === 'misto') {
      const halfSize = Math.ceil(size / 2);
      const fromMost = rankedMostVoted
        .slice(skipCount)
        .filter(e => !usedNumbersInCriteria.has(e.number))
        .slice(0, halfSize)
        .map(e => e.number);
      
      const fromLeast = rankedLeastVoted
        .filter(e => !usedNumbersInCriteria.has(e.number) && !fromMost.includes(e.number))
        .slice(0, size - fromMost.length)
        .map(e => e.number);
      
      const combined = [...fromMost, ...fromLeast];
      if (combined.length >= size) {
        numbers = combined.slice(0, size);
        reason = `Jogo personalizado MISTO com ${size} números`;
      }
    }
    
    if (numbers) {
      const gameKey = [...numbers].sort((a, b) => a - b).join(',');
      if (!existingGames.has(gameKey)) {
        return { numbers: numbers.sort((a, b) => a - b), reason };
      }
      numbers = null; // Try again
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get and validate user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Validate user token using anon client
    const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { 
      bolaoId,
      totalArrecadado, 
      lotteryConfig, 
      apostas, 
      excludeIds = [], 
      alreadySelectedCost = 0,
      customRequest,
      existingGameNumbers = [],
      gameSelections,
    } = body as {
      bolaoId: string;
      totalArrecadado: number;
      lotteryConfig: LotteryConfig;
      apostas: Aposta[];
      excludeIds?: string[];
      alreadySelectedCost?: number;
      customRequest?: {
        size: number;
        criteria: "mais_votados" | "menos_votados" | "nao_votados" | "misto";
      };
      existingGameNumbers?: number[][];
      gameSelections?: Array<{
        size: number;
        criteria: "mais_votados" | "menos_votados" | "nao_votados" | "misto";
        quantity: number;
      }>;
    };

    if (!bolaoId) {
      return new Response(
        JSON.stringify({ error: "bolaoId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user owns this bolao
    const { data: bolao, error: bolaoError } = await supabase
      .from("boloes")
      .select("gestor_id")
      .eq("id", bolaoId)
      .single();

    if (bolaoError || !bolao) {
      console.error("Bolao not found:", bolaoError?.message);
      return new Response(
        JSON.stringify({ error: "Bolão não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bolao.gestor_id !== user.id) {
      console.error(`User ${user.id} is not the owner of bolao ${bolaoId} (owner: ${bolao.gestor_id})`);
      return new Response(
        JSON.stringify({ error: "Acesso negado - você não é o gestor deste bolão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Request received for bolao ${bolaoId} (gestor: ${user.id}): ${apostas.length} apostas, budget R$ ${totalArrecadado}`);
    
    const analysis = analyzeNumbers(apostas, lotteryConfig.numberRange);
    
    const individualGamesCost = apostas.length * lotteryConfig.prices[lotteryConfig.minNumbers];
    const availableBudget = totalArrecadado - individualGamesCost - alreadySelectedCost;
    
    console.log(`Individual games cost: R$ ${individualGamesCost.toFixed(2)}, Available: R$ ${availableBudget.toFixed(2)}`);
    
    // Track existing games
    const existingGames = new Set<string>(
      apostas.map(a => a.dezenas.sort((x, y) => x - y).join(','))
    );
    
    // Add previously suggested/selected games
    existingGameNumbers.forEach(nums => {
      existingGames.add([...nums].sort((a, b) => a - b).join(','));
    });
    
    // Handle custom single game request
    if (customRequest) {
      const { size, criteria } = customRequest;
      const price = lotteryConfig.prices[size];
      
      if (!price) {
        return new Response(
          JSON.stringify({ 
            customGame: null,
            error: `Tamanho de jogo inválido: ${size} dezenas` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (price > availableBudget) {
        return new Response(
          JSON.stringify({ 
            customGame: null,
            error: `Orçamento insuficiente. Precisa de R$ ${price.toFixed(2)}, disponível: R$ ${availableBudget.toFixed(2)}` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Track used numbers from existing games of same criteria
      const usedInCriteria = new Set<number>();
      existingGameNumbers.forEach(nums => {
        nums.forEach(n => usedInCriteria.add(n));
      });
      
      const result = generateCustomGame(size, criteria, analysis, lotteryConfig, existingGames, usedInCriteria);
      
      if (!result) {
        return new Response(
          JSON.stringify({ 
            customGame: null,
            error: "Não foi possível gerar um jogo único com esses critérios. Todos os números disponíveis já foram usados." 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const customGame: SuggestedGame = {
        id: `custom-${Date.now()}`,
        numbers: result.numbers,
        cost: price,
        type: `${size} dezenas`,
        reason: result.reason,
        categoria: criteria,
      };
      
      console.log(`Generated custom game: ${size} numbers, criteria: ${criteria}`);
      
      return new Response(
        JSON.stringify({ customGame }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Handle specific game selections from user
    if (gameSelections && gameSelections.length > 0) {
      console.log(`Processing ${gameSelections.length} game selection types`);
      
      const suggestions: SuggestedGame[] = [];
      const skippedGames: SkippedGame[] = [];
      let gameIndex = 1;
      
      // Get ranked numbers
      const rankedMostVoted = analysis.fullRanking.filter(e => e.count > 0);
      const rankedLeastVoted = [...rankedMostVoted].sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return a.number - b.number;
      });
      
      console.log(`Full ranking (most voted first): ${rankedMostVoted.slice(0, 15).map(e => `${e.number}(${e.count})`).join(', ')}`);
      console.log(`Least voted ranking: ${rankedLeastVoted.slice(0, 15).map(e => `${e.number}(${e.count})`).join(', ')}`);
      
      // Track how many games we've generated per criteria (for sequential games)
      const gamesPerCriteria: Record<string, number> = {
        mais_votados: 0,
        menos_votados: 0,
        nao_votados: 0,
        misto: 0,
      };
      
      // Sort selections by size descending to generate larger games first
      const sortedSelections = [...gameSelections].sort((a, b) => b.size - a.size);
      
      for (const selection of sortedSelections) {
        const { size, criteria, quantity } = selection;
        const price = lotteryConfig.prices[size];
        
        if (!price) continue;
        
        for (let i = 0; i < quantity; i++) {
          let numbers: number[] | null = null;
          let reason = '';
          
          if (criteria === 'mais_votados') {
            // For "mais_votados", ALWAYS use the TOP N numbers from the ranking
            // This means a 10-number game uses positions 1-10, a 9-number game uses positions 1-9, etc.
            const topNumbers = rankedMostVoted
              .slice(0, size)
              .map(e => e.number);
            
            if (topNumbers.length >= size) {
              numbers = topNumbers;
              reason = `Jogo com ${size} números MAIS VOTADOS (TOP ${size} do ranking: posições 1º ao ${size}º)`;
              console.log(`mais_votados game ${size} dezenas: using TOP ${size} numbers: ${numbers.join(', ')}`);
            }
          } else if (criteria === 'menos_votados') {
            // For "menos_votados", use the TOP N from the least voted ranking
            const leastNumbers = rankedLeastVoted
              .slice(0, size)
              .map(e => e.number);
            
            if (leastNumbers.length >= size) {
              numbers = leastNumbers;
              reason = `Jogo com ${size} números MENOS VOTADOS (TOP ${size} menos votados: posições 1º ao ${size}º)`;
              console.log(`menos_votados game ${size} dezenas: using TOP ${size} least voted: ${numbers.join(', ')}`);
            }
          } else if (criteria === 'nao_votados') {
            // For "nao_votados", use the first N numbers that weren't voted
            const notVotedNumbers = analysis.notVoted.slice(0, size);
            
            if (notVotedNumbers.length >= size) {
              numbers = notVotedNumbers;
              reason = `Jogo com ${size} números NÃO VOTADOS`;
              console.log(`nao_votados game ${size} dezenas: ${numbers.join(', ')}`);
            }
          } else if (criteria === 'misto') {
            // Mixed: half from most voted, half from least voted
            // Important: Generate UNIQUE combinations by varying which numbers we pick
            const halfSize = Math.ceil(size / 2);
            const otherHalf = size - halfSize;
            
            // Track numbers already used in other misto games to create diversity
            const numbersInExistingMistoGames = new Set<number>();
            suggestions.filter(s => s.categoria === 'misto').forEach(s => {
              s.numbers.forEach(n => numbersInExistingMistoGames.add(n));
            });
            
            // Strategy: For different game sizes, vary the starting positions
            // to avoid smaller games being subsets of larger games
            const mistoGamesCount = gamesPerCriteria['misto'];
            
            // Use offset to pick different numbers for each misto game attempt
            // This ensures variety across different game sizes
            let fromMost: number[] = [];
            let fromLeast: number[] = [];
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
              const offset = attempts;
              
              // Try picking numbers with offset to create variety
              // For mais_votados: skip some top numbers to get different ones
              const candidatesMost = rankedMostVoted
                .slice(offset, offset + halfSize + 5) // Get extra candidates
                .map(e => e.number);
              
              // For menos_votados: also use offset
              const candidatesLeast = rankedLeastVoted
                .slice(offset, offset + otherHalf + 5)
                .filter(e => !candidatesMost.includes(e.number))
                .map(e => e.number);
              
              fromMost = candidatesMost.slice(0, halfSize);
              fromLeast = candidatesLeast.slice(0, otherHalf);
              
              const combined = [...fromMost, ...fromLeast];
              if (combined.length >= size) {
                const sortedCandidate = [...combined].sort((a, b) => a - b);
                const candidateKey = sortedCandidate.join(',');
                
                // Check if this game already exists
                if (!existingGames.has(candidateKey)) {
                  // Also check if this is a subset of an existing misto game
                  let isSubset = false;
                  for (const existing of suggestions.filter(s => s.categoria === 'misto')) {
                    const existingSet = new Set(existing.numbers);
                    if (combined.every(n => existingSet.has(n))) {
                      isSubset = true;
                      console.log(`Misto ${size} dezenas: combination [${sortedCandidate.join(', ')}] is subset of existing game, trying offset ${offset + 1}`);
                      break;
                    }
                  }
                  
                  if (!isSubset) {
                    numbers = combined.slice(0, size);
                    break; // Found a valid unique combination
                  }
                }
              }
              
              attempts++;
            }
            
            if (numbers && numbers.length === size) {
              reason = `Jogo MISTO com ${size} números (${halfSize} mais votados + ${otherHalf} menos votados)`;
              console.log(`misto game ${size} dezenas: ${numbers.join(', ')} (after ${attempts + 1} attempts)`);
            } else {
              console.log(`misto game ${size} dezenas: could not find unique combination after ${maxAttempts} attempts`);
            }
          }
          
          if (numbers && numbers.length === size) {
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            const gameKey = sortedNumbers.join(',');
            
            // Check if this exact game already exists
            if (!existingGames.has(gameKey)) {
              existingGames.add(gameKey);
              gamesPerCriteria[criteria]++;
              
              suggestions.push({
                id: `suggestion-${gameIndex}`,
                numbers: sortedNumbers,
                cost: price,
                type: `${size} dezenas`,
                reason,
                categoria: criteria,
              });
              
              gameIndex++;
              console.log(`Added ${criteria} game: ${size} numbers = [${sortedNumbers.join(', ')}], R$ ${price.toFixed(2)}`);
            } else {
              console.log(`Skipped duplicate game: ${sortedNumbers.join(', ')}`);
            }
          } else {
            console.log(`Could not generate ${criteria} game: ${size} numbers - not enough available numbers (got ${numbers?.length || 0})`);
          }
        }
      }
      
      // Sort suggestions by size descending for better presentation
      suggestions.sort((a, b) => b.numbers.length - a.numbers.length);
      
      console.log(`Generated ${suggestions.length} games from user selections`);
      
      return new Response(
        JSON.stringify({
          analysis: {
            mostVoted: analysis.mostVoted,
            leastVoted: analysis.leastVoted,
            notVoted: analysis.notVoted,
          },
          suggestions,
          skippedGames,
          individualGamesCost,
          availableBudget: totalArrecadado - individualGamesCost,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Regular suggestions generation (automatic mode)
    const { suggestions, skippedGames } = generateGameSuggestions(
      availableBudget,
      analysis,
      lotteryConfig,
      existingGames,
      excludeIds
    );
    
    console.log(`Generated ${suggestions.length} game suggestions, ${skippedGames.length} skipped`);

    return new Response(
      JSON.stringify({
        analysis: {
          mostVoted: analysis.mostVoted,
          leastVoted: analysis.leastVoted,
          notVoted: analysis.notVoted,
        },
        suggestions,
        skippedGames,
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
