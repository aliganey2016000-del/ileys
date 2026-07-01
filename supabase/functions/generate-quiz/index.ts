import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QuizQuestion {
  type: 'multiple_choice' | 'fill_blank' | 'matching_pair' | 'listening' | 'listen_write' | 'flash_card';
  questionText: string;
  options?: { text: string; isCorrect: boolean }[];
  correctText?: string;
  explanation?: string;
  hint?: string;
  points: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "DeepSeek API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    topic?: string;
    subject?: string;
    level?: string;
    questionCount?: number;
    questionTypes?: string[];
    lessonContent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { topic, subject, level, questionCount = 5, questionTypes, lessonContent } = body;

  const typesToUse = questionTypes?.length
    ? questionTypes
    : ['multiple_choice', 'fill_blank', 'matching_pair'];

  const systemPrompt = `You are an expert quiz creator for an online learning platform called Ilesy Academy.
Generate high-quality educational quiz questions based on the given topic or lesson content.

Rules:
1. Questions must be clear, accurate, and educational
2. Multiple choice questions must have 4 options with exactly one correct answer
3. Fill-in-the-blank questions should have a single clear answer
4. Matching pairs should have 4 pairs (left-right matches)
5. Include helpful explanations where appropriate
6. Points should be between 5-20 based on difficulty
7. For listening/listen_write types, suggest audio text for TTS
8. Respond ONLY with valid JSON, no markdown or extra text

Response format must be a JSON array:
[
  {
    "type": "multiple_choice",
    "questionText": "Question text here?",
    "options": [
      {"text": "Option A", "isCorrect": false},
      {"text": "Option B", "isCorrect": true},
      {"text": "Option C", "isCorrect": false},
      {"text": "Option D", "isCorrect": false}
    ],
    "explanation": "Why B is correct...",
    "hint": "Optional hint",
    "points": 10
  },
  {
    "type": "fill_blank",
    "questionText": "Complete the sentence: The capital of France is _____.",
    "correctText": "Paris",
    "explanation": "Paris is the capital and largest city of France.",
    "points": 10
  },
  {
    "type": "matching_pair",
    "questionText": "Match the countries with their capitals.",
    "options": [
      {"text": "France", "isCorrect": false, "matchKey": "A"},
      {"text": "Paris", "isCorrect": true, "matchKey": "A"},
      {"text": "Japan", "isCorrect": false, "matchKey": "B"},
      {"text": "Tokyo", "isCorrect": true, "matchKey": "B"},
      {"text": "Germany", "isCorrect": false, "matchKey": "C"},
      {"text": "Berlin", "isCorrect": true, "matchKey": "C"},
      {"text": "Italy", "isCorrect": false, "matchKey": "D"},
      {"text": "Rome", "isCorrect": true, "matchKey": "D"}
    ],
    "points": 15
  }
]`;

  const userPrompt = `Generate ${questionCount} quiz question${questionCount > 1 ? 's' : ''} about:
${topic ? `Topic: ${topic}` : ''}
${subject ? `Subject: ${subject}` : ''}
${level ? `Level: ${level}` : ''}
${lessonContent ? `Lesson Content: ${lessonContent.slice(0, 2000)}` : ''}

Question types to use (distribute evenly): ${typesToUse.join(', ')}

Generate educational, accurate questions appropriate for the level. Respond ONLY with the JSON array.`;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `DeepSeek error: ${err}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse the JSON from the response
    let questions: QuizQuestion[];
    try {
      // Remove any potential markdown code blocks
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response as JSON", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questions)) {
      return new Response(JSON.stringify({ error: "AI did not return an array of questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
