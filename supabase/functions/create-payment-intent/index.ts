import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Check for valid request method
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // Parse request body
    const { amount, bookingId, metadata } = await req.json();

    if (!amount || !bookingId) {
      throw new Error("Missing required parameters");
    }

    // Construct Stripe API URL
    const stripeUrl = "https://api.stripe.com/v1/payment_intents";

    // Create payment intent
    const paymentIntentResponse = await fetch(stripeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: (amount * 100).toString(), // Convert to cents
        currency: "dkk",
        automatic_payment_methods: JSON.stringify({ enabled: true }),
        ...(metadata && { metadata: JSON.stringify(metadata) }),
      }),
    });

    const paymentIntent = await paymentIntentResponse.json();

    if (paymentIntent.error) {
      throw new Error(paymentIntent.error.message);
    }

    // Update booking with payment intent ID
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ payment_intent_id: paymentIntent.id })
      .eq("id", bookingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Return client secret
    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});