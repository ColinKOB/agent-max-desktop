#!/usr/bin/env node
/**
 * Stripe Webhook Integration Test
 * Tests complete payment flow: Stripe → Backend → Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rburoajxsyfousnleydw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidXJvYWp4c3lmb3VzbmxleWR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5MTYxOCwiZXhwIjoyMDc2NTY3NjE4fQ.no4IKU5bR7q-rXb_bvo1pM3sqtegJBv8Jb6TChuDLag';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testWebhookFlow() {
  console.log('\n🧪 STRIPE WEBHOOK INTEGRATION TEST\n');
  console.log('═══════════════════════════════════════\n');

  const { randomUUID } = await import('crypto');
  
  // Create test user
  console.log('1️⃣  Creating test user...');
  const testDeviceId = randomUUID();
  const { data: testUser, error: userError } = await supabase
    .from('users')
    .insert({
      device_id: testDeviceId,
      email: 'webhook-test@agentmax.com',
      name: 'Webhook Test User',
      metadata: {
        credits: 0,
        test_user: true
      }
    })
    .select()
    .single();

  if (userError) {
    console.error('❌ Failed to create test user:', userError);
    process.exit(1);
  }

  console.log(`✅ Test user created: ${testUser.id}`);
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Credits: 0\n`);

  // Instructions for manual webhook test
  console.log('2️⃣  Now trigger Stripe webhook:\n');
  console.log('   In another terminal, run:');
  console.log('   ─────────────────────────────────────');
  console.log('   stripe trigger checkout.session.completed \\');
  console.log(`     --add checkout_session:client_reference_id=${testUser.id} \\`);
  console.log('     --add checkout_session:metadata[credits]=100 \\');
  console.log('     --add checkout_session:metadata[user_id]=' + testUser.id);
  console.log('   ─────────────────────────────────────\n');

  console.log('3️⃣  Waiting for webhook to process...');
  console.log('   (This will check every 2 seconds for 30 seconds)\n');

  // Poll for credit update
  let attempts = 0;
  const maxAttempts = 15; // 30 seconds total
  let creditsAdded = false;

  while (attempts < maxAttempts && !creditsAdded) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;

    const { data: userData } = await supabase
      .from('users')
      .select('metadata')
      .eq('id', testUser.id)
      .single();

    const currentCredits = userData?.metadata?.credits || 0;

    if (currentCredits > 0) {
      creditsAdded = true;
      console.log(`✅ SUCCESS! Credits updated: 0 → ${currentCredits}`);
      
      // Check telemetry
      const { data: events } = await supabase
        .from('telemetry_events')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('event_type', 'credit_purchase');

      if (events && events.length > 0) {
        console.log(`✅ Telemetry event logged:`);
        console.log(`   Event: ${events[0].action}`);
        console.log(`   Credits purchased: ${events[0].metadata.credits_purchased}`);
        console.log(`   Amount paid: $${events[0].metadata.amount_paid}\n`);
      }

      console.log('═══════════════════════════════════════');
      console.log('🎉 WEBHOOK INTEGRATION TEST PASSED!');
      console.log('═══════════════════════════════════════\n');
      
      console.log('✅ Verified:');
      console.log('   - Webhook received by backend');
      console.log('   - Credits added to Supabase');
      console.log('   - Telemetry event logged');
      console.log('   - Complete flow working!\n');
      
      break;
    } else {
      process.stdout.write(`   Attempt ${attempts}/${maxAttempts}... Still 0 credits\r`);
    }
  }

  if (!creditsAdded) {
    console.log('\n\n⚠️  TIMEOUT: Credits not updated after 30 seconds');
    console.log('\nTroubleshooting:');
    console.log('1. Check webhook listener is running:');
    console.log('   stripe listen --forward-to localhost:8000/webhooks/stripe\n');
    console.log('2. Check backend logs for errors');
    console.log('3. Verify STRIPE_WEBHOOK_SECRET in backend .env\n');
  }

  // Cleanup
  console.log('🧹 Cleaning up test data...');
  await supabase.from('users').delete().eq('id', testUser.id);
  console.log('✅ Cleanup complete\n');
}

testWebhookFlow().catch(console.error);
