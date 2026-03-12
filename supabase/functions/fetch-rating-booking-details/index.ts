import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  bookingId: string;
  token: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { bookingId, token }: RequestBody = await req.json();

    if (!bookingId || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingId or token' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch booking details with token validation
    const { data: booking, error: fetchError } = await supabase
      .from('bookings_with_users')
      .select(`
        id,
        user_id,
        product_name,
        booking_date,
        booking_time,
        address,
        user_email,
        rating_token_expires_at
      `)
      .eq('id', bookingId)
      .eq('rating_access_token', token)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(booking.rating_token_expires_at);
    const now = new Date();

    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { 
          status: 410, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if booking has already been rated
    const { data: existingRating } = await supabase
      .from('ratings')
      .select('id')
      .eq('booking_id', bookingId)
      .single();

    const hasExistingRating = !!existingRating;

    // Return booking data
    return new Response(
      JSON.stringify({
        booking: {
          id: booking.id,
          user_id: booking.user_id,
          product_name: booking.product_name,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          address: booking.address,
          user_email: booking.user_email,
          rating_token_expires_at: booking.rating_token_expires_at,
        },
        hasExistingRating,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in fetch-rating-booking-details:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});