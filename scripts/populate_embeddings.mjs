#!/usr/bin/env node
/**
 * Embedding Population Script
 * 
 * Populates pgvector embeddings for existing messages and facts in Supabase
 * Features:
 * - Batch processing with progress tracking
 * - Resume capability (skips already embedded items)
 * - Error handling and retry logic
 * - Rate limiting to avoid overwhelming the system
 * - Dry-run mode for testing
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, generateEmbeddingsBatch } from '../src/services/embeddings.js';

const BATCH_SIZE = 10;  // Process 10 items at a time
const DELAY_BETWEEN_BATCHES = 2000;  // 2 second delay to avoid rate limits
const MAX_RETRIES = 3;

// Get Supabase credentials from env
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const messagesOnly = args.includes('--messages-only');
const factsOnly = args.includes('--facts-only');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retry(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      console.warn(`  ⚠️  Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

/**
 * Populate embeddings for messages
 */
async function populateMessages() {
  console.log('\n📧 Processing Messages...\n');
  
  // Fetch messages without embeddings
  let query = supabase
    .from('messages')
    .select('id, content, redacted_content, session_id, role')
    .is('embedding', null)
    .not('content', 'is', null)
    .order('created_at', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data: messages, error } = await query;
  
  if (error) {
    console.error('❌ Failed to fetch messages:', error);
    return;
  }
  
  if (!messages || messages.length === 0) {
    console.log('✅ All messages already have embeddings!');
    return;
  }
  
  console.log(`Found ${messages.length} messages without embeddings`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN - Would process:', messages.slice(0, 5).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content?.substring(0, 50) + '...'
    })));
    return;
  }
  
  let processed = 0;
  let failed = 0;
  
  // Process in batches
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messages.length / BATCH_SIZE)}...`);
    
    for (const message of batch) {
      try {
        const content = message.content || message.redacted_content || '';
        
        if (!content || content.trim().length === 0) {
          console.log(`  ⏭️  Skipping message ${message.id} (empty content)`);
          continue;
        }
        
        // Generate embedding
        const embedding = await retry(() => generateEmbedding(content));
        
        // Update in Supabase
        const { error: updateError } = await supabase
          .from('messages')
          .update({ embedding })
          .eq('id', message.id);
        
        if (updateError) {
          console.error(`  ❌ Failed to update message ${message.id}:`, updateError.message);
          failed++;
        } else {
          processed++;
          console.log(`  ✅ Message ${message.id} (${message.role})`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing message ${message.id}:`, error.message);
        failed++;
      }
    }
    
    // Progress update
    console.log(`Progress: ${processed}/${messages.length} processed, ${failed} failed`);
    
    // Delay between batches to avoid overwhelming the system
    if (i + BATCH_SIZE < messages.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`\n✅ Messages complete: ${processed} processed, ${failed} failed`);
}

/**
 * Populate embeddings for facts
 */
async function populateFacts() {
  console.log('\n📝 Processing Facts...\n');
  
  // Fetch facts without embeddings
  let query = supabase
    .from('facts')
    .select('id, category, key, value, user_id')
    .is('embedding', null)
    .order('created_at', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data: facts, error } = await query;
  
  if (error) {
    console.error('❌ Failed to fetch facts:', error);
    return;
  }
  
  if (!facts || facts.length === 0) {
    console.log('✅ All facts already have embeddings!');
    return;
  }
  
  console.log(`Found ${facts.length} facts without embeddings`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN - Would process:', facts.slice(0, 5).map(f => ({
      id: f.id,
      category: f.category,
      key: f.key,
      value: f.value?.substring(0, 50) + '...'
    })));
    return;
  }
  
  let processed = 0;
  let failed = 0;
  
  // Process in batches
  for (let i = 0; i < facts.length; i += BATCH_SIZE) {
    const batch = facts.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(facts.length / BATCH_SIZE)}...`);
    
    for (const fact of batch) {
      try {
        // Combine key and value for embedding
        const text = `${fact.key}: ${fact.value}`;
        
        if (!text || text.trim().length === 0) {
          console.log(`  ⏭️  Skipping fact ${fact.id} (empty content)`);
          continue;
        }
        
        // Generate embedding
        const embedding = await retry(() => generateEmbedding(text));
        
        // Update in Supabase
        const { error: updateError } = await supabase
          .from('facts')
          .update({ embedding })
          .eq('id', fact.id);
        
        if (updateError) {
          console.error(`  ❌ Failed to update fact ${fact.id}:`, updateError.message);
          failed++;
        } else {
          processed++;
          console.log(`  ✅ Fact ${fact.id} (${fact.category}/${fact.key})`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing fact ${fact.id}:`, error.message);
        failed++;
      }
    }
    
    // Progress update
    console.log(`Progress: ${processed}/${facts.length} processed, ${failed} failed`);
    
    // Delay between batches
    if (i + BATCH_SIZE < facts.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`\n✅ Facts complete: ${processed} processed, ${failed} failed`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Embedding Population Script\n');
  console.log('Configuration:');
  console.log(`  - Batch size: ${BATCH_SIZE}`);
  console.log(`  - Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`  - Dry run: ${dryRun ? 'Yes' : 'No'}`);
  console.log(`  - Limit: ${limit || 'None'}`);
  console.log(`  - Target: ${messagesOnly ? 'Messages only' : factsOnly ? 'Facts only' : 'Both'}\n`);
  
  const startTime = Date.now();
  
  try {
    if (!factsOnly) {
      await populateMessages();
    }
    
    if (!messagesOnly) {
      await populateFacts();
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Completed in ${duration}s`);
    
    if (dryRun) {
      console.log('\n💡 Run without --dry-run to actually populate embeddings');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Help text
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Embedding Population Script

Usage: node scripts/populate_embeddings.mjs [options]

Options:
  --dry-run           Show what would be processed without making changes
  --messages-only     Only process messages
  --facts-only        Only process facts
  --limit=N           Only process N items (for testing)
  --help, -h          Show this help message

Environment Variables:
  VITE_SUPABASE_URL      Required: Your Supabase project URL
  VITE_SUPABASE_ANON_KEY Required: Your Supabase anon key

Examples:
  # Dry run to see what would be processed
  node scripts/populate_embeddings.mjs --dry-run

  # Process only first 10 items of each type
  node scripts/populate_embeddings.mjs --limit=10

  # Process only messages
  node scripts/populate_embeddings.mjs --messages-only

  # Full run
  node scripts/populate_embeddings.mjs
  `);
  process.exit(0);
}

main();
