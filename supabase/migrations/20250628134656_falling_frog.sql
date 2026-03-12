/*
  # Add Missing Credit System Content

  1. New Content Entries
    - Add all missing content keys for the credit system
    - Include proper descriptions and categories
    - Set appropriate default values

  2. Content Categories
    - All entries categorized under 'credits' for easy management
*/

-- Insert missing credit system content entries
INSERT INTO site_content (key, type, value, description, category) VALUES
  ('credits_buy_page_title', 'text', 'Køb Credits', 'Title for the buy credits page', 'credits'),
  ('credits_buy_page_subtitle', 'text', 'Køb credits og brug dem til at betale for vores tjenester', 'Subtitle for the buy credits page', 'credits'),
  ('credits_buy_custom_amount_title', 'text', 'Vælg Antal Credits', 'Title for the custom amount selection section', 'credits'),
  ('credits_buy_price_info', 'text', '1 credit = 1 kr', 'Information about credit pricing', 'credits'),
  ('credits_buy_button_text', 'text', 'Køb Credits', 'Text for the buy credits button', 'credits'),
  ('credits_buy_how_it_works_title', 'text', 'Sådan Fungerer Credits', 'Title for how credits work section', 'credits'),
  ('credits_buy_step_1_title', 'text', 'Køb Credits', 'Title for step 1 of how credits work', 'credits'),
  ('credits_buy_step_1_description', 'text', 'Vælg det antal credits du ønsker og gennemfør betalingen sikkert via Stripe', 'Description for step 1 of how credits work', 'credits'),
  ('credits_buy_step_2_title', 'text', 'Brug Credits', 'Title for step 2 of how credits work', 'credits'),
  ('credits_buy_step_2_description', 'text', 'Brug dine credits til at betale for vores tjenester ved booking', 'Description for step 2 of how credits work', 'credits'),
  ('credits_buy_step_3_title', 'text', 'Fleksibel Betaling', 'Title for step 3 of how credits work', 'credits'),
  ('credits_buy_step_3_description', 'text', 'Brug alle dine credits eller vælg et brugerdefineret beløb', 'Description for step 3 of how credits work', 'credits'),
  
  ('credits_payment_section_title', 'text', 'Brug Credits', 'Title for the credits section on payment page', 'credits'),
  ('credits_payment_available_text', 'text', 'Du har {credits} credits tilgængelige', 'Text showing available credits', 'credits'),
  ('credits_payment_option_none', 'text', 'Brug ikke credits', 'Option to not use credits', 'credits'),
  ('credits_payment_option_all', 'text', 'Brug alle tilgængelige credits', 'Option to use all available credits', 'credits'),
  ('credits_payment_option_custom', 'text', 'Brug brugerdefineret antal credits', 'Option to use custom amount of credits', 'credits'),
  ('credits_payment_using_text', 'text', 'Credits der bruges:', 'Text for credits being used', 'credits'),
  ('credits_payment_remaining_text', 'text', 'Credits tilbage:', 'Text for remaining credits', 'credits'),
  ('credits_payment_pay_credits_button', 'text', 'Betal med Credits', 'Button text for paying with credits', 'credits'),
  
  ('credits_profile_balance_label', 'text', 'Credits Saldo', 'Label for credits balance', 'credits'),
  ('credits_profile_balance_subtitle', 'text', 'Brug credits til at betale for tjenester', 'Subtitle for credits balance section', 'credits'),
  ('credits_profile_credits_label', 'text', 'credits', 'Label for credits unit', 'credits'),
  ('credits_profile_buy_button', 'text', 'Køb Credits', 'Button text for buying credits from profile', 'credits')

ON CONFLICT (key) DO NOTHING;