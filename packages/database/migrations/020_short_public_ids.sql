-- Keep previous encrypted tokens for rollback/history; canonical URLs now use short IDs.
ALTER TABLE public_route_ids ALTER COLUMN token DROP NOT NULL;
ALTER TABLE public_route_ids ADD COLUMN short_id varchar(10);
ALTER TABLE public_route_ids ADD CONSTRAINT public_route_ids_short_id_key UNIQUE(short_id);
ALTER TABLE public_route_ids ADD CONSTRAINT public_route_ids_short_id_check
 CHECK(short_id IS NULL OR (short_id ~ '^[A-Za-z0-9]{10}$' AND short_id ~ '[A-Za-z]'));
