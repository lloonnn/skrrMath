-- A simpler lecturer code: at least 6 characters instead of 12 (owner request).
-- A short code is easier to guess, so there is now also a limit across all people: after 30
-- wrong tries in an hour, nobody can try until the hour has passed. Each person still has their own
-- limit of five wrong tries in an hour.

create or replace function set_lecturer_code(code text) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if code is null or char_length(code) < 6 then
    raise exception 'the lecturer code must have at least 6 characters';
  end if;
  insert into app_secrets (name, value) values ('lecturer_code_hash', crypt(code, gen_salt('bf')))
  on conflict (name) do update set value = excluded.value;
end $$;

create or replace function claim_lecturer(code text) returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  stored text;
  wrong int;
  wrong_all int;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  select count(*) into wrong from lecturer_claim_attempts
    where user_id = uid and ok = false and at > now() - interval '1 hour';
  select count(*) into wrong_all from lecturer_claim_attempts
    where ok = false and at > now() - interval '1 hour';
  if wrong >= 5 or wrong_all >= 30 then
    return 'locked';
  end if;
  select value into stored from app_secrets where name = 'lecturer_code_hash';
  if stored is null then
    return 'not_set';
  end if;
  if code is null or crypt(code, stored) <> stored then
    insert into lecturer_claim_attempts (user_id, ok) values (uid, false);
    return 'wrong_code';
  end if;
  insert into lecturer_claim_attempts (user_id, ok) values (uid, true);
  insert into profiles (id, role) values (uid, 'lecturer')
  on conflict (id) do update set role = 'lecturer';
  return 'lecturer';
end $$;
