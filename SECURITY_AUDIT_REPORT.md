#!/usr/bin/env node
/**
 * Security Fix Script - Remove Hardcoded Secrets
 * 
 * This script removes hardcoded secrets from test files and replaces them with environment variables.
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 SECURITY FIX: Removing hardcoded secrets from test files...\n');

const filesToFix = [
  'tests/test-supabase-integration.js',
  'tests/test-complete-integration.js',
  'tests/test-stripe-webhook.js', 
  'tests/test-credit-deduction.js',
  'tests/test-supabase-comprehensive.js'
];

const serviceKeyPattern = /const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[^']+';/g;
const anonKeyPattern = /const supabaseKey = process\.env\.VITE_SUPABASE_ANON_KEY \|\| 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[^']+';/g;

const replacementServiceKey = "const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || 'test-service-key';";
const replacementAnonKey = "const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';";

let fixedFiles = 0;

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Replace service keys
  if (serviceKeyPattern.test(content)) {
    content = content.replace(serviceKeyPattern, replacementServiceKey);
    modified = true;
    console.log(`✅ Fixed service key in: ${filePath}`);
  }
  
  // Replace anon keys  
  if (anonKeyPattern.test(content)) {
    content = content.replace(anonKeyPattern, replacementAnonKey);
    modified = true;
    console.log(`✅ Fixed anon key in: ${filePath}`);
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    fixedFiles++;
  }
});

console.log(`\n🎉 Security fix complete! Fixed ${fixedFiles} files.`);
console.log('\n📋 NEXT STEPS:');
console.log('1. Add VITE_SUPABASE_SERVICE_KEY to your .env file');
console.log('2. Use test keys for development, production keys for production');
console.log('3. Never commit real secrets to version control');
