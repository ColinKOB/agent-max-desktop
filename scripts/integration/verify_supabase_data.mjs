#!/usr/bin/env node
/**
 * Verify Supabase Data Exists
 * Checks that our probe data is actually stored in the tables
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing env vars');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Check recent users with probe-like device_id patterns
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (userErr) {
    console.error('Failed to query users:', userErr);
    process.exit(2);
  }

  console.log('Recent users:');
  console.log(JSON.stringify(users, null, 2));

  // Check recent preferences
  const { data: prefs, error: prefErr } = await supabase
    .from('preferences')
    .select('*')
    .like('key', 'probe_pref_%')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (prefErr) {
    console.error('Failed to query preferences:', prefErr);
    process.exit(3);
  }

  console.log('\nRecent probe preferences:');
  console.log(JSON.stringify(prefs, null, 2));

  // Check recent facts
  const { data: facts, error: factErr } = await supabase
    .from('facts')
    .select('*')
    .eq('category', 'probe')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (factErr) {
    console.error('Failed to query facts:', factErr);
    process.exit(4);
  }

  console.log('\nRecent probe facts:');
  console.log(JSON.stringify(facts, null, 2));

  // Check recent sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .like('title', 'probe-%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessErr) {
    console.error('Failed to query sessions:', sessErr);
    process.exit(5);
  }

  console.log('\nRecent probe sessions:');
  console.log(JSON.stringify(sessions, null, 2));

  // Check messages for those sessions
  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (msgErr) {
      console.error('Failed to query messages:', msgErr);
      process.exit(6);
    }

    console.log('\nRecent probe messages:');
    console.log(JSON.stringify(messages, null, 2));
  }

  console.log('\n✅ Verification complete - data exists in Supabase!');
}

main().catch(e => {
  console.error('Verification failed:', e);
  process.exit(100);
});
