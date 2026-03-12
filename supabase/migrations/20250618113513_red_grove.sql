/*
  # Add comprehensive site content for editing

  1. Changes
    - Add all missing content entries for editable elements
    - Organize content by categories for better management
    - Include all text, button, and label content from the website
*/

-- Insert comprehensive site content
INSERT INTO site_content (key, type, value, description, category) VALUES

-- Hero Section (additional content)
('hero-button-primary', 'text', 'Se Vores Tjenester', 'Hero primary button text', 'hero'),
('hero-button-secondary', 'text', 'Se Anmeldelser', 'Hero secondary button text', 'hero'),

-- About Section (additional content)
('about-feature-1', 'text', 'Dronepilot', 'About feature 1', 'about'),
('about-feature-2', 'text', 'Kreativ og præcis i sit arbejde', 'About feature 2', 'about'),

-- Drone Section
('drone-section-title', 'text', 'DJI Mini 3 Pro Drone', 'Drone section title', 'services'),
('drone-section-description', 'text', 'Med vores DJI Mini 3 Pro drone leverer vi exceptionel billedkvalitet og stabilitet. Perfekt til ejendomsvisninger, events og personlige projekter.', 'Drone section description', 'services'),
('drone-section-image', 'image', '/Drone.png', 'Drone section image', 'services'),
('drone-feature-video', 'text', '4K/60fps videooptagelse', 'Drone video feature', 'services'),
('drone-feature-photo', 'text', '48MP stillbilleder', 'Drone photo feature', 'services'),
('drone-feature-coverage', 'text', 'Dækker hele områder i Danmark', 'Drone coverage feature', 'services'),

-- Call to Action (additional content)
('cta-button-primary', 'text', 'Se Priser og Book', 'CTA primary button', 'cta'),
('cta-button-secondary', 'text', 'Kontakt Os', 'CTA secondary button', 'cta'),

-- Testimonials Section
('testimonials-title', 'text', 'Hvad siger vores kunder', 'Testimonials section title', 'testimonials'),
('testimonials-button', 'text', 'Se Alle Anmeldelser', 'Testimonials button text', 'testimonials'),

-- Contact Page
('contact-page-title', 'text', 'Kontakt Os', 'Contact page main title', 'contact'),
('contact-page-subtitle', 'text', 'Har du spørgsmål eller ønsker du at diskutere et specielt projekt? Vi er her for at hjælpe!', 'Contact page subtitle', 'contact'),
('contact-info-title', 'text', 'Kontaktinformation', 'Contact info section title', 'contact'),
('contact-email-label', 'text', 'Email', 'Contact email label', 'contact'),
('contact-email-note', 'text', 'Vi svarer normalt inden for 24 timer', 'Contact email note', 'contact'),
('contact-phone-label', 'text', 'Telefon', 'Contact phone label', 'contact'),
('contact-location-label', 'text', 'Lokation', 'Contact location label', 'contact'),
('contact-location', 'text', 'Danmark', 'Contact location', 'contact'),

-- FAQ Section
('faq-title', 'text', 'Ofte Stillede Spørgsmål', 'FAQ section title', 'contact'),
('faq-booking-question', 'text', 'Hvor langt i forvejen skal jeg booke?', 'FAQ booking question', 'contact'),
('faq-booking-answer', 'text', 'Vi anbefaler at booke mindst 3-6 dag i forvejen.', 'FAQ booking answer', 'contact'),
('faq-weather-question', 'text', 'Hvad sker der, hvis vejret er dårligt?', 'FAQ weather question', 'contact'),
('faq-weather-answer', 'text', 'Ved dårlige vejrforhold vil vi samarbejde med dig om at ombooke til en passende dato uden ekstra omkostninger.', 'FAQ weather answer', 'contact'),
('faq-delivery-question', 'text', 'Hvor hurtigt får jeg mine færdige optagelser?', 'FAQ delivery question', 'contact'),
('faq-delivery-answer', 'text', 'Standardleveringstid for optagelser eller billder er 1-2 dage. Hvis du vælger redigering, vil det typisk tage 2-6 dage.', 'FAQ delivery answer', 'contact'),

-- Coverage Areas Page
('coverage-page-title', 'text', 'Dækningsområder', 'Coverage page title', 'coverage'),
('coverage-page-subtitle', 'text', 'Vi tilbyder droneoptagelser i følgende områder. Kontakt os hvis du har spørgsmål om dækning i dit område.', 'Coverage page subtitle', 'coverage'),
('coverage-check-title', 'text', 'Check din adresse', 'Coverage check section title', 'coverage'),
('coverage-check-button', 'text', 'Check dækning', 'Coverage check button', 'coverage'),
('coverage-checking-text', 'text', 'Checker...', 'Coverage checking text', 'coverage'),
('coverage-valid-title', 'text', 'Vi dækker denne adresse', 'Coverage valid title', 'coverage'),
('coverage-valid-subtitle', 'text', 'Du kan nu gå videre til at booke din droneoptagelse', 'Coverage valid subtitle', 'coverage'),
('coverage-invalid-title', 'text', 'Vi dækker ikke denne adresse', 'Coverage invalid title', 'coverage'),
('coverage-zones-title', 'text', 'Aktive Dækningsområder', 'Coverage zones title', 'coverage'),
('coverage-loading-text', 'text', 'Indlæser dækningsområder...', 'Coverage loading text', 'coverage'),
('coverage-no-zones', 'text', 'Ingen aktive dækningsområder fundet', 'Coverage no zones text', 'coverage'),

-- Booking Page
('booking-page-title', 'text', 'Book Din Droneoptagelse', 'Booking page title', 'booking'),
('booking-loading-text', 'text', 'Indlæser produkt...', 'Booking loading text', 'booking'),
('booking-product-not-found', 'text', 'Produktet blev ikke fundet. Gå tilbage til produktsiden og prøv igen.', 'Booking product not found', 'booking'),
('booking-back-to-products-button', 'text', 'Tilbage til Produkter', 'Booking back to products button', 'booking'),
('booking-product-info-title', 'text', 'Produkt Information', 'Booking product info title', 'booking'),
('booking-time-selection-title', 'text', 'Vælg Dato og Tid', 'Booking time selection title', 'booking'),
('booking-address-title', 'text', 'Adresse', 'Booking address title', 'booking'),
('booking-address-description', 'text', 'Indtast adressen hvor droneoptagelsen skal finde sted.', 'Booking address description', 'booking'),
('booking-address-label', 'text', 'Fuld adresse', 'Booking address label', 'booking'),
('booking-address-out-of-range', 'text', 'Denne adresse er uden for vores dækningsområde.', 'Booking address out of range', 'booking'),
('booking-extras-title', 'text', 'Tilvalg', 'Booking extras title', 'booking'),
('booking-editing-option-title', 'text', 'Redigering af optagelser', 'Booking editing option title', 'booking'),
('booking-editing-option-description', 'text', 'Få redigering af dine optagelser, herunder farvekorrigering, klipning og baggrundsmusik.', 'Booking editing option description', 'booking'),
('booking-editing-option-price', 'text', '+100 kr', 'Booking editing option price', 'booking'),
('booking-summary-title', 'text', 'Opsummering', 'Booking summary title', 'booking'),
('booking-summary-product-label', 'text', 'Produkt', 'Booking summary product label', 'booking'),
('booking-summary-date-label', 'text', 'Dato', 'Booking summary date label', 'booking'),
('booking-summary-time-label', 'text', 'Tidspunkt', 'Booking summary time label', 'booking'),
('booking-summary-editing-label', 'text', 'Redigering', 'Booking summary editing label', 'booking'),
('booking-summary-editing-yes', 'text', 'Ja (+100 kr)', 'Booking summary editing yes', 'booking'),
('booking-summary-editing-no', 'text', 'Nej', 'Booking summary editing no', 'booking'),
('booking-summary-total-label', 'text', 'Total', 'Booking summary total label', 'booking'),
('booking-back-button', 'text', 'Tilbage', 'Booking back button', 'booking'),
('booking-continue-button', 'text', 'Fortsæt til Betaling', 'Booking continue button', 'booking'),
('booking-processing-text', 'text', 'Behandler...', 'Booking processing text', 'booking'),

-- Payment Page
('payment-page-title', 'text', 'Gennemfør Din Booking', 'Payment page title', 'payment'),
('payment-discount-code-title', 'text', 'Rabatkode', 'Payment discount code title', 'payment'),
('payment-method-title', 'text', 'Vælg Betalingsmetode', 'Payment method title', 'payment'),
('payment-card-option-title', 'text', 'Betal nu med betalingskort', 'Payment card option title', 'payment'),
('payment-card-option-description', 'text', 'Sikker betaling via Stripe. Din booking bekræftes med det samme.', 'Payment card option description', 'payment'),
('payment-card-types', 'text', 'Visa, Mastercard, o.a.', 'Payment card types', 'payment'),
('payment-invoice-option-title', 'text', 'Betal efter optagelse', 'Payment invoice option title', 'payment'),
('payment-invoice-option-description', 'text', 'Vi sender dig en faktura efter at optagelsen er gennemført. Bemærk at der kræves en underskrevet kontrakt.', 'Payment invoice option description', 'payment'),
('payment-pay-now-button', 'text', 'Betal nu', 'Payment pay now button', 'payment'),
('payment-complete-booking-button', 'text', 'Gennemfør Booking', 'Payment complete booking button', 'payment'),
('payment-processing-text', 'text', 'Behandler...', 'Payment processing text', 'payment'),
('payment-order-summary-title', 'text', 'Din Ordre', 'Payment order summary title', 'payment'),
('payment-summary-product-label', 'text', 'Produkt', 'Payment summary product label', 'payment'),
('payment-summary-date-label', 'text', 'Dato', 'Payment summary date label', 'payment'),
('payment-summary-time-label', 'text', 'Tidspunkt', 'Payment summary time label', 'payment'),
('payment-summary-address-label', 'text', 'Adresse', 'Payment summary address label', 'payment'),
('payment-summary-base-price-label', 'text', 'Basis pris', 'Payment summary base price label', 'payment'),
('payment-summary-editing-label', 'text', 'Redigering', 'Payment summary editing label', 'payment'),
('payment-summary-discount-label', 'text', 'Rabat', 'Payment summary discount label', 'payment'),
('payment-summary-total-label', 'text', 'Total', 'Payment summary total label', 'payment'),
('payment-terms-notice', 'text', 'Ved at gennemføre bestillingen accepterer du vores vilkår og betingelser.', 'Payment terms notice', 'payment'),
('payment-success-title', 'text', 'Booking Bekræftet!', 'Payment success title', 'payment'),
('payment-success-message', 'text', 'Tak for din bestilling. Vi har modtaget din booking og sender en faktura til din email.', 'Payment success message', 'payment'),
('payment-success-redirect', 'text', 'Du omdirigeres til din profilside...', 'Payment success redirect', 'payment'),

-- Profile Page
('profile-page-title', 'text', 'Min Profil', 'Profile page title', 'profile'),
('profile-upcoming-bookings-tab', 'text', 'Kommende Bookinger', 'Profile upcoming bookings tab', 'profile'),
('profile-past-bookings-tab', 'text', 'Tidligere Bookinger', 'Profile past bookings tab', 'profile'),
('profile-settings-tab', 'text', 'Indstillinger', 'Profile settings tab', 'profile'),
('profile-loading-bookings-text', 'text', 'Indlæser bookinger...', 'Profile loading bookings text', 'profile'),
('profile-no-bookings-title', 'text', 'Ingen bookinger fundet', 'Profile no bookings title', 'profile'),
('profile-no-bookings-message', 'text', 'Du har ingen kommende bookinger. Book din første droneoptagelse nu!', 'Profile no bookings message', 'profile'),
('profile-book-now-button', 'text', 'Book Nu', 'Profile book now button', 'profile'),
('profile-booking-id-label', 'text', 'Booking #', 'Profile booking ID label', 'profile'),
('profile-payment-status-paid', 'text', 'Betalt', 'Profile payment status paid', 'profile'),
('profile-payment-status-failed', 'text', 'Betaling fejlet', 'Profile payment status failed', 'profile'),
('profile-payment-status-pending', 'text', 'Afventer betaling', 'Profile payment status pending', 'profile'),
('profile-booking-date-label', 'text', 'Dato', 'Profile booking date label', 'profile'),
('profile-booking-time-label', 'text', 'Tidspunkt', 'Profile booking time label', 'profile'),
('profile-booking-address-label', 'text', 'Adresse', 'Profile booking address label', 'profile'),
('profile-booking-editing-label', 'text', 'Redigering', 'Profile booking editing label', 'profile'),
('profile-booking-editing-yes', 'text', 'Ja (+100 kr)', 'Profile booking editing yes', 'profile'),
('profile-booking-editing-no', 'text', 'Nej', 'Profile booking editing no', 'profile'),
('profile-booking-completed-text', 'text', 'Optagelse gennemført', 'Profile booking completed text', 'profile'),
('profile-rate-experience-button', 'text', 'Bedøm oplevelsen', 'Profile rate experience button', 'profile'),
('profile-contact-us-button', 'text', 'Kontakt os', 'Profile contact us button', 'profile'),

-- Profile Settings
('profile-update-email-title', 'text', 'Opdater Email', 'Profile update email title', 'profile'),
('profile-new-email-label', 'text', 'Ny Email', 'Profile new email label', 'profile'),
('profile-update-email-button', 'text', 'Opdater Email', 'Profile update email button', 'profile'),
('profile-sending-email-text', 'text', 'Sender...', 'Profile sending email text', 'profile'),
('profile-change-password-title', 'text', 'Skift Adgangskode', 'Profile change password title', 'profile'),
('profile-new-password-label', 'text', 'Ny Adgangskode', 'Profile new password label', 'profile'),
('profile-confirm-password-label', 'text', 'Bekræft Ny Adgangskode', 'Profile confirm password label', 'profile'),
('profile-update-password-button', 'text', 'Opdater Adgangskode', 'Profile update password button', 'profile'),
('profile-deactivate-account-title', 'text', 'Deaktiver Konto', 'Profile deactivate account title', 'profile'),
('profile-deactivate-account-description', 'text', 'Din konto vil blive deaktiveret. Kontakt support hvis du ønsker at genaktivere den senere.', 'Profile deactivate account description', 'profile'),
('profile-deactivate-account-button', 'text', 'Deaktiver Min Konto', 'Profile deactivate account button', 'profile'),
('profile-deactivate-confirmation-text', 'text', 'Skriv din email for at bekræfte deaktivering:', 'Profile deactivate confirmation text', 'profile'),
('profile-confirm-deactivation-button', 'text', 'Bekræft Deaktivering', 'Profile confirm deactivation button', 'profile'),
('profile-cancel-deactivation-button', 'text', 'Annuller', 'Profile cancel deactivation button', 'profile'),

-- Login Page
('login-page-title', 'text', 'Log ind på din konto', 'Login page title', 'auth'),
('login-page-subtitle', 'text', 'Indtast dine oplysninger for at logge ind', 'Login page subtitle', 'auth'),
('login-email-label', 'text', 'Email', 'Login email label', 'auth'),
('login-password-label', 'text', 'Adgangskode', 'Login password label', 'auth'),
('login-button', 'text', 'Log ind', 'Login button', 'auth'),
('login-logging-in-text', 'text', 'Logger ind...', 'Login logging in text', 'auth'),
('login-no-account-text', 'text', 'Har du ikke en konto?', 'Login no account text', 'auth'),
('login-signup-link', 'text', 'Opret konto', 'Login signup link', 'auth'),

-- Signup Page
('signup-page-title', 'text', 'Opret en konto', 'Signup page title', 'auth'),
('signup-page-subtitle', 'text', 'Indtast dine oplysninger for at oprette en konto', 'Signup page subtitle', 'auth'),
('signup-email-label', 'text', 'Email', 'Signup email label', 'auth'),
('signup-password-label', 'text', 'Adgangskode', 'Signup password label', 'auth'),
('signup-confirm-password-label', 'text', 'Bekræft adgangskode', 'Signup confirm password label', 'auth'),
('signup-button', 'text', 'Opret konto', 'Signup button', 'auth'),
('signup-creating-account-text', 'text', 'Opretter konto...', 'Signup creating account text', 'auth'),
('signup-have-account-text', 'text', 'Har du allerede en konto?', 'Signup have account text', 'auth'),
('signup-login-link', 'text', 'Log ind', 'Signup login link', 'auth'),

-- Update Password Page
('update-password-page-title', 'text', 'Opdater Adgangskode', 'Update password page title', 'auth'),
('update-password-page-subtitle', 'text', 'Indtast din nye adgangskode nedenfor', 'Update password page subtitle', 'auth'),
('update-password-new-password-label', 'text', 'Ny adgangskode', 'Update password new password label', 'auth'),
('update-password-confirm-password-label', 'text', 'Bekræft ny adgangskode', 'Update password confirm password label', 'auth'),
('update-password-button', 'text', 'Opdater Adgangskode', 'Update password button', 'auth'),
('update-password-updating-text', 'text', 'Opdaterer...', 'Update password updating text', 'auth'),

-- Portfolio Page
('portfolio-page-title', 'text', 'Vores arbejde', 'Portfolio page title', 'portfolio'),
('portfolio-loading-text', 'text', 'Indlæser billeder...', 'Portfolio loading text', 'portfolio'),
('portfolio-no-images', 'text', 'Ingen portfolio billeder fundet endnu.', 'Portfolio no images text', 'portfolio'),

-- Ratings Page
('ratings-page-title', 'text', 'Alle Anmeldelser', 'Ratings page title', 'ratings'),
('ratings-loading-text', 'text', 'Indlæser anmeldelser...', 'Ratings loading text', 'ratings'),
('ratings-no-ratings', 'text', 'Ingen anmeldelser fundet endnu.', 'Ratings no ratings text', 'ratings'),
('ratings-close-modal-icon', 'text', '×', 'Ratings close modal icon', 'ratings'),

-- 404 Page
('404-error-code', 'text', '404', '404 error code', 'error'),
('404-page-title', 'text', 'Siden blev ikke fundet', '404 page title', 'error'),
('404-page-message', 'text', 'Beklager, men siden du leder efter findes ikke eller er blevet flyttet.', '404 page message', 'error'),
('404-home-button', 'text', 'Gå til forsiden', '404 home button', 'error')

ON CONFLICT (key) DO NOTHING;