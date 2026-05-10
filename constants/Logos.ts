/**
 * This file maps school IDs to their specific image assets for the In-App UI.
 */
import { SCHOOL_CONFIG } from "./Config";

export const SCHOOL_LOGOS: Record<string, any> = {
  afahjoy: require("../assets/gilead.png"),
  beano: require("../assets/beano.png"),
  morgis: require("../assets/legacy.jpg"),
  perfect: require("../assets/perfect.png"),
  bishops: require("../assets/bishop.png"),
  ibs: require("../assets/ibs.png"),
  IBS: require("../assets/ibs.png"), // Added uppercase key for consistency
  kent: require("../assets/Kent.png"),
  creation: require("../assets/creation.png"),
  eagles: require("../assets/aps.png"),
  bms: require("../assets/bms.png"),
  cascom: require("../assets/cascom.png"),
  model: require("../assets/modelpower.png"),
  brain: require("../assets/brain.png"),
  clis: require("../assets/clis.png"),
  stone: require("../assets/stone.png"),
  jewel: require("../assets/Jewel.png"),
  abijah: require("../assets/abijah.png"),
  lilies: require("../assets/abijah.png"),
};

export const getSchoolLogo = (schoolId?: string) => {
  const rawId = (schoolId || SCHOOL_CONFIG.schoolId || "eagles").toLowerCase();

  // Strip common Firebase suffixes like -93b3a if present to find the base ID
  const baseId = rawId.split('-')[0];

  // Return the specific logo, the base ID logo, or use the Eagles logo as the ultimate fallback
  return SCHOOL_LOGOS[rawId] || SCHOOL_LOGOS[baseId] || SCHOOL_LOGOS.eagles;
};
