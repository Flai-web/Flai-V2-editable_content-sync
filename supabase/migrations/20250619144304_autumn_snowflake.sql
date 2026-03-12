/*
  # Add product page editable content

  1. Changes
    - Add all product page content entries for editing
    - Include features, descriptions, and all text elements
*/

-- Insert product page content
INSERT INTO site_content (key, type, value, description, category) VALUES

-- Product Page General
('product-page-loading-text', 'text', 'Indlæser produkt...', 'Product page loading text', 'product'),
('product-page-not-found-title', 'text', 'Produkt ikke fundet', 'Product page not found title', 'product'),
('product-page-not-found-message', 'text', 'Det produkt du leder efter findes ikke eller er blevet fjernet.', 'Product page not found message', 'product'),
('product-page-back-to-products-button', 'text', 'Tilbage til Produkter', 'Product page back to products button', 'product'),
('product-page-back-button', 'text', 'Tilbage til produkter', 'Product page back button', 'product'),

-- Product Page Sections
('product-page-description-title', 'text', 'Beskrivelse', 'Product page description section title', 'product'),
('product-page-links-title', 'text', 'Relaterede links', 'Product page links section title', 'product'),
('product-page-features-title', 'text', 'Hvad får du', 'Product page features section title', 'product'),

-- Video Product Features
('product-page-video-feature-1', 'text', 'Professionel 4K videooptagelse', 'Video product feature 1', 'product'),
('product-page-video-feature-2', 'text', 'Stabiliseret optagelse med gimbal', 'Video product feature 2', 'product'),
('product-page-video-feature-3', 'text', 'Levering inden for 1-2 dage', 'Video product feature 3', 'product'),

-- Photo Product Features
('product-page-photo-feature-1', 'text', 'Højopløselige 48MP billeder', 'Photo product feature 1', 'product'),
('product-page-photo-feature-2', 'text', 'RAW og JPEG formater', 'Photo product feature 2', 'product'),
('product-page-photo-feature-3', 'text', 'Professionel farvekorrigering', 'Photo product feature 3', 'product'),

-- Editing Section
('product-page-editing-title', 'text', 'Tilvalg: Professionel redigering', 'Product page editing section title', 'product'),
('product-page-editing-description', 'text', 'Få dine optagelser professionelt redigeret med farvekorrigering, klipning og baggrundsmusik.', 'Product page editing description', 'product'),
('product-page-editing-price', 'text', '+100 kr', 'Product page editing price', 'product'),

-- Book Section
('product-page-book-button', 'text', 'Book Nu', 'Product page book button', 'product'),
('product-page-book-note', 'text', 'Du kan vælge dato og tid på næste side', 'Product page book note', 'product')


-- Product Page - Editing Section
('product-page-editing-included-title', 'text', 'Professionel redigering inkluderet', 'Produktsektion titel for inkluderet redigering', 'product'),
('product-page-editing-included-description', 'text', 'Dette produkt inkluderer professionel redigering med farvekorrigering, klipning og baggrundsmusik.', 'Produktsektion beskrivelse for inkluderet redigering', 'product')


  
ON CONFLICT (key) DO NOTHING;