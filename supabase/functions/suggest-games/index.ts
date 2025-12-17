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

    // Format paid bets for the prompt
    const apostasFormatadas = apostas.map((a, i) => 
      `${i + 1}. ${a.apelido}: [${a.dezenas.map(n => n.toString().padStart(2, "0")).join(", ")}]`
    ).join("\n");

    // Format prices table
    const pricesTable = Object.entries(lotteryConfig.prices)
      .map(([nums, price]) => `${nums} números: R$ ${price.toFixed(2)}`)
      .join("\n");

    const systemPrompt = `Você é um especialista em loterias brasileiras da Caixa Econômica Federal.
Sua função é ajudar gestores de bolões a decidir como usar o dinheiro arrecadado.

LOTERIA SELECIONADA: ${lotteryConfig.name}
- Faixa de números: 01 a ${lotteryConfig.numberRange}
- Mínimo de números: ${lotteryConfig.minNumbers}
- Máximo de números: ${lotteryConfig.maxNumbers}

TABELA DE PREÇOS (${lotteryConfig.name}):
${pricesTable}

IMPORTANTE:
1. Os participantes já fizeram seus jogos (listados abaixo). Esses jogos DEVEM ser considerados como apostas a serem registradas.
2. O gestor precisa saber: com o valor arrecadado, é possível registrar todos esses jogos?
3. Se sobrar dinheiro, sugira combinações adicionais que complementem os jogos existentes.
4. Considere os números mais frequentes entre os participantes para as sugestões adicionais.

Responda de forma clara e objetiva em português brasileiro.`;

    const userPrompt = `VALOR TOTAL ARRECADADO: R$ ${totalArrecadado.toFixed(2)}
QUANTIDADE DE APOSTAS PAGAS: ${apostas.length}

JOGOS DOS PARTICIPANTES QUE DEVEM SER APOSTADOS:
${apostasFormatadas}

Com base nesses dados:
1. Calcule o custo total para registrar todos os jogos dos participantes (cada jogo tem ${lotteryConfig.minNumbers} números = R$ ${lotteryConfig.prices[lotteryConfig.minNumbers].toFixed(2)})
2. Informe se o valor arrecadado é suficiente
3. Se sobrar dinheiro, sugira combinações adicionais considerando os números mais escolhidos pelos participantes
4. Se faltar dinheiro, explique quanto falta

Seja prático e direto.`;

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
