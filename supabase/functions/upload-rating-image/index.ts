/*
  # Upload Rating Image Edge Function

  1. Purpose
    - Handles image uploads for the rating page without requiring user authentication
    - Uses service role key to bypass RLS policies
    - Accepts base64 encoded images and uploads them to Supabase storage

  2. Security
    - Uses service role key for storage operations
    - Validates file types and sizes
    - Returns public URLs for uploaded images

  3. Input
    - POST request with JSON body containing:
      - imageData: base64 encoded image
      - fileName: original file name
      - fileType: MIME type of the file
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface UploadRequest {
  imageData: string;
  fileName: string;
  fileType: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const { imageData, fileName, fileType }: UploadRequest = await req.json();

    // Validate input
    if (!imageData || !fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: imageData, fileName, fileType' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Convert base64 to Uint8Array
    const base64Data = imageData.split(',')[1] || imageData;
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Validate file size (max 30MB)
    const maxSize = 30 * 1024 * 1024; // 30MB
    if (binaryData.length > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 30MB.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate unique file name
    const fileExt = fileName.split('.').pop() || 'webp';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `rating-images/${uniqueFileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('rating-images')
      .upload(filePath, binaryData, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image', details: uploadError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('rating-images')
      .getPublicUrl(filePath);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        fileName: uniqueFileName 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});