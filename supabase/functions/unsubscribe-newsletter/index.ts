/*
  # Newsletter Unsubscribe Function

  1. Purpose
    - Handles newsletter unsubscription requests
    - Removes email addresses from the newsletter_subscribers table
    - Uses service role key to bypass RLS for this operation

  2. Security
    - Uses CORS headers for cross-origin requests
    - Validates email format before processing
    - Uses service role key for database operations

  3. Error Handling
    - Returns appropriate HTTP status codes
    - Provides meaningful error messages
    - Handles cases where email doesn't exist
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface UnsubscribeRequest {
  email: string;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Parse request body
    const { email }: UnsubscribeRequest = await req.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email exists in newsletter_subscribers
    const { data: existingSubscriber, error: checkError } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking subscriber:', checkError);
      return new Response(
        JSON.stringify({ error: 'Database error occurred' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // If email doesn't exist, return success anyway (idempotent operation)
    if (!existingSubscriber) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email successfully unsubscribed',
          already_unsubscribed: true 
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Delete the subscriber
    const { error: deleteError } = await supabase
      .from('newsletter_subscribers')
      .delete()
      .eq('email', email);

    if (deleteError) {
      console.error('Error deleting subscriber:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to unsubscribe email' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email successfully unsubscribed' 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Unsubscribe function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});