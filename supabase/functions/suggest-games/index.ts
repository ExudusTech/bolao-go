import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { totalArrecadado, quantidadeApostasPagas, dezenasSelecionadas } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em loterias brasileiras da Caixa Econômica Federal.
Sua função é sugerir combinações de jogos com base no valor arrecadado em um bolão.

Regras das loterias:
- Mega-Sena: 6 a 20 dezenas de 01 a 60. Aposta mínima (6 dezenas): R$ 5,00
- Lotofácil: 15 a 20 dezenas de 01 a 25. Aposta mínima (15 dezenas): R$ 3,00
- Quina: 5 a 15 dezenas de 01 a 80. Aposta mínima (5 dezenas): R$ 2,50
- Lotomania: 50 dezenas fixas de 01 a 100. Aposta única: R$ 3,00
- Dupla Sena: 6 a 15 dezenas de 01 a 50. Aposta mínima (6 dezenas): R$ 2,50
- Timemania: 10 dezenas fixas de 01 a 80. Aposta única: R$ 3,50

Ao sugerir combinações:
1. Priorize jogos com maior chance de retorno para o valor disponível
2. Sugira combinações que maximizem a cobertura de números
3. Considere as dezenas já selecionadas pelos participantes como preferências
4. Seja prático e objetivo nas sugestões

Responda sempre em português brasileiro de forma clara e objetiva.`;

    const userPrompt = `Total arrecadado no bolão: R$ ${totalArrecadado.toFixed(2)}
Quantidade de apostas pagas: ${quantidadeApostasPagas}
${dezenasSelecionadas?.length > 0 ? `Dezenas mais escolhidas pelos participantes: ${dezenasSelecionadas.join(", ")}` : ""}

Com base nesse valor, sugira as melhores combinações de jogos para o bolão, indicando:
1. Qual loteria jogar
2. Quantos jogos fazer
3. Como distribuir o valor
4. Se vale a pena fazer jogos com mais dezenas

Seja prático e direto na resposta.`;

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
