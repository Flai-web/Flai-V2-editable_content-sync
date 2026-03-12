import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@2.0.0';

interface ContactMessageRequest {
  name: string;
  email: string;
  message: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Contact Message Request Started ===');

  try {
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: 'Could not parse JSON' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { name, email, message }: ContactMessageRequest = requestBody;

    // Validate required fields
    if (!name || !email || !message) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          received: {
            name: !!name,
            email: !!email,
            message: !!message
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasResendKey: !!Deno.env.get('RESEND_API_KEY')
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error - Supabase credentials missing' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');

    // Fetch admin email from site_content table
    console.log('Fetching admin email from site_content table...');
    const { data: adminEmailData, error: adminEmailError } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'admin-notification-email')
      .single();

    if (adminEmailError) {
      console.error('Database error fetching admin email:', adminEmailError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retrieve admin email from database',
          details: adminEmailError.message,
          hint: 'Please add an admin-notification-email entry to site_content table'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const adminEmail = adminEmailData?.value;
    console.log('Admin email retrieved:', adminEmail ? 'Yes' : 'No');

    if (!adminEmail) {
      console.error('Admin email not found in database');
      return new Response(
        JSON.stringify({ 
          error: 'Admin email not configured',
          hint: 'Please add admin-notification-email to site_content table'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate admin email format
    if (!emailRegex.test(adminEmail)) {
      console.error('Invalid admin email format:', adminEmail);
      return new Response(
        JSON.stringify({ error: 'Invalid admin email configuration' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send emails
    return await sendContactEmails(adminEmail, name, email, message);

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error processing contact message:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name || 'Unknown'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendContactEmails(
  adminEmail: string,
  senderName: string,
  senderEmail: string,
  message: string
) {
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

  const resend = new Resend(resendApiKey);

  // Email to admin
  const adminEmailData = {
    from: 'Flai.dk Kontaktformular <noreply@flai.dk>',
    to: adminEmail,
    replyTo: senderEmail,
    subject: `Ny Kontaktbesked fra ${senderName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #3B5FA8;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .info-box {
              background-color: #e7f3ff;
              border-left: 4px solid #3B5FA8;
              padding: 15px;
              margin: 20px 0;
            }
            .detail-row {
              margin: 15px 0;
              padding-bottom: 15px;
              border-bottom: 1px solid #eee;
            }
            .detail-label {
              font-weight: bold;
              color: #555;
            }
            .detail-value {
              margin-top: 5px;
              color: #333;
            }
            .message-box {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #777;
              font-size: 12px;
            }
            .reply-button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #3B5FA8;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 Ny Kontaktbesked</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>⚠️ Husk at svare:</strong> En kunde har sendt en besked via kontaktformularen på flai.dk
              </div>

              <div class="detail-row">
                <div class="detail-label">👤 Navn:</div>
                <div class="detail-value">${senderName}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">📧 Email:</div>
                <div class="detail-value"><a href="mailto:${senderEmail}">${senderEmail}</a></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">💬 Besked:</div>
                <div class="message-box">${message}</div>
              </div>

              <div style="text-align: center;">
                <a href="mailto:${senderEmail}?subject=Re: Din henvendelse til Flai.dk" class="reply-button">
                  Besvar denne email
                </a>
              </div>

              <div class="footer">
                <p>Dette er en automatisk genereret email fra Flai.dk kontaktformular.</p>
                <p>Modtaget: ${new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  console.log('Attempting to send admin notification email...');
  
  try {
    // Send admin notification only
    const { data: adminData, error: adminError } = await resend.emails.send(adminEmailData);

    if (adminError) {
      console.error('Resend API error (admin):', adminError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send notification to admin',
          details: adminError.message || 'Unknown error from email service',
          resendError: adminError
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Admin notification sent successfully. ID:', adminData?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contact message sent successfully',
        adminEmailId: adminData?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (emailError) {
    console.error('Exception while sending email:', emailError);
    return new Response(
      JSON.stringify({ 
        error: 'Email sending failed with exception',
        details: emailError instanceof Error ? emailError.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}