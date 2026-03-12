/*
  # Add Newsletter Content Data

  1. Content Keys Added
    - Admin newsletter management interface text
    - Newsletter subscription form text
    - Newsletter template management text
    - FAQ newsletter content
    
  2. Categories
    - All content is categorized as 'newsletter' for easy management
    
  3. Content Types
    - All entries are 'text' type for editable content
*/

-- Admin Newsletter Management Content
INSERT INTO site_content (key, type, value, description, category) VALUES
('admin-newsletter-title', 'text', 'Newsletter Management', 'Main title for the newsletter management section', 'newsletter'),
('admin-newsletter-subscribers-label', 'text', 'Total Subscribers', 'Label for displaying total subscriber count', 'newsletter'),
('admin-newsletter-sent-label', 'text', 'Newsletters Sent', 'Label for displaying total newsletters sent', 'newsletter'),
('admin-newsletter-last-sent-label', 'text', 'Last Sent', 'Label for displaying when the last newsletter was sent', 'newsletter'),
('admin-newsletter-send-title', 'text', 'Send Newsletter', 'Title for the send newsletter section', 'newsletter'),
('admin-newsletter-template-label', 'text', 'Template', 'Label for template selection dropdown', 'newsletter'),
('admin-newsletter-title-label', 'text', 'Newsletter Title', 'Label for newsletter title input field', 'newsletter'),
('admin-newsletter-content-label', 'text', 'Content', 'Label for newsletter content textarea', 'newsletter'),
('admin-newsletter-recipients-info', 'text', 'This newsletter will be sent to all active subscribers.', 'Information text about newsletter recipients', 'newsletter'),
('admin-newsletter-send-button', 'text', 'Send Newsletter', 'Text for the send newsletter button', 'newsletter'),
('admin-newsletter-history-title', 'text', 'Newsletter History', 'Title for the newsletter history section', 'newsletter'),
('admin-newsletter-no-history', 'text', 'No newsletters have been sent yet.', 'Message when no newsletter history exists', 'newsletter'),
('admin-newsletter-subscribers-title', 'text', 'Subscribers', 'Title for the subscribers management section', 'newsletter'),
('admin-newsletter-no-subscribers', 'text', 'No subscribers yet.', 'Message when no subscribers exist', 'newsletter'),

-- Newsletter Template Management Content
('admin-newsletter-templates-title', 'text', 'Newsletter Templates', 'Title for the newsletter templates section', 'newsletter'),
('admin-newsletter-no-templates', 'text', 'No templates created yet.', 'Message when no templates exist', 'newsletter'),
('admin-newsletter-add-template-button', 'text', 'Add New Template', 'Text for the add new template button', 'newsletter'),
('admin-newsletter-edit-template-title', 'text', 'Edit Template', 'Title for editing an existing template', 'newsletter'),
('admin-newsletter-create-template-title', 'text', 'Create New Template', 'Title for creating a new template', 'newsletter'),
('admin-newsletter-template-name-label', 'text', 'Template Name', 'Label for template name input field', 'newsletter'),
('admin-newsletter-template-subject-label', 'text', 'Email Subject', 'Label for email subject input field', 'newsletter'),
('admin-newsletter-template-header-label', 'text', 'Header Text', 'Label for header text input field', 'newsletter'),
('admin-newsletter-template-body-label', 'text', 'Body Content', 'Label for body content textarea', 'newsletter'),
('admin-newsletter-template-footer-label', 'text', 'Footer Text', 'Label for footer text input field', 'newsletter'),
('admin-newsletter-template-primary-color-label', 'text', 'Primary Color', 'Label for primary color picker', 'newsletter'),
('admin-newsletter-template-secondary-color-label', 'text', 'Secondary Color', 'Label for secondary color picker', 'newsletter'),
('admin-newsletter-template-background-color-label', 'text', 'Background Color', 'Label for background color picker', 'newsletter'),
('admin-newsletter-template-text-color-label', 'text', 'Text Color', 'Label for text color picker', 'newsletter'),
('admin-newsletter-template-preview-title', 'text', 'Template Preview', 'Title for the template preview section', 'newsletter'),
('admin-newsletter-template-save-button', 'text', 'Save Template', 'Text for the save template button', 'newsletter'),
('admin-newsletter-template-cancel-button', 'text', 'Cancel', 'Text for the cancel button', 'newsletter'),
('admin-newsletter-template-edit-button', 'text', 'Edit', 'Text for the edit template button', 'newsletter'),
('admin-newsletter-template-delete-button', 'text', 'Delete', 'Text for the delete template button', 'newsletter'),

-- Public Newsletter Subscription Content
('newsletter-subscribe-title', 'text', 'Stay Updated', 'Title for the newsletter subscription section', 'newsletter'),
('newsletter-subscribe-description', 'text', 'Subscribe to our newsletter to receive the latest updates, photography tips, and exclusive offers.', 'Description text for newsletter subscription', 'newsletter'),
('newsletter-email-label', 'text', 'Email Address', 'Label for email input field in subscription form', 'newsletter'),
('newsletter-subscribe-button', 'text', 'Subscribe', 'Text for the subscribe button', 'newsletter'),
('newsletter-privacy-note', 'text', 'We respect your privacy. Unsubscribe at any time.', 'Privacy note for newsletter subscription', 'newsletter'),

-- FAQ Newsletter Content
('faq-newsletter-question', 'text', 'How often do you send newsletters?', 'FAQ question about newsletter frequency', 'newsletter'),
('faq-newsletter-answer', 'text', 'We send newsletters monthly with updates about our latest work, photography tips, and special offers. You can unsubscribe at any time.', 'FAQ answer about newsletter frequency and content', 'newsletter')

ON CONFLICT (key) DO NOTHING;