-- Allow deleting a user/profile even if they appear as an audit log actor.
-- Without this, deleting `auth.users` cascades to `public.profiles`, which fails
-- when `public.audit_logs.actor_id` still references that profile.

alter table if exists public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

alter table if exists public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id)
  references public.profiles(id)
  on delete set null;

