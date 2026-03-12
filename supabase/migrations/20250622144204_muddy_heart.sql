/*
  # Create newsletter templates table

  1. New Tables
    - `newsletter_templates`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `template_data` (jsonb, not null) - stores structured content and styling
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `newsletter_templates` table
    - Add policy for admins to manage templates
    - Add policy for admins to view templates

  3. Triggers
    - Auto-update `updated_at` column on row updates
*/

CREATE TABLE IF NOT EXISTS newsletter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  template_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE newsletter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage newsletter templates"
  ON newsletter_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE TRIGGER update_newsletter_templates_updated_at
  BEFORE UPDATE ON newsletter_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert 10 default newsletter templates
INSERT INTO newsletter_templates (name, template_data) VALUES
(
  'Velkommen Template',
  '{
    "subject": "Velkommen til vores nyhedsbrev!",
    "header": "Velkommen!",
    "body": "Tak fordi du tilmeldte dig vores nyhedsbrev. Vi glæder os til at dele spændende nyheder og opdateringer med dig.\n\nHold øje med din indbakke for de seneste nyheder fra os!",
    "footer": "Med venlig hilsen,\nTeamet",
    "colors": {
      "primary": "#3B82F6",
      "secondary": "#1F2937",
      "background": "#F9FAFB",
      "text": "#111827"
    }
  }'
),
(
  'Månedlig Opdatering',
  '{
    "subject": "Månedlig opdatering - {{month}} {{year}}",
    "header": "Månedlige Nyheder",
    "body": "Her er hvad der er sket i {{month}}:\n\n• Ny funktion lanceret\n• Forbedret brugeroplevelse\n• Kommende begivenheder\n\nBliv ved med at følge med for flere opdateringer!",
    "footer": "Tak for din støtte!\nTeamet",
    "colors": {
      "primary": "#10B981",
      "secondary": "#065F46",
      "background": "#ECFDF5",
      "text": "#064E3B"
    }
  }'
),
(
  'Produkt Lancering',
  '{
    "subject": "Spændende nyt produkt er her!",
    "header": "Ny Produktlancering",
    "body": "Vi er stolte af at præsentere vores nyeste produkt!\n\n{{product_name}} er nu tilgængelig og klar til at forbedre din oplevelse.\n\nSpecielle funktioner:\n• {{feature_1}}\n• {{feature_2}}\n• {{feature_3}}\n\nBesøg vores hjemmeside for at lære mere!",
    "footer": "Bedste hilsner,\nProduktteamet",
    "colors": {
      "primary": "#8B5CF6",
      "secondary": "#5B21B6",
      "background": "#F5F3FF",
      "text": "#4C1D95"
    }
  }'
),
(
  'Event Invitation',
  '{
    "subject": "Du er inviteret til {{event_name}}",
    "header": "Særlig Invitation",
    "body": "Vi har glæden af at invitere dig til {{event_name}}!\n\nDetaljer:\n📅 Dato: {{event_date}}\n🕐 Tid: {{event_time}}\n📍 Sted: {{event_location}}\n\nDette bliver en fantastisk mulighed for at møde andre og lære noget nyt.\n\nTilmeld dig nu for at sikre din plads!",
    "footer": "Vi ser frem til at se dig!\nEvent Teamet",
    "colors": {
      "primary": "#F59E0B",
      "secondary": "#92400E",
      "background": "#FFFBEB",
      "text": "#78350F"
    }
  }'
),
(
  'Sæson Tilbud',
  '{
    "subject": "Eksklusivt sæsontilbud - Spar {{discount}}%!",
    "header": "Sæson Udsalg",
    "body": "🎉 Vores store sæsonudsalg er i gang!\n\nSpar {{discount}}% på alle vores produkter og tjenester.\n\nTilbuddet gælder kun til {{end_date}}, så skynd dig!\n\nBrug koden: {{promo_code}} ved checkout\n\nSe alle tilbud på vores hjemmeside nu!",
    "footer": "Happy shopping!\nSalgs Teamet",
    "colors": {
      "primary": "#EF4444",
      "secondary": "#B91C1C",
      "background": "#FEF2F2",
      "text": "#991B1B"
    }
  }'
),
(
  'Nyhedssammendrag',
  '{
    "subject": "Ugens nyheder og opdateringer",
    "header": "Ugentligt Sammendrag",
    "body": "Her er de vigtigste nyheder fra denne uge:\n\n📰 {{news_1}}\n📰 {{news_2}}\n📰 {{news_3}}\n\nVi arbejder konstant på at forbedre vores tjenester og bringe dig det bedste indhold.\n\nHar du forslag eller feedback? Svar på denne email!",
    "footer": "Tak for at læse med!\nRedaktionen",
    "colors": {
      "primary": "#6366F1",
      "secondary": "#4338CA",
      "background": "#EEF2FF",
      "text": "#3730A3"
    }
  }'
),
(
  'Tak for Køb',
  '{
    "subject": "Tak for dit køb - Ordre #{{order_number}}",
    "header": "Tak for dit køb!",
    "body": "Vi har modtaget din ordre og behandler den nu.\n\nOrdredetaljer:\n• Ordre nummer: {{order_number}}\n• Dato: {{order_date}}\n• Total: {{order_total}}\n\nDu vil modtage en forsendelsesbekræftelse, når din ordre er afsendt.\n\nHar du spørgsmål? Kontakt vores kundeservice!",
    "footer": "Med venlig hilsen,\nKundeservice",
    "colors": {
      "primary": "#059669",
      "secondary": "#047857",
      "background": "#ECFDF5",
      "text": "#065F46"
    }
  }'
),
(
  'Påmindelse',
  '{
    "subject": "Påmindelse: {{reminder_title}}",
    "header": "Venlig Påmindelse",
    "body": "Dette er en venlig påmindelse om {{reminder_details}}.\n\nVigtige datoer:\n📅 {{important_date_1}}\n📅 {{important_date_2}}\n\nSørg for at markere disse datoer i din kalender!\n\nKontakt os hvis du har spørgsmål.",
    "footer": "Bedste hilsner,\nTeamet",
    "colors": {
      "primary": "#DC2626",
      "secondary": "#991B1B",
      "background": "#FEF2F2",
      "text": "#7F1D1D"
    }
  }'
),
(
  'Feedback Anmodning',
  '{
    "subject": "Vi vil gerne høre din mening!",
    "header": "Din Feedback Betyder Alt",
    "body": "Hej {{customer_name}},\n\nVi håber du har haft en fantastisk oplevelse med os!\n\nVil du hjælpe os med at blive endnu bedre? Det tager kun 2 minutter at dele din feedback.\n\n[Feedback Link]\n\nDin mening hjælper os med at forbedre vores tjenester for alle.",
    "footer": "Tak for din tid!\nKvalitetsteamet",
    "colors": {
      "primary": "#7C3AED",
      "secondary": "#5B21B6",
      "background": "#F5F3FF",
      "text": "#4C1D95"
    }
  }'
),
(
  'Ferie Hilsen',
  '{
    "subject": "Glædelig {{holiday}} fra hele teamet!",
    "header": "Ferie Hilsner",
    "body": "På vegne af hele teamet ønsker vi dig og dine kære en glædelig {{holiday}}!\n\n🎄 Måtte denne sæson bringe dig glæde og lykke\n🎁 Tak for at være en del af vores fællesskab\n✨ Vi ser frem til et fantastisk nyt år sammen\n\nVores kontor er lukket fra {{start_date}} til {{end_date}}.\n\nVi vender tilbage {{return_date}} med fornyet energi!",
    "footer": "Varme hilsner,\nHele Teamet",
    "colors": {
      "primary": "#DC2626",
      "secondary": "#059669",
      "background": "#FEF2F2",
      "text": "#7F1D1D"
    }
  }'
);