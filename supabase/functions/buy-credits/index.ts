import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

interface BuyCreditsRequest {
  credits: number;
  price: number;
  userId: string;
  email: string;
}


 Deno.serve(async (req: Request) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, {
       status: 200,
       headers: corsHeaders,
     });
   }
 
   try {
    const requestBody = await req.json();
    console.log('Received request body:', requestBody);
    
    const { credits, price, userId, email }: BuyCreditsRequest = requestBody;
    
    // Log the extracted values for debugging
    console.log('Extracted values:', { credits, price, userId, email });
    console.log('Credits type:', typeof credits, 'Price type:', typeof price);

    if (!STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    // Enhanced validation with explicit type checks
    if (typeof credits !== 'number' || credits < 1 || !Number.isInteger(credits)) {
      console.error('Invalid credits value:', credits);
      throw new Error('Credits must be a positive integer');
    }
    
    if (typeof price !== 'number' || price < 1) {
      console.error('Invalid price value:', price);
      throw new Error('Price must be a positive number');
    }
    
    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId:', userId);
      throw new Error('Valid user ID is required');
    }
    
    if (!email || typeof email !== 'string') {
      console.error('Invalid email:', email);
      throw new Error('Valid email is required');
    }
    
    // Defensive string conversion
    const creditsString = String(credits);
    const priceString = String(price);
    const productName = `${creditsString} Credits`;
    const productDescription = `${creditsString} credits til brug på vores platform`;
    
    console.log('Creating Stripe session with:', {
      productName,
      productDescription,
      credits: creditsString,
      price: priceString,
      userId,
      email
    });

    // Create Stripe checkout session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'success_url': `${req.headers.get('origin')}/profile?credits_purchased=true`,
        'cancel_url': `${req.headers.get('origin')}/buy-credits`,
        'customer_email': email,
        'line_items[0][price_data][currency]': 'dkk', 
        'line_items[0][price_data][product_data][name]': productName,
        'line_items[0][price_data][product_data][description]': productDescription,
        'line_items[0][price_data][unit_amount]': (price * 100).toString(),
        'line_items[0][quantity]': '1',
        'metadata[type]': 'credit_purchase',
        'metadata[user_id]': userId,
        'metadata[credits]': creditsString,
        'metadata[price]': priceString,
      }),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error('Stripe API error:', errorText);
      throw new Error('Failed to create Stripe checkout session');
    }

    const session = await stripeResponse.json();
    console.log('Stripe session created successfully:', session.id);

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
   } catch (error) {
     console.error('Error in buy-credits function:', error);
     console.error('Error stack:', error.stack);
     return new Response(
       JSON.stringify({ error: error.message }),
       {
         status: 400,
         headers: {
           'Content-Type': 'application/json',
           ...corsHeaders,
         },
       }
     );
   }
 });