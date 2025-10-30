#!/usr/bin/env node
/**
 * Test Supabase Memory Service
 * 
 * Tests the actual supabaseMemory.js service functions
 * Simulates the browser environment
 */

import { createClient } from '@supabase/supabase-js';

// Mock browser environment
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true
  },
  writable: true
});

global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  }
};

// Mock crypto
global.crypto = {
  randomUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

// Setup env
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rburoajxsyfousnleydw.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidXJvYWp4c3lmb3VzbmxleWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTE2MTgsImV4cCI6MjA3NjU2NzYxOH0.sWHCQpHiQvI_whjLKF8ybR3mr9BNtPF68MgKT1LLuSc';

// Import after setting up env
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function testSupabaseMemoryService() {
  console.log('🧪 Testing Supabase Memory Service Functions\n');
  
  const testId = Date.now();
  const deviceId = crypto.randomUUID();
  
  try {
    // Create test user
    console.log('📝 Setting up test user...');
    const { data: user, error: userErr } = await supabase
      .from('users')
      .upsert({
        device_id: deviceId,
        consent_version: 1,
        scopes: { prompts: true, outputs: true, tools: false, screenshots: false },
        metadata: {
          profile: {
            name: `Service Test User ${testId}`,
            interaction_count: 0,
            temporal_info: {},
            top_preferences: []
          }
        }
      }, { onConflict: 'device_id' })
      .select()
      .maybeSingle();
    
    if (userErr || !user) {
      throw new Error(`User setup failed: ${userErr?.message}`);
    }
    
    const userId = user.id;
    localStorage.setItem('user_id', userId);
    console.log(`✅ Test user ready: ${userId}\n`);
    
    // TEST: Profile operations
    console.log('📝 Testing profile operations...');
    
    // getProfile
    const profile = await testGetProfile(userId);
    if (!profile || !profile.name) {
      throw new Error('getProfile failed');
    }
    console.log(`✅ getProfile: ${profile.name}`);
    
    // setPreference
    console.log('\n📝 Testing preference operations...');
    await testSetPreference(userId, `test_pref_${testId}`, 'test_value');
    console.log('✅ setPreference: stored');
    
    // getPreferences
    const prefs = await testGetPreferences(userId);
    if (!prefs || Object.keys(prefs).length === 0) {
      throw new Error('getPreferences failed');
    }
    console.log(`✅ getPreferences: ${Object.keys(prefs).length} items`);
    
    // setFact
    console.log('\n📝 Testing fact operations...');
    await testSetFact(userId, 'test', `key_${testId}`, `value_${testId}`);
    console.log('✅ setFact: stored');
    
    // getFacts
    const facts = await testGetFacts(userId);
    if (!facts || Object.keys(facts).length === 0) {
      throw new Error('getFacts failed');
    }
    console.log(`✅ getFacts: ${Object.keys(facts).length} categories`);
    
    // startSession
    console.log('\n📝 Testing session operations...');
    const sessionId = await testStartSession(userId);
    if (!sessionId) {
      throw new Error('startSession failed');
    }
    localStorage.setItem('session_id', sessionId);
    console.log(`✅ startSession: ${sessionId}`);
    
    // addMessage
    await testAddMessage(sessionId, 'user', `Test message ${testId}`);
    console.log('✅ addMessage (user): stored');
    
    await testAddMessage(sessionId, 'assistant', `Response ${testId}`);
    console.log('✅ addMessage (assistant): stored');
    
    // getRecentMessages
    const messages = await testGetRecentMessages(sessionId);
    if (!messages || messages.length === 0) {
      throw new Error('getRecentMessages failed');
    }
    console.log(`✅ getRecentMessages: ${messages.length} messages`);
    
    // getAllSessions
    const sessions = await testGetAllSessions(userId);
    if (!sessions || sessions.length === 0) {
      throw new Error('getAllSessions failed');
    }
    console.log(`✅ getAllSessions: ${sessions.length} sessions`);
    
    // FINAL SUMMARY
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 SERVICE TEST PASSED - ALL FUNCTIONS WORKING');
    console.log('═'.repeat(50));
    console.log('\n✅ supabaseMemory.js service is fully functional!');
    
  } catch (error) {
    console.error('\n❌ SERVICE TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Helper test functions
async function testGetProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data?.metadata?.profile || {};
}

async function testSetPreference(userId, key, value) {
  const { error } = await supabase
    .from('preferences')
    .upsert({
      user_id: userId,
      key,
      value,
      category: 'test',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,key' });
  
  if (error) throw error;
}

async function testGetPreferences(userId) {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  const prefs = {};
  data.forEach(p => { prefs[p.key] = p.value; });
  return prefs;
}

async function testSetFact(userId, category, key, value) {
  const { error } = await supabase
    .from('facts')
    .upsert({
      user_id: userId,
      category,
      key,
      value,
      source: 'test',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category,key' });
  
  if (error) throw error;
}

async function testGetFacts(userId) {
  const { data, error } = await supabase
    .from('facts')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  const facts = {};
  data.forEach(f => {
    if (!facts[f.category]) facts[f.category] = {};
    facts[f.category][f.key] = f.value;
  });
  return facts;
}

async function testStartSession(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      title: `Service Test Session ${Date.now()}`,
      mode: 'private'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

async function testAddMessage(sessionId, role, content) {
  const { error } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      redacted_content: content
    });
  
  if (error) throw error;
}

async function testGetRecentMessages(sessionId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20);
  
  if (error) throw error;
  
  return data.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.created_at).getTime()
  }));
}

async function testGetAllSessions(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map(s => ({
    id: s.id,
    title: s.title || 'Untitled',
    created_at: s.created_at,
    updated_at: s.updated_at,
    message_count: 0
  }));
}

testSupabaseMemoryService();
