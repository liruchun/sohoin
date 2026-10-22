-- Public community URLs: /community/{category-slug}/{content-slug}.
-- Slugs stay optional; the existing 10-character public ID remains the fallback
-- segment until an editor or the AI flow fills one in. Published content always
-- has a category, so slug uniqueness is scoped to the category.
ALTER TABLE contents ADD COLUMN slug text;
ALTER TABLE contents ADD CONSTRAINT contents_slug_shape CHECK (
  slug IS NULL OR (
    length(slug) BETWEEN 2 AND 60
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    -- Ten-character alphanumerics are reserved for system public IDs.
    AND slug !~ '^[a-z0-9]{10}$'
  )
);
CREATE UNIQUE INDEX contents_category_slug_idx ON contents (category_id, slug) WHERE slug IS NOT NULL;
