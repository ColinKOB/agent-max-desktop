#!/usr/bin/env node
/**
 * E2E Memory Integration Test
 * 
 * Tests the complete flow:
 * 1. User initialization
 * 2. Session creation
 * 3. Profile/preferences/facts read/write
 * 4. Message storage
 * 5. Context building
 * 6. Session listing
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runE2ETest() {
  console.log('🧪 Starting E2E Memory Integration Test\n');
  
  const testId = Date.now();
  const deviceId = crypto.randomUUID();
  let userId, sessionId;
  
  try {
    // TEST 1: User Initialization
    console.log('📝 Test 1: User Initialization');
    const { data: user, error: userErr } = await supabase
      .from('users')
      .upsert({
        device_id: deviceId,
        consent_version: 1,
        scopes: { prompts: true, outputs: true, tools: false, screenshots: false }
      }, { onConflict: 'device_id' })
      .select()
      .maybeSingle();
    
    if (userErr || !user) {
      throw new Error(`User creation failed: ${userErr?.message}`);
    }
    userId = user.id;
    console.log(`✅ User created: ${userId}\n`);
    
    // TEST 2: Profile Update
    console.log('📝 Test 2: Profile Update (via metadata)');
    const { error: profileErr } = await supabase
      .from('users')
      .update({
        metadata: {
          profile: {
            name: `E2E Test User ${testId}`,
            interaction_count: 0,
            temporal_info: {},
            top_preferences: []
          }
        }
      })
      .eq('id', userId);
    
    if (profileErr) {
      throw new Error(`Profile update failed: ${profileErr.message}`);
    }
    console.log('✅ Profile updated\n');
    
    // TEST 3: Set Preferences
    console.log('📝 Test 3: Set Preferences');
    const prefs = [
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'en' },
      { key: `e2e_test_${testId}`, value: 'test_value' }
    ];
    
    for (const pref of prefs) {
      const { error: prefErr } = await supabase
        .from('preferences')
        .upsert({
          user_id: userId,
          key: pref.key,
          value: pref.value,
          category: 'test',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,key' });
      
      if (prefErr) {
        throw new Error(`Preference upsert failed: ${prefErr.message}`);
      }
    }
    console.log(`✅ ${prefs.length} preferences set\n`);
    
    // TEST 4: Set Facts
    console.log('📝 Test 4: Set Facts');
    const facts = [
      { category: 'personal', key: 'name', value: `E2E User ${testId}` },
      { category: 'personal', key: 'test_id', value: String(testId) },
      { category: 'location', key: 'city', value: 'Test City' }
    ];
    
    for (const fact of facts) {
      const { error: factErr } = await supabase
        .from('facts')
        .upsert({
          user_id: userId,
          category: fact.category,
          key: fact.key,
          value: fact.value,
          source: 'test',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,category,key' });
      
      if (factErr) {
        throw new Error(`Fact upsert failed: ${factErr.message}`);
      }
    }
    console.log(`✅ ${facts.length} facts set\n`);
    
    // TEST 5: Create Session
    console.log('📝 Test 5: Create Session');
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        title: `E2E Test Session ${testId}`,
        mode: 'private'
      })
      .select()
      .single();
    
    if (sessionErr || !session) {
      throw new Error(`Session creation failed: ${sessionErr?.message}`);
    }
    sessionId = session.id;
    console.log(`✅ Session created: ${sessionId}\n`);
    
    // TEST 6: Store Messages
    console.log('📝 Test 6: Store Messages');
    const messages = [
      { role: 'user', content: `Hello from E2E test ${testId}` },
      { role: 'assistant', content: `Response from E2E test ${testId}` },
      { role: 'user', content: `Follow-up from E2E test ${testId}` }
    ];
    
    for (const msg of messages) {
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          redacted_content: msg.content
        });
      
      if (msgErr) {
        throw new Error(`Message insert failed: ${msgErr.message}`);
      }
    }
    console.log(`✅ ${messages.length} messages stored\n`);
    
    // TEST 7: Retrieve Profile
    console.log('📝 Test 7: Retrieve Profile');
    const { data: retrievedUser, error: retrieveErr } = await supabase
      .from('users')
      .select('metadata')
      .eq('id', userId)
      .single();
    
    if (retrieveErr || !retrievedUser?.metadata?.profile) {
      throw new Error(`Profile retrieval failed: ${retrieveErr?.message}`);
    }
    console.log(`✅ Profile retrieved: ${retrievedUser.metadata.profile.name}\n`);
    
    // TEST 8: Retrieve Preferences
    console.log('📝 Test 8: Retrieve Preferences');
    const { data: retrievedPrefs, error: prefsErr } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId);
    
    if (prefsErr || !retrievedPrefs?.length) {
      throw new Error(`Preferences retrieval failed: ${prefsErr?.message}`);
    }
    console.log(`✅ ${retrievedPrefs.length} preferences retrieved\n`);
    
    // TEST 9: Retrieve Facts
    console.log('📝 Test 9: Retrieve Facts');
    const { data: retrievedFacts, error: factsErr } = await supabase
      .from('facts')
      .select('*')
      .eq('user_id', userId);
    
    if (factsErr || !retrievedFacts?.length) {
      throw new Error(`Facts retrieval failed: ${factsErr?.message}`);
    }
    console.log(`✅ ${retrievedFacts.length} facts retrieved\n`);
    
    // TEST 10: Retrieve Messages
    console.log('📝 Test 10: Retrieve Messages');
    const { data: retrievedMsgs, error: msgsErr } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (msgsErr || !retrievedMsgs?.length) {
      throw new Error(`Messages retrieval failed: ${msgsErr?.message}`);
    }
    console.log(`✅ ${retrievedMsgs.length} messages retrieved\n`);
    
    // TEST 11: Get All Sessions
    console.log('📝 Test 11: Get All Sessions');
    const { data: allSessions, error: sessionsErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (sessionsErr) {
      throw new Error(`Sessions retrieval failed: ${sessionsErr?.message}`);
    }
    console.log(`✅ ${allSessions.length} session(s) retrieved\n`);
    
    // TEST 12: Context Building Simulation
    console.log('📝 Test 12: Context Building Simulation');
    const context = {
      profile: retrievedUser.metadata.profile,
      facts: retrievedFacts.reduce((acc, f) => {
        if (!acc[f.category]) acc[f.category] = {};
        acc[f.category][f.key] = f.value;
        return acc;
      }, {}),
      preferences: retrievedPrefs.reduce((acc, p) => {
        acc[p.key] = p.value;
        return acc;
      }, {}),
      recent_messages: retrievedMsgs.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at).getTime()
      }))
    };
    
    console.log('✅ Context built successfully');
    console.log(JSON.stringify({
      hasProfile: !!context.profile,
      factCount: Object.keys(context.facts).length,
      prefCount: Object.keys(context.preferences).length,
      messageCount: context.recent_messages.length
    }, null, 2));
    console.log();
    
    // FINAL SUMMARY
    console.log('═'.repeat(50));
    console.log('🎉 E2E TEST PASSED - ALL OPERATIONS SUCCESSFUL');
    console.log('═'.repeat(50));
    console.log(`User ID: ${userId}`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Test ID: ${testId}`);
    console.log('\n✅ All memory operations are working correctly with Supabase!');
    
  } catch (error) {
    console.error('\n❌ E2E TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runE2ETest();
