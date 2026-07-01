import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Aggressively repair and parse malformed JSON from LLM output.
 * Handles: markdown fences, prose wrapper, unescaped newlines/quotes,
 * missing closing braces, and other common issues.
 */
function repairAndParseJson(raw: string): { description: string; content: string } {
  let s = raw;

  // 1. Strip markdown code fences (```json, ```html, ```)
  s = s.replace(/```(?:json|html)?\s*/gi, "").replace(/```\s*/g, "").trim();

  // 2. Find the outermost { ... }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }

  // 3. Remove control characters
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  // 4. Try parsing as-is first
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed.content === "string") {
      return { description: parsed.description ?? "", content: parsed.content };
    }
  } catch {
    // Continue to repair attempts
  }

  // 5. Repair unescaped newlines inside string values
  //    Walk through the string, tracking whether we're inside a string literal.
  //    When inside a string, replace literal newlines with \n escape.
  let repaired = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escapeNext) {
      repaired += ch;
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      repaired += ch;
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      repaired += ch;
      continue;
    }

    if (inString) {
      // Inside a string literal — escape special chars
      if (ch === "\n") {
        repaired += "\\n";
        continue;
      }
      if (ch === "\r") {
        repaired += "\\r";
        continue;
      }
      if (ch === "\t") {
        repaired += "\\t";
        continue;
      }
      // Unescaped quote inside string? This is tricky — often indicates
      // HTML attribute quote that wasn't escaped. Replace with \"
      // ONLY if it looks like part of HTML (preceded by =)
      if (ch === "'") {
        // Single quote inside string is fine — keep as-is
        repaired += ch;
        continue;
      }
    }

    repaired += ch;
  }

  // 6. Try parsing the repaired string
  try {
    const parsed = JSON.parse(repaired);
    if (typeof parsed.content === "string") {
      return { description: parsed.description ?? "", content: parsed.content };
    }
  } catch {
    // Continue to more aggressive repair
  }

  // 7. Last resort: extract HTML content directly using regex
  //    Look for "content": "..." pattern and extract the HTML string
  const contentMatch = repaired.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const descMatch = repaired.match(/"description"\s*:\s*"([^"]*)"/);

  let htmlContent = "";
  if (contentMatch) {
    // Unescape the captured string
    htmlContent = contentMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  const description = descMatch ? descMatch[1] : "";

  if (!htmlContent) {
    // 8. If still nothing, the entire raw string minus JSON syntax might be the content
    //    Strip JSON structural chars and use remainder as HTML
    const stripped = raw
      .replace(/^[{[\s]*"description"\s*:\s*"[^"]*",?\s*/i, "")
      .replace(/"content"\s*:\s*"/i, "")
      .replace(/"\s*}\s*$/i, "")
      .replace(/\\"/g, '"');
    htmlContent = stripped.trim();
  }

  return { description, content: htmlContent };
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
    level?: string;
    description?: string;
    rawText?: string;
    videoUrl?: string;
    customInstructions?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { topic, level, description, rawText, videoUrl, customInstructions } = body;

  if (!topic || !topic.trim()) {
    return new Response(JSON.stringify({ error: "A lesson topic (title) is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Simpler prompt that's harder for the model to mess up
  const systemPrompt = `You are a curriculum designer. Generate lesson content as JSON.

OUTPUT ONLY this exact JSON structure (no other text):
{"description": "Brief one sentence summary", "content": "Full lesson HTML"}

STRICT RULES:
1. Output ONLY the JSON object — no markdown, no explanation before/after
2. In the "content" field, put complete well-formatted HTML
3. Use \\n for line breaks inside the JSON string (never actual line breaks)
4. Escape ALL double quotes in HTML attributes as \\"
5. Keep content compact and focused

Example valid output:
{"description":"Intro to French vowels.","content":"<div style=\\"padding:16px;\\"><h2>Vowels</h2><p>A, E, I, O, U are vowels.</p></div>"}`;

  const userPrompt = `Create a lesson on: "${topic}"
Level: ${level ?? "intermediate"}
${description ? `Context: ${description}` : ""}
${rawText ? `Use this source material: ${rawText.slice(0, 2000)}` : ""}
${videoUrl ? `Reference: ${videoUrl}` : ""}
${customInstructions ? `Additional: ${customInstructions}` : ""}

Remember: output ONLY the JSON. No markdown fences.`;

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
        temperature: 0.3,
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
    const raw: string = data.choices?.[0]?.message?.content ?? "";

    // Use the robust repair parser
    const { content, description: lessonDesc } = repairAndParseJson(raw);

    if (!content || content.trim().length < 10) {
      return new Response(
        JSON.stringify({
          error: "AI returned empty or invalid content. Please try again.",
          raw,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ description: lessonDesc, content }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
