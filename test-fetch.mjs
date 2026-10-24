import { createClient } from '@supabase/supabase-js';
const store = new Map();
globalThis.localStorage = { getItem: (k)=>store.get(k)??null, setItem:(k,v)=>store.set(k,v), removeItem:(k)=>store.delete(k) };
const url='https://fahjpdgnaqyzfzqewily.supabase.co';
const key='sb_publishable_6huI6X4KlIHlX6ol--9cyw_OrGBV6A5';
const c = createClient(url,key,{auth:{storage:localStorage,persistSession:true,autoRefreshToken:true}});
await c.auth.signInWithPassword({email:'admin@test.com',password:'Password123!'});
const { data: sessionData } = await c.auth.getSession();
const sessionUser = sessionData.session?.user ?? null;
console.log('sessionUser', sessionUser?.id);
const [{ data: profile }, { data: roles }] = await Promise.all([
  c.from('profiles').select('id, full_name, email, initials, phone, school_id, department_id, is_active, must_change_password').eq('id', sessionUser.id).maybeSingle(),
  c.from('user_roles').select('role').eq('user_id', sessionUser.id),
]);
console.log('profile', profile);
console.log('roles', roles);
let school=null;
if (profile?.school_id) {
  const { data } = await c.from('schools').select('id, name, code, logo_url, status').eq('id', profile.school_id).maybeSingle();
  school=data;
}
console.log('school', school);
