// ─── Stockholm defaults ─────────────────────────────────────
export const STOCKHOLM_CENTER = { lat: 59.3293, lng: 18.0686 };

export const RADIUS_OPTIONS = [
  { label: "2 km", value: 2 },
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "20 km", value: 20 },
] as const;

export const DEFAULT_RADIUS = 5;

// ─── Car defaults ───────────────────────────────────────────
export const DEFAULT_CAR_PROFILE = {
  fuelType: "PETROL" as const,
  consumptionPer100km: 7.5,
  energyUnit: "L_PER_100KM" as const,
  energyPricePerUnit: 18.5, // SEK per liter
};

// ─── Optimization ───────────────────────────────────────────
export const MISSING_ITEM_PENALTY_SEK = 50;
export const TWO_STORE_MINIMUM_SAVINGS_SEK = 10;
export const TOP_N_STORES_FOR_PAIRS = 6;
export const MAX_PRICE_AGE_DAYS = 30;

// ─── Freshness thresholds (days) ────────────────────────────
export const FRESHNESS_FRESH_MAX_DAYS = 7;
export const FRESHNESS_AGING_MAX_DAYS = 14;

// ─── Taxonomy ───────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  FRUKT_GRONT: "Frukt & Grönt",
  MEJERI_AGG: "Mejeri & Ägg",
  KOTT: "Kött",
  FISK_SKALDJUR: "Fisk & Skaldjur",
  CHARK_PALAGG: "Chark & Pålägg",
  BROD_BAGERI: "Bröd & Bageri",
  SKAFFERI: "Skafferi",
  FRYST: "Fryst",
  DRYCK: "Dryck",
  SNACKS_GODIS: "Snacks & Godis",
  BARN_BABY: "Barn & Baby",
  HALSA_SKONHET: "Hälsa & Skönhet",
  VEGO: "Vego",
  HEM_STAD: "Hem & Städ",
  DJUR: "Djur",
};

export const SUBCATEGORY_LABELS: Record<string, Record<string, string>> = {
  FRUKT_GRONT: {
    FRUKT: "Frukt",
    GRONSAKER: "Grönsaker",
    SALLAD: "Sallad",
    ORTER: "Örter",
    BAR: "Bär",
    POTATIS_ROTFRUKT: "Potatis & Rotfrukter",
  },
  MEJERI_AGG: {
    MJOLK: "Mjölk",
    YOGHURT_FIL: "Yoghurt & Fil",
    OST: "Ost",
    SMOR_MARGARIN: "Smör & Margarin",
    GRADDE: "Grädde",
    AGG: "Ägg",
    VAXTBASERAT: "Växtbaserat",
  },
  KOTT: {
    NOT: "Nöt",
    FLASK: "Fläsk",
    KYCKLING: "Kyckling",
    LAMM: "Lamm",
    FARS: "Färs",
  },
  FISK_SKALDJUR: {
    FARSK: "Färsk",
    FRYST: "Fryst",
    SKALDJUR: "Skaldjur",
    ROKT_GRAVAT: "Rökt & Gravat",
  },
  CHARK_PALAGG: {
    SKINKA: "Skinka",
    SALAMI: "Salami",
    KORV: "Korv",
    PASTEJ: "Pastej",
    PALAGG: "Pålägg",
  },
  BROD_BAGERI: {
    BROD: "Bröd",
    FRALLOR: "Frallor",
    KNACKEBROT: "Knäckebröd",
    FIKA: "Fika",
    TORTILLA: "Tortilla",
  },
  SKAFFERI: {
    PASTA_RIS_GRYN: "Pasta, Ris & Gryn",
    KONSERV: "Konserv",
    KRYDDOR: "Kryddor",
    OLJA_VINAGER: "Olja & Vinäger",
    SASER: "Såser",
    BAKNING: "Bakning",
    FRUKOST: "Frukost",
  },
  FRYST: {
    GRONSAKER: "Grönsaker",
    GLASS: "Glass",
    FARDIGRATTER: "Färdigrätter",
    POMMES: "Pommes",
    BAR: "Bär",
  },
  DRYCK: {
    VATTEN: "Vatten",
    LASK: "Läsk",
    JUICE: "Juice",
    KAFFE_TE: "Kaffe & Te",
    ENERGI: "Energi",
    ALKOHOLFRITT: "Alkoholfritt",
  },
  SNACKS_GODIS: {
    CHIPS: "Chips",
    NOTTER: "Nötter",
    CHOKLAD: "Choklad",
    GODIS: "Godis",
    KAKOR: "Kakor",
  },
  BARN_BABY: {
    BLOJOR: "Blöjor",
    BARNMAT: "Barnmat",
    VALLING: "Välling",
    BABYVARD: "Babyvård",
  },
  HALSA_SKONHET: {
    HUDVARD: "Hudvård",
    HARVARD: "Hårvård",
    HYGIEN: "Hygien",
  },
  VEGO: {
    VEGOPROTEIN: "Vegoprotein",
    TOFU_TEMPEH: "Tofu & Tempeh",
    BALJVAXTER: "Baljväxter",
    VEGOPALAGG: "Vegopålägg",
  },
  HEM_STAD: {
    TVATT: "Tvätt",
    DISK: "Disk",
    RENGORING: "Rengöring",
    PAPPER: "Papper",
    SOPPASAR: "Soppåsar",
  },
  DJUR: {
    HUND: "Hund",
    KATT: "Katt",
    TILLBEHOR: "Tillbehör",
  },
};

export const CHAIN_LABELS: Record<string, string> = {
  ICA: "ICA",
  COOP: "Coop",
  WILLYS: "Willys",
  HEMKOP: "Hemköp",
  CITY_GROSS: "City Gross",
  LIDL: "Lidl",
  OTHER: "Övrigt",
};

export const FORMAT_LABELS: Record<string, string> = {
  ICA_MAXI: "ICA Maxi",
  ICA_KVANTUM: "ICA Kvantum",
  ICA_SUPERMARKET: "ICA Supermarket",
  ICA_NARA: "ICA Nära",
  STORA_COOP: "Stora Coop",
  COOP: "Coop",
  COOP_NARA: "Coop Nära",
  WILLYS: "Willys",
  WILLYS_HEMMA: "Willys Hemma",
  HEMKOP: "Hemköp",
  CITY_GROSS: "City Gross",
  LIDL: "Lidl",
};

// ─── Preset shopping lists ─────────────────────────────────
export const PRESET_LISTS = [
  {
    id: "basvaror",
    name: "Standardkasse: Basvaror",
    description: "Mjölk, bröd, smör, ägg, ost, frukt & grönt",
    items: [
      { name: "Mjölk 3%", quantity: 2, category: "MEJERI_AGG" },
      { name: "Storhushållsbröd", quantity: 1, category: "BROD_BAGERI" },
      { name: "Smör normalsaltat 500g", quantity: 1, category: "MEJERI_AGG" },
      { name: "Ägg 12-pack", quantity: 1, category: "MEJERI_AGG" },
      { name: "Hushållsost 1kg", quantity: 1, category: "MEJERI_AGG" },
      { name: "Bananer", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Äpplen Royal Gala", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Gurka", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Tomat kvisttomater 500g", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Potatis fast 1kg", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Kaffe mellanrost 450g", quantity: 1, category: "DRYCK" },
    ],
  },
  {
    id: "tacos",
    name: "Tacos-kväll",
    description: "Allt för en trevlig tacos-fredag",
    items: [
      { name: "Nötfärs 500g", quantity: 1, category: "KOTT" },
      { name: "Tortilla mjuka 8-pack", quantity: 1, category: "BROD_BAGERI" },
      { name: "Tacokrydda", quantity: 1, category: "SKAFFERI" },
      { name: "Tacosås mild", quantity: 1, category: "SKAFFERI" },
      { name: "Riven ost 150g", quantity: 1, category: "MEJERI_AGG" },
      { name: "Gräddfil 300ml", quantity: 1, category: "MEJERI_AGG" },
      { name: "Tomat kvisttomater 500g", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Gurka", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Isbergssallad", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Paprika röd", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Majs på burk", quantity: 1, category: "SKAFFERI" },
    ],
  },
  {
    id: "veckohandling",
    name: "Veckohandling (familj)",
    description: "Komplett veckohandling för en familj med 2 vuxna + 2 barn",
    items: [
      { name: "Mjölk 3%", quantity: 3, category: "MEJERI_AGG" },
      { name: "Yoghurt naturell 1L", quantity: 2, category: "MEJERI_AGG" },
      { name: "Smör normalsaltat 500g", quantity: 1, category: "MEJERI_AGG" },
      { name: "Ägg 12-pack", quantity: 1, category: "MEJERI_AGG" },
      { name: "Hushållsost 1kg", quantity: 1, category: "MEJERI_AGG" },
      { name: "Storhushållsbröd", quantity: 2, category: "BROD_BAGERI" },
      { name: "Kycklingfilé 1kg", quantity: 1, category: "KOTT" },
      { name: "Nötfärs 500g", quantity: 2, category: "KOTT" },
      { name: "Pasta penne 500g", quantity: 2, category: "SKAFFERI" },
      { name: "Ris basmati 1kg", quantity: 1, category: "SKAFFERI" },
      { name: "Krossade tomater 400g", quantity: 3, category: "SKAFFERI" },
      { name: "Bananer", quantity: 2, category: "FRUKT_GRONT" },
      { name: "Äpplen Royal Gala", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Gurka", quantity: 2, category: "FRUKT_GRONT" },
      { name: "Tomat kvisttomater 500g", quantity: 2, category: "FRUKT_GRONT" },
      { name: "Potatis fast 1kg", quantity: 2, category: "FRUKT_GRONT" },
      { name: "Lök gul 1kg", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Morötter 1kg", quantity: 1, category: "FRUKT_GRONT" },
      { name: "Kaffe mellanrost 450g", quantity: 1, category: "DRYCK" },
      { name: "Juice apelsin 1.5L", quantity: 1, category: "DRYCK" },
      { name: "Toapapper 12-pack", quantity: 1, category: "HEM_STAD" },
      { name: "Diskmedel 500ml", quantity: 1, category: "HEM_STAD" },
    ],
  },
] as const;
