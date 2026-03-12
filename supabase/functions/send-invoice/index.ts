import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { Resend } from "npm:resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_ANON_KEY") || ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { bookingId, email, amount } = await req.json();

    if (!bookingId || !email || !amount) {
      throw new Error("Missing required parameters");
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, products(*)")
      .eq("id", bookingId)
      .single();

    if (bookingError) throw bookingError;

    // Send invoice email
    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: "faktura@flai.dk",
      to: email,
      subject: `Faktura for booking #${bookingId}`,
      html: `
        <h1>Faktura for Droneoptagelse</h1>
        <p>Kære kunde,</p>
        <p>Tak for din booking. Her er din faktura:</p>
        <div style="margin: 20px 0; padding: 20px; border: 1px solid #eee;">
          <h2>Fakturadetaljer</h2>
          <p>Booking ID: ${bookingId}</p>
          <p>Produkt: ${booking.products.name}</p>
          <p>Dato: ${booking.booking_date}</p>
          <p>Tid: ${booking.booking_time}</p>
          <p>Adresse: ${booking.address}</p>
          <p>Total: ${amount} DKK</p>
        </div>
        <p>Betalingsfrist: 14 dage</p>
        <p>Bankoplysninger:</p>
        <p>Bank: [Bank Name]</p>
        <p>Reg. nr.: XXXX</p>
        <p>Konto nr.: XXXXXXXXXX</p>
      `,
    });

    if (emailError) throw emailError;

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ 
        payment_status: "awaiting_payment",
        payment_method: "invoice"
      })
      .eq("id", bookingId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Faktura sendt" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Invoice sending error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Der opstod en fejl ved afsendelse af fakturaen",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});