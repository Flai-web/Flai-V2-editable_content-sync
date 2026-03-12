INSERT INTO site_content (key, type, value, description, category) VALUES

  ('admin-home-sections-title',                  'text', 'Forside Sektioner',  'Heading for the Home Sections manager screen',         'admin-home-sections'),
  ('admin-home-sections-add-button',             'text', 'Tilføj Sektion',      'Label for the "Add Section" button',                   'admin-home-sections'),
  ('admin-home-sections-add-form-title',         'text', 'Tilføj Ny Sektion',   'Title of the add‑new‑section form',                    'admin-home-sections'),
  ('admin-home-sections-new-title-label',        'text', 'Titel',               'Label for the Title input in add form',                'admin-home-sections'),
  ('admin-home-sections-new-description-label',  'text', 'Beskrivelse',         'Label for the Description textarea in add form',       'admin-home-sections'),
  ('admin-home-sections-new-image-label',        'text', 'Billede',             'Label for the Image upload in add form',               'admin-home-sections'),
  ('admin-home-sections-new-active-label',       'text', 'Aktiv',               'Label for the Active checkbox in add form',            'admin-home-sections'),
  ('admin-home-sections-cancel-button',          'text', 'Annuller',            'Text for the cancel button in add form',               'admin-home-sections'),
  ('admin-home-sections-add-form-submit-button', 'text', 'Tilføj Sektion',      'Text for the submit button in add form',               'admin-home-sections'),
  ('admin-home-sections-edit-title-label',       'text', 'Titel',               'Label for the Title input in edit form',               'admin-home-sections'),
  ('admin-home-sections-edit-description-label', 'text', 'Beskrivelse',         'Label for the Description textarea in edit form',      'admin-home-sections'),
  ('admin-home-sections-edit-image-label',       'text', 'Billede',             'Label for the Image upload in edit form',              'admin-home-sections'),
  ('admin-home-sections-edit-active-label',      'text', 'Aktiv',               'Label for the Active checkbox in edit form',           'admin-home-sections'),
  ('admin-home-sections-edit-cancel-button',     'text', 'Annuller',            'Text for the cancel button in edit form',              'admin-home-sections'),
  ('admin-home-sections-save-button',            'text', 'Gem',                 'Text for the save button in edit form',                'admin-home-sections'),
  ('admin-home-sections-status-active',          'text', 'Aktiv',               'Display text for an active section status badge',      'admin-home-sections'),
  ('admin-home-sections-status-inactive',        'text', 'Inaktiv',             'Display text for an inactive section status badge',    'admin-home-sections'),
  ('admin-home-sections-order-label',            'text', 'Rækkefølge:',         'Label preceding the section order index',              'admin-home-sections'),
  ('admin-home-sections-no-sections',            'text', 'Ingen sektioner fundet. Tilføj den første sektion for at komme i gang.', 'Message when no sections are present', 'admin-home-sections')

ON CONFLICT (key) DO NOTHING;