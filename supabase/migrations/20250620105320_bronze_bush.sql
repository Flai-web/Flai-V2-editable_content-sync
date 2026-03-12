/*
  # Add cash payment content

  1. Changes
    - Add editable content for cash payment option
    - Include all text elements for the new payment method
*/

-- Insert cash payment content
INSERT INTO site_content (key, type, value, description, category) VALUES

-- Cash Payment Option
('payment-cash-option-title', 'text', 'Betal kontant ved optagelse', 'Cash payment option title', 'payment'),
('payment-cash-option-description', 'text', 'Du betaler kontant direkte til fotografen ved optagelsen. Booking bekræftes med det samme.', 'Cash payment option description', 'payment'),
('payment-cash-types', 'text', 'Kontanter', 'Cash payment types', 'payment'),
('payment-cash-booking-button', 'text', 'Bekræft Booking (Kontant)', 'Cash booking button', 'payment')

ON CONFLICT (key) DO NOTHING;