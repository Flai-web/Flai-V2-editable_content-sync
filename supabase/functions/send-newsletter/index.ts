import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendNewsletterRequest {
  title: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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
    const { title, content }: SendNewsletterRequest = await req.json();

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get all subscribers
    const { data: subscribers, error: subscribersError } = await supabase
      .from('newsletter_subscribers')
      .select('email');

    if (subscribersError) {
      console.error('Error fetching subscribers:', subscribersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscribers' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No subscribers found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send emails using Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get site URL for unsubscribe link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://your-domain.com';

    const emailPromises = subscribers.map(async (subscriber) => {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@flai.dk',
            to: [subscriber.email],
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">${title}</h1>
                <div style="line-height: 1.6; color: #555;">
                  ${content.replace(/\n/g, '<br>')}
                </div>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #888;">
                  Du modtager denne email, fordi du har tilmeldt dig vores nyhedsbrev.
                </p>
                <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">
                  Hvis du ikke længere ønsker at modtage disse emails, kan du <a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(subscriber.email)}" style="color: #007bff; text-decoration: underline;">afmelde dig her</a>.
                </p>
              </div>
            `,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send email to ${subscriber.email}:`, errorText);
          return { email: subscriber.email, success: false, error: errorText };
        }

        return { email: subscriber.email, success: true };
      } catch (error) {
        console.error(`Error sending email to ${subscriber.email}:`, error);
        return { email: subscriber.email, success: false, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Record the newsletter in the database
    const { error: insertError } = await supabase
      .from('newsletters')
      .insert([{ title, content }]);

    if (insertError) {
      console.error('Error recording newsletter:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Newsletter sent successfully to ${successCount} subscribers${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
        stats: {
          total: subscribers.length,
          sent: successCount,
          failed: failureCount
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});