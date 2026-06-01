insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', true)
on conflict (id) do nothing;

create policy "Public read site-photos"
on storage.objects for select
using (bucket_id = 'site-photos');

create policy "Public upload site-photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'site-photos');