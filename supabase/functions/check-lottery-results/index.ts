import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaixaLotteryResult {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  acumulado: boolean;
  valorAcumuladoProximoConcurso: number;
}

interface JogoSelecionado {
  id: string;
  dezenas: number[];
  tipo: string;
  categoria: string;
  custo: number;
}

interface MatchResult {
  jogoId: string;
  dezenas: number[];
  acertos: number[];
  quantidadeAcertos: number;
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

    const { bolaoId, numeroConcurso } = await req.json();

    if (!bolaoId || !numeroConcurso) {
      return new Response(
        JSON.stringify({ error: "bolaoId e numeroConcurso são obrigatórios" }),
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

    console.log(`Buscando resultado do concurso ${numeroConcurso} para bolão ${bolaoId} (gestor: ${user.id})`);

    // Fetch lottery result - try multiple APIs
    let lotteryResult: CaixaLotteryResult | null = null;
    
    // Try the loteriascaixa-api first (more reliable)
    try {
      const alternativeUrl = `https://loteriascaixa-api.herokuapp.com/api/mega-sena/${numeroConcurso}`;
      console.log(`Tentando API alternativa: ${alternativeUrl}`);
      
      const altResponse = await fetch(alternativeUrl, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        console.log("API alternativa respondeu:", JSON.stringify(altData));
        
        if (altData && altData.dezenas) {
          lotteryResult = {
            numero: altData.concurso || numeroConcurso,
            dataApuracao: altData.data || new Date().toISOString(),
            listaDezenas: altData.dezenas,
            acumulado: altData.acumulou || false,
            valorAcumuladoProximoConcurso: altData.acumuladaProxConcurso || 0,
          };
        }
      }
    } catch (altError) {
      console.log("API alternativa falhou, tentando API da Caixa...", altError);
    }

    // If alternative API failed, try Caixa API
    if (!lotteryResult) {
      const caixaUrl = `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/${numeroConcurso}`;
      console.log(`Tentando API Caixa: ${caixaUrl}`);
      
      try {
        const caixaResponse = await fetch(caixaUrl, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://loterias.caixa.gov.br/",
            "Origin": "https://loterias.caixa.gov.br",
          },
        });

        if (caixaResponse.ok) {
          const caixaData = await caixaResponse.json();
          lotteryResult = caixaData;
          console.log(`Caixa API respondeu: ${JSON.stringify(caixaData.listaDezenas)}`);
        } else {
          console.error(`Caixa API error: ${caixaResponse.status}`);
        }
      } catch (caixaError) {
        console.error("Erro na API da Caixa:", caixaError);
      }
    }

    if (!lotteryResult) {
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível buscar o resultado. Tente novamente em alguns minutos.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse drawn numbers
    const numerosSorteados = lotteryResult.listaDezenas.map(n => parseInt(n, 10));
    console.log(`Números sorteados: ${numerosSorteados.join(", ")}`);

    // Update bolao with drawn numbers
    const { error: updateBolaoError } = await supabase
      .from("boloes")
      .update({
        numeros_sorteados: numerosSorteados,
        resultado_verificado: true,
      })
      .eq("id", bolaoId);

    if (updateBolaoError) {
      console.error("Erro ao atualizar bolão:", updateBolaoError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar resultado no bolão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch selected games for this bolao
    const { data: jogosSelecionados, error: jogosError } = await supabase
      .from("jogos_selecionados")
      .select("*")
      .eq("bolao_id", bolaoId);

    if (jogosError) {
      console.error("Erro ao buscar jogos:", jogosError);
    }

    // Calculate matches for each game
    const resultadosJogos: MatchResult[] = [];

    if (jogosSelecionados && jogosSelecionados.length > 0) {
      for (const jogo of jogosSelecionados) {
        const acertos = jogo.dezenas.filter((d: number) => numerosSorteados.includes(d));
        resultadosJogos.push({
          jogoId: jogo.id,
          dezenas: jogo.dezenas,
          acertos,
          quantidadeAcertos: acertos.length,
        });
      }

      console.log(`Verificados ${jogosSelecionados.length} jogos selecionados`);
    }

    // Also check individual bets (apostas)
    const { data: apostas, error: apostasError } = await supabase
      .from("apostas")
      .select("*")
      .eq("bolao_id", bolaoId);

    const resultadosApostas: MatchResult[] = [];

    if (apostas && !apostasError) {
      for (const aposta of apostas) {
        const acertos = aposta.dezenas.filter((d: number) => numerosSorteados.includes(d));
        resultadosApostas.push({
          jogoId: aposta.id,
          dezenas: aposta.dezenas,
          acertos,
          quantidadeAcertos: acertos.length,
        });
      }

      console.log(`Verificadas ${apostas.length} apostas individuais`);
    }

    // Calculate summary
    const todosResultados = [...resultadosJogos, ...resultadosApostas];
    const maiorAcerto = Math.max(0, ...todosResultados.map(r => r.quantidadeAcertos));
    const jogosComAcertos = todosResultados.filter(r => r.quantidadeAcertos >= 4);

    const response = {
      success: true,
      concurso: numeroConcurso,
      dataApuracao: lotteryResult.dataApuracao,
      numerosSorteados,
      acumulado: lotteryResult.acumulado,
      valorAcumulado: lotteryResult.valorAcumuladoProximoConcurso,
      resultadosJogos,
      resultadosApostas,
      resumo: {
        totalJogosVerificados: todosResultados.length,
        maiorQuantidadeAcertos: maiorAcerto,
        jogosComQuatroOuMaisAcertos: jogosComAcertos.length,
      },
    };

    console.log(`Verificação concluída. Maior acerto: ${maiorAcerto}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-lottery-results:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
