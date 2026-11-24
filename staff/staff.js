(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const message = text => { $('message').textContent = text; };
  const show = id => ['login', 'recovery', 'reset', 'portal'].forEach(name => { $(name).hidden = name !== id; });
  const config = window.FSBN_SUPABASE;
  if (!config || !window.supabase || !config.url || !config.publishableKey || config.url.includes('YOUR_PROJECT') || config.publishableKey.includes('YOUR_')) {
    message('Staff access is not configured. Contact an administrator.');
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey);
  let signingOut = false;
  let recovering = false;
  let hadAccess = false;
  let generation = 0;
  async function refreshAccess() {
    const current = ++generation;
    const { data, error } = await client.auth.getUser();
    if (current !== generation || recovering) return;
    if (error || !data.user) {
      window.FSBN_DASHBOARD?.stop();
      show('login');
      message(hadAccess ? 'Your session has expired. Please sign in again.' : 'Sign in with your staff account.');
      hadAccess = false;
      return;
    }
    const result = await client.from('staff_roles').select('role').eq('user_id', data.user.id).maybeSingle();
    if (current !== generation || recovering) return;
    if (result.error) { window.FSBN_DASHBOARD?.stop(); show('login'); message('Unable to verify staff access. Please try again.'); return; }
    if (!result.data || !['admin', 'editor', 'author'].includes(result.data.role)) {
      window.FSBN_DASHBOARD?.stop(); show('login'); message('This account is not authorised for staff access. Contact an administrator.'); return;
    }
    hadAccess = true;
    const role = result.data.role;
    $('identity').textContent = `${data.user.email || 'Staff account'} · ${role === 'admin' ? 'Administrator' : role[0].toUpperCase() + role.slice(1)}`;
    $('role-description').textContent = ({admin: 'Manage staff, content and settings.', editor: 'Review, edit and publish content.', author: 'Create and edit your own drafts.'})[role];
    document.querySelectorAll('[data-roles]').forEach(element => { element.hidden = !element.dataset.roles.split(' ').includes(role); });
    show('portal'); message(''); window.FSBN_DASHBOARD?.start(client, role, data.user.id);
  }
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; generation++; show('reset'); message('Enter a new password to complete recovery.'); return; }
    if (event === 'SIGNED_OUT' && !signingOut) { generation++; recovering = false; window.FSBN_DASHBOARD?.stop(); show('login'); message(hadAccess ? 'Your session has expired or was signed out. Please sign in again.' : 'Please sign in.'); hadAccess = false; }
  });
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; message('Signing in…');
    const { error } = await client.auth.signInWithPassword({email: form.elements.email.value.trim(), password: form.elements.password.value});
    form.elements.password.value = '';
    if (error) { message('Sign-in failed. Check your credentials and try again.'); return; }
    await refreshAccess();
  });
  $('show-recovery').addEventListener('click', () => { show('recovery'); message('Enter your staff email address.'); });
  $('back-login').addEventListener('click', () => { show('login'); message('Sign in with your staff account.'); });
  $('recovery-form').addEventListener('submit', async event => {
    event.preventDefault();
    const { error } = await client.auth.resetPasswordForEmail(event.currentTarget.elements.email.value.trim(), {redirectTo: new URL('index.html', location.href).href});
    message(error ? 'Unable to request a recovery link. Please try again.' : 'If the account exists, a recovery link will be sent.');
  });
  $('reset-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const { error } = await client.auth.updateUser({password: form.elements.password.value});
    form.elements.password.value = '';
    if (error) { message('Unable to update your password. The link may have expired; request another.'); return; }
    recovering = false; signingOut = true; await client.auth.signOut(); signingOut = false; hadAccess = false; show('login'); message('Password updated. Please sign in.');
  });
  $('logout').addEventListener('click', async () => {
    if (window.FSBN_DASHBOARD && !window.FSBN_DASHBOARD.canLeave()) return;
    signingOut = true; generation++; window.FSBN_DASHBOARD?.stop(); const { error } = await client.auth.signOut(); signingOut = false; hadAccess = false; show('login');
    message(error ? 'Signed out locally. Server sign-out failed; contact an administrator if this device is shared.' : 'You have signed out.');
  });
  $('staff-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) { await refreshAccess(); return; }
    const id = form.elements.id.value.trim();
    const profile = await client.from('profiles').upsert({id, display_name: form.elements.name.value.trim()});
    if (profile.error) { message('Could not save the profile. Check the user ID and your access.'); return; }
    const role = await client.from('staff_roles').upsert({user_id: id, role: form.elements.role.value});
    if (role.error) { message('Profile saved, but the role could not be assigned.'); return; }
    form.reset(); message('Staff role saved.'); await refreshAccess();
  });
  window.addEventListener('focus', () => { if (hadAccess && !recovering) refreshAccess(); });
  refreshAccess();
})();

