// Test script to verify the new string-indexed wordlist functionality
const fs = require('fs');

// Load the new string-indexed wordlist
const words = JSON.parse(fs.readFileSync('memorable_words_string_indexed_full.json', 'utf8'));

console.log('String-indexed wordlist loaded successfully!');
console.log(`Total entries: ${Object.keys(words).length}`);

// Test phone number conversion simulation
function testPhoneToWords(phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    console.log(`\nTesting phone number: ${phoneNumber} (digits: ${digits})`);
    
    // Simulate the splitting logic
    let part1, part2, part3;
    if (digits.length <= 9) {
        const segmentLength = Math.ceil(digits.length / 3);
        part1 = digits.substring(0, segmentLength);
        part2 = digits.substring(segmentLength, segmentLength * 2);
        part3 = digits.substring(segmentLength * 2);
    } else {
        part1 = digits.substring(0, 3);
        part2 = digits.substring(3, digits.length - 3);
        part3 = digits.substring(digits.length - 3);
    }
    
    console.log(`Parts: "${part1}", "${part2}", "${part3}"`);
    
    const word1 = words[part1] || words[part1.padStart(4, '0')] || 'unknown';
    const word2 = words[part2] || words[part2.padStart(4, '0')] || 'unknown';
    const word3 = words[part3] || words[part3.padStart(4, '0')] || 'unknown';
    
    console.log(`Words: ${word1}, ${word2}, ${word3}`);
    
    return [word1, word2, word3];
}

// Test some phone numbers
testPhoneToWords('5551234567');
testPhoneToWords('+442079460958');
testPhoneToWords('8881234');
testPhoneToWords('+17041234567');

console.log('\nString-indexed conversion test complete!');
