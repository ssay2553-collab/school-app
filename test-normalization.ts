import { normalizeClassLevel, getNaCCAStrands } from './constants/Curriculum';

console.log('Testing normalizeClassLevel:');
console.log('basic-1 ->', normalizeClassLevel('basic-1'));
console.log('BASIC 1 ->', normalizeClassLevel('BASIC 1'));
console.log('basic 1 ->', normalizeClassLevel('basic 1'));
console.log('JHS-2 ->', normalizeClassLevel('JHS-2'));

console.log('\nTesting getNaCCAStrands with normalization:');
// Assuming "Mathematics" and "Basic 1" exist in your data
const strands = getNaCCAStrands('Mathematics', 'basic-1');
console.log('Strands for Mathematics (basic-1):', strands);
