
import { calculateSpeakingRate } from '../lib/audioUtils';

console.log('=== Radio SaaS Logic Verification ===');

// Test Case 1: Standard Speed
const text1 = "これはテストです。"; // 9 chars
const target1 = 9 / 5.5; // ~1.63 sec
const rate1 = calculateSpeakingRate(text1, target1);
console.log(`[Test 1] Text: "${text1}" (9 chars), Target: ${target1.toFixed(2)}s`);
console.log(`         Expected Rate: ~1.0, Actual: ${rate1}`);
if (Math.abs(rate1 - 1.0) < 0.1) console.log('✅ PASS'); else console.error('❌ FAIL');

// Test Case 2: Fast Speed (Short time for long text)
const text2 = "長い文章を短い時間で読み上げる必要があります。"; // 24 chars
const target2 = 2.0; // Very short
const rate2 = calculateSpeakingRate(text2, target2);
// Standard: 24 / 5.5 = 4.36s. Target 2.0s. Rate should be approx 2.18
console.log(`[Test 2] Text: ${text2.length} chars, Target: ${target2}s`);
console.log(`         Expected Rate: ~2.18, Actual: ${rate2}`);
if (Math.abs(rate2 - 2.18) < 0.1) console.log('✅ PASS'); else console.error('❌ FAIL');

// Test Case 3: Slow Speed (Long time for short text)
const text3 = "ゆっくり。"; // 5 chars
const target3 = 5.0;
const rate3 = calculateSpeakingRate(text3, target3);
// Standard: 5 / 5.5 = 0.9s. Target 5.0s. Rate should be 0.18 ?? 
// Wait, limit is 0.25. So verification should pass if it hits 0.25 (clamped)
console.log(`[Test 3] Text: ${text3.length} chars, Target: ${target3}s`);
console.log(`         Expected Rate: 0.25 (Clamped), Actual: ${rate3}`);
if (rate3 === 0.25) console.log('✅ PASS'); else console.error('❌ FAIL');

console.log('=== Verification Complete ===');
