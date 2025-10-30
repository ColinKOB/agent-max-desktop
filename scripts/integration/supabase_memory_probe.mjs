#!/usr/bin/env node
/**
 * Supabase Memory Integration Probe
 *
 * Verifies:
 * - users upsert by device_id
 * - preferences upsert and readback
 * - facts upsert and readback
 * - session create and message insert
 *
 * Requirements:
 * - ENV: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const ts = Date.now();
  // Generate a proper UUID for device_id
  const deviceId = crypto.randomUUID();

  // 1) Upsert user by device_id
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .upsert({ device_id: deviceId, consent_version: 1, scopes: { prompts: true, outputs: true, tools: false, screenshots: false } }, { onConflict: 'device_id' })
    .select()
    .maybeSingle();
  if (userErr || !userRow?.id) {
    console.error('User upsert failed. Check RLS/policies.', userErr);
    process.exit(2);
  }
  const userId = userRow.id;

  // 2) Preference upsert/readback
  const prefKey = `probe_pref_${ts}`;
  const prefVal = `ok-${ts}`;
  const { error: prefErr } = await supabase
    .from('preferences')
    .upsert({ user_id: userId, key: prefKey, value: prefVal, category: 'test', updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
  if (prefErr) {
    console.error('Preference upsert failed.', prefErr);
    process.exit(3);
  }
  const { data: prefs, error: prefsReadErr } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('key', prefKey)
    .limit(1);
  if (prefsReadErr || !prefs?.length || prefs[0].value !== prefVal) {
    console.error('Preference readback failed or mismatched.', prefsReadErr, prefs);
    process.exit(4);
  }

  // 3) Fact upsert/readback
  const factKey = `probe_key_${ts}`;
  const factVal = `probe_val_${ts}`;
  const { error: factErr } = await supabase
    .from('facts')
    .upsert({ user_id: userId, category: 'probe', key: factKey, value: factVal, source: 'test', updated_at: new Date().toISOString() }, { onConflict: 'user_id,category,key' });
  if (factErr) {
    console.error('Fact upsert failed.', factErr);
    process.exit(5);
  }
  const { data: facts, error: factsReadErr } = await supabase
    .from('facts')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'probe')
    .eq('key', factKey)
    .limit(1);
  if (factsReadErr || !facts?.length || facts[0].value !== factVal) {
    console.error('Fact readback failed or mismatched.', factsReadErr, facts);
    process.exit(6);
  }

  // 4) Session create + message insert
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('sessions')
    .insert({ user_id: userId, title: `probe-${ts}`, mode: 'private' })
    .select()
    .single();
  if (sessionErr) {
    console.error('Session create failed.', sessionErr);
    process.exit(7);
  }
  const sessionId = sessionRow.id;

  const { error: msgErr } = await supabase
    .from('messages')
    .insert({ session_id: sessionId, role: 'user', content: `Hello from probe ${ts}`, redacted_content: `Hello from probe ${ts}` });
  if (msgErr) {
    console.error('Message insert failed.', msgErr);
    process.exit(8);
  }
  const { data: msgs, error: msgsReadErr } = await supabase
    .from('messages')
    .select('id, role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(5);
  if (msgsReadErr || !msgs?.length) {
    console.error('Message readback failed.', msgsReadErr, msgs);
    process.exit(9);
  }

  const result = {
    ok: true,
    userId,
    preference: { key: prefKey, value: prefVal },
    fact: { category: 'probe', key: factKey, value: factVal },
    sessionId,
    messagesCount: msgs.length,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('Probe crashed:', e);
  process.exit(100);
});
