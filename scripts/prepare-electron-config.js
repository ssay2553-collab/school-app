const fs = require("fs");
const path = require("path");

// Ensure a SCHOOL_ID is provided when running a production electron build
const schoolId = process.env.SCHOOL_ID;
if (!schoolId) {
  console.error("\n\u274C  SCHOOL_ID is required for electron builds.");
  console.error(
    "Run a targeted build like `npm run build:clis` or set SCHOOL_ID in your environment.",
  );
  process.exit(1);
}

const configPath = path.join(__dirname, "../electron-school-config.json");
const config = { schoolId };

try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ electron-school-config.json written for: ${schoolId}`);
} catch (e) {
  console.error("Failed to write electron-school-config.json:", e.message);
  process.exit(1);
}
