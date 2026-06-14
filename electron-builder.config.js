require("dotenv").config();
const schoolId = process.env.SCHOOL_ID || "eagles";

const schools = {
  afahjoy: {
    appId: "com.eduease.afahjoy",
    productName: "Gilead App",
    icon: "assets/icon-gilead.png",
  },
  beano: {
    appId: "com.saysmanage.beanoapp",
    productName: "Beano App",
    icon: "assets/icon-beano.png",
  },
  morgis: {
    appId: "com.saysmanage.morgisapp",
    productName: "Kings Kids",
    icon: "assets/icon-kings.png",
  },
  IBS: {
    appId: "com.saysmanage.jeiriver",
    productName: "IBS App",
    icon: "assets/icon-sincere.png",
  },
  perfect: {
    appId: "com.saysmanage.peiapp",
    productName: "PEI End",
    icon: "assets/icon-perfect.png",
  },
  creation: {
    appId: "com.saysmanage.creation",
    productName: "Creation Star",
    icon: "assets/icon-creation.png",
  },
  eagles: {
    appId: "com.saysmanage.eagleapp",
    productName: "Adehyeemba",
    icon: "assets/icon-aps.png",
  },
  abijah: {
    appId: "com.saysmanage.abijah",
    productName: "Abijah Adesua",
    icon: "assets/icon-abijah.png",
  },
  kent: {
    appId: "com.saysmanage.martbeck",
    productName: "World Sage",
    icon: "assets/icon-sage.png",
  },
  bishops: {
    appId: "com.saysmanage.firstapp",
    productName: "Bishop App",
    icon: "assets/icon-bishop.png",
  },
  bms: {
    appId: "com.saysmanage.bms",
    productName: "BMS App",
    icon: "assets/icon-bms.png",
  },
  model: {
    appId: "com.saysmanage.modelpower",
    productName: "Model Power",
    icon: "assets/icon-modelpower.png",
  },
  brain: {
    appId: "com.saysmanage.brain",
    productName: "Bright Brain",
    icon: "assets/icon-brain.png",
  },
  cascom: {
    appId: "com.saysmanage.cascom",
    productName: "CASCOM App",
    icon: "assets/icon-cascom.png",
  },
  clis: {
    appId: "com.saysmanage.clis",
    productName: "CLIS App",
    icon: "assets/icon-clis.png",
  },
  stone: {
    appId: "com.saysmanage.stone",
    productName: "Spring Gate",
    icon: "assets/icon-spring.png",
  },
  jewel: {
    appId: "com.saysmanage.jewel",
    productName: "Jewel App",
    icon: "assets/icon-jewel.png",
  },
};

const selected = schools[schoolId] || schools.eagles;

console.log(
  `[Electron Config] Building for: ${selected.productName} (${schoolId})`,
);

module.exports = {
  appId: selected.appId,
  productName: selected.productName,
  asar: true,
  files: [
    "dist/**/*",
    "electron-main.js",
    "preload.js",
    "package.json",
    "electron-school-config.json",
    selected.icon,
    "!node_modules/${" + "/*" + "}",
    "!app${" + "/*" + "}",
    "!backend${" + "/*" + "}",
    "!scripts${" + "/*" + "}",
    "!release${" + "/*" + "}",
    "!.github${" + "/*" + "}",
    "!android${" + "/*" + "}",
  ],
  directories: {
    buildResources: "assets",
    output: "release",
  },
  win: {
    target: ["nsis"],
    icon: selected.icon,
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
  },
  extraMetadata: {
    main: "electron-main.js",
  },
};
