import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import Stripe from "npm:stripe@14.14.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
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
    const { 
      amount,
      productName,
      bookingDate,
      bookingTime,
      userId,
      email,
      metadata 
    } = await req.json();

    console.log('Create checkout session request:', {
      amount,
      productName,
      bookingDate,
      bookingTime,
      userId,
      email,
      metadata
    });

    // Check if the date/time is already booked
    // IMPORTANT: Skip this check if bookingId exists in metadata (payment for existing booking)
    if (!metadata?.bookingId) {
      const { data: existingBooking, error: bookingError } = await supabase
        .from('bookings')
        .select('id')
        .eq('booking_date', bookingDate)
        .eq('booking_time', bookingTime)
        .is('deleted_at', null);

      if (bookingError) {
        console.error('Error checking existing bookings:', bookingError);
        throw bookingError;
      }

      if (existingBooking && existingBooking.length > 0) {
        console.log('Time slot already booked');
        return new Response(
          JSON.stringify({ error: "Dette tidspunkt er allerede booket" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: 'dkk',
            product_data: {
              name: productName,
              description: `Booking ${bookingDate} kl. ${bookingTime}`,
            },
            unit_amount: Math.round(amount * 100), // Ensure it's an integer
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/payment`,
      customer_email: email,
      metadata: {
        userId: userId || '',
        bookingDate: bookingDate || '',
        bookingTime: bookingTime || '',
        bookingId: metadata?.bookingId || '',
        productId: metadata?.productId || '',
        address: metadata?.address || '',
        includeEditing: metadata?.includeEditing?.toString() || 'false',
        discountCodeId: metadata?.discountCodeId || '',
        discountAmount: metadata?.discountAmount?.toString() || '0',
        originalPrice: metadata?.originalPrice?.toString() || '0',
        creditsUsed: metadata?.creditsUsed?.toString() || '0',
        guestEmail: metadata?.guestEmail || '', // CRITICAL: Include guest email
      },
    });

    console.log('Stripe session created:', session.id);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});