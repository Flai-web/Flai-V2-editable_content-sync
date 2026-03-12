import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BookingEmailRequest {
  bookingId: number;
  userEmail?: string;
  productName?: string;
  bookingDate?: string;
  bookingTime?: string;
  zipFileUrl?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting email sending process...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify(requestBody, null, 2));

    let { bookingId, userEmail, productName, bookingDate, bookingTime, zipFileUrl } = requestBody as BookingEmailRequest;

    // Declare additional variables for extended data
    let userName = '';
    let address = '';
    let includeEditing = false;
    let totalPrice = 0;
    let discountAmount = 0;
    let productDescription = '';
    let productCategory = '';
    let creditsUsed = 0;
    let extraInformation: any = {};
    let userDisplayName = '';

    // Validate booking ID first
    if (!bookingId) {
      throw new Error('Missing bookingId in request');
    }

    // Fetch from database
    console.log('Fetching booking data from database...');
    
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        booking_date,
        booking_time,
        zip_file_url,
        guest_email,
        user_id,
        address,
        include_editing,
        price,
        discount_amount,
        credits_used,
        customer_name,
        user_display_name,
        extra_information,
        products (
          name,
          description,
          category,
          price
        ),
        profiles (
          email
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      throw new Error(`Could not find booking with ID ${bookingId}: ${bookingError?.message || 'Not found'}`);
    }

    console.log('Booking data from database:', JSON.stringify(booking, null, 2));

    // Use database values
    bookingDate = bookingDate || booking.booking_date;
    bookingTime = bookingTime || booking.booking_time;
    zipFileUrl = zipFileUrl || booking.zip_file_url;
    productName = productName || booking.products?.name;
    
    // Populate additional fields
    address = booking.address || '';
    includeEditing = booking.include_editing || false;
    totalPrice = booking.price || 0;
    discountAmount = booking.discount_amount || 0;
    productDescription = booking.products?.description || '';
    productCategory = booking.products?.category || '';
    creditsUsed = booking.credits_used || 0;
    extraInformation = booking.extra_information || {};
    
    // Determine email and name
    if (!userEmail) {
      userName = booking.customer_name || '';
      userDisplayName = booking.user_display_name || '';
      userEmail = booking.guest_email || booking.profiles?.email;
    }

    // Final validation of required fields
    const missingFields: string[] = [];
    if (!bookingId) missingFields.push('bookingId');
    if (!userEmail) missingFields.push('userEmail');
    if (!productName) missingFields.push('productName');
    if (!bookingDate) missingFields.push('bookingDate');
    if (!bookingTime) missingFields.push('bookingTime');
    if (!zipFileUrl) missingFields.push('zipFileUrl');

    if (missingFields.length > 0) {
      const errorMsg = `Missing required fields: ${missingFields.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('All required fields present');

    // Get Google Review URL
    const googleReviewUrl = Deno.env.get('Google_Write_Review_Url');

    // Format date and time
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('da-DK', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const formatTime = (timeString: string) => {
      return timeString.slice(0, 5);
    }

    const formattedDate = formatDate(bookingDate);
    const formattedTime = formatTime(bookingTime);

    // Determine payment info
    const paymentInfo = creditsUsed > 0 
      ? { icon: '🎫', text: `${creditsUsed} Credits` }
      : { icon: '💳', text: `${totalPrice} kr` };

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="da">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dine Optagelser Er Klar - Flai Drone Service</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #1f2937;
                background-color: #f3f4f6;
                margin: 0;
                padding: 0;
            }
            .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background-color: #f3f4f6;
            }
            .email-container {
                background: #f3f4f6;
                margin: 20px;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            }
            /* Header */
            .header {
                background: #0d52ba;
                padding: 40px 30px;
                text-align: center;
                color: #f3f4f6;
            }
            .logo-img {
                max-width: 180px;
                height: auto;
                margin-bottom: 20px;
            }
            .header-subtitle {
                font-size: 14px;
                opacity: 0.95;
                margin-bottom: 20px;
            }
            .success-badge {
                display: inline-block;
                background: rgba(254, 255, 234, 0.15);
                padding: 12px 24px;
                border-radius: 50px;
                font-size: 16px;
                font-weight: 600;
                margin-top: 10px;
            }
            /* Greeting */
            .greeting {
                background: #f8f9fa;
                padding: 30px;
                text-align: center;
            }
            .greeting h1 {
                font-size: 24px;
                color: #111827;
                margin-bottom: 10px;
                font-weight: 700;
            }
            .greeting p {
                font-size: 15px;
                color: #6b7280;
            }
            /* CTA Section */
            .cta-section {
                background: #0d52ba;
                padding: 40px 30px;
                text-align: center;
                margin: 20px 30px;
                border-radius: 12px;
            }
            .cta-section h2 {
                color: #f3f4f6;
                font-size: 22px;
                margin-bottom: 15px;
                font-weight: 700;
            }
            .cta-section p {
                color: #ffffff;
                font-size: 15px;
                margin-bottom: 25px;
            }
            .cta-buttons {
                display: flex;
                flex-direction: column;
                gap: 15px;
                align-items: center;
                max-width: 400px;
                margin: 0 auto;
            }
            .btn {
                display: block;
                width: 100%;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                text-align: center;
                transition: all 0.2s;
            }
            .btn-primary {
                background: #f3f4f6;
                color: #0d52ba;
            }
            .btn-secondary {
                background: transparent;
                color: #f3f4f6;
                border: 2px solid #f3f4f6;
            }
            /* Booking Details Card */
            .booking-card {
                background: #f3f4f6;
                margin: 20px 30px;
                border-radius: 12px;
                border: 2px solid #e5e7eb;
                overflow: hidden;
            }
            .card-header {
                background: #0d52ba;
                padding: 20px 25px;
                color: #f3f4f6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .card-header h2 {
                font-size: 18px;
                font-weight: 600;
                margin: 0;
            }
            .booking-id-badge {
                background: rgba(254, 255, 234, 0.2);
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .card-content {
                padding: 0;
            }
            .detail-row {
                display: flex;
                padding: 18px 25px;
                border-bottom: 1px solid #f3f4f6;
                align-items: center;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-icon {
                font-size: 20px;
                margin-right: 15px;
                min-width: 24px;
                text-align: center;
            }
            .detail-content {
                flex: 1;
            }
            .detail-label {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .detail-value {
                font-size: 15px;
                color: #111827;
                font-weight: 500;
            }
            /* Info Boxes */
            .info-box {
                margin: 20px 30px;
                padding: 20px;
                border-radius: 12px;
                border-left: 4px solid;
            }
            .info-box.product {
                background: #fef3c7;
                border-color: #FBBF24;
            }
            .info-box.editing {
                background: #dbeafe;
                border-color: #0d52ba;
            }
            .info-box.review {
                background: #fee2e2;
                border-color: #FF6B35;
            }
            .info-box h3 {
                font-size: 15px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #111827;
            }
            .info-box p {
                font-size: 14px;
                color: #374151;
                line-height: 1.5;
            }
            /* Extra Info */
            .extra-info {
                margin: 20px 30px;
                padding: 20px;
                background: #fef3c7;
                border-radius: 12px;
                border: 2px solid #fbbf24;
            }
            .extra-info h3 {
                font-size: 15px;
                font-weight: 700;
                color: #78350f;
                margin-bottom: 15px;
            }
            .extra-info-item {
                padding: 10px 0;
                border-bottom: 1px solid #fde68a;
                font-size: 14px;
                color: #92400e;
            }
            .extra-info-item:last-child {
                border-bottom: none;
            }
            .extra-info-item strong {
                color: #78350f;
                font-weight: 600;
            }
            /* Footer */
            .footer {
                background: #0d52ba;
                padding: 40px 30px;
                text-align: center;
                color: #f3f4f6;
            }
            .footer-logo {
                max-width: 150px;
                height: auto;
                margin-bottom: 20px;
            }
            .footer-links {
                margin: 20px 0;
            }
            .footer-links a {
                color: #f3f4f6;
                text-decoration: none;
                margin: 0 12px;
                font-size: 14px;
                opacity: 0.9;
            }
            .footer-contact {
                margin: 20px 0;
                font-size: 14px;
            }
            .footer-contact a {
                color: #f3f4f6;
                text-decoration: none;
            }
            .footer-bottom {
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid rgba(254, 255, 234, 0.2);
                font-size: 13px;
                opacity: 0.8;
            }
            @media only screen and (max-width: 600px) {
                .email-container { margin: 10px; }
                .header { padding: 30px 20px; }
                .cta-section { margin: 15px 20px; padding: 30px 20px; }
                .booking-card { margin: 15px 20px; }
                .info-box, .extra-info { margin: 15px 20px; }
                .detail-row { flex-direction: column; align-items: flex-start; }
                .card-header { flex-direction: column; gap: 10px; }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                <!-- Header -->
                <div class="header">
                    <img src="https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/site-content/0.8098168609814219.webp" alt="Flai drone service" class="logo-img">
                    <div class="header-subtitle">Droneservice - En ny verden</div>
                    <div class="success-badge">
                        🎉 Dine optagelser er klar!
                    </div>
                </div>

                <!-- Greeting -->
                <div class="greeting">
                    <h1>${userDisplayName || userName ? `Hej ${userDisplayName || userName}! 🎊` : 'Dine optagelser er klar! 🎊'}</h1>
                    <p>Tak for at vælge Flai drone service. Vi håber du er tilfreds med resultatet!</p>
                </div>

                <!-- CTA Section -->
                <div class="cta-section">
                    <h2>📥 Download dine optagelser</h2>
                    <p>Dine drone-optagelser er nu klar til download. Klik på knappen nedenfor for at hente dine filer.</p>
                    <div class="cta-buttons">
                        <a href="${zipFileUrl}" class="btn btn-primary">Download dine ${productCategory === 'photo' ? 'Billeder' : 'Optagelser'} </a>
                        ${googleReviewUrl ? `
                        <a href="${googleReviewUrl}" class="btn btn-secondary" target="_blank">⭐⭐⭐⭐⭐ Anmeld os på Google</a>
                        ` : ''}
                    </div>
                </div>

                ${productDescription ? `
                <!-- Product Description -->
                <div class="info-box product">
                    <h3>📦 ${productName}</h3>
                    <p>${productDescription}</p>
                </div>
                ` : ''}

                ${includeEditing ? `
                <!-- Editing Included -->
                <div class="info-box editing">
                    <h3>✨ Redigering Inkluderet</h3>
                    <p>Dine optagelser er blevet redigeret og er klar til brug. Du modtager både rå filer og redigerede versioner.</p>
                </div>
                ` : ''}

                <!-- Booking Details Card -->
                <div class="booking-card">
                    <div class="card-header">
                        <h2>Booking detaljer</h2>
                        <div class="booking-id-badge">#${bookingId}</div>
                    </div>
                    <div class="card-content">
                        <div class="detail-row">
                            <div class="detail-icon">📅</div>
                            <div class="detail-content">
                                <div class="detail-label">Dato</div>
                                <div class="detail-value">${formattedDate}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-icon">🕐</div>
                            <div class="detail-content">
                                <div class="detail-label">Tidspunkt</div>
                                <div class="detail-value">${formattedTime}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-icon">📍</div>
                            <div class="detail-content">
                                <div class="detail-label">Lokation</div>
                                <div class="detail-value">${address}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-icon">${productCategory === 'photo' ? '📸' : '🎥'}</div>
                            <div class="detail-content">
                                <div class="detail-label">Service Type</div>
                                <div class="detail-value">${productName}${productCategory ? ` (${productCategory === 'photo' ? 'Foto' : 'Video'})` : ''}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-icon">${paymentInfo.icon}</div>
                            <div class="detail-content">
                                <div class="detail-label">Betalingsmetode</div>
                                <div class="detail-value">${paymentInfo.text}</div>
                            </div>
                        </div>
                    </div>
                </div>

                ${googleReviewUrl ? `
                <!-- Review Request -->
                <div class="info-box review">
                    <h3>⭐⭐⭐⭐⭐⭐ Din mening betyder meget for os!</h3>
                    <p>Vi sætter stor pris på din feedback. Ved at dele din oplevelse på Google hjælper du andre med at finde os og forbedrer vores service.</p>
                </div>
                ` : ''}

                <!-- Footer -->
                <div class="footer">
                    <img src="https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/site-content/0.8098168609814219.webp" alt="Flai Drone Service" class="footer-logo">
                    <div class="footer-contact">
                        <p>Har du spørgsmål eller brug for support?</p>
                        <p style="margin-top: 10px;">
                            📧 <a href="mailto:fb@flai.dk">fb@flai.dk</a>
                        </p>
                    </div>
                    <div class="footer-links">
                        <a href="https://flai.dk">Website</a>
                        <a href="https://flai.dk/portfolio">Portfolio</a>
                        <a href="https://flai.dk/kontakt">Kontakt</a>
                    </div>
                    <div class="footer-bottom">
                        <p>© ${new Date().getFullYear()} Flai Drone Service. Alle rettigheder forbeholdes.</p>
                        <p style="margin-top: 8px;">Denne email blev sendt automatisk. Gem den gerne til dine egne optegnelser.</p>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    console.log('Preparing to send email...');

    // Prepare email payload
    const emailPayload = {
      from: 'Flai Drone Service <noreply@flai.dk>',
      to: [userEmail],
      subject: `🎉 Dine ${productName} optagelser er klar!`,
      html: htmlContent,
    };

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error(`Resend API error (${emailResponse.status}): ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: emailResult.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in send-booking-completion-email function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});