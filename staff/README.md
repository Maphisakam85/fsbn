# Staff access setup

1. Apply all migrations to the intended Supabase project using an administrator-controlled connection. Disable public sign-up in Supabase Auth. Configure production HTTPS, SMTP, the site URL and the exact `https://YOUR-HOST/staff/index.html` recovery redirect in the Auth allow list. Set an appropriate password policy and MFA for administrators where supported.
2. Copy `staff-config.example.js` to `staff/config.js` and set the project URL and **publishable** key. This file is served to browsers and must never contain a secret or service-role key. The CDN dependency requires network access and should be pinned/reviewed when updated.
3. Create the first staff Auth user using the Supabase dashboard's trusted user administration flow. Obtain the verified user's UUID. In the dashboard SQL editor, as a trusted project administrator, execute the following after replacing the UUID and name with the intended user's values:

```sql
begin;
insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000000', 'REPLACE WITH NAME');
insert into public.staff_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'admin');
commit;
```

Do not run this example unchanged. Deliver the initial password or recovery link through the trusted Auth workflow, never through source files. Verify identity before provisioning. The administrator can assign roles to other existing Auth users in Staff access. User creation and account deletion remain trusted dashboard operations; remove the role and disable the Auth account when revoking access. Maintain a separately controlled recovery administrator and audit role changes operationally.

The static staff page contains no protected data itself: every data operation relies on Supabase RLS. Author ownership requires an `authors.profile_id` linked to that staff user's profile; assign that link using an authorized editorial workflow. Authors can insert and edit only their own draft articles; editorial review/publishing and taxonomy/media management require an editor or administrator. Article management and a settings editor are not yet implemented. Password recovery links are handled in the browser; verify the complete email flow on the deployed origin. Browser sessions are stored by the Supabase client, so use trusted devices and a restrictive hosting Content Security Policy. Never expose service credentials.

Before launch, execute role and session tests against a non-production project: anonymous, nonstaff, author (own and another author's drafts, publish attempt), editor (publish and denied role changes), and administrator; also test role removal, expiry, logout, and password recovery. The database is the authority even if a browser still displays a previously authorized screen.

The article dashboard uses limited Markdown (headings, bold and lists). It saves article fields and topics atomically; image uploads are separate and may need orphan cleanup after a failed save. The private bucket does not yet deliver published images to public readers. `supabase/tests/article_permissions.sql` is intended for a disposable project after migrations; run it as a trusted database administrator and also test anonymous/nonstaff, cross-author and media restrictions. Check real Auth, upload, responsive layout and session flows before production. Concurrent edits currently use last-write-wins behavior.
