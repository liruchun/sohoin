-- Never merge distinct entities whose IDs only differ in case.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public_route_ids WHERE short_id IS NOT NULL GROUP BY lower(short_id) HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Public ID lowercase collision: resolve conflicting mappings before retrying migration';
 END IF;
END $$;
UPDATE public_route_ids SET short_id=lower(short_id) WHERE short_id IS NOT NULL AND short_id<>lower(short_id);
ALTER TABLE public_route_ids DROP CONSTRAINT public_route_ids_short_id_check;
ALTER TABLE public_route_ids ADD CONSTRAINT public_route_ids_short_id_check
 CHECK(short_id IS NULL OR (short_id ~ '^[a-z0-9]{10}$' AND short_id ~ '[a-z]'));
