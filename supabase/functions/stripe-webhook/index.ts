import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.14.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
};

// Helper function to extract customer details from session
function extractCustomerDetails(session: Stripe.Checkout.Session) {
  return {
    customer_name: session.customer_details?.name || null,
    customer_email: session.customer_details?.email || null,
    customer_phone: session.customer_details?.phone || null,
    customer_address: session.customer_details?.address || null,
    customer_tax_ids: session.customer_details?.tax_ids || null,
  };
}

// Helper function to build extra_information object
function buildExtraInformation(session: Stripe.Checkout.Session, customerDetails: any) {
  return {
    // Customer information
    customer: {
      id: session.customer as string || null,
      name: customerDetails.customer_name,
      email: customerDetails.customer_email,
      phone: customerDetails.customer_phone,
      address: customerDetails.customer_address,
      tax_ids: customerDetails.customer_tax_ids,
    },
    // Payment details
    payment: {
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
      currency: session.currency,
      payment_status: session.payment_status,
      payment_method_types: session.payment_method_types,
      total_details: session.total_details,
    },
    // Session details
    session: {
      id: session.id,
      mode: session.mode,
      status: session.status,
      client_reference_id: session.client_reference_id,
      created: session.created,
      expires_at: session.expires_at,
      locale: session.locale,
      url: session.url,
    },
    // Shipping information (if applicable)
    shipping: session.shipping_details ? {
      address: session.shipping_details.address,
      name: session.shipping_details.name,
    } : null,
    // Custom fields (if any)
    custom_fields: session.custom_fields || null,
    // All metadata
    metadata: session.metadata || {},
    // Timestamp
    collected_at: new Date().toISOString(),
  };
}

// Helper function to extract customer details from invoice
function extractInvoiceCustomerDetails(invoice: Stripe.Invoice) {
  return {
    customer_name: invoice.customer_name || invoice.customer_email || null,
    customer_email: invoice.customer_email || null,
    customer_phone: invoice.customer_phone || null,
    customer_address: invoice.customer_address || null,
  };
}

// Helper function to build extra_information for invoice
function buildInvoiceExtraInformation(invoice: Stripe.Invoice, customerDetails: any) {
  return {
    // Customer information
    customer: {
      id: invoice.customer as string || null,
      name: customerDetails.customer_name,
      email: customerDetails.customer_email,
      phone: customerDetails.customer_phone,
      address: customerDetails.customer_address,
    },
    // Payment details
    payment: {
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      currency: invoice.currency,
      status: invoice.status,
      payment_intent: invoice.payment_intent,
    },
    // Invoice details
    invoice: {
      id: invoice.id,
      number: invoice.number,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      created: invoice.created,
      due_date: invoice.due_date,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
    },
    // Billing details
    billing: {
      billing_reason: invoice.billing_reason,
      collection_method: invoice.collection_method,
    },
    // All metadata
    metadata: invoice.metadata || {},
    // Timestamp
    collected_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const signature = req.headers.get('stripe-signature');

  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing signature or webhook secret');
    return new Response('Missing signature or webhook secret', { 
      status: 400,
      headers: corsHeaders 
    });
  }

  try {
    // CRITICAL: Read the raw body as text to preserve exact formatting
    const rawBody = await req.text();
    
    console.log('📥 Received webhook request');
    console.log('Body length:', rawBody.length);
    console.log('Signature:', signature);
    
    // Verify the webhook signature - CHANGED: Use constructEventAsync instead of constructEvent
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      console.error('Signature received:', signature);
      console.error('Body preview:', rawBody.substring(0, 200));
      console.error('Webhook secret configured:', STRIPE_WEBHOOK_SECRET ? 'Yes (length: ' + STRIPE_WEBHOOK_SECRET.length + ')' : 'No');
      return new Response(`Webhook Error: ${err.message}`, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('✅ Webhook event received:', event.type);
    console.log('Event ID:', event.id);
    console.log('Full event object:', JSON.stringify(event, null, 2));

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('💳 Checkout session completed:', session.id);
        console.log('Session metadata:', session.metadata);

        // Extract customer details
        const customerDetails = extractCustomerDetails(session);
        console.log('📝 Extracted customer details:', customerDetails);

        const metadata = session.metadata;

        // Handle credit purchase
        if (metadata?.type === 'credit_purchase') {
          const userId = metadata.user_id;
          const credits = parseInt(metadata.credits || '0');

          if (!userId || !credits) {
            console.error('❌ Missing userId or credits in metadata');
            break;
          }

          console.log(`💰 Processing credit purchase: ${credits} credits for user ${userId}`);

          // Get current credits
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', userId)
            .single();

          if (fetchError) {
            console.error('❌ Error fetching profile:', fetchError);
            throw fetchError;
          }

          const currentCredits = profile?.credits || 0;
          const newCredits = currentCredits + credits;

          // Update user's credit balance
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ credits: newCredits })
            .eq('id', userId);

          if (updateError) {
            console.error('❌ Error updating credits:', updateError);
            throw updateError;
          }

          console.log(`✅ Added ${credits} credits to user ${userId} (${currentCredits} → ${newCredits})`);
        } 
        // Handle regular booking payment
        else {
          const bookingId = metadata?.bookingId;
          const userId = metadata?.userId || null;
          const guestEmail = metadata?.guestEmail || null;

          if (!bookingId) {
            console.error('❌ No booking ID in metadata');
            break;
          }

          console.log('📅 Processing booking payment:', {
            bookingId,
            userId,
            guestEmail,
            paymentIntent: session.payment_intent,
            customerName: customerDetails.customer_name
          });

          // Build extra information object
          const extraInfo = buildExtraInformation(session, customerDetails);
          console.log('📦 Extra information collected:', JSON.stringify(extraInfo, null, 2));

          // Update booking with payment status, customer name, and extra information
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
              payment_status: 'paid',
              payment_intent_id: session.payment_intent as string,
              customer_name: customerDetails.customer_name,
              extra_information: extraInfo,
            })
            .eq('id', bookingId);

          if (updateError) {
            console.error('❌ Error updating booking payment status:', updateError);
            throw updateError;
          }

          console.log(`✅ Booking ${bookingId} marked as paid with customer name: ${customerDetails.customer_name}`);

          // Get booking details for email
          const { data: booking, error: bookingError } = await supabase
            .from('bookings_with_users')
            .select('*')
            .eq('id', bookingId)
            .single();

          if (bookingError) {
            console.error('❌ Error fetching booking details:', bookingError);
          } else if (booking) {
            // Determine email to send to
            const recipientEmail = booking.user_email || guestEmail || customerDetails.customer_email;

            if (recipientEmail) {
              console.log('📧 Sending confirmation email to:', recipientEmail);

              // Send booking confirmation email
              try {
                const emailResponse = await fetch(
                  `${SUPABASE_URL}/functions/v1/send-booking-confirmation-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      email: recipientEmail,
                      productName: booking.product_name,
                      bookingDate: booking.booking_date,
                      bookingTime: booking.booking_time,
                      address: booking.address,
                      totalPrice: booking.price,
                      paymentMethod: 'card',
                      bookingId: booking.id,
                      includeEditing: booking.include_editing,
                      discountAmount: booking.discount_amount || 0,
                      creditsUsed: booking.credits_used || 0,
                      customerName: customerDetails.customer_name,
                    }),
                  }
                );

                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text();
                  console.error('❌ Email API error:', errorText);
                } else {
                  const emailResult = await emailResponse.json();
                  
                  if (emailResult.error) {
                    console.error('❌ Error sending confirmation email:', emailResult.error);
                  } else {
                    console.log('✅ Confirmation email sent successfully');
                  }
                }
              } catch (emailError) {
                console.error('❌ Error calling email function:', emailError);
              }
            } else {
              console.warn('⚠️ No email address found for booking', bookingId);
            }
          }
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('💳 Payment intent succeeded:', paymentIntent.id);
        
        // Additional handling if needed
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('❌ Payment failed:', paymentIntent.id);

        // Find booking by payment_intent_id
        const { data: booking, error: findError } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', paymentIntent.id)
          .single();

        if (findError) {
          console.error('Error finding booking:', findError);
          break;
        }

        if (booking) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ payment_status: 'failed' })
            .eq('id', booking.id);

          if (updateError) {
            console.error('Error updating booking to failed:', updateError);
          } else {
            console.log(`✅ Booking ${booking.id} marked as failed`);
          }
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('📄 Invoice payment succeeded:', invoice.id);
        console.log('Invoice payment_intent:', invoice.payment_intent);
        console.log('Invoice metadata:', JSON.stringify(invoice.metadata));

        // Extract customer details from invoice
        const customerDetails = extractInvoiceCustomerDetails(invoice);
        console.log('📝 Extracted invoice customer details:', customerDetails);

        // Try to find booking by multiple methods
        let booking = null;
        let findMethod = '';

        // Method 1: Try finding by invoice ID in payment_intent_id field
        console.log('🔍 Method 1: Searching by invoice ID:', invoice.id);
        const { data: bookingByInvoice } = await supabase
          .from('bookings')
          .select('id, payment_method, payment_intent_id, payment_status')
          .eq('payment_intent_id', invoice.id)
          .maybeSingle();

        if (bookingByInvoice) {
          booking = bookingByInvoice;
          findMethod = 'invoice ID';
          console.log('✓ Found booking by invoice ID:', booking.id);
        }

        // Method 2: Try finding by payment_intent (if invoice has one)
        if (!booking && invoice.payment_intent) {
          const piId = typeof invoice.payment_intent === 'string' 
            ? invoice.payment_intent 
            : invoice.payment_intent.id;
          
          console.log('🔍 Method 2: Searching by payment_intent:', piId);
          const { data: bookingByPI } = await supabase
            .from('bookings')
            .select('id, payment_method, payment_intent_id, payment_status')
            .eq('payment_intent_id', piId)
            .maybeSingle();

          if (bookingByPI) {
            booking = bookingByPI;
            findMethod = 'payment_intent';
            console.log('✓ Found booking by payment_intent:', booking.id);
          }
        }

        // Method 3: Try finding by metadata booking_id
        if (!booking && invoice.metadata?.booking_id) {
          console.log('🔍 Method 3: Searching by metadata booking_id:', invoice.metadata.booking_id);
          const { data: bookingByMetadata } = await supabase
            .from('bookings')
            .select('id, payment_method, payment_intent_id, payment_status')
            .eq('id', invoice.metadata.booking_id)
            .maybeSingle();

          if (bookingByMetadata) {
            booking = bookingByMetadata;
            findMethod = 'metadata booking_id';
            console.log('✓ Found booking by metadata:', booking.id);
          }
        }

        // Method 4: Try finding by metadata bookingId (alternative spelling)
        if (!booking && invoice.metadata?.bookingId) {
          console.log('🔍 Method 4: Searching by metadata bookingId:', invoice.metadata.bookingId);
          const { data: bookingByMetadata2 } = await supabase
            .from('bookings')
            .select('id, payment_method, payment_intent_id, payment_status')
            .eq('id', invoice.metadata.bookingId)
            .maybeSingle();

          if (bookingByMetadata2) {
            booking = bookingByMetadata2;
            findMethod = 'metadata bookingId';
            console.log('✓ Found booking by metadata bookingId:', booking.id);
          }
        }

        // Method 5: FALLBACK - Match by metadata fields (date, time, address)
        if (!booking && invoice.metadata?.bookingDate && invoice.metadata?.bookingTime && invoice.metadata?.address) {
          console.log('🔍 Method 5: Searching by metadata fields (date, time, address)');
          const { data: bookingsByMetadata } = await supabase
            .from('bookings')
            .select('id, payment_method, payment_intent_id, payment_status, booking_date, booking_time, address')
            .eq('payment_method', 'invoice')
            .eq('booking_date', invoice.metadata.bookingDate)
            .eq('booking_time', invoice.metadata.bookingTime)
            .ilike('address', `%${invoice.metadata.address}%`)
            .order('created_at', { ascending: false })
            .limit(5);

          console.log('Bookings matching metadata:', bookingsByMetadata);

          if (bookingsByMetadata && bookingsByMetadata.length > 0) {
            // Prefer unpaid bookings
            const unpaidBooking = bookingsByMetadata.find(b => b.payment_status !== 'paid');
            booking = unpaidBooking || bookingsByMetadata[0];
            findMethod = 'metadata fields match';
            console.log('✓ Found booking by metadata fields:', booking.id);
          }
        }

        if (!booking) {
          console.error('❌ CRITICAL: Could not find booking for invoice:', invoice.id);
          console.error('⚠️ Invoice metadata does NOT contain booking_id!');
          console.error('Invoice metadata:', invoice.metadata);
          console.error('🔧 FIX: Add booking_id to invoice metadata when creating invoices');
          break;
        }

        console.log(`📝 Found booking ${booking.id} using ${findMethod}`);

        // Build extra information object for invoice
        const extraInfo = buildInvoiceExtraInformation(invoice, customerDetails);
        console.log('📦 Invoice extra information collected:', JSON.stringify(extraInfo, null, 2));

        // Update booking payment status with customer name and extra information
        console.log(`🔄 Updating booking ${booking.id} to paid...`);
        const { data: updateData, error: updateError } = await supabase
          .from('bookings')
          .update({ 
            payment_status: 'paid',
            payment_intent_id: invoice.id,
            customer_name: customerDetails.customer_name,
            extra_information: extraInfo,
          })
          .eq('id', booking.id)
          .select();

        if (updateError) {
          console.error('❌ Error updating booking:', updateError);
        } else {
          console.log(`✅ Booking ${booking.id} marked as paid (invoice) with customer name: ${customerDetails.customer_name}`);
          console.log('Updated data:', updateData);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('❌ Invoice payment failed:', invoice.id);
        console.log('Invoice payment_intent:', invoice.payment_intent);
        console.log('Invoice metadata:', invoice.metadata);

        // Try to find booking by multiple methods
        let booking = null;

        // Method 1: Try finding by invoice ID
        const { data: bookingByInvoice } = await supabase
          .from('bookings')
          .select('id, payment_method')
          .eq('payment_intent_id', invoice.id)
          .maybeSingle();

        if (bookingByInvoice) {
          booking = bookingByInvoice;
          console.log('✓ Found booking by invoice ID:', booking.id);
        }

        // Method 2: Try finding by payment_intent
        if (!booking && invoice.payment_intent) {
          const piId = typeof invoice.payment_intent === 'string' 
            ? invoice.payment_intent 
            : invoice.payment_intent.id;
          
          const { data: bookingByPI } = await supabase
            .from('bookings')
            .select('id, payment_method')
            .eq('payment_intent_id', piId)
            .maybeSingle();

          if (bookingByPI) {
            booking = bookingByPI;
            console.log('✓ Found booking by payment_intent:', booking.id);
          }
        }

        // Method 3: Try finding by metadata
        if (!booking && invoice.metadata?.booking_id) {
          const { data: bookingByMetadata } = await supabase
            .from('bookings')
            .select('id, payment_method')
            .eq('id', invoice.metadata.booking_id)
            .maybeSingle();

          if (bookingByMetadata) {
            booking = bookingByMetadata;
            console.log('✓ Found booking by metadata:', booking.id);
          }
        }

        if (!booking) {
          console.error('❌ Could not find booking for failed invoice:', invoice.id);
          break;
        }

        // Update booking payment status to failed
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ payment_status: 'failed' })
          .eq('id', booking.id);

        if (updateError) {
          console.error('❌ Error updating booking:', updateError);
        } else {
          console.log(`✅ Booking ${booking.id} marked as failed (invoice)`);
        }

        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true, eventType: event.type }), 
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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