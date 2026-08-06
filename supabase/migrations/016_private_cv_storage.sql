-- Keep candidate CV uploads private. Consumers must use short-lived signed URLs.
update storage.buckets set public = false where id = 'cvs';

-- Remove the historical bucket-wide upload policy before replacing it with
-- ownership-scoped policies. Object names are resumes/<profile-id>/... .
drop policy if exists "cvs_upload_authenticated" on storage.objects;
drop policy if exists "cvs_select_authenticated" on storage.objects;
drop policy if exists "cvs_insert_candidate" on storage.objects;
drop policy if exists "cvs_select_candidate_or_employer" on storage.objects;

create policy "cvs_insert_candidate" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = auth.uid()::text
    )
  );

create policy "cvs_select_candidate_or_employer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = 'resumes'
    and (
      exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[2]
          and p.user_id = auth.uid()::text
      )
      or exists (
        select 1
        from public.applications a
        join public.jobs j on j.id = a.job_id
        join public.companies c on c.id = j.company_id
        where a.candidate_id::text = (storage.foldername(name))[2]
          and c.employer_id = auth.uid()::text
      )
      or public.current_user_role() = 'admin'
    )
  );
