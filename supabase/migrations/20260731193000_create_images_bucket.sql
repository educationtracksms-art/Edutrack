insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  begin
    create policy "images_bucket_public_read"
      on storage.objects
      for select
      to public
      using (bucket_id = 'images');
  exception
    when duplicate_object then null;
  end;

  begin
    create policy "images_bucket_authenticated_insert"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'images');
  exception
    when duplicate_object then null;
  end;

  begin
    create policy "images_bucket_authenticated_update"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'images')
      with check (bucket_id = 'images');
  exception
    when duplicate_object then null;
  end;

  begin
    create policy "images_bucket_authenticated_delete"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'images');
  exception
    when duplicate_object then null;
  end;
end
$$;
