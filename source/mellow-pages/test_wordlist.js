// Test script to verify the new wordlist functionality
const fs = require('fs');

// Load the new wordlist
const words = JSON.parse(fs.readFileSync('memorable_words_full.json', 'utf8'));

console.log('Wordlist loaded successfully!');
console.log(`Total words: ${Object.keys(words).length}`);
console.log(`Max index: ${Math.max(...Object.keys(words).map(k => parseInt(k)))}`);
console.log(`Min index: ${Math.min(...Object.keys(words).map(k => parseInt(k)))}`);

// Test some entries
console.log('\nSample words:');
console.log(`Index 0: ${words[0]}`);
console.log(`Index 1000: ${words[1000]}`);
console.log(`Index 5000: ${words[5000]}`);
console.log(`Index 16383: ${words[16383]}`);

// Create reverse mapping like the app does
const reverseMap = Object.fromEntries(
    Object.entries(words).map(([k, v]) => [v.toLowerCase(), parseInt(k)])
);

console.log('\nReverse mapping test:');
console.log(`"child" maps to index: ${reverseMap['child']}`);
console.log(`"money" maps to index: ${reverseMap['money']}`);

console.log('\nWordlist validation complete!');
