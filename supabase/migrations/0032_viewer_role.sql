-- On its own: Postgres can't use a new enum value in the transaction that adds it (0033 uses it).
alter type public.member_role add value 'viewer' before 'writer';
