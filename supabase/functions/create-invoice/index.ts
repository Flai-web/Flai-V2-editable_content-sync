import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import Stripe from "npm:stripe@14.14.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

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
    const { customerId, email, amount, description, metadata } = await req.json();

    console.log('Creating invoice with metadata:', metadata);

    // First, create or get customer
    let customer;
    try {
      customer = await stripe.customers.retrieve(customerId);
    } catch {
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          supabaseUserId: customerId
        }
      });
    }

    // CRITICAL FIX: Ensure booking_id is in the metadata
    // The webhook needs this to find and update the correct booking
    const invoiceMetadata = {
      ...metadata,
      // Add booking_id if it's passed as bookingId (normalize the field name)
      booking_id: metadata.booking_id || metadata.bookingId || metadata.id
    };

    console.log('Invoice metadata with booking_id:', invoiceMetadata);

    // Create a Stripe invoice with the booking_id in metadata
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 14,
      metadata: invoiceMetadata  // ← FIXED: Now includes booking_id
    });

    // Add invoice items
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: amount * 100, // Convert to cents
      currency: 'dkk',
      description: description
    });

    // Finalize and send the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

    console.log('✅ Invoice created successfully:', sentInvoice.id);
    console.log('Invoice metadata:', sentInvoice.metadata);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoiceId: sentInvoice.id,
        invoiceUrl: sentInvoice.hosted_invoice_url 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Invoice creation error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Der opstod en fejl ved oprettelse af fakturaen",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});