import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get all images from storage
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('product-images')
      .list();

    if (storageError) throw storageError;

    // Get all products to check their images
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('images');

    if (productsError) throw productsError;

    // Create a set of all images used in products
    const usedImages = new Set<string>();
    products.forEach(product => {
      product.images.forEach((imageUrl: string) => {
        // Extract filename from URL
        const filename = imageUrl.split('/').pop();
        if (filename) {
          usedImages.add(filename);
        }
      });
    });

    // Find unused images
    const unusedFiles = storageFiles.filter(file => !usedImages.has(file.name));

    // Delete unused images
    const deletionPromises = unusedFiles.map(file => 
      supabase.storage
        .from('product-images')
        .remove([file.name])
    );

    await Promise.all(deletionPromises);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: unusedFiles.length,
        deletedFiles: unusedFiles.map(f => f.name)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});