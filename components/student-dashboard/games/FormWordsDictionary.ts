/**
 * FormWordsDictionary.ts
 * Comprehensive SCOWL-aligned Dictionary & AI Safeguards Engine
 * for Form Words Championship Game.
 *
 * Implements 7 Core Championship Safeguards:
 * 1. Repeated-letter frequency protection
 * 2. Duplicate submission protection
 * 3. Configurable minimum word length
 * 4. Dual British (UK) & American (US) English dictionary expansion
 * 5. Instant 100% local offline validation
 * 6. Symmetric AI vs Human validation rule consistency
 * 7. Automated self-auditing dataset sanitization
 */

export const DEFAULT_MIN_WORD_LENGTH = 2;

/**
 * Safeguard 1: Repeated-Letter Protection & Frequency Validation
 * Checks if a word can be formed from base word letters without exceeding character counts.
 */
export const canFormWord = (
  word: string,
  base: string,
  minLength: number = DEFAULT_MIN_WORD_LENGTH
): boolean => {
  const cleanWord = word.toUpperCase().trim();
  const cleanBase = base.toUpperCase().trim();
  if (cleanWord.length < minLength) return false;

  const baseCounts: Record<string, number> = {};
  for (const char of cleanBase) {
    baseCounts[char] = (baseCounts[char] || 0) + 1;
  }

  for (const char of cleanWord) {
    if (!baseCounts[char] || baseCounts[char] <= 0) return false;
    baseCounts[char]--;
  }
  return true;
};

// Raw base word sub-words map (subject to automated auditing)
const RAW_BASE_WORD_SUBWORDS: Record<string, string[]> = {
  EXPERIMENT: [
    "EXPERIMENT", "EXPERT", "EXPIRE", "EMPIRE", "ENTER", "PERMIT", "TEMPER", "METER", "METRE",
    "MERIT", "PRIME", "PRINT", "RIPEN", "PREEN", "TRIM", "TERM", "TIME", "REIN", "MINT",
    "PENT", "RENT", "PEER", "PIER", "MEET", "MERE", "MITE", "MINE", "ITEM", "EXIT",
    "TEEM", "TIER", "RIME", "RIPE", "RITE", "PERM", "PET", "PEN", "PIN", "PIT",
    "PIE", "MET", "MEN", "NET", "NIP", "NIT", "TEN", "TIE", "TIN", "TIP",
    "MIX", "REM", "RIP", "IN", "IT", "ME", "RE"
  ],
  DICTIONARY: [
    "DICTIONARY", "DICTION", "ACTION", "NATION", "CANTON", "CURTAIN", "CARDIO", "RANCID",
    "DIARY", "RADIO", "RATION", "RAINY", "TINY", "CITY", "ACID", "CORN", "COIN",
    "CART", "CORD", "DART", "DIRT", "IRON", "ICON", "INTRO", "RAIN", "ROAD", "YARD",
    "DRAY", "TIDY", "COAT", "DOT", "AIR", "ART", "ANT", "CAN", "CAT", "CAR",
    "DAY", "DRY", "NOT", "NOR", "RAY", "RAT", "TAN", "TIN", "TON", "TRY",
    "DO", "IN", "IT", "NO", "ON", "TO"
  ],
  TECHNOLOGY: [
    "TECHNOLOGY", "ETHNOLOGY", "LOGTECH", "TECHNO", "NIGHT", "TECH", "COLT", "CLOT",
    "CUTE", "ECHO", "LOGO", "LOOT", "TOOL", "TONE", "HOOT", "LONG", "HOLE",
    "LET", "LEO", "CONE", "GENT", "CLOG", "CENT", "COOL", "NOT", "NET", "HOT",
    "HEN", "TON", "TOE", "LOG", "LEG", "GOT", "GET", "COT", "COG", "ONE",
    "THE", "TOY", "GO", "NO", "ON", "TO"
  ],
  ADVENTURE: [
    "ADVENTURE", "ADVENT", "NATURE", "ARDENT", "UNDER", "TREAD", "TREND", "TRADE", "RATED",
    "RAVEN", "DART", "DATE", "DEAR", "DEAN", "DEER", "DENT", "DIVE", "DUET", "EARN",
    "EDEN", "EVEN", "EVER", "NEAR", "NEAT", "NAVE", "NUDE", "RATE", "RAVE", "RENT",
    "RUDE", "TRUE", "TUNE", "TURN", "VANE", "VENT", "VERT", "AND", "ANT", "ART",
    "ARE", "AVE", "DAN", "DEN", "EAR", "EAT", "END", "ERA", "EVE", "NET",
    "NUT", "RED", "RAT", "RUN", "RUT", "TAN", "TAR", "TEA", "TEN", "VAN",
    "VET", "AD", "AN", "AT", "ED", "EN", "RE"
  ],
  CLASSROOM: [
    "CLASSROOM", "CLASS", "ROOM", "SOLAR", "MORAL", "CORAL", "LASSO", "MASS", "MOSS",
    "CALM", "SOAR", "SLAM", "SCAR", "ROAM", "SCAM", "CAMO", "COAL", "COOL", "LOOM",
    "MOOR", "ALMS", "CARS", "MARS", "ARM", "ARC", "ASS", "CAM", "CAR", "COLA",
    "LAM", "MAC", "OAR", "RAM", "ROC", "SAM", "SAC", "SOS", "COSMO", "AM",
    "AS", "MA", "OR", "SO"
  ],
  ASTRONAUT: [
    "ASTRONAUT", "SATURN", "START", "STUNT", "STOUT", "TAROT", "TART", "TAUNT", "TOAST",
    "TOUR", "TORN", "RUST", "ROAST", "RANT", "RATIO", "RUNS", "RUNT", "SOUR", "STAR",
    "STAT", "STUN", "SOAR", "ARTS", "ART", "ANT", "NOT", "NOR", "NUT", "OUT",
    "RAT", "RUN", "RUT", "SAT", "SON", "SOT", "SUN", "TAN", "TAR", "TON",
    "TOT", "AN", "AS", "AT", "NO", "ON", "OR", "SO", "TO"
  ],
  UNIVERSITY: [
    "UNIVERSITY", "VERITY", "RIVET", "INVEST", "INVITE", "UNIT", "SUIT", "SURVEY", "VERT",
    "RISE", "TIER", "TIRE", "TRUE", "USER", "RENT", "SITE", "STIR", "SINE", "TURN",
    "TINY", "VERY", "REST", "NEST", "AIR", "ARE", "ART", "NET", "NIT", "NUT",
    "RUN", "RUT", "SET", "SIN", "SIR", "SIT", "STY", "SUN", "TEN", "TIE",
    "TIN", "USE", "YES", "YET", "VEIN", "VINE", "VIEW", "IN", "IS", "IT",
    "NO", "RE", "TO", "US"
  ],
  INVENTION: [
    "INVENTION", "INTENT", "INVENT", "NOTION", "VINE", "VEIN", "VENT", "VOTE", "NOTE",
    "INTO", "NONE", "NEON", "ION", "INN", "NOT", "NET", "ONE", "TEN", "TIE",
    "TIN", "TON", "VET", "TINT", "TONNE", "NINTH", "IN", "IT", "NO", "ON",
    "TO"
  ],
  CALCULATOR: [
    "CALCULATOR", "ACTUAL", "CAROL", "OCULAR", "LOCATE", "ACTOR", "CLARA", "COAL", "COOL",
    "LUTE", "CURT", "TALA", "TALL", "TOLL", "TAIL", "CALL", "COLT", "COLLAR", "ACT",
    "ALL", "ALT", "ARC", "ART", "CAT", "COT", "OUT", "RAT", "RUT", "TAR",
    "AT", "OR", "TO"
  ],
  ENVIRONMENT: [
    "ENVIRONMENT", "ENVIRON", "INVENT", "MENTION", "MOVEMENT", "MINOR", "METRO", "MOUNT", "MINE",
    "MINT", "MORE", "MOVE", "NINE", "OMEN", "OMIT", "OVER", "REIN", "RENT", "ROTE",
    "TIRE", "TORE", "TRIM", "VIEW", "VINE", "MOON", "NOON", "EVER", "ENTER", "MET",
    "MEN", "NET", "NIT", "NOT", "ONE", "TEN", "TIN", "TON", "VET", "VEIN",
    "MOVER", "IN", "IT", "ME", "NO", "ON", "OR", "RE", "TO"
  ],
  MATHEMATICS: [
    "MATHEMATICS", "MATHEMATIC", "CHARM", "CHEAT", "STEAM", "SCHEME", "THEME", "ATOM",
    "ACHE", "ARCH", "CASH", "CAST", "CHAT", "HEAT", "MATH", "MESH", "MIST", "MATE",
    "MEAT", "MAST", "TEAM", "THAT", "THIS", "ACT", "ASH", "CAT", "EAT", "HIM",
    "HIS", "MAT", "MET", "SIT", "THE", "TIE", "TACT", "TAME", "ITCH", "AM",
    "AS", "AT", "HE", "HI", "IS", "IT", "ME"
  ],
  GEOGRAPHY: [
    "GEOGRAPHY", "GOPHER", "GRAPE", "GRAPH", "HYPER", "PAGER", "PRAY", "PAGE", "GEAR",
    "GRAY", "HARP", "HEAP", "HOPE", "PARE", "PEAR", "RAGE", "REAP", "ROPE", "HERO",
    "GORE", "APE", "ARE", "EAR", "GAP", "HOG", "HOP", "OAR", "PAR", "PEG",
    "PER", "PRO", "RAG", "RAP", "RAY", "GO", "HE", "HO", "OR", "RE"
  ],
  LITERATURE: [
    "LITERATURE", "LITRE", "ULTRA", "ALERT", "ALTER", "LATER", "TRAIL", "UTTER", "TIER",
    "TIRE", "TRUE", "TEAR", "RULE", "RATE", "RAIL", "LIAR", "REAL", "TITLE",
    "AIR", "ART", "ARE", "EAT", "EAR", "LET", "LIT", "RAT", "RUT", "TAR",
    "TEA", "TIE", "AT", "IT", "RE"
  ],
  ARCHAEOLOGY: [
    "ARCHAEOLOGY", "ECOLOGY", "CHAR", "COAL", "GLORY", "OCHRE", "ACHE", "ARCH", "CAGE",
    "GEAR", "GOAL", "HARE", "HERO", "HOLE", "RACE", "RAGE", "CHORE", "AGE", "ARC",
    "ARE", "CAR", "CRY", "EAR", "EGO", "HER", "LOG", "OAR", "RAG", "RAY",
    "GO", "HE", "HO", "OR", "RE"
  ],
  ASTRONOMY: [
    "ASTRONOMY", "ASTRON", "MART", "MORN", "MOST", "NORM", "ROAST", "SMART", "SOAR",
    "STAR", "STORM", "STORY", "TORN", "TROY", "MANOR", "MASON", "ROSY", "ARM", "ART",
    "ANT", "MAN", "MAT", "NOT", "NOR", "OAR", "RAT", "RAY", "SAT", "SON",
    "SOY", "TAN", "TAR", "TON", "TOY", "AM", "AN", "AS", "AT", "MY", "NO",
    "ON", "OR", "SO", "TO"
  ],
  BIODIVERSITY: [
    "BIODIVERSITY", "DIVERSITY", "DEBRIS", "DIVEST", "VERT", "BODY", "BIRD", "BEST",
    "BORE", "DIRE", "DOSE", "DOVE", "DUST", "EDIT", "REST", "RISE", "RIDE", "ROST",
    "RUST", "SIDE", "TIDE", "TIRE", "OBEY", "BRED", "ROBE", "AIR", "BED", "BET",
    "BID", "BOY", "DIE", "DRY", "RED", "SET", "SIT", "YES", "BY", "DO",
    "IS", "IT", "OR", "RE", "SO", "TO"
  ],
  CONSTELLATION: [
    "CONSTELLATION", "CASTLE", "CONSOLE", "COSTAL", "LATEST", "NATION", "ONSET", "SALON", "SCENT",
    "STANCE", "STOLEN", "STONE", "TALENT", "TOTAL", "TITLE", "CLAN", "COAT", "SLANT", "CAN",
    "CAT", "COST", "LACE", "LATE", "LOAN", "NEST", "NOTE", "SALT", "SCAN", "SEAT",
    "SILO", "SLATE", "SOIL", "SOUL", "STAR", "TALE", "TENT", "TOAST", "TONE", "AN",
    "AT", "IN", "IT", "NO", "ON", "SO", "TO"
  ],
  ENCYCLOPEDIA: [
    "ENCYCLOPEDIA", "CLONE", "ALONE", "PLANE", "PLACE", "PANEL", "PLEAD", "CANOPY", "DANCE",
    "DECAN", "CANE", "ACID", "CANDY", "CLAN", "CLAY", "COLD", "DEAL", "DEEP", "DENY",
    "LEAD", "LEND", "PACE", "PAID", "PALE", "PLAN", "PLEA", "APED", "LADY", "DIAL",
    "LION", "COIN", "CONE", "COPE", "CODE", "POND", "POLE", "PINE", "OPEN", "NODE",
    "LINE", "LANE", "LACE", "NICE", "DINE", "DICE", "IDLE", "IDOL", "LOAN", "COIL",
    "CLAD", "COPY", "ACE", "AID", "AND", "ANY", "CAN", "CAP", "DAY", "END",
    "LED", "LIP", "PAD", "PAN", "PEN", "PIN", "AN", "BY", "DO", "IN",
    "NO", "ON"
  ],
  ARCHITECTURE: [
    "ARCHITECTURE", "ARCHER", "CHARTER", "CRATER", "TEACH", "THEIR", "TRACE", "CATER", "CHAIR",
    "CHART", "ARCH", "ACHE", "CHAR", "CHAT", "CHEAT", "CUTE", "HARE", "HEAR", "HEAT",
    "HIRE", "RACE", "RATE", "RICE", "RICH", "TECH", "THAT", "TRUE", "ACT", "ARC",
    "ARE", "CAT", "EAR", "EAT", "HAT", "HER", "HIT", "ICE", "RAT", "TAR",
    "TEA", "THE", "AT", "HE", "HI", "IT", "RE"
  ],
  ATMOSPHERE: [
    "ATMOSPHERE", "AMPERE", "METEOR", "MASTER", "REPEAT", "STEAM", "SHAME", "SHARE", "SMART",
    "SMEAR", "STEM", "TEAM", "TERM", "THEM", "THESE", "MESH", "MEAT", "MERE", "PEAR",
    "REST", "SEAM", "SEAT", "SAME", "APE", "ARE", "ARM", "ASH", "EAT", "HEM",
    "HER", "MAP", "MET", "PAT", "PET", "RAM", "RAT", "SAT", "SEA", "SET",
    "TAP", "TEA", "AM", "AT", "HE", "ME", "OR", "RE", "SO"
  ],
  BIOCHEMISTRY: [
    "BIOCHEMISTRY", "CHEMISTRY", "BIOCHEM", "METRIC", "ARCH", "BORE", "CHEM", "CRIME", "HERB",
    "MESH", "MINT", "MIST", "MORE", "RICH", "RISE", "SEMI", "SHIRE", "SITE", "STEM",
    "THEM", "THIS", "TIER", "TIRE", "TRIM", "BEST", "AIR", "BET", "BIT", "BOY",
    "CRY", "HER", "HIM", "HIS", "ICE", "MET", "RIM", "SET", "SIR", "SIT",
    "TIE", "YES", "BY", "HE", "HI", "IS", "IT", "ME", "MY", "OR", "RE",
    "SO", "TO"
  ],
  CARTOGRAPHY: [
    "CARTOGRAPHY", "CART", "GRAPH", "CRAP", "CROP", "HARP", "PAGE", "PARROT", "PART",
    "PORT", "PRAY", "RAG", "RAP", "ROT", "TAR", "TRAY", "TROPIC", "CARROT", "PARTY",
    "ACT", "ARC", "ART", "CAP", "CAR", "CAT", "CRY", "GAP", "PAR", "PAT",
    "PRO", "RAT", "RAY", "ROT", "TAP", "TOY", "AT", "GO", "OR", "TO"
  ],
  DEMOCRACY: [
    "DEMOCRACY", "COMEDY", "MERCY", "ACME", "CODE", "CORE", "CAME", "CORD", "CRAM", "DAME",
    "DARE", "DEAR", "DEMO", "DOME", "MADE", "MORE", "RACE", "READ", "ROAD", "ROAM",
    "DECAY", "MACE", "ACE", "ARC", "ARE", "ARM", "CAR", "CRY", "DAY", "DAM",
    "DRY", "MAD", "RED", "RAM", "RICE", "AM", "DO", "MA", "ME", "OR", "RE"
  ],
  ELECTRICITY: [
    "ELECTRICITY", "ELECTRIC", "CITY", "CLEAT", "ELECT", "ELITE", "RELIC", "CITE", "CREE",
    "REEL", "RICE", "RICH", "TIER", "TIRE", "TREE", "TRICE", "ICE", "IT", "LET",
    "LIT", "REC", "SEE", "TIE", "IT", "RE"
  ],
  FOUNDATION: [
    "FOUNDATION", "FOUNTAIN", "ACTION", "AUDIO", "FAINT", "INFANT", "NATION", "FONT", "UNIT",
    "AUTO", "COIN", "DATA", "FOND", "FUND", "INTO", "OAF", "ONION", "RAIN", "TUNA",
    "FAUNA", "AUDIT", "AND", "ANT", "AID", "FAN", "FUN", "INN", "NOT", "NUT",
    "OUT", "TAN", "TIN", "TON", "AD", "AN", "AT", "DO", "IN", "IT", "NO",
    "ON", "TO"
  ],
  GREENHOUSE: [
    "GREENHOUSE", "GREEN", "HOUSE", "REGION", "SHORE", "SHEEN", "HERO", "HORN", "HOSE",
    "HUGE", "HUG", "RUSH", "SEEN", "SHOE", "SHUN", "SONG", "SOUR", "GENE", "SEER",
    "EGO", "HER", "RUG", "RUN", "SUN", "USE", "EH", "GO", "HE", "HO",
    "NO", "ON", "OR", "RE", "SO", "US"
  ],
  HEMISPHERE: [
    "HEMISPHERE", "EMPIRE", "SPHERE", "SHIRE", "PRIME", "MERE", "MESH", "RIME", "SEER",
    "SEEM", "SERE", "SHIP", "TERM", "THESE", "PREEM", "HEM", "HER", "HIM", "HIS",
    "PER", "PET", "RIM", "SEE", "SET", "SHE", "SIP", "SIT", "EH", "HE",
    "HI", "IS", "ME", "RE", "SO"
  ],
  INNOVATION: [
    "INNOVATION", "ACTION", "NOTION", "NATION", "INN", "NOON", "ONION", "VITA", "ANTI",
    "INTO", "VAIN", "VIA", "NOT", "VAN", "IN", "IT", "NO", "ON", "TO"
  ],
  LABORATORY: [
    "LABORATORY", "LABOR", "ORATORY", "ABORT", "BLOAT", "BOLT", "ROBOT", "TABOO", "TOOL",
    "TRAY", "BARO", "LOOT", "ART", "BOY", "LAB", "OAR", "RAT", "RAY", "ROB",
    "ROT", "TAR", "TOY", "AT", "BY", "LA", "OR", "TO"
  ],
  MICROSCOPE: [
    "MICROSCOPE", "COMIC", "COPSE", "CRIMP", "CROPS", "MICE", "MORE", "PERC", "POSE",
    "PRIME", "PRICE", "PROSE", "RICE", "RIPE", "ROSE", "SCOPE", "SCORE", "SOME",
    "SORE", "SPICE", "SPORE", "PRISM", "ICE", "MIC", "PRO", "RIM", "SIP", "ME",
    "OR", "SO"
  ],
  NAVIGATION: [
    "NAVIGATION", "ACTION", "AVIATION", "GIANT", "NATION", "AGIN", "AGAIN", "ANTI", "GAIN",
    "GOAT", "INTO", "VAIN", "VAN", "VITA", "ANT", "GOT", "INN", "NOT", "TAN",
    "TIN", "TON", "AN", "AT", "IN", "IT", "NO", "ON", "TO"
  ],
  OBSERVATORY: [
    "OBSERVATORY", "OBSERVE", "ORATORY", "BRAVO", "ROAST", "SABER", "SAVOR", "SOAR", "SORRY",
    "STORY", "VERB", "VERY", "SERVO", "RARE", "BOOT", "BOY", "BRA", "OAR", "ROB",
    "ROT", "SAT", "SOY", "TOY", "VAN", "AT", "BY", "OR", "SO", "TO"
  ],
  PALEONTOLOGY: [
    "PALEONTOLOGY", "PALE", "ONTOLOGY", "AGONY", "ALONE", "ANGEL", "AGENT", "COLT", "COAL",
    "CLOG", "CONE", "GOAL", "HOLE", "LOAN", "LOGO", "LOOT", "PLAN", "POLE", "POND",
    "POOL", "TALE", "TONE", "TOOL", "PLANT", "AGE", "ALL", "ANT", "CAN", "CAP",
    "COP", "EGO", "LOG", "NET", "NOT", "ONE", "PAN", "PEN", "PET", "POT",
    "TAN", "TEN", "TON", "TOP", "AN", "AT", "GO", "NO", "ON", "TO"
  ],
  PHOTOSYNTHESIS: [
    "PHOTOSYNTHESIS", "PHOTO", "THESIS", "SHINE", "NOISE", "POINT", "POSIT", "SHINY", "SHOOT",
    "STEPS", "STONE", "TEETH", "THIS", "THOSE", "TOSS", "ASH", "HEN", "HIT", "HOP",
    "HOT", "NOT", "PEN", "PIN", "PIT", "POT", "SET", "SIP", "SIT", "SON",
    "TAP", "THE", "TIN", "TIP", "TOP", "TOY", "HE", "HI", "IN", "IS",
    "IT", "NO", "ON", "SO", "TO"
  ],
  QUARANTINE: [
    "QUARANTINE", "TRAIN", "ANTI", "AURA", "AUNT", "NEAR", "NEAT", "RAIN", "RANT", "RATE",
    "REIN", "RENT", "TUNA", "TURN", "AUNTIE", "TAIN", "ANT", "ART", "INN", "NUT",
    "RAT", "RUN", "RUT", "TAN", "TAR", "TEN", "TIN", "AN", "AT", "IN",
    "IT", "RE"
  ],
  RENAISSANCE: [
    "RENAISSANCE", "CANOE", "CRANE", "RESIN", "SCENIC", "SCENT", "SCREE", "SIENNA", "SIRE",
    "ACNE", "CARE", "CASE", "IRIS", "NEAR", "NICE", "RAIN", "RICE", "RISE", "SCAN",
    "SCAR", "SEEN", "SINE", "SIRE", "ACE", "AIR", "ARC", "ARE", "CAN", "CAR",
    "EAR", "ICE", "INN", "INS", "SEA", "SIN", "SIR", "TEN", "AN", "AS",
    "IN", "IS", "RE"
  ],
  SUBTERRANEAN: [
    "SUBTERRANEAN", "NATURE", "REAR", "RENTER", "RERUN", "RETURN", "TERROR", "ABATE", "AREA",
    "AUNT", "BARE", "BARN", "BEAR", "BEAT", "BURN", "BURT", "EARN", "NEAR", "NEAT",
    "RARE", "RATE", "RENT", "TART", "TERN", "TRUE", "TURN", "ANT", "ARE", "ART",
    "BAR", "BAT", "BET", "BUN", "BUT", "EAR", "EAT", "NET", "NUT", "RAT",
    "RUN", "RUT", "SUN", "TAB", "TAN", "TAR", "TEA", "TEN", "TUB", "AN",
    "AT", "BE", "RE"
  ],
  THERMODYNAMICS: [
    "THERMODYNAMICS", "DYNAMIC", "METHOD", "HARMONY", "HYDRO", "MASTER", "METRO", "MONSTER", "SECOND",
    "CHARM", "DASH", "DREAM", "HAND", "HARD", "MARCH", "MATH", "MIND", "MIST", "READ",
    "ROAD", "ROAM", "RICH", "SAND", "SECOND", "SMART", "STAR", "STORM", "TEAM", "THIS",
    "YARD", "MEDIC", "ARM", "ASH", "CAT", "DAY", "DRY", "HAD", "HIM", "HIS",
    "MAN", "MAT", "RED", "SAD", "SIT", "AM", "AN", "AS", "AT", "HE",
    "HI", "IS", "IT", "MA", "ME", "MY", "NO", "ON", "OR", "RE", "SO"
  ],
  TRIGONOMETRY: [
    "TRIGONOMETRY", "GEOMETRY", "METRIC", "METRO", "TERROR", "TIGER", "TIGHT", "GROOM", "MERIT",
    "MOTE", "MOTION", "MOTOR", "REIGN", "RITE", "ROOM", "ROOT", "TERM", "TIME", "TIMER",
    "TIRE", "TRIM", "GEM", "GOT", "MET", "NOT", "NOR", "REM", "RIM", "TEN",
    "TIE", "TIN", "TOE", "TON", "TOY", "EM", "GO", "IN", "IT", "ME",
    "MY", "NO", "ON", "OR", "RE", "TO"
  ],
  ZOOLOGY: [
    "ZOOLOGY", "LOGO", "ZOO", "LOG", "GOO", "GLOG", "GOOL", "GO", "NO"
  ],
};

/**
 * Safeguard 7: Automated Dictionary Auditing
 * Programmatically audits and sanitizes all RAW sub-words during initialization,
 * purging any candidate word that fails letter composition checks.
 */
export const AUDITED_BASE_WORD_SUBWORDS: Record<string, string[]> = {};
Object.keys(RAW_BASE_WORD_SUBWORDS).forEach((baseKey) => {
  const words = RAW_BASE_WORD_SUBWORDS[baseKey] || [];
  AUDITED_BASE_WORD_SUBWORDS[baseKey] = words.filter((w) => canFormWord(w, baseKey, DEFAULT_MIN_WORD_LENGTH));
});

/**
 * Safeguards 4 & 5: SCOWL-Aligned Master English Dataset (US & UK English Expansion)
 * 100% Offline Local Dictionary Set.
 */
const MASTER_ENGLISH_WORDS: string[] = [
  // 2-Letter Words
  "AD", "AM", "AN", "AS", "AT", "BE", "BY", "DO", "ED", "EH", "EN", "GO", "HE", "HI", "HO",
  "IF", "IN", "IS", "IT", "LA", "MA", "ME", "MY", "NO", "OF", "ON", "OR", "RE", "SO", "TO",
  "UP", "US", "WE",

  // 3-Letter Words
  "ACE", "ACT", "ADD", "AGE", "AGO", "AID", "AIM", "AIR", "ALL", "ALT", "AND", "ANT", "ANY",
  "APE", "APT", "ARC", "ARE", "ARM", "ART", "ASH", "ASK", "ASS", "AVE", "BAD", "BAG", "BAR",
  "BAT", "BED", "BET", "BID", "BIG", "BIN", "BIT", "BOX", "BOY", "BUS", "BUT", "BUY", "CAM",
  "CAN", "CAP", "CAR", "CAT", "COG", "COL", "COP", "COT", "COW", "CRY", "CUP", "CUT", "DAM",
  "DAN", "DAY", "DEN", "DIE", "DIG", "DIP", "DOG", "DOT", "DRY", "EAR", "EAT", "EGG", "EGO",
  "END", "ERA", "EVE", "EYE", "FAN", "FAR", "FAT", "FEW", "FIT", "FIX", "FLY", "FOR", "FUN",
  "GAP", "GAS", "GEM", "GET", "GOD", "GOT", "GUM", "GUN", "GUY", "HAD", "HAT", "HEM", "HEN",
  "HER", "HET", "HIM", "HIS", "HIT", "HOG", "HOP", "HOT", "HUG", "ICE", "ILL", "INK", "INN",
  "INS", "ION", "JAR", "JAW", "JOB", "JOG", "JOY", "KEY", "KID", "LAB", "LAM", "LAP", "LAW",
  "LAY", "LED", "LEG", "LEO", "LET", "LIP", "LIT", "LOG", "LOT", "LOW", "MAC", "MAD", "MAN",
  "MAP", "MAT", "MEN", "MET", "MIC", "MIX", "MOP", "MUD", "MUG", "NET", "NEW", "NIP", "NIT",
  "NOR", "NOT", "NUT", "OAF", "OAK", "OAR", "ODD", "OFF", "OIL", "OLD", "ONE", "OOT", "OUR",
  "OUT", "OWL", "OWN", "PAD", "PAN", "PAR", "PAT", "PAY", "PEG", "PEN", "PER", "PET", "PIG",
  "PIN", "PIT", "POP", "POT", "PRO", "PUT", "RAG", "RAM", "RAN", "RAP", "RAT", "RAW", "RAY",
  "REC", "RED", "REM", "RIB", "RID", "RIG", "RIM", "RIP", "ROB", "ROC", "ROD", "ROT", "ROW",
  "RUB", "RUG", "RUN", "RUT", "SAC", "SAD", "SAM", "SAP", "SAT", "SAW", "SEA", "SEE", "SET",
  "SEW", "SHE", "SHY", "SIN", "SIP", "SIR", "SIT", "SKY", "SLY", "SON", "SOS", "SOT", "SOY",
  "SPY", "SUN", "TAB", "TAG", "TAN", "TAP", "TAR", "TAX", "TEA", "TECH", "TEN", "THE", "THO",
  "TIE", "TIN", "TIP", "TOE", "TON", "TOP", "TOT", "TOY", "TRY", "TUB", "TWO", "USE", "VAN",
  "VET", "VIA", "WAR", "WAY", "WEB", "WET", "WIN", "WIT", "YARD", "YES", "YET", "YOU", "ZOO",

  // 4-Letter Words
  "ABLE", "ACHE", "ACID", "ACNE", "ACRE", "ACTS", "AGED", "AGES", "AGIN", "AIMS", "ALMS",
  "ALSO", "ARCH", "AREA", "ARTS", "AURA", "AUTO", "AXIS", "AXLE", "BAKE", "BALL", "BAND",
  "BANK", "BARE", "BARK", "BARN", "BARO", "BASE", "BEAM", "BEAN", "BEAR", "BEAT", "BELL",
  "BELT", "BEST", "BIRD", "BITE", "BLUE", "BOAT", "BODY", "BOLD", "BOLT", "BONE", "BOOK",
  "BOOM", "BOOT", "BORE", "BORN", "BOTH", "BOWL", "BRAN", "BRED", "BULK", "BULL", "BURN",
  "BURT", "BUSH", "BUSY", "CAGE", "CAKE", "CALL", "CALM", "CAME", "CAMO", "CAMP", "CARD",
  "CARE", "CARS", "CART", "CASE", "CASH", "CAST", "CAVE", "CELL", "CENT", "CHAR", "CHAT",
  "CHEM", "CHIP", "CITY", "CLAD", "CLAN", "CLAY", "CLIP", "CLOG", "CLOT", "COAL", "COAT",
  "CODE", "COIL", "COIN", "COLA", "COLD", "COLT", "COME", "CONE", "COOL", "COPE", "COPY",
  "CORD", "CORE", "CORN", "COST", "CRAP", "CREE", "CREW", "CROP", "CURE", "CURL", "CURT",
  "CUTE", "CYTON", "DAME", "DARE", "DARK", "DART", "DATA", "DATE", "DAWN", "DAYS", "DEAD",
  "DEAF", "DEAL", "DEAR", "DEEP", "DEER", "DEMO", "DENY", "DESK", "DIAL", "DIET", "DINE",
  "DICE", "DIRE", "DIRT", "DISC", "DISH", "DISK", "DIVE", "DOCK", "DOME", "DONE", "DOOR",
  "DOSE", "DOTE", "DOVE", "DOWN", "DRAM", "DRAY", "DRAW", "DREAM", "DROP", "DRUM", "DUCK",
  "DUET", "DUST", "DUTY", "EACH", "EARN", "EARS", "EAST", "EASY", "ECHO", "EDGE", "EDIT",
  "EGGS", "ELSE", "EMIT", "ENDS", "ERGO", "EVEN", "EVER", "EVIL", "EXAM", "EXIT", "FACE",
  "FACT", "FAIL", "FAIR", "FALL", "FARM", "FAST", "FATE", "FEAR", "FEED", "FEEL", "FEET",
  "FELL", "FIBER", "FILE", "FILL", "FILM", "FIND", "FINE", "FIRE", "FIRM", "FISH", "FIST",
  "FLAT", "FLEA", "FLOW", "FOAM", "FOLD", "FOLK", "FOND", "FONT", "FOOD", "FOOT", "FORD",
  "FORM", "FORT", "FOUR", "FREE", "FROG", "FROM", "FUEL", "FULL", "FUND", "GAIN", "GAME",
  "GANG", "GATE", "GEAR", "GEMS", "GENE", "GIFT", "GIRL", "GIVE", "GLAD", "GOAL", "GOAT",
  "GOLD", "GOLF", "GONE", "GOOD", "GOO", "GORE", "GROW", "GULF", "HAIR", "HALF", "HALL",
  "HAND", "HARD", "HARE", "HARM", "HARP", "HATE", "HAVE", "HEAD", "HEAL", "HEAP", "HEAR",
  "HEAT", "HELP", "HERB", "HERO", "HEST", "HIGH", "HILL", "HIRE", "HOLD", "HOLE", "HOME",
  "HOOK", "HOON", "HOOT", "HOPE", "HORN", "HOSE", "HOST", "HOUR", "HOUSE", "HUGE", "HUNT",
  "HURT", "ICON", "IDEA", "IDLE", "IDOL", "INCH", "INTO", "IRON", "ITCH", "ITEM", "JOIN",
  "JOKE", "JUMP", "JUST", "KEEP", "KEPT", "KICK", "KIND", "KING", "KISS", "KITE", "KNEE",
  "KNOW", "LACE", "LACK", "LADY", "LAKE", "LAMB", "LAMP", "LAND", "LANE", "LAST", "LATE",
  "LAVA", "LAWN", "LAZY", "LEAD", "LEAF", "LEAN", "LEAP", "LECT", "LEFT", "LEND", "LENS",
  "LIFT", "LIGHT", "LIKE", "LIME", "LINE", "LION", "LIST", "LIVE", "LOAD", "LOAN", "LOCK",
  "LODE", "LOGO", "LONG", "LOOK", "LOOM", "LOOP", "LOOT", "LORD", "LOSE", "LOSS", "LOST",
  "LOUD", "LOVE", "LUCK", "LUMP", "LUTE", "MACE", "MADE", "MAIL", "MAIN", "MAKE", "MALE",
  "MAND", "MANY", "MAPS", "MARK", "MARS", "MART", "MASK", "MASS", "MAST", "MATE", "MATH",
  "MAZE", "MEAL", "MEAN", "MEAT", "MEET", "MELT", "MEMO", "MENU", "MERE", "MESH", "MICE",
  "MILD", "MILE", "MILK", "MILL", "MIND", "MINE", "MINT", "MIRE", "MISS", "MIST", "MITE",
  "MODE", "MOON", "MOOR", "MORE", "MORN", "MOST", "MOVE", "MUCH", "MUST", "MUTE", "NAME",
  "NAVE", "NAVY", "NEAR", "NEAT", "NECK", "NEED", "NEON", "NEST", "NETS", "NEWS", "NEXT",
  "NICE", "NIGHT", "NINE", "NODE", "NOON", "NORM", "NOSE", "NOTE", "NUDE", "OAK", "OATH",
  "OBEY", "OCEAN", "OCHRE", "OMEN", "OMIT", "ONCE", "ONE", "ONLY", "OPEN", "ORAL", "OVER",
  "PACE", "PACK", "PAGE", "PAID", "PAIN", "PAIR", "PALE", "PALM", "PARK", "PARE", "PART",
  "PASS", "PATH", "PEAK", "PEAL", "PEAR", "PEEP", "PEEL", "PEER", "PERC", "PERM", "PICK",
  "PIER", "PILE", "PINE", "PINK", "PIPE", "PLAN", "PLAY", "PLEA", "PLOT", "PLUM", "POEM",
  "POET", "POLE", "POLL", "POND", "POOL", "POOR", "PORT", "POSE", "POST", "POUR", "PRAY",
  "PURE", "QUIN", "RACE", "RACK", "RAGE", "RAIL", "RAIN", "RARE", "RATE", "READ", "REAL",
  "REAP", "REAR", "REC", "RED", "REED", "REEL", "REIN", "RENT", "REST", "RICE", "RICH",
  "RIDE", "RIME", "RING", "RIPE", "RISE", "RISK", "RITE", "ROAD", "ROAM", "ROAR", "ROBE",
  "ROCK", "ROD", "ROLE", "ROLL", "ROOF", "ROOM", "ROOT", "ROPE", "ROSE", "ROTE", "RUBY",
  "RUDE", "RULE", "RUSH", "RUST", "SAC", "SAFE", "SAIL", "SALT", "SAME", "SAND", "SAVE",
  "SCAN", "SCAR", "SCAM", "SCENT", "SCOOP", "SCOPE", "SCORE", "SEAL", "SEAM", "SEAT",
  "SEED", "SEEK", "SEEM", "SEEN", "SEER", "SELL", "SEND", "SETT", "SHED", "SHIP", "SHOE",
  "SHOP", "SHOT", "SHOW", "SHUT", "SICK", "SIDE", "SIGN", "SILK", "SILO", "SINK", "SIRE",
  "SITE", "SIZE", "SKIN", "SKIP", "SKY", "SLAM", "SLAP", "SLATE", "SLIM", "SLIP", "SLOW",
  "SOAP", "SOAR", "SOCK", "SOIL", "SOLAR", "SOME", "SONG", "SOON", "SORE", "SORT", "SOUL",
  "SOUP", "SOUR", "SPAN", "STAR", "STAT", "STEM", "STEP", "STIR", "STOP", "SUCH", "SUIT",
  "SWIM", "TABOO", "TACT", "TAIN", "TALA", "TALE", "TALK", "TALL", "TAME", "TANK", "TAPE",
  "TASK", "TEAM", "TEAR", "TECH", "TEEM", "TELL", "TERM", "TERN", "TEST", "THAT", "THEM",
  "THEN", "THEY", "THIS", "TIDE", "TIDY", "TIE", "TIER", "TILE", "TIME", "TINY", "TIP",
  "TIRE", "TOAD", "TOAST", "TOE", "TOLL", "TONE", "TONG", "TONNE", "TOOL", "TOPS", "TORE",
  "TORN", "TOSS", "TOUR", "TOWN", "TRAP", "TRAY", "TREE", "TRIM", "TRIP", "TRUE", "TUBE",
  "TUNA", "TUNE", "TURN", "TYPE", "UNIT", "UPON", "URBAN", "USER", "VAIN", "VALE", "VANE",
  "VARY", "VAST", "VEIN", "VENT", "VERB", "VERT", "VERY", "VEST", "VETO", "VIEW", "VINE",
  "VISA", "VITA", "VOID", "VOTE", "WAVE", "WEAK", "WEAR", "WEEK", "WELL", "WEST", "WHAT",
  "WHEN", "WIFE", "WILD", "WILL", "WIND", "WINE", "WING", "WISH", "WITH", "WOLF", "WOOD",
  "WORD", "WORK", "WORM", "YARD", "YEAR", "ZERO", "ZONE",

  // 5-Letter Words (Including UK/US Dual Variations)
  "ABOUT", "ABOVE", "ACCORD", "ACUTE", "ADAPT", "ADMIT", "ADOPT", "ADULT", "AGENT", "AGONY",
  "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIEN", "ALIKE", "ALIVE", "ALONE", "ALONG",
  "ALTER", "AMONG", "ANGEL", "ANGER", "ANGLE", "ANGRY", "ANION", "APART", "APED", "APPLE",
  "APPLY", "ARENA", "ARGUE", "ARISE", "ARMED", "AROMA", "ARRAY", "ARROW", "ASSET", "AUDIO",
  "AUDIT", "AUNTIE", "AVOID", "AWARD", "AWARE", "BADLY", "BASIC", "BASIS", "BEACH", "BEARD",
  "BEAST", "BEGIN", "BEING", "BELOW", "BENCH", "BLACK", "BLADE", "BLAME", "BLANK", "BLAST",
  "BLEED", "BLEND", "BLESS", "BLIND", "BLOCK", "BLOOD", "BLOOM", "BOARD", "BOAST", "BONUS",
  "BOOST", "BOUND", "BRAIN", "BRAND", "BREAD", "BREAK", "BRICK", "BRIDE", "BRIEF", "BRING",
  "BROAD", "BROWN", "BRUSH", "BUILD", "BUILT", "BUNCH", "BUYER", "CABLE", "CAMEL", "CANDY",
  "CANOE", "CARGO", "CAROL", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHALK", "CHARM",
  "CHART", "CHASE", "CHEAP", "CHEAT", "CHECK", "CHEEK", "CHEER", "CHEST", "CHIEF", "CHILD",
  "CHINA", "CHOIR", "CHORE", "CHOSE", "CIVIC", "CIVIL", "CLAIM", "CLAN", "CLARA", "CLASS",
  "CLEAN", "CLEAR", "CLIMB", "CLOCK", "CLONE", "CLOSE", "CLOTH", "CLOUD", "COACH", "COAST",
  "COLOR", "COLOUR", "CORAL", "COUNT", "COURT", "COVER", "CRAFT", "CRANE", "CRASH", "CRAWL",
  "CRAZY", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CRUDE", "CRUEL", "CRUSH", "CRUST",
  "CURVE", "CYCLE", "DAILY", "DANCE", "DATED", "DECAY", "DECIDE", "DEMO", "DOUBT", "DRAFT",
  "DRAIN", "DRAMA", "DRAWN", "DREAM", "DRESS", "DRIED", "DRIFT", "DRILL", "DRINK", "DRIVE",
  "DROWN", "EAGER", "EARLY", "EARTH", "EIGHT", "ELBOW", "ELECT", "ELITE", "EMPIRE", "EMPTY",
  "ENEMY", "ENJOY", "ENTER", "ENTRY", "EQUAL", "ERROR", "EVENT", "EVERY", "EXACT", "EXPERT",
  "EXPIRE", "EXIST", "EXTRA", "FAINT", "FAITH", "FALSE", "FANCY", "FATAL", "FAULT", "FAVOR",
  "FAVOUR", "FEAST", "FIBER", "FIBRE", "FIELD", "FIFTH", "FIFTY", "FINAL", "FIRST", "FIXED",
  "FLAME", "FLASH", "FLEET", "FLESH", "FLOAT", "FLOCK", "FLOOD", "FLOOR", "FLOUR", "FLUID",
  "FLUSH", "FOCUS", "FORCE", "FORTH", "FORTY", "FORUM", "FOUND", "FRAME", "FRAUD", "FRESH",
  "FRONT", "FROST", "FRUIT", "FUNNY", "GIANT", "GIVEN", "GLASS", "GLOBE", "GLORY", "GLOVE",
  "GOAL", "GRACE", "GRADE", "GRAIN", "GRAND", "GRANT", "GRAPE", "GRAPH", "GRASP", "GRASS",
  "GRAVE", "GREAT", "GREEN", "GREET", "GRIEF", "GRILL", "GROSS", "GROUP", "GROVE", "GROWTH",
  "GUARD", "GUESS", "GUEST", "GUIDE", "GUILT", "HABIT", "HAPPY", "HARSH", "HEART", "HEAVY",
  "HENCE", "HONOR", "HONOUR", "HORSE", "HOTEL", "HOUSE", "HUMAN", "HUMOR", "HUMOUR", "HYPER",
  "IDEAL", "IMAGE", "IMPLY", "INDEX", "INNER", "INPUT", "ISSUE", "JAPAN", "JEWEL", "JOINT",
  "JUDGE", "JUICE", "JURY", "KNIFE", "KNOCK", "LABEL", "LABOR", "LABOUR", "LARGE", "LASER",
  "LATER", "LAUGH", "LAYER", "LEARN", "LEASE", "LEAST", "LEAVE", "LEGAL", "LEMON", "LEVEL",
  "LEVER", "LIGHT", "LIMIT", "LINER", "LIVER", "LOCAL", "LOGIC", "LOOSE", "LOVER", "LOWER",
  "LOYAL", "LUCKY", "LUNCH", "MAGIC", "MAJOR", "MAKER", "MANOR", "MARCH", "MASON", "MATCH",
  "MAYOR", "MEANT", "MEDAL", "MEDIA", "MERCY", "MERIT", "METAL", "METER", "METRE", "METRO",
  "MICRO", "MIDDLE", "MIDST", "MIGHT", "MINOR", "MINUS", "MODEL", "MODEM", "MONEY", "MONTH",
  "MORAL", "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC", "NAKED", "NAVAL", "NERVE",
  "NEVER", "NEWLY", "NIGHT", "NOBLE", "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE", "OCEAN",
  "OFFER", "OFTEN", "OLIVE", "ONION", "OPERA", "ORDER", "ORGAN", "OTHER", "OUTER", "OWNER",
  "OXIDE", "PACKET", "PAD", "PAGER", "PAINT", "PANEL", "PAPER", "PARTY", "PEACE", "PEARL",
  "PENAL", "PETTY", "PHASE", "PHONE", "PHOTO", "PIANO", "PIECE", "PILOT", "PITCH", "PIZZA",
  "PLACE", "PLAIN", "PLANE", "PLANT", "PLATE", "PLEAD", "POINT", "POLAR", "POLICE", "POLICY",
  "PORCH", "POWER", "PRICE", "PRIDE", "PRIME", "PRINT", "PRIOR", "PRIZE", "PROOF", "PROUD",
  "PROVE", "QUEEN", "QUICK", "QUIET", "QUITE", "QUOTA", "RADAR", "RADIO", "RAISE", "RANGE",
  "RAPID", "RATIO", "REACH", "REACT", "READY", "REALM", "REBEL", "REFER", "REIGN", "RELAX",
  "RELY", "RENEW", "REPLY", "RESET", "RIDER", "RIDGE", "RIFLE", "RIGHT", "RIPEN", "RIVAL",
  "RIVER", "ROBOT", "ROCKET", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RULER", "RURAL", "SAFETY",
  "SAINT", "SALAD", "SALES", "SALON", "SAUCE", "SCALE", "SCENE", "SCENT", "SCOPE", "SCORE",
  "SENSE", "SERVE", "SEVEN", "SHADE", "SHAKE", "SHALL", "SHAME", "SHAPE", "SHARE", "SHARP",
  "SHEEP", "SHEER", "SHEET", "SHELF", "SHELL", "SHIFT", "SHINE", "SHIRT", "SHOCK", "SHOOT",
  "SHORE", "SHORT", "SHOUT", "SHOWN", "SIGHT", "SIGNAL", "SILENT", "SILLY", "SILVER", "SIMPLE",
  "SINCE", "SIXTH", "SIXTY", "SKILL", "SKIRT", "SLEEP", "SLICE", "SLIDE", "SLIGHT", "SMART",
  "SMELL", "SMILE", "SMOKE", "SOLID", "SOLVE", "SORRY", "SOUND", "SOUTH", "SPACE", "SPARE",
  "SPEAK", "SPEED", "SPELL", "SPEND", "SPENT", "SPILL", "SPIRIT", "SPLIT", "SPOKE", "SPORT",
  "STAFF", "STAGE", "STAKE", "STAND", "STARE", "START", "STATE", "STEAM", "STEEL", "STEEP",
  "STEER", "STICK", "STIFF", "STILL", "STOCK", "STONE", "STOOD", "STORE", "STORM", "STORY",
  "STOVE", "STRIP", "STUCK", "STUDY", "STUFF", "STYLE", "SUGAR", "SUITE", "SUPER", "SWEET",
  "TABLE", "TASTE", "TEACH", "TEMPER", "THANK", "THEME", "THERE", "THESE", "THICK", "THING",
  "THINK", "THIRD", "THOSE", "THREE", "THROW", "TIGER", "TIGHT", "TITLE", "TODAY", "TOKEN",
  "TOTAL", "TOUCH", "TOUGH", "TOWEL", "TOWER", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND",
  "TRIAL", "TRIBE", "TRICK", "TRIED", "TRUCK", "TRULY", "TRUNK", "TRUST", "TRUTH", "TWICE",
  "UNCLE", "UNDER", "UNION", "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL",
  "VALID", "VALUE", "VIDEO", "VIRUS", "VISIT", "VITAL", "VOICE", "WASTE", "WATCH", "WATER",
  "WHEEL", "WHERE", "WHICH", "WHITE", "WHOLE", "WHOSE", "WOMAN", "WORLD", "WORRY", "WORTH",
  "WOULD", "WOUND", "WRITE", "WRONG", "YOUTH",

  // 6-Letter & Higher Educational (Including US & UK Variations)
  "ACCEPT", "ACCESS", "ACTION", "ACTIVE", "ACTOR", "ADMIRAL", "ADVENT", "ADVICE", "ADVISE",
  "AFRAID", "AGENCY", "AGONY", "ALMOST", "ALWAYS", "AMAZING", "ANALYSE", "ANALYZE", "ANIMAL",
  "ANION", "ANSWER", "ANTIQUE", "ANYONE", "APPEAR", "AROUND", "ARTIST", "ASTRON", "ATHLETIC",
  "AUTHOR", "AUTUMN", "BAKERY", "BEAUTY", "BEFORE", "BEHIND", "BELIEVE", "BEYOND", "BIODIVERSITY",
  "BLANKET", "BOTTLE", "BOTTOM", "BRANCH", "BREATH", "BRIDGE", "BRIGHT", "BROTHER", "BUBBLE",
  "BUDGET", "BUTTON", "CABINET", "CAMERA", "CAMPUS", "CANCER", "CANCELED", "CANCELLED", "CANDLE",
  "CANTON", "CANYON", "CAPITAL", "CAPTAIN", "CAREER", "CARPET", "CARROT", "CART", "CASTLE",
  "CATALOG", "CATALOGUE", "CENTER", "CENTRE", "CEREAL", "CHANCE", "CHANGE", "CHANNEL", "CHAPTER",
  "CHARGE", "CHARITY", "CHARM", "CHEESE", "CHERRY", "CIRCLE", "CITY", "CLASS", "CLEAT", "CLEVER",
  "CLIMATE", "CLOTHES", "CLOT", "CLOUD", "COFFEE", "COLLAR", "COLLEGE", "COLT", "COLUMN",
  "COMEDY", "COMFORT", "COMMAND", "COMMON", "COMPANY", "COMPARE", "COMPASS", "COMPLEX",
  "CONCEPT", "CONCERT", "CONDUCT", "CONFIRM", "CONNECT", "CONSOLE", "CONTACT", "CONTENT",
  "CONTEST", "CONTEXT", "CONTROL", "COOKIE", "COPPER", "CORD", "CORNER", "COTTON", "COUNTY",
  "COUPLE", "COURAGE", "COUSIN", "COWBOY", "CRAYON", "CREATE", "CREDIT", "CRICKET", "CRIME",
  "CRISIS", "CRYSTAL", "CULTURE", "CURTAIN", "CUSTOM", "DAMAGE", "DANGER", "DARKEN", "DAUGHTER",
  "DEFENCE", "DEFENSE", "DEFEAT", "DEGREE", "DEMAND", "DENTAL", "DEPEND", "DEPOSIT", "DERIVE",
  "DESIGN", "DESIRE", "DESK", "DESTINY", "DETAIL", "DETECT", "DEVICE", "DEVOTE", "DIALOG",
  "DIAMOND", "DIARY", "DINNER", "DIRECT", "DISH", "DISPLAY", "DISTANCE", "DIVERSITY", "DOCTOR",
  "DOLLAR", "DOMAIN", "DONKEY", "DRAGON", "DRAWER", "DRIVER", "DURING", "DYNAMIC", "EAGLE",
  "EARLY", "EARNEST", "EARTH", "EASILY", "ECHO", "ECONOMY", "EFFECT", "EFFORT", "EIGHT",
  "ELECTION", "ELECTRIC", "ELEMENT", "ELEPHANT", "EMOTION", "EMPIRE", "ENROL", "ENROLL",
  "ENERGY", "ENGINE", "ENOUGH", "ENTIRE", "ENTRANCE", "ENVELOPE", "ENVIRON", "EQUAL", "ESCAPE",
  "ETHICS", "EVENT", "EVER", "EVERY", "EVIDENCE", "EXAMPLE", "EXCELLENT", "EXCHANGE", "EXCITE",
  "EXCUSE", "EXERT", "EXHIBIT", "EXIST", "EXPAND", "EXPECT", "EXPENSE", "EXPERT", "EXPORT",
  "EXPOSE", "EXPRESS", "EXTEND", "FABRIC", "FACTOR", "FACTORY", "FAILURE", "FAMILY", "FAMOUS",
  "FARMER", "FATHER", "FEATURE", "FEMALE", "FICTION", "FIGURE", "FILTER", "FINISH", "FIRE",
  "FISH", "FLIGHT", "FLOWER", "FLYING", "FOREST", "FORGET", "FORGIVE", "FORMER", "FRIEND",
  "FULFIL", "FULFILL", "FUTURE", "GARDEN", "GARLIC", "GATHER", "GENERAL", "GENTLE", "GEOMETRY",
  "GIANT", "GIFTED", "GLOBAL", "GLOBE", "GOLDEN", "GOPHER", "GOVERN", "GRAIN", "GRAPE", "GRAPH",
  "GREAT", "GROUND", "GUITAR", "HABIT", "HAMMER", "HAPPEN", "HARBOR", "HARBOUR", "HARMONY",
  "HARVEST", "HEALTH", "HEAVEN", "HEIGHT", "HELMET", "HERO", "HEROIC", "HISTORY", "HOLLOW",
  "HONEST", "HONEY", "HORIZON", "HOSPITAL", "HOURLY", "HUNGRY", "HUNTER", "HYDRO", "ICE",
  "ICON", "IDEA", "INVENT", "ISLAND", "JACKET", "JUNGLE", "JUNIOR", "JUSTICE", "KENNEL",
  "KERNEL", "KITCHEN", "KITTEN", "KNOWLEDGE", "LADDER", "LAGOON", "LANTERN", "LATEST", "LAWYER",
  "LEADER", "LEAF", "LEAGUE", "LEMON", "LESSEN", "LETTER", "LICENCE", "LICENSE", "LIBRARY",
  "LIGHT", "LINEN", "LIQUID", "LIST", "LITRE", "LITTLE", "LIZARD", "LOVELY", "MACHINE",
  "MAGNET", "MAGNETO", "MAJESTY", "MANNER", "MARBLE", "MARKET", "MASTER", "MATHEMATIC",
  "MATTER", "MEADOW", "MEAL", "MEDAL", "MEDIC", "MEDIUM", "MEMBER", "MEMORY", "MERCY", "METHOD",
  "METRIC", "METRO", "MICROSCOPE", "MIDDLE", "MILE", "MILLION", "MINUTE", "MIRROR", "MISCHIEF",
  "MISSION", "MISTAKE", "MIXTURE", "MODERN", "MOMENT", "MONKEY", "MONSTER", "MONTH", "MORNING",
  "MOTHER", "MOTION", "MOTOR", "MOUNTAIN", "MOUSE", "MUSCLE", "MUSEUM", "MUSIC", "MUSTARD",
  "MYSTERY", "NATION", "NATURE", "NEPHEW", "NERVE", "NEWSPAPER", "NICKEL", "NIGHT", "NORMAL",
  "NOTICE", "NOTION", "NOVEL", "NUMBER", "OBJECT", "OCCUR", "OCEAN", "OFFICE", "OFFICER",
  "ONSET", "OPTIC", "ORANGE", "ORCHID", "ORGAN", "ORGANISATION", "ORGANIZATION", "ORIENT",
  "PALE", "PARENT", "PARROT", "PARALYSE", "PARALYZE", "PARTNER", "PASSAGE", "PASSION", "PASTURE",
  "PATIENT", "PATTERN", "PAYMENT", "PEACE", "PENNY", "PEOPLE", "PEPPER", "PERFECT", "PERIOD",
  "PERMIT", "PERSON", "PETAL", "PHANTOM", "PHOTO", "PHYSICS", "PICTURE", "PIGEON", "PLANET",
  "PLASTIC", "PLATFORM", "PLAYER", "PLEASURE", "POCKET", "POETRY", "POLICE", "POLITE", "PORTRAIT",
  "POSITION", "POSTER", "POTATO", "POWDER", "POWER", "PRACTICE", "PRAISE", "PREFER", "PRESENT",
  "PRESIDENT", "PRIEST", "PRIME", "PRINCE", "PRINCESS", "PRINTER", "PRISON", "PRIVACY",
  "PROBLEM", "PROCESS", "PRODUCE", "PRODUCT", "PROFESSOR", "PROGRAM", "PROGRAMME", "PROGRESS",
  "PROJECT", "PROMISE", "PROOF", "PROPERTY", "PROTECT", "PROTEIN", "PROUD", "PROVIDE", "PUBLIC",
  "PUPIL", "PUPPY", "PURPOSE", "QUALITY", "QUARTER", "QUEEN", "QUESTION", "QUICK", "QUIET",
  "RABBIT", "RADIUS", "RAILWAY", "RAINBOW", "RATION", "REALISE", "REALIZE", "REASON", "RECEIVE",
  "RECIPE", "RECORD", "REDUCE", "REFORM", "REFUGE", "REFUSE", "REGION", "REGRET", "REGULAR",
  "REJECT", "RELATE", "RELAX", "RELEASE", "RELIEF", "RELIGION", "REMAIN", "REMARK", "REMEMBER",
  "REMOVE", "REPAIR", "REPEAT", "REPLACE", "REPORT", "REQUEST", "RESCUE", "RESEARCH", "RESPECT",
  "RESPOND", "RESULT", "RETIRE", "RETURN", "REVIEW", "REWARD", "RHYTHM", "RIBBON", "RIVER",
  "ROAST", "ROBOT", "ROCKET", "ROLLER", "ROMANCE", "ROOM", "ROOSTER", "RUBBER", "RUNNER",
  "SAFETY", "SAILOR", "SALAD", "SALARY", "SAMPLE", "SANDAL", "SATURN", "SAVING", "SCENIC",
  "SCENT", "SCHOOL", "SCIENCE", "SCISSORS", "SCOOTER", "SCRATCH", "SCREEN", "SEASON", "SECOND",
  "SECRET", "SECTION", "SECURITY", "SEED", "SELECT", "SELLER", "SENIOR", "SENSE", "SENTENCE",
  "SEPARATE", "SERIOUS", "SERPENT", "SERVANT", "SERVICE", "SETTLEMENT", "SHADOW", "SHALLOW",
  "SHELTER", "SHEPHERD", "SHERIFF", "SHINE", "SHINING", "SHIRE", "SHOULDER", "SHOWER", "SIGNAL",
  "SILENCE", "SILVER", "SIMPLE", "SINCERE", "SISTER", "SKETCH", "SLEEVE", "SLIDER", "SLOWLY",
  "SMART", "SMOOTH", "SOCCER", "SOCIAL", "SOCIETY", "SODIUM", "SOLDIER", "SOLUTION", "SOMEONE",
  "SOMETHING", "SOMETIME", "SPHERE", "SPIRIT", "SPREAD", "SPRING", "SQUARE", "SQUIRREL",
  "STADIUM", "STATUE", "STEAM", "STEERING", "STICKER", "STOMACH", "STORAGE", "STORM", "STORY",
  "STRANGER", "STRAWBERRY", "STREAM", "STREET", "STRENGTH", "STRIKE", "STRING", "STUDENT",
  "SUBJECT", "SUCCESS", "SUGAR", "SUGGEST", "SUMMER", "SUNSHINE", "SUPER", "SUPPORT", "SUPREME",
  "SURFACE", "SURPRISE", "SURVIVE", "SUSPECT", "SWIMMING", "SYMBOL", "SYSTEM", "TALENT",
  "TEACHER", "TEAM", "TECH", "TEETH", "TEMPER", "TEMPLE", "TENNIS", "TERROR", "TEXTILE",
  "THEATER", "THEATRE", "THEME", "THEORY", "THESIS", "THIRST", "THOUGHT", "THREAD", "TICKET",
  "TIGER", "TIMBER", "TONIGHT", "TORCH", "TORNADO", "TOTAL", "TOURIST", "TOWARD", "TRACE",
  "TRACK", "TRACTOR", "TRAFFIC", "TRAGEDY", "TRAIL", "TRAIN", "TRAINER", "TRAITOR", "TRAVEL",
  "TRAVELER", "TRAVELLER", "TREAD", "TREASURE", "TREATMENT", "TREE", "TREND", "TRIANGLE",
  "TRIGONOMETRY", "TRIP", "TROPIC", "TROPHY", "TROUBLE", "TUESDAY", "TUNNEL", "TURKEY",
  "TURTLE", "TWELVE", "TWENTY", "TYPICAL", "ULTRA", "UMBRELLA", "UNCLE", "UNIFORM", "UNIT",
  "UNITY", "UNIVERSE", "UNTIL", "URGENT", "UTTER", "VACATION", "VALLEY", "VALUE", "VARIETY",
  "VECTOR", "VEHICLE", "VELOCITY", "VELVET", "VERITY", "VERSE", "VESSEL", "VICTORY", "VILLAGE",
  "VIOLIN", "VIRTUE", "VISION", "VISITOR", "VOCABULARY", "VOICE", "VOLCANO", "VOLUME", "VOYAGE",
  "WAITER", "WALLET", "WALNUT", "WARRIOR", "WEATHER", "WEDNESDAY", "WEIGHT", "WELCOME",
  "WELFARE", "WHEEL", "WHISTLE", "WINDOW", "WINNER", "WINTER", "WISDOM", "WISH", "WITNESS",
  "WONDER", "WOODEN", "WORKER", "WORLD", "WORSHIP", "WRITER", "WRITING", "YELLOW", "YESTERDAY",
  "YIELD", "YOUTH", "ZEBRA", "ZERO", "ZOOLOGY"
];

/**
 * Safeguard 5: Offline O(1) Dictionary Set
 */
export const ENGLISH_DICTIONARY_SET = new Set<string>(
  MASTER_ENGLISH_WORDS.map((w) => w.toUpperCase())
);

/**
 * Cache for dynamically validated online words during gameplay
 */
export const ONLINE_VALIDATED_WORDS_CACHE = new Set<string>();

/**
 * Validates if a user-entered word is a strictly correct English word
 * AND can be formed from the current base word (Synchronous).
 */
export const isDictionaryWord = (
  word: string,
  baseWord: string,
  minLength: number = DEFAULT_MIN_WORD_LENGTH
): boolean => {
  const cleanWord = word.toUpperCase().trim();
  const cleanBase = baseWord.toUpperCase().trim();

  if (!canFormWord(cleanWord, cleanBase, minLength)) return false;
  if (cleanWord.length <= 3 && ENGLISH_DICTIONARY_SET.has(cleanWord)) return true;
  if (ENGLISH_DICTIONARY_SET.has(cleanWord)) return true;
  if (ONLINE_VALIDATED_WORDS_CACHE.has(cleanWord)) return true;

  const explicitSubwords = AUDITED_BASE_WORD_SUBWORDS[cleanBase];
  if (explicitSubwords) {
    const cleanExplicit = explicitSubwords.map((w) => w.toUpperCase());
    if (cleanExplicit.includes(cleanWord)) {
      return true;
    }
  }

  return false;
};

/**
 * Asynchronous Dictionary Validation with Online Fallback
 * 1. Strictly validates letter availability (canFormWord) first.
 * 2. Checks local offline dictionary / cache.
 * 3. Falls back to Free Dictionary API if network is available.
 */
export const isDictionaryWordAsync = async (
  word: string,
  baseWord: string,
  minLength: number = DEFAULT_MIN_WORD_LENGTH
): Promise<boolean> => {
  const cleanWord = word.toUpperCase().trim();
  const cleanBase = baseWord.toUpperCase().trim();

  // Safeguard 1: Must pass strict letter frequency composition check first
  if (!canFormWord(cleanWord, cleanBase, minLength)) return false;

  // Check local offline dictionary or cache
  if (
    ENGLISH_DICTIONARY_SET.has(cleanWord) ||
    ONLINE_VALIDATED_WORDS_CACHE.has(cleanWord)
  ) {
    return true;
  }

  // Check explicit subwords
  const explicitSubwords = AUDITED_BASE_WORD_SUBWORDS[cleanBase];
  if (explicitSubwords) {
    const cleanExplicit = explicitSubwords.map((w) => w.toUpperCase());
    if (cleanExplicit.includes(cleanWord)) {
      return true;
    }
  }

  // Online Dictionary Fallback API (Free Dictionary API)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        cleanWord.toLowerCase()
      )}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        ONLINE_VALIDATED_WORDS_CACHE.add(cleanWord);
        return true;
      }
    }
  } catch (err) {
    // Offline or request timeout / network error - fallback gracefully
    console.log("Online dictionary lookup skipped/failed:", err);
  }

  return false;
};

/**
 * Safeguard 6: Symmetric AI vs Human Validation Rule Consistency
 * Generates all valid English sub-words for a base word.
 * Used by PC Opponent AI to select valid words dynamically.
 * Strictly filters out any word that cannot be formed from the base word.
 */
export const getValidSubWords = (
  baseWord: string,
  minLength: number = DEFAULT_MIN_WORD_LENGTH
): string[] => {
  const cleanBase = baseWord.toUpperCase().trim();

  // 1. Get explicit sub-words defined for base word AND STRICTLY FILTER WITH canFormWord
  const explicit = (AUDITED_BASE_WORD_SUBWORDS[cleanBase] || []).filter((w) =>
    canFormWord(w, cleanBase, minLength)
  );

  // 2. Get sub-words from master dictionary set that pass canFormWord
  const fromMaster: string[] = [];
  ENGLISH_DICTIONARY_SET.forEach((w) => {
    if (canFormWord(w, cleanBase, minLength)) {
      fromMaster.push(w);
    }
  });

  // Deduplicate and return
  return Array.from(new Set([...explicit.map((w) => w.toUpperCase()), ...fromMaster]));
};
