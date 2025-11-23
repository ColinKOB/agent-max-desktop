#!/usr/bin/env node

/**
 * Quick test for fs.write with smart extraction
 */

const path = require('path');
const os = require('os');

// Simulate the step from GPT-5
const step = {
    step_id: "step-2",
    description: "Create a file named test.txt in the determined desktop directory containing the text 'hello world'.",
    goal: "Produce the required test.txt file on the Desktop containing exactly 'hello world'.",
    tool_name: "fs.write"
};

const args = {}; // Empty args - should extract from description

// Test the extraction logic
let filePath = args.path || args.file_path || args.filename;
let content = args.content || args.text || args.data || '';

if (!filePath && step) {
    const description = step.description || step.goal || '';
    
    // Extract filename
    const filenameMatch = description.match(/(?:file|named|called)\s+([a-zA-Z0-9_-]+\.txt)/i);
    if (filenameMatch) {
        const filename = filenameMatch[1];
        const desktopPath = path.join(os.homedir(), 'Desktop');
        filePath = path.join(desktopPath, filename);
        console.log(`✅ Extracted filename: ${filename}`);
        console.log(`✅ Full path: ${filePath}`);
    }
    
    // Extract content
    const contentMatch = description.match(/(?:containing|with|text)\s+['""]?([^'""\n]+)['""]?/i);
    if (contentMatch && !content) {
        content = contentMatch[1].trim();
        console.log(`✅ Extracted content: "${content}"`);
    }
}

if (!filePath) {
    console.error('❌ Failed to extract file path');
} else if (!content && content !== '') {
    console.error('❌ Failed to extract content');
} else {
    console.log('\n✅ Extraction successful!');
    console.log(`   File: ${filePath}`);
    console.log(`   Content: "${content}"`);
    
    // Actually create the file
    const fs = require('fs').promises;
    (async () => {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`\n🎉 File created successfully!`);
            console.log(`   Check your Desktop for test.txt`);
        } catch (error) {
            console.error(`\n❌ Error creating file: ${error.message}`);
        }
    })();
}
