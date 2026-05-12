const fs = require('fs');
const path = require('path');

const schoolId = process.env.EXPO_PUBLIC_SCHOOL_ID;

if (!schoolId) {
  console.error('Error: EXPO_PUBLIC_SCHOOL_ID environment variable is not set.');
  process.exit(1);
}

const easIgnorePath = path.join(__dirname, '..', '.easignore');
const templatePath = path.join(__dirname, '..', '.easignore.template');

// If template doesn't exist, create it from current .easignore (first time)
if (!fs.existsSync(templatePath)) {
  fs.copyFileSync(easIgnorePath, templatePath);
}

let content = fs.readFileSync(templatePath, 'utf8');
const newContent = content.replace(/\$\{SCHOOL_ID\}/g, schoolId);

fs.writeFileSync(easIgnorePath, newContent);
console.log(`Successfully updated .easignore for school: ${schoolId}`);
