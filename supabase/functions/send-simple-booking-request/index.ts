import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@2.0.0';

interface SimpleBookingRequest {
  productName: string;
  customerEmail: string;
  customerAddress: string;
  wantsEditing: boolean;
  paymentMethod: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMENT_METHOD_LABELS: { [key: string]: string } = {
  'invoice-card': 'Faktura - Kort',
  'on-site-card': 'Betaling ved optagelsen - Kort eller kontant',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Simple Booking Request Started ===');

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

    const { 
      productName, 
      customerEmail, 
      customerAddress, 
      wantsEditing, 
      paymentMethod 
    }: SimpleBookingRequest = requestBody;

    // Validate required fields
    if (!productName || !customerEmail || !customerAddress || !paymentMethod) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          received: {
            productName: !!productName,
            customerEmail: !!customerEmail,
            customerAddress: !!customerAddress,
            paymentMethod: !!paymentMethod
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
    if (!emailRegex.test(customerEmail)) {
      console.error('Invalid customer email format:', customerEmail);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate payment method
    if (!PAYMENT_METHOD_LABELS[paymentMethod]) {
      console.error('Invalid payment method:', paymentMethod);
      return new Response(
        JSON.stringify({ error: 'Invalid payment method' }),
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
    const { data: adminEmailData, error: dbError } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'admin-notification-email')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retrieve admin email from database',
          details: dbError.message,
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

    // Send email
    return await sendBookingEmail(
      adminEmail, 
      productName, 
      customerEmail, 
      customerAddress,
      wantsEditing,
      paymentMethod
    );

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error processing simple booking request:', error);
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

async function sendBookingEmail(
  adminEmail: string, 
  productName: string, 
  customerEmail: string, 
  customerAddress: string,
  wantsEditing: boolean,
  paymentMethod: string
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
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;

  const emailData = {
    from: 'Simple Booking <noreply@flai.dk>',
    to: adminEmail,
    subject: `Ny Simpel Booking Forespørgsel - ${productName}`,
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
              background-color: #007bff;
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
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
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
            .badge {
              display: inline-block;
              padding: 5px 12px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 600;
              margin-top: 5px;
            }
            .badge-yes {
              background-color: #d4edda;
              color: #155724;
            }
            .badge-no {
              background-color: #f8d7da;
              color: #721c24;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ny Simpel Booking Forespørgsel</h1>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>⚠️ Handling Påkrævet:</strong> Admin skal færdiggøre denne booking manuelt via det offentlige 'Book Nu' system for kunden.
              </div>

              <div class="detail-row">
                <div class="detail-label">📦 Produkt:</div>
                <div class="detail-value">${productName}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">📧 Kunde Email:</div>
                <div class="detail-value"><a href="mailto:${customerEmail}">${customerEmail}</a></div>
              </div>

              <div class="detail-row">
                <div class="detail-label">📍 Kunde Adresse:</div>
                <div class="detail-value">${customerAddress.replace(/\n/g, '<br>')}</div>
              </div>

              <div class="detail-row">
                <div class="detail-label">✂️ Redigering:</div>
                <div class="detail-value">
                  <span class="badge ${wantsEditing ? 'badge-yes' : 'badge-no'}">
                    ${wantsEditing ? '✓ Ja, Redigering ønskes' : '✗ Nej, ingen redigering'}
                  </span>
                </div>
              </div>

              <div class="detail-row">
                <div class="detail-label">💳 Betalingsmetode:</div>
                <div class="detail-value">
                  <strong>${paymentMethodLabel}</strong>
                </div>
              </div>

              <div style="margin-top: 30px; padding: 20px; background-color: #e7f3ff; border-radius: 5px;">
                <h3 style="margin-top: 0; color: #0056b3;">Næste Skridt:</h3>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>Kontakt kunden via email for at bekræfte detaljer</li>
                  <li>Aftale dato og tid for booking</li>
                  <li>Færdiggør bookingen gennem det normale booking-system</li>
                  <li>Bekræft betalingsmetode med kunden</li>
                  ${wantsEditing ? '<li>Husk at inkludere redigering i den endelige booking</li>' : ''}
                  <li>Send bekræftelse til kunden</li>
                </ol>
              </div>

              <div class="footer">
                <p>Dette er en automatisk genereret email fra Simple Booking systemet.</p>
                <p>Modtaget: ${new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  console.log('Attempting to send email via Resend to:', adminEmail);
  
  try {
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend API error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: error.message || 'Unknown error from email service',
          resendError: error
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Email sent successfully. ID:', data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Booking request sent successfully',
        emailId: data?.id 
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