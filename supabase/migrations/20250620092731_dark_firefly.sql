/*
  # Add admin panel content

  1. Changes
    - Add all admin panel content entries for editing
    - Include all text, labels, and messages for the admin interface
*/

-- Insert admin panel content
INSERT INTO site_content (key, type, value, description, category) VALUES

-- Admin Access
('admin-access-denied-title', 'text', 'Adgang Nægtet', 'Admin access denied title', 'admin'),
('admin-access-denied-message', 'text', 'Du har ikke tilladelse til at se denne side.', 'Admin access denied message', 'admin'),

-- Admin Page General
('admin-page-title', 'text', 'Admin Panel', 'Admin page main title', 'admin'),

-- Overview Section
('admin-overview-title', 'text', 'Oversigt', 'Admin overview section title', 'admin'),
('admin-total-bookings-label', 'text', 'Total Bookinger', 'Total bookings label', 'admin'),
('admin-completed-bookings-label', 'text', 'Gennemførte', 'Completed bookings label', 'admin'),
('admin-pending-bookings-label', 'text', 'Afventende', 'Pending bookings label', 'admin'),
('admin-total-revenue-label', 'text', 'Total Omsætning', 'Total revenue label', 'admin'),
('admin-products-overview-title', 'text', 'Produkter', 'Products overview title', 'admin'),
('admin-active-products-label', 'text', '
Aktive produkter', 'Active products label', 'admin'),
('admin-portfolio-overview-title', 'text', 'Portfolio', 'Portfolio overview title', 'admin'),
('admin-portfolio-images-label', 'text', 'Portfolio billeder', 'Portfolio images label', 'admin'),
('admin-ratings-overview-title', 'text', 'Anmeldelser', 'Ratings overview title', 'admin'),
('admin-average-rating-label', 'text', 'Gennemsnit', 'Average rating label', 'admin'),
('admin-recent-activity-title', 'text', 'Seneste Aktivitet', 'Recent activity title', 'admin'),

-- Analytics Section
('admin-analytics-title', 'text', 'Analyser og Statistikker', 'Analytics section title', 'admin'),
('admin-analytics-revenue-label', 'text', 'Omsætning', 'Analytics revenue label', 'admin'),
('admin-analytics-bookings-label', 'text', 'Bookinger', 'Analytics bookings label', 'admin'),
('admin-analytics-conversion-label', 'text', 'Konverteringsrate', 'Analytics conversion label', 'admin'),
('admin-analytics-rating-label', 'text', 'Gennemsnitsrating', 'Analytics rating label', 'admin'),
('admin-analytics-daily-revenue-title', 'text', 'Daglig Omsætning', 'Daily revenue chart title', 'admin'),
('admin-analytics-product-performance-title', 'text', 'Produktpræstation', 'Product performance title', 'admin'),
('admin-analytics-payment-methods-title', 'text', 'Betalingsmetoder', 'Payment methods title', 'admin'),
('admin-analytics-summary-title', 'text', 'Sammendrag', 'Analytics summary title', 'admin'),
('admin-analytics-summary-performance', 'text', 'Præstation', 'Summary performance title', 'admin'),
('admin-analytics-summary-trends', 'text', 'Tendenser', 'Summary trends title', 'admin'),

-- Bookings Management
('admin-bookings-title', 'text', 'Booking Administration', 'Bookings management title', 'admin'),
('admin-bookings-total-label', 'text', 'Total Bookinger', 'Total bookings label', 'admin'),
('admin-bookings-pending-label', 'text', 'Afventende', 'Pending bookings label', 'admin'),
('admin-bookings-paid-label', 'text', 'Betalt', 'Paid bookings label', 'admin'),
('admin-bookings-completed-label', 'text', 'Gennemført', 'Completed bookings label', 'admin'),
('admin-bookings-no-results', 'text', 'Ingen bookinger fundet med de valgte filtre.', 'No bookings found message', 'admin'),
('admin-bookings-customer-label', 'text', 'Kunde', 'Customer label', 'admin'),
('admin-bookings-service-label', 'text', 'Service', 'Service label', 'admin'),
('admin-bookings-location-label', 'text', 'Lokation', 'Location label', 'admin'),
('admin-bookings-payment-label', 'text', 'Betaling', 'Payment label', 'admin'),
('admin-bookings-complete-button', 'text', 'Gennemfør', 'Complete booking button', 'admin'),
('admin-bookings-mark-paid-button', 'text', 'Marker Betalt', 'Mark paid button', 'admin'),
('admin-bookings-edit-button', 'text', 'Rediger', 'Edit booking button', 'admin'),
('admin-bookings-edit-form-title', 'text', 'Rediger Booking', 'Edit booking form title', 'admin'),
('admin-bookings-edit-status-label', 'text', 'Betalingsstatus', 'Edit status label', 'admin'),
('admin-bookings-edit-method-label', 'text', 'Betalingsmetode', 'Edit method label', 'admin'),

-- Products Management
('admin-products-title', 'text', 'Produkt Administration', 'Products management title', 'admin'),
('admin-products-add-button', 'text', 'Tilføj Produkt', 'Add product button', 'admin'),
('admin-products-add-form-title', 'text', 'Tilføj Nyt Produkt', 'Add product form title', 'admin'),
('admin-products-name-label', 'text', 'Produktnavn', 'Product name label', 'admin'),
('admin-products-price-label', 'text', 'Pris (DKK)', 'Product price label', 'admin'),
('admin-products-category-label', 'text', 'Kategori', 'Product category label', 'admin'),
('admin-products-description-label', 'text', 'Beskrivelse', 'Product description label', 'admin'),
('admin-products-images-label', 'text', 'Billeder', 'Product images label', 'admin'),
('admin-products-links-label', 'text', 'Links (valgfrit)', 'Product links label', 'admin'),
('admin-products-cancel-button', 'text', 'Annuller', 'Cancel button', 'admin'),
('admin-products-save-button', 'text', 'Gem Produkt', 'Save product button', 'admin'),
('admin-products-edit-name-label', 'text', 'Produktnavn', 'Edit product name label', 'admin'),
('admin-products-edit-price-label', 'text', 'Pris (DKK)', 'Edit product price label', 'admin'),
('admin-products-edit-category-label', 'text', 'Kategori', 'Edit product category label', 'admin'),
('admin-products-edit-description-label', 'text', 'Beskrivelse', 'Edit product description label', 'admin'),
('admin-products-edit-images-label', 'text', 'Billeder', 'Edit product images label', 'admin'),
('admin-products-edit-links-label', 'text', 'Links', 'Edit product links label', 'admin'),
('admin-products-edit-cancel-button', 'text', 'Annuller', 'Edit cancel button', 'admin'),
('admin-products-edit-save-button', 'text', 'Gem', 'Edit save button', 'admin'),
('admin-products-links-display-label', 'text', 'Links:', 'Links display label', 'admin'),
('admin-products-no-products', 'text', 'Ingen produkter fundet. Tilføj det første produkt for at komme i gang.', 'No products message', 'admin'),

-- Portfolio Management
('admin-portfolio-title', 'text', 'Portfolio Administration', 'Portfolio management title', 'admin'),
('admin-portfolio-add-button', 'text', 'Tilføj Billede', 'Add portfolio image button', 'admin'),
('admin-portfolio-total-images-label', 'text', 'Total Billeder', 'Total images label', 'admin'),
('admin-portfolio-total-likes-label', 'text', 'Total Likes', 'Total likes label', 'admin'),
('admin-portfolio-total-dislikes-label', 'text', 'Total Dislikes', 'Total dislikes label', 'admin'),
('admin-portfolio-add-form-title', 'text', 'Tilføj Nyt Portfolio Billede', 'Add portfolio form title', 'admin'),
('admin-portfolio-title-label', 'text', 'Titel', 'Portfolio title label', 'admin'),
('admin-portfolio-image-label', 'text', 'Billede eller Video', 'Portfolio image label', 'admin'),
('admin-portfolio-cancel-button', 'text', 'Annuller', 'Portfolio cancel button', 'admin'),
('admin-portfolio-save-button', 'text', 'Gem Billede', 'Portfolio save button', 'admin'),
('admin-portfolio-edit-title-label', 'text', 'Titel', 'Edit portfolio title label', 'admin'),
('admin-portfolio-edit-image-label', 'text', 'Billede', 'Edit portfolio image label', 'admin'),
('admin-portfolio-edit-cancel-button', 'text', 'Annuller', 'Edit portfolio cancel button', 'admin'),
('admin-portfolio-edit-save-button', 'text', 'Gem', 'Edit portfolio save button', 'admin'),
('admin-portfolio-no-images', 'text', 'Ingen portfolio billeder fundet. Tilføj det første billede for at komme i gang.', 'No portfolio images message', 'admin'),

-- Address Zones Management
('admin-zones-title', 'text', 'Adressezone Administration', 'Address zones management title', 'admin'),
('admin-zones-add-button', 'text', 'Tilføj Zone', 'Add zone button', 'admin'),
('admin-zones-total-label', 'text', 'Total Zoner', 'Total zones label', 'admin'),
('admin-zones-active-label', 'text', 'Aktive Zoner', 'Active zones label', 'admin'),
('admin-zones-coverage-label', 'text', 'Gennemsnitlig Radius', 'Average radius label', 'admin'),
('admin-zones-add-form-title', 'text', 'Tilføj Ny Adressezone', 'Add zone form title', 'admin'),
('admin-zones-name-label', 'text', 'Zone Navn', 'Zone name label', 'admin'),
('admin-zones-radius-label', 'text', 'Radius (km)', 'Zone radius label', 'admin'),
('admin-zones-address-label', 'text', 'Center Adresse', 'Zone address label', 'admin'),
('admin-zones-active-checkbox', 'text', 'Aktiv zone', 'Active zone checkbox', 'admin'),
('admin-zones-cancel-button', 'text', 'Annuller', 'Zone cancel button', 'admin'),
('admin-zones-save-button', 'text', 'Gem Zone', 'Zone save button', 'admin'),
('admin-zones-edit-name-label', 'text', 'Zone Navn', 'Edit zone name label', 'admin'),
('admin-zones-edit-radius-label', 'text', 'Radius (km)', 'Edit zone radius label', 'admin'),
('admin-zones-edit-address-label', 'text', 'Center Adresse', 'Edit zone address label', 'admin'),
('admin-zones-edit-active-checkbox', 'text', 'Aktiv zone', 'Edit active zone checkbox', 'admin'),
('admin-zones-edit-cancel-button', 'text', 'Annuller', 'Edit zone cancel button', 'admin'),
('admin-zones-edit-save-button', 'text', 'Gem', 'Edit zone save button', 'admin'),
('admin-zones-radius-display', 'text', 'Radius:', 'Zone radius display', 'admin'),
('admin-zones-created-label', 'text', 'Oprettet:', 'Zone created label', 'admin'),
('admin-zones-no-zones', 'text', 'Ingen adressezoner fundet. Tilføj den første zone for at komme i gang.', 'No zones message', 'admin'),

-- Discount Codes Management
('admin-discounts-title', 'text', 'Rabatkode Administration', 'Discount codes management title', 'admin'),
('admin-discounts-add-button', 'text', 'Tilføj Rabatkode', 'Add discount code button', 'admin'),
('admin-discounts-total-label', 'text', 'Total Koder', 'Total codes label', 'admin'),
('admin-discounts-active-label', 'text', 'Aktive Koder', 'Active codes label', 'admin'),
('admin-discounts-used-label', 'text', 'Total Anvendelser', 'Total uses label', 'admin'),
('admin-discounts-expired-label', 'text', 'Udløbne Koder', 'Expired codes label', 'admin'),
('admin-discounts-add-form-title', 'text', 'Tilføj Ny Rabatkode', 'Add discount form title', 'admin'),
('admin-discounts-code-label', 'text', 'Rabatkode', 'Discount code label', 'admin'),
('admin-discounts-type-label', 'text', 'Rabat Type', 'Discount type label', 'admin'),
('admin-discounts-value-label', 'text', 'Rabat Værdi', 'Discount value label', 'admin'),
('admin-discounts-min-amount-label', 'text', 'Minimum Ordrebeløb (DKK)', 'Minimum amount label', 'admin'),
('admin-discounts-description-label', 'text', 'Beskrivelse', 'Discount description label', 'admin'),
('admin-discounts-max-uses-label', 'text', 'Maksimale Anvendelser (valgfrit)', 'Max uses label', 'admin'),
('admin-discounts-valid-until-label', 'text', 'Udløbsdato (valgfrit)', 'Valid until label', 'admin'),
('admin-discounts-active-checkbox', 'text', 'Aktiv rabatkode', 'Active discount checkbox', 'admin'),
('admin-discounts-cancel-button', 'text', 'Annuller', 'Discount cancel button', 'admin'),
('admin-discounts-save-button', 'text', 'Gem Rabatkode', 'Discount save button', 'admin'),
('admin-discounts-edit-code-label', 'text', 'Rabatkode', 'Edit discount code label', 'admin'),
('admin-discounts-edit-type-label', 'text', 'Rabat Type', 'Edit discount type label', 'admin'),
('admin-discounts-edit-value-label', 'text', 'Rabat Værdi', 'Edit discount value label', 'admin'),
('admin-discounts-edit-min-amount-label', 'text', 'Minimum Ordrebeløb (DKK)', 'Edit minimum amount label', 'admin'),
('admin-discounts-edit-description-label', 'text', 'Beskrivelse', 'Edit discount description label', 'admin'),
('admin-discounts-edit-max-uses-label', 'text', 'Maksimale Anvendelser', 'Edit max uses label', 'admin'),
('admin-discounts-edit-valid-until-label', 'text', 'Udløbsdato', 'Edit valid until label', 'admin'),
('admin-discounts-edit-active-checkbox', 'text', 'Aktiv rabatkode', 'Edit active discount checkbox', 'admin'),
('admin-discounts-edit-cancel-button', 'text', 'Annuller', 'Edit discount cancel button', 'admin'),
('admin-discounts-edit-save-button', 'text', 'Gem', 'Edit discount save button', 'admin'),
('admin-discounts-no-codes', 'text', 'Ingen rabatkoder fundet. Tilføj den første rabatkode for at komme i gang.', 'No discount codes message', 'admin')

ON CONFLICT (key) DO NOTHING;