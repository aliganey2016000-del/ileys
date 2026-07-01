import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SMSPayload {
  /** Target phone numbers in E.164 format, e.g. ["+252611234567"] */
  to: string[];
  /** Message body (max 160 chars per segment) */
  message: string;
  /** Optional: only send if user opted in (skips check when false) */
  respectOptOut?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Africa's Talking credentials from secrets
    const AT_USERNAME = Deno.env.get("AT_USERNAME");
    const AT_API_KEY  = Deno.env.get("AT_API_KEY");
    const AT_SENDER   = Deno.env.get("AT_SENDER_ID") ?? ""; // optional short-code

    if (!AT_USERNAME || !AT_API_KEY) {
      return new Response(
        JSON.stringify({ error: "SMS service not configured. Set AT_USERNAME and AT_API_KEY secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as SMSPayload;
    const { to, message } = body;

    if (!to || to.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Africa's Talking REST API
    const form = new URLSearchParams();
    form.set("username", AT_USERNAME);
    form.set("to", to.join(","));
    form.set("message", message);
    if (AT_SENDER) form.set("from", AT_SENDER);

    const atResponse = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "apiKey": AT_API_KEY,
        },
        body: form.toString(),
      },
    );

    const atResult = await atResponse.json();

    if (!atResponse.ok) {
      return new Response(
        JSON.stringify({ error: "SMS gateway error", details: atResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, result: atResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
