const fs = require('fs');
const path = require('path');

const schoolId = process.env.SCHOOL_ID || 'eagles';
const config = { schoolId };

fs.writeFileSync(
  path.join(__dirname, '../electron-school-config.json'),
  JSON.stringify(config, null, 2)
);

console.log(`✅ Electron runtime config generated for: ${schoolId}`);
