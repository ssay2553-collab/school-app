/**
 * This file maps school IDs to their specific signature assets for reports.
 * These are the default signatures used when no individual admin/teacher signature is provided.
 */
import { SCHOOL_CONFIG } from "./Config";

export const SCHOOL_SIGNATURES: Record<string, any> = {
  afahjoy: require("../assets/signatures/afahjoy.png"),
  beano: require("../assets/signatures/beano.png"),
  morgis: require("../assets/signatures/morgis.png"),
  perfect: require("../assets/signatures/perfect.png"),
  bishops: require("../assets/signatures/bishops.png"),
  ibs: require("../assets/signatures/ibs.png"),
  kent: require("../assets/signatures/kent.png"),
  creation: require("../assets/signatures/creation.png"),
  eagles: require("../assets/signatures/eagles.png"),
  bms: require("../assets/signatures/bms.png"),
  cascom: require("../assets/signatures/cascom.png"),
  model: require("../assets/signatures/model.png"),
  brain: require("../assets/signatures/brain.png"),
  clis: require("../assets/signatures/clis.png"),
  stone: require("../assets/signatures/josepac.png"),
  jewel: require("../assets/signatures/jewel.png"),
  abijah: require("../assets/signatures/abijah.png"),
  sincere: require("../assets/signatures/eagles.png"),
  spring: require("../assets/signatures/eagles.png"),
  josepac: require("../assets/signatures/josepac.png"),
  advent: require("../assets/signatures/advent.png"),
  bishop: require("../assets/signatures/bishops.png"),
  gilead: require("../assets/signatures/afahjoy.png"),
};

export const getSchoolSignature = (schoolId?: string) => {
  const rawId = (schoolId || SCHOOL_CONFIG.schoolId || "eagles").toLowerCase();
  const baseId = rawId.split("-")[0];
  return SCHOOL_SIGNATURES[rawId] || SCHOOL_SIGNATURES[baseId] || SCHOOL_SIGNATURES.eagles;
};
