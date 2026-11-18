-- Function to check if an email is already registered (callable by anon/public for register validation)
create or replace function public.check_email_registered(check_email text)
returns boolean as $$
begin
  return exists (
    select 1 from auth.users where lower(email) = lower(trim(check_email))
  ) or exists (
    select 1 from public.profiles where lower(email) = lower(trim(check_email))
  );
end;
$$ language plpgsql security definer;

grant execute on function public.check_email_registered(text) to anon, authenticated;

