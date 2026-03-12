import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      email, 
      productName, 
      bookingDate, 
      bookingTime, 
      address, 
      totalPrice, 
      paymentMethod, 
      bookingId,
      includeEditing,
      discountAmount 
    } = await req.json()

    // Initialize Supabase client to fetch additional data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    let productDescription = ''
    let productCategory = ''
    let userName = ''
    let discountCode = ''
    let creditsUsed = 0
    let extraInformation: any = {}
    let userDisplayName = ''

    // Fetch additional booking data if we have a bookingId
    if (bookingId && supabaseUrl && supabaseServiceKey) {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: booking, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          customer_name,
          user_display_name,
          credits_used,
          extra_information,
          products (
            name,
            description,
            category,
            price
          ),
          discount_codes (
            code
          )
        `)
        .eq('id', bookingId)
        .single()

      if (booking && !bookingError) {
        productDescription = booking.products?.description || ''
        productCategory = booking.products?.category || ''
        userName = booking.customer_name || ''
        userDisplayName = booking.user_display_name || ''
        creditsUsed = booking.credits_used || 0
        discountCode = booking.discount_codes?.code || ''
        extraInformation = booking.extra_information || {}
      }
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }

    // Format date and time for display
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
      return timeString.slice(0, 5)
    }

    // Determine payment method text and icon
    const getPaymentMethodInfo = (method: string) => {
      switch (method) {
        case 'card':
          return { text: 'Betalingskort', icon: '💳' }
        case 'invoice':
          return { text: 'Faktura', icon: '📄' }
        case 'cash':
          return { text: 'Kontant', icon: '💵' }
        default:
          return { text: method, icon: '💰' }
      }
    }

    const paymentInfo = getPaymentMethodInfo(paymentMethod)

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="da">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Bekræftet - Flai Drone Service</title>
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
            /* Booking Details Card */
            .booking-card {
                background: #ffffff;
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
                background: #ffffff;
            }
            .detail-row {
                display: flex;
                padding: 18px 25px;
                border-bottom: 1px solid #f3f4f6;
                align-items: center;
                background: #ffffff;
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
            /* Special Sections */
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
            /* Price Summary */
            .price-summary {
                background: #f8f9fa;
                margin: 20px 30px;
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #e5e7eb;
            }
            .price-row {
                display: flex;
                justify-content: space-between;
                padding: 12px 0;
                font-size: 15px;
            }
            .price-row.total {
                border-top: 2px solid #e5e7eb;
                margin-top: 10px;
                padding-top: 15px;
                font-size: 18px;
                font-weight: 700;
                color: #0d52ba;
            }
            .price-row.discount {
                color: #0d52ba;
                font-weight: 600;
            }
            /* Next Steps */
            .next-steps {
                background: #fff7ed;
                border: 2px solid #FBBF24;
                margin: 20px 30px;
                padding: 25px;
                border-radius: 12px;
            }
            .next-steps h3 {
                font-size: 16px;
                color: #92400e;
                margin-bottom: 15px;
                font-weight: 700;
            }
            .next-steps ul {
                margin: 0;
                padding-left: 20px;
            }
            .next-steps li {
                color: #78350f;
                margin-bottom: 10px;
                font-size: 14px;
                line-height: 1.6;
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
            @media only screen and (max-width: 600px) {
                .email-container { margin: 10px; }
                .header { padding: 30px 20px; }
                .booking-card { margin: 15px 20px; }
                .info-box, .price-summary, .next-steps, .extra-info { margin: 15px 20px; }
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
                    <img src="https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/site-content/0.8098168609814219.webp" alt="Flai Drone Service" class="logo-img">
                    <div class="header-subtitle">Droneservice - En ny verden</div>
                    <div class="success-badge">
                        ✓ Booking bekræftet
                    </div>
                </div>

                <!-- Greeting -->
                <div class="greeting">
                    <h1>${userDisplayName || userName ? `Hej ${userDisplayName || userName}! 👋` : 'Tak for din booking! 👋'}</h1>
                    <p>Vi glæder os til at arbejde med dig og skabe fantastiske optagelser.</p>
                </div>

                ${productDescription ? `
                <!-- Product Description -->
                <div class="info-box product">
                    <h3>📦 ${productName}</h3>
                    <p>${productDescription}</p>
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
                                <div class="detail-value">${formatDate(bookingDate)}</div>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-icon">🕐</div>
                            <div class="detail-content">
                                <div class="detail-label">Tidspunkt</div>
                                <div class="detail-value">${formatTime(bookingTime)}</div>
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

                        <!-- Price Summary inside card -->
                        <div style="background: #ffffff; padding: 20px 25px; margin-top: 10px;">
                    ${creditsUsed > 0 ? `
                    <div class="price-row">
                        <span>Credits brugt</span>
                        <span style="color: #0d52ba; font-weight: 600;">${creditsUsed} credits</span>
                    </div>
                    ` : ''}
                    ${discountCode ? `
                    <div class="price-row">
                        <span>Rabatkode (${discountCode})</span>
                        <span style="color: #0d52ba; font-weight: 600;">Anvendt ✓</span>
                    </div>
                    ` : ''}
                    ${discountAmount > 0 ? `
                    <div class="price-row discount">
                        <span>Rabat</span>
                        <span>-${discountAmount} kr</span>
                    </div>
                    ` : ''}
                    <div class="price-row total">
                        <span>Total</span>
                        <span>${totalPrice} kr</span>
                    </div>
                        </div>
                    </div>
                </div>

                ${paymentMethod === 'invoice' ? `
                <!-- Next Steps - Invoice -->
                <div class="next-steps">
                    <h3>📋 Næste skridt</h3>
                    <ul>
                        <li>Du vil modtage en faktura på denne email efter optagelsen er gennemført</li>
                        <li>Husk at medbringe en underskrevet kontrakt til optagelsen</li>
                        <li>Vi kontakter dig hvis der er ændringer til din booking</li>
                    </ul>
                </div>
                ` : paymentMethod === 'cash' ? `
                <!-- Next Steps - Cash -->
                <div class="next-steps">
                    <h3>💵 Næste skridt</h3>
                    <ul>
                        <li>Husk at medbringe kontanter eller kreditkort til optagelsen (${totalPrice} kr)</li>
                        <li>Vi anbefaler at have det præcise beløb klar</li>
                        <li>Vi kontakter dig hvis der er ændringer til din booking</li>
                    </ul>
                </div>
                ` : `
                <!-- Next Steps - Card -->
                <div class="next-steps">
                    <h3>✅ Næste skridt</h3>
                    <ul>
                        <li>Din betaling er blevet behandlet succesfuldt</li>
                        <li>Du vil modtage en kvittering separat</li>
                        <li>Vi ses til den aftalte tid. Glæder os!</li>
                    </ul>
                </div>
                `}

                <!-- Footer -->
                <div class="footer">
                    <img src="https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/site-content/0.8098168609814219.webp" alt="Flai Drone Service" class="footer-logo">
                    <div class="footer-contact">
                        <p>Har du spørgsmål eller ønsker at ændre din booking?</p>
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
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Flai Drone Service <mail@flai.dk>',
        to: [email],
        subject: `✓ Booking Bekræftet - ${productName} (${formatDate(bookingDate)})`,
        html: htmlContent,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Failed to send email: ${error}`)
    }

    const data = await res.json()
    
    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error sending booking confirmation email:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send booking confirmation email' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})