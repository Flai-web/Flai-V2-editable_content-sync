import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@3.2.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const resetPasswordTemplate = (resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { 
      display: inline-block;
      padding: 12px 24px;
      background-color: #0F52BA;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://flai.dk/logo.png" alt="Flai.dk" style="max-width: 150px;">
      <h1>Nulstil Din Adgangskode</h1>
    </div>
    
    <p>Hej!</p>
    
    <p>Vi har modtaget en anmodning om at nulstille din adgangskode. Klik på knappen nedenfor for at vælge en ny adgangskode:</p>
    
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Nulstil Adgangskode</a>
    </div>
    
    <p>Hvis du ikke har anmodet om at nulstille din adgangskode, kan du ignorere denne email.</p>
    
    <p>Linket udløber om 24 timer.</p>
    
    <div class="footer">
      <p>Med venlig hilsen<br>Flai.dk</p>
    </div>
  </div>
</body>
</html>
`;

const confirmEmailTemplate = (confirmLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { 
      display: inline-block;
      padding: 12px 24px;
      background-color: #0F52BA;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://flai.dk/logo.png" alt="Flai.dk" style="max-width: 150px;">
      <h1>Bekræft Din Email</h1>
    </div>
    
    <p>Velkommen til Flai.dk!</p>
    
    <p>Tak for din tilmelding. For at aktivere din konto skal du bekræfte din email-adresse ved at klikke på knappen nedenfor:</p>
    
    <div style="text-align: center;">
      <a href="${confirmLink}" class="button">Bekræft Email</a>
    </div>
    
    <p>Hvis du ikke har oprettet en konto hos os, kan du ignorere denne email.</p>
    
    <div class="footer">
      <p>Med venlig hilsen<br>Flai.dk</p>
    </div>
  </div>
</body>
</html>
`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { type, email, link } = await req.json();

    let template;
    let subject;

    if (type === 'reset_password') {
      template = resetPasswordTemplate(link);
      subject = 'Nulstil Din Adgangskode - Flai.dk';
    } else if (type === 'confirm_email') {
      template = confirmEmailTemplate(link);
      subject = 'Bekræft Din Email - Flai.dk';
    } else {
      throw new Error('Invalid template type');
    }

    const { data, error } = await resend.emails.send({
      from: 'Flai.dk <no-reply@flai.dk>',
      to: email,
      subject: subject,
      html: template,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
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