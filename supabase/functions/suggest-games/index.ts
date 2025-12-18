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

function analyzeNumbers(apostas: Aposta[], numberRange: number) {
  const frequency: Record<number, number> = {};
  
  // Initialize all numbers with 0
  for (let i = 1; i <= numberRange; i++) {
    frequency[i] = 0;
  }
  
  // Count frequency
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
  
  return { frequency, mostVoted, leastVoted, notVoted };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { totalArrecadado, tipoLoteria, lotteryConfig, apostas } = await req.json() as {
      totalArrecadado: number;
      tipoLoteria: string;
      lotteryConfig: LotteryConfig;
      apostas: Aposta[];
    };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Analyze numbers
    const { mostVoted, leastVoted, notVoted } = analyzeNumbers(apostas, lotteryConfig.numberRange);

    // Format paid bets for the prompt
    const apostasFormatadas = apostas.map((a, i) => 
      `${i + 1}. ${a.apelido}: [${a.dezenas.map(n => n.toString().padStart(2, "0")).join(", ")}]`
    ).join("\n");

    // Format prices table
    const pricesTable = Object.entries(lotteryConfig.prices)
      .map(([nums, price]) => `${nums} números: R$ ${price.toFixed(2)}`)
      .join("\n");

    // Format number analysis
    const mostVotedStr = mostVoted.map(e => `${e.number.toString().padStart(2, "0")} (${e.count}x)`).join(", ");
    const leastVotedStr = leastVoted.map(e => `${e.number.toString().padStart(2, "0")} (${e.count}x)`).join(", ");
    const notVotedStr = notVoted.length > 0 
      ? notVoted.map(n => n.toString().padStart(2, "0")).join(", ")
      : "Todos os números foram votados";

    const systemPrompt = `Você é um especialista em loterias brasileiras da Caixa Econômica Federal e estrategista de bolões.
Sua função é analisar as apostas de um bolão e sugerir a melhor estratégia de jogos considerando o orçamento disponível.

LOTERIA SELECIONADA: ${lotteryConfig.name}
- Faixa de números: 01 a ${lotteryConfig.numberRange}
- Mínimo de números por jogo: ${lotteryConfig.minNumbers}
- Máximo de números por jogo: ${lotteryConfig.maxNumbers}

TABELA DE PREÇOS (${lotteryConfig.name}):
${pricesTable}

ANÁLISE DE NÚMEROS:
- MAIS VOTADOS pelos participantes: ${mostVotedStr}
- MENOS VOTADOS pelos participantes: ${leastVotedStr}
- NÃO VOTADOS (números disponíveis): ${notVotedStr}

IMPORTANTE:
1. Os jogos dos participantes SÃO as apostas oficiais do bolão - cada participante já escolheu suas 6 dezenas
2. Calcule primeiro o custo total para registrar TODOS os jogos individuais dos participantes
3. Se sobrar orçamento após os jogos individuais, sugira JOGOS ADICIONAIS específicos:
   - Crie combinações que complementem os jogos existentes
   - Considere os números mais votados para aumentar chances de prêmio compartilhado
   - Considere números menos votados ou não votados para diversificar
4. Para cada jogo adicional sugerido, mostre:
   - Os 6 números específicos do jogo (ex: [01, 12, 23, 34, 45, 56])
   - O custo do jogo
   - O saldo restante após esse jogo
5. Calcule quantos jogos cabem no orçamento restante

FORMATO DA RESPOSTA:
Use markdown com seções claras e emojis para facilitar leitura.
Apresente os jogos sugeridos em formato de tabela ou lista numerada com os números bem destacados.`;

    const userPrompt = `ORÇAMENTO TOTAL: R$ ${totalArrecadado.toFixed(2)}
QUANTIDADE DE PARTICIPANTES (apostas pagas): ${apostas.length}
CUSTO POR JOGO INDIVIDUAL: R$ ${lotteryConfig.prices[lotteryConfig.minNumbers].toFixed(2)} (${lotteryConfig.minNumbers} números)

JOGOS DOS PARTICIPANTES (cada um = 1 aposta oficial):
${apostasFormatadas}

Por favor:
1. 📊 RESUMO FINANCEIRO:
   - Custo total dos ${apostas.length} jogos individuais
   - Saldo restante para jogos adicionais

2. 🎯 ANÁLISE DOS NÚMEROS:
   - Números mais escolhidos (quentes)
   - Números pouco escolhidos (frios)
   - Números não escolhidos (oportunidade)

3. 🎲 SUGESTÃO DE JOGOS ADICIONAIS (se houver saldo):
   Para cada jogo, apresente:
   | Jogo # | Dezenas | Custo | Saldo Após |
   Com os números específicos sugeridos

4. 💰 RESUMO FINAL:
   - Total de jogos do bolão (individuais + adicionais)
   - Valor total gasto
   - Saldo final

Seja específico com os números de cada jogo sugerido!`;

    console.log("Sending request to AI with prompt:", userPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar sugestões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content || "Não foi possível gerar sugestões.";

    console.log("AI suggestion generated successfully");

    return new Response(
      JSON.stringify({ suggestion }),
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