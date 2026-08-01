const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TemporaryItem = {
  shouldAdd: boolean;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  note: string;
};

type AiCoachResponse = {
  kind: "coach" | "food_estimate" | "mixed";
  reply: string;
  temporaryItem: TemporaryItem;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "reply", "temporaryItem"],
  properties: {
    kind: { type: "string", enum: ["coach", "food_estimate", "mixed"] },
    reply: { type: "string" },
    temporaryItem: {
      type: "object",
      additionalProperties: false,
      required: ["shouldAdd", "name", "grams", "kcal", "protein", "carbs", "fat", "confidence", "note"],
      properties: {
        shouldAdd: { type: "boolean" },
        name: { type: "string" },
        grams: { type: "number" },
        kcal: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fat: { type: "number" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        note: { type: "string" },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

  if (!openAiKey || !supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "AI-funktionen saknar serverkonfiguration." }, 500);
  }

  const authorization = req.headers.get("authorization") || "";
  const user = await getSupabaseUser(supabaseUrl, supabaseAnonKey, authorization);
  if (!user) {
    return jsonResponse({ error: "Du behöver vara inloggad i Supabase för att använda AI-coachen." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Ogiltig JSON." }, 400);
  }

  const message = String(payload.message || "").trim();
  const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "";
  if (!message && !imageDataUrl) {
    return jsonResponse({ error: "Skriv något eller bifoga en bild." }, 400);
  }

  const day = payload.day || {};
  const focus = payload.focus === "history_long_term" ? "history_long_term" : "today_general";
  const foodHints = Array.isArray(payload.foodHints) ? payload.foodHints.slice(0, 12) : [];
  const recentMessages = Array.isArray(payload.messages) ? payload.messages.slice(-10) : [];

  const inputContent: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: JSON.stringify({
        focus,
        message,
        day,
        foodHints,
        recentMessages,
      }),
    },
  ];

  if (imageDataUrl) {
    inputContent.push({ type: "input_image", image_url: imageDataUrl });
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt,
            },
          ],
        },
        {
          role: "user",
          content: inputContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "matdash_ai_coach_response",
          schema: responseSchema,
          strict: true,
        },
      },
    }),
  });

  const responseBody = await openAiResponse.json().catch(() => ({}));
  if (!openAiResponse.ok) {
    const message = responseBody?.error?.message || "OpenAI svarade med ett fel.";
    return jsonResponse({ error: message }, openAiResponse.status);
  }

  const text = extractResponseText(responseBody);
  if (!text) {
    return jsonResponse({ error: "AI-svaret saknade text." }, 502);
  }

  try {
    const parsed = JSON.parse(text) as AiCoachResponse;
    return jsonResponse(normalizeCoachResponse(parsed));
  } catch {
    return jsonResponse({
      kind: "coach",
      reply: text,
      temporaryItem: emptyTemporaryItem(),
    });
  }
});

async function getSupabaseUser(supabaseUrl: string, anonKey: string, authorization: string) {
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "apikey": anonKey,
      "authorization": authorization,
    },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function extractResponseText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  return output
    .flatMap((item) => {
      const record = item as Record<string, unknown>;
      return Array.isArray(record.content) ? record.content : [];
    })
    .map((part) => {
      const record = part as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeCoachResponse(value: AiCoachResponse): AiCoachResponse {
  const item = value.temporaryItem || emptyTemporaryItem();
  return {
    kind: ["coach", "food_estimate", "mixed"].includes(value.kind) ? value.kind : "coach",
    reply: String(value.reply || "Jag kunde inte formulera ett bra svar."),
    temporaryItem: {
      shouldAdd: Boolean(item.shouldAdd),
      name: String(item.name || ""),
      grams: safeNumber(item.grams),
      kcal: safeNumber(item.kcal),
      protein: safeNumber(item.protein),
      carbs: safeNumber(item.carbs),
      fat: safeNumber(item.fat),
      confidence: ["low", "medium", "high"].includes(item.confidence) ? item.confidence : "medium",
      note: String(item.note || ""),
    },
  };
}

function emptyTemporaryItem(): TemporaryItem {
  return {
    shouldAdd: false,
    name: "",
    grams: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    confidence: "low",
    note: "",
  };
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const systemPrompt = `
Du är en svensk kostcoach i en privat matlådsapp. Svara kort, praktiskt och resonemangsdugligt.

Du får dagsdata, mål, makro, vatten, måltider, tillfälliga livsmedel, relevant livsmedelsdatabas och ibland en bild.

Regler:
- Svara på svenska.
- Formatera reply som lättläst Markdown-liknande text: korta stycken, tom rad mellan ämnen och punktlistor med "- " när du nämner flera saker.
- Använd gärna **fetstil** för korta rubriker, men undvik långa kompakta textblock.
- Om focus är "today_general": fokusera på dagens intag, snabba val, vatten, måltider och eventuell mat/bild som användaren vill lägga till.
- Om focus är "history_long_term": fokusera på historiskt registrerad data, mönster över dagar/veckor, återkommande brister, hållbara justeringar och vad som behövs långsiktigt. Ge gärna prioriterade slutsatser och nästa steg.
- Ge inte medicinska diagnoser. Vid medicinska symtom: rekommendera vårdkontakt.
- Om användaren beskriver mat som den ätit eller bifogar tallriksbild: uppskatta portionsstorlek och makro så gott det går.
- Använd databashints när de matchar maten. Om maten saknas, uppskatta själv och sätt confidence låg/medium.
- Föreslå aldrig att frontend ändrar data direkt. Returnera ett temporaryItem med shouldAdd=true när appen bör visa "lägg till"-förslag.
- Makro ska vara totalen för portionen, inte per 100 g.
- Om det är en ren coachfråga ska temporaryItem.shouldAdd vara false.
- Var ärlig med osäkerhet kring bilder och portioner.
`.trim();
