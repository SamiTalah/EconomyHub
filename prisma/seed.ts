import {
  PrismaClient,
  Chain,
  StoreFormat,
  PriceSource,
  Category,
  UnitType,
  FlyerSourceType,
  ParseStatus,
  MultiBuyType,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeProductKey(
  name: string,
  brand?: string | null,
  sizeValue?: number | null,
  sizeUnit?: string | null,
): string {
  const parts = [
    name.toLowerCase().trim(),
    brand?.toLowerCase().trim() ?? "",
    sizeValue?.toString() ?? "",
    sizeUnit?.toLowerCase().trim() ?? "",
  ];
  return parts
    .filter(Boolean)
    .join("_")
    .replace(/\s+/g, "_")
    .replace(/[^a-zåäö0-9_]/g, "");
}

/** Returns a Date that is `daysAgo` days before now, at a random hour. */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(Math.floor(Math.random() * 12) + 6, 0, 0, 0);
  return d;
}

/** Monday of the current ISO week. */
function currentWeekMonday(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/** Sunday of the current ISO week. */
function currentWeekSunday(): Date {
  const mon = currentWeekMonday();
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

/** Small random jitter for prices: ±pct (0‑1). */
function jitter(base: number, pct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * pct;
  return Math.round(factor * base * 100) / 100;
}

// ─── Store definitions ──────────────────────────────────────────────────────

interface StoreSeed {
  name: string;
  chain: Chain;
  format: StoreFormat;
  lat: number;
  lng: number;
  address: string;
}

const STORES: StoreSeed[] = [
  { name: "ICA Maxi Lindhagen", chain: Chain.ICA, format: StoreFormat.ICA_MAXI, lat: 59.3355, lng: 18.01, address: "Lindhagensgatan 76, 112 18 Stockholm" },
  { name: "ICA Kvantum Liljeholmen", chain: Chain.ICA, format: StoreFormat.ICA_KVANTUM, lat: 59.3095, lng: 18.0232, address: "Liljeholmstorget 7, 117 63 Stockholm" },
  { name: "ICA Supermarket Gärdet", chain: Chain.ICA, format: StoreFormat.ICA_SUPERMARKET, lat: 59.3444, lng: 18.092, address: "Värtavägen 47, 115 29 Stockholm" },
  { name: "ICA Nära Södermalm", chain: Chain.ICA, format: StoreFormat.ICA_NARA, lat: 59.315, lng: 18.072, address: "Götgatan 44, 118 26 Stockholm" },
  { name: "Stora Coop Nacka Forum", chain: Chain.COOP, format: StoreFormat.STORA_COOP, lat: 59.308, lng: 18.162, address: "Forumvägen 14, 131 52 Nacka" },
  { name: "Coop Medborgarplatsen", chain: Chain.COOP, format: StoreFormat.COOP, lat: 59.3155, lng: 18.0722, address: "Medborgarplatsen 3, 118 26 Stockholm" },
  { name: "Coop Nära Vasastan", chain: Chain.COOP, format: StoreFormat.COOP_NARA, lat: 59.3432, lng: 18.051, address: "Odengatan 52, 113 51 Stockholm" },
  { name: "Willys Hornstull", chain: Chain.WILLYS, format: StoreFormat.WILLYS, lat: 59.3158, lng: 18.034, address: "Hornstulls strand 9, 117 39 Stockholm" },
  { name: "Willys Solna", chain: Chain.WILLYS, format: StoreFormat.WILLYS, lat: 59.36, lng: 18.0, address: "Solnavägen 19, 171 45 Solna" },
  { name: "Willys Hemma Kungsholmen", chain: Chain.WILLYS, format: StoreFormat.WILLYS_HEMMA, lat: 59.3333, lng: 18.031, address: "Hantverkargatan 56, 112 31 Stockholm" },
  { name: "Hemköp Östermalm", chain: Chain.HEMKOP, format: StoreFormat.HEMKOP, lat: 59.338, lng: 18.08, address: "Östermalmstorg 56, 114 42 Stockholm" },
  { name: "Hemköp Fridhemsplan", chain: Chain.HEMKOP, format: StoreFormat.HEMKOP, lat: 59.331, lng: 18.029, address: "Fridhemsgatan 24, 112 40 Stockholm" },
  { name: "City Gross Bromma", chain: Chain.CITY_GROSS, format: StoreFormat.CITY_GROSS, lat: 59.348, lng: 17.94, address: "Bromma Blocks, Malmvägen 2, 168 58 Bromma" },
  { name: "Lidl Liljeholmen", chain: Chain.LIDL, format: StoreFormat.LIDL, lat: 59.307, lng: 18.02, address: "Liljeholmsvägen 18, 117 61 Stockholm" },
  { name: "Lidl Globen", chain: Chain.LIDL, format: StoreFormat.LIDL, lat: 59.293, lng: 18.079, address: "Palmfeltsvägen 5, 121 62 Johanneshov" },
  { name: "ICA Maxi Haninge", chain: Chain.ICA, format: StoreFormat.ICA_MAXI, lat: 59.1735, lng: 18.154, address: "Handenterminalen 3, 136 44 Haninge" },
  { name: "Coop Nära Gamla Stan", chain: Chain.COOP, format: StoreFormat.COOP_NARA, lat: 59.324, lng: 18.07, address: "Munkbrogatan 2, 111 27 Stockholm" },
];

// ─── Product definitions ────────────────────────────────────────────────────

interface ProductSeed {
  nameSv: string;
  brand?: string;
  sizeValue?: number;
  sizeUnit?: string;
  category: Category;
  subcategory: string;
  dietaryTags?: string[];
  gtin?: string;
  basePrice: number; // SEK – used for price generation
  unitType?: UnitType;
}

const PRODUCTS: ProductSeed[] = [
  // ── FRUKT_GRONT ───────────────────────────
  { nameSv: "Bananer", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 24.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Äpplen Royal Gala", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Gurka", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 18.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Kvisttomater", sizeValue: 500, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Potatis fast", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Rotfrukter", basePrice: 19.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Paprika röd", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Isbergssallad", category: Category.FRUKT_GRONT, subcategory: "Sallad", basePrice: 15.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Lök gul", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 14.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Morötter", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Rotfrukter", basePrice: 16.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Avokado", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 22.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Citron", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 7.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Broccoli", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Vitkål", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 14.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Champinjoner", sizeValue: 250, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Svamp", basePrice: 24.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Päron conference", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Blomkål", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Rödbetor", sizeValue: 500, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Rotfrukter", basePrice: 19.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Spenat baby", sizeValue: 65, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Sallad", basePrice: 22.9, unitType: UnitType.KR_PER_ST, dietaryTags: ["vegan"] },
  { nameSv: "Mango", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Zucchini", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 34.9, unitType: UnitType.KR_PER_KG },

  // ── MEJERI_AGG ────────────────────────────
  { nameSv: "Mjölk 3%", brand: "Arla", sizeValue: 1.5, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Mjölk", basePrice: 19.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Yoghurt naturell", brand: "Arla", sizeValue: 1, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Yoghurt", basePrice: 29.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Hushållsost", brand: "Arla", sizeValue: 1.1, sizeUnit: "kg", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 99.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Smör normalsaltat", brand: "Bregott", sizeValue: 500, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Smör", basePrice: 57.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Ägg 12-pack", sizeValue: 12, sizeUnit: "st", category: Category.MEJERI_AGG, subcategory: "Ägg", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Vispgrädde", sizeValue: 300, sizeUnit: "ml", category: Category.MEJERI_AGG, subcategory: "Grädde", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Riven ost Västerbotten", brand: "Västerbotten", sizeValue: 150, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Gräddfil", sizeValue: 300, sizeUnit: "ml", category: Category.MEJERI_AGG, subcategory: "Grädde", basePrice: 18.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Fil", brand: "Arla", sizeValue: 1, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Fil", basePrice: 21.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Kvarg naturell", brand: "Lindahls", sizeValue: 500, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Kvarg", basePrice: 34.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["proteinrik"] },
  { nameSv: "Crème fraiche", brand: "Arla", sizeValue: 200, sizeUnit: "ml", category: Category.MEJERI_AGG, subcategory: "Grädde", basePrice: 19.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Mjölk 1.5%", brand: "Arla", sizeValue: 1.5, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Mjölk", basePrice: 18.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Riven ost Grevé", brand: "Arla", sizeValue: 300, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 42.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Mozzarella", brand: "Galbani", sizeValue: 125, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 24.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Yoghurt blåbär", brand: "Arla", sizeValue: 1, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Yoghurt", basePrice: 32.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Havredryck", brand: "Oatly", sizeValue: 1, sizeUnit: "L", category: Category.MEJERI_AGG, subcategory: "Växtbaserat", basePrice: 27.9, unitType: UnitType.KR_PER_L, dietaryTags: ["vegan", "laktosfri"] },
  { nameSv: "Matlagningsgrädde", sizeValue: 250, sizeUnit: "ml", category: Category.MEJERI_AGG, subcategory: "Grädde", basePrice: 16.9, unitType: UnitType.KR_PER_L },

  // ── KÖTT ──────────────────────────────────
  { nameSv: "Nötfärs 10%", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Färs", basePrice: 54.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kycklingfilé", sizeValue: 1, sizeUnit: "kg", category: Category.KOTT, subcategory: "Kyckling", basePrice: 99.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Fläskfilé", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 54.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Blandfärs", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Färs", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kycklingben", sizeValue: 1, sizeUnit: "kg", category: Category.KOTT, subcategory: "Kyckling", basePrice: 59.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Karré fläskkotlett", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 59.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kycklinglårfilé", sizeValue: 700, sizeUnit: "g", category: Category.KOTT, subcategory: "Kyckling", basePrice: 79.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Bacon", brand: "Scan", sizeValue: 140, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Entrecôte", sizeValue: 300, sizeUnit: "g", category: Category.KOTT, subcategory: "Nöt", basePrice: 89.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kalkonfilé", sizeValue: 400, sizeUnit: "g", category: Category.KOTT, subcategory: "Kalkon", basePrice: 64.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Lammfärs", sizeValue: 400, sizeUnit: "g", category: Category.KOTT, subcategory: "Lamm", basePrice: 69.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Grillkorv", brand: "Scan", sizeValue: 600, sizeUnit: "g", category: Category.KOTT, subcategory: "Korv", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Köttbullar", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Färdigmat", basePrice: 44.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Högrev", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Nöt", basePrice: 79.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Fläskytterfilé", sizeValue: 400, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 49.9, unitType: UnitType.KR_PER_KG },

  // ── FISK_SKALDJUR ─────────────────────────
  { nameSv: "Laxfilé", sizeValue: 400, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Fisk", basePrice: 89.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Räkor skalade", sizeValue: 200, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Skaldjur", basePrice: 64.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Torskfilé", sizeValue: 400, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Fisk", basePrice: 79.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Sill inlagd", brand: "Abba", sizeValue: 240, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Konserverad fisk", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Tonfisk i vatten", sizeValue: 185, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Konserverad fisk", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Makrill i tomatsås", brand: "Abba", sizeValue: 125, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Konserverad fisk", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Sej panerad", sizeValue: 400, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Fisk", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Rökt lax", sizeValue: 100, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Fisk", basePrice: 44.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Surimi kräftstjärtar", sizeValue: 200, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Skaldjur", basePrice: 34.9, unitType: UnitType.KR_PER_KG },

  // ── CHARK_PALAGG ──────────────────────────
  { nameSv: "Skinka kokt", brand: "Scan", sizeValue: 200, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Skinka", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Salami", brand: "Nyhléns & Hugosons", sizeValue: 100, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Korv", basePrice: 32.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Leverpastej", brand: "Scan", sizeValue: 200, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Pastej", basePrice: 24.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kalkonpålägg", brand: "Pärsons", sizeValue: 120, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Pålägg", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Prinskorv", brand: "Scan", sizeValue: 300, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Korv", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Rökt skinka", sizeValue: 150, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Skinka", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Falukorv", brand: "Scan", sizeValue: 800, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Korv", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Chorizo", sizeValue: 200, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Korv", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kaviar", brand: "Kalles", sizeValue: 300, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Pålägg", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hamburgare frysta", sizeValue: 600, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Hamburgare", basePrice: 44.9, unitType: UnitType.KR_PER_KG },

  // ── BRÖD_BAGERI ───────────────────────────
  { nameSv: "Storformslimpa", brand: "Pågen", sizeValue: 950, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tortilla mjuka 8-pack", brand: "Santa Maria", sizeValue: 320, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Tortilla", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Knäckebröd Husman", brand: "Wasa", sizeValue: 520, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Knäckebröd", basePrice: 27.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kanelbullar 6-pack", sizeValue: 300, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Fikabröd", basePrice: 32.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Korvbröd 10-pack", brand: "Korvbrödsbagarn", sizeValue: 300, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Rågbröd", brand: "Polarbröd", sizeValue: 550, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hamburgerbröd 8-pack", brand: "Korvbrödsbagarn", sizeValue: 320, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Formfranska", brand: "Pågen", sizeValue: 500, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 26.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Lantbröd", brand: "Pågen", sizeValue: 750, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 33.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Polarbrödkaka", brand: "Polarbröd", sizeValue: 330, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Tunnbröd", basePrice: 27.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Havrefralla 6-pack", sizeValue: 360, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Frallor", basePrice: 29.9, unitType: UnitType.KR_PER_ST },

  // ── SKAFFERI ──────────────────────────────
  { nameSv: "Pasta penne", brand: "Barilla", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Pasta", basePrice: 18.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Ris basmati", sizeValue: 1, sizeUnit: "kg", category: Category.SKAFFERI, subcategory: "Ris", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Krossade tomater", brand: "Mutti", sizeValue: 400, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Konserver", basePrice: 16.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Tacokrydda", brand: "Santa Maria", sizeValue: 28, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Kryddor", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tacosås mild", brand: "Santa Maria", sizeValue: 230, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Såser", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Majs på burk", sizeValue: 340, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Konserver", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Rapsolja", brand: "Zeta", sizeValue: 1, sizeUnit: "L", category: Category.SKAFFERI, subcategory: "Oljor", basePrice: 34.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Spaghetti", brand: "Barilla", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Pasta", basePrice: 18.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kokosmjölk", sizeValue: 400, sizeUnit: "ml", category: Category.SKAFFERI, subcategory: "Asiatiskt", basePrice: 19.9, unitType: UnitType.KR_PER_L, dietaryTags: ["vegan"] },
  { nameSv: "Ketchup", brand: "Felix", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Såser", basePrice: 27.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Senap", brand: "Slotts", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Såser", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Olivolja extra virgin", brand: "Zeta", sizeValue: 500, sizeUnit: "ml", category: Category.SKAFFERI, subcategory: "Oljor", basePrice: 59.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Vetemjöl", brand: "Kungsörnen", sizeValue: 2, sizeUnit: "kg", category: Category.SKAFFERI, subcategory: "Mjöl", basePrice: 22.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Strösocker", brand: "Dansukker", sizeValue: 1, sizeUnit: "kg", category: Category.SKAFFERI, subcategory: "Socker", basePrice: 17.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Linser röda", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Baljväxter", basePrice: 24.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan", "glutenfri"] },
  { nameSv: "Tomatpuré", brand: "Mutti", sizeValue: 200, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Konserver", basePrice: 22.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Sojasås", brand: "Kikkoman", sizeValue: 250, sizeUnit: "ml", category: Category.SKAFFERI, subcategory: "Asiatiskt", basePrice: 32.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Müsli crunch", brand: "AXA", sizeValue: 750, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Flingor", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Havregryn", brand: "AXA", sizeValue: 1, sizeUnit: "kg", category: Category.SKAFFERI, subcategory: "Flingor", basePrice: 22.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Bönor vita", sizeValue: 380, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Baljväxter", basePrice: 14.9, unitType: UnitType.KR_PER_ST, dietaryTags: ["vegan"] },
  { nameSv: "Pastasås bolognese", brand: "Felix", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Såser", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Tacoskal", brand: "Santa Maria", sizeValue: 135, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Mexicanskt", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Honung", sizeValue: 350, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Sylt & marmelad", basePrice: 44.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Jordnötssmör", brand: "Felix", sizeValue: 340, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Pålägg", basePrice: 39.9, unitType: UnitType.KR_PER_KG },

  // ── FRYST ─────────────────────────────────
  { nameSv: "Frysta grönsaker wok mix", sizeValue: 600, sizeUnit: "g", category: Category.FRYST, subcategory: "Grönsaker", basePrice: 24.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Glass vanilj", brand: "SIA Glass", sizeValue: 500, sizeUnit: "ml", category: Category.FRYST, subcategory: "Glass", basePrice: 39.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Pizza Vesuvio", brand: "Grandiosa", sizeValue: 350, sizeUnit: "g", category: Category.FRYST, subcategory: "Pizza", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Fiskpinnar", brand: "Findus", sizeValue: 450, sizeUnit: "g", category: Category.FRYST, subcategory: "Fisk", basePrice: 44.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Pommes frites", sizeValue: 1, sizeUnit: "kg", category: Category.FRYST, subcategory: "Potatis", basePrice: 24.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Frysta bär hallon", sizeValue: 250, sizeUnit: "g", category: Category.FRYST, subcategory: "Bär", basePrice: 34.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Lasagne", brand: "Findus", sizeValue: 400, sizeUnit: "g", category: Category.FRYST, subcategory: "Färdigmat", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Köttbullar frysta", sizeValue: 600, sizeUnit: "g", category: Category.FRYST, subcategory: "Kött", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Frysta ärtor", sizeValue: 800, sizeUnit: "g", category: Category.FRYST, subcategory: "Grönsaker", basePrice: 19.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Pizza Quattro Stagioni", brand: "Dr. Oetker", sizeValue: 395, sizeUnit: "g", category: Category.FRYST, subcategory: "Pizza", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Pirogger", brand: "Findus", sizeValue: 360, sizeUnit: "g", category: Category.FRYST, subcategory: "Färdigmat", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Chicken nuggets", sizeValue: 500, sizeUnit: "g", category: Category.FRYST, subcategory: "Kyckling", basePrice: 44.9, unitType: UnitType.KR_PER_KG },

  // ── DRYCK ─────────────────────────────────
  { nameSv: "Kaffe mellanrost", brand: "Gevalia", sizeValue: 450, sizeUnit: "g", category: Category.DRYCK, subcategory: "Kaffe", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kaffe mellanrost", brand: "Löfbergs", sizeValue: 450, sizeUnit: "g", category: Category.DRYCK, subcategory: "Kaffe", basePrice: 47.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Juice apelsin", brand: "Bravo", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Juice", basePrice: 29.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Coca-Cola", brand: "Coca-Cola", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Läsk", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Mineralvatten kolsyrat", brand: "Ramlösa", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Vatten", basePrice: 16.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Te Earl Grey", brand: "Lipton", sizeValue: 20, sizeUnit: "st", category: Category.DRYCK, subcategory: "Te", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Pepsi Max", brand: "Pepsi", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Läsk", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Juice äpple", brand: "Bravo", sizeValue: 1, sizeUnit: "L", category: Category.DRYCK, subcategory: "Juice", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Nocco BCAA", brand: "Nocco", sizeValue: 330, sizeUnit: "ml", category: Category.DRYCK, subcategory: "Energidryck", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Fanta Orange", brand: "Fanta", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Läsk", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Kaffe espresso", brand: "Zoégas", sizeValue: 450, sizeUnit: "g", category: Category.DRYCK, subcategory: "Kaffe", basePrice: 54.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Loka naturell", brand: "Loka", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Vatten", basePrice: 13.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Saft hallon", brand: "BOB", sizeValue: 950, sizeUnit: "ml", category: Category.DRYCK, subcategory: "Saft", basePrice: 32.9, unitType: UnitType.KR_PER_L },

  // ── SNACKS_GODIS ──────────────────────────
  { nameSv: "Chips lättsaltade", brand: "OLW", sizeValue: 275, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Chips", basePrice: 32.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Choklad mjölkchoklad", brand: "Marabou", sizeValue: 200, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Choklad", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Nötter cashew", sizeValue: 200, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Nötter", basePrice: 44.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Lösgodis", sizeValue: 1, sizeUnit: "kg", category: Category.SNACKS_GODIS, subcategory: "Godis", basePrice: 109.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Popcorn mikro", brand: "OLW", sizeValue: 3, sizeUnit: "st", category: Category.SNACKS_GODIS, subcategory: "Popcorn", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Kex Ballerina", brand: "Göteborgs", sizeValue: 190, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Kex", basePrice: 27.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Chips dipp", brand: "Estrella", sizeValue: 275, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Chips", basePrice: 32.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Chokladkaka Daim", brand: "Marabou", sizeValue: 200, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Choklad", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Nötmix", sizeValue: 350, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Nötter", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Lakrits", brand: "Malaco", sizeValue: 80, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Godis", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Kex Singoalla", brand: "Göteborgs", sizeValue: 190, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Kex", basePrice: 27.9, unitType: UnitType.KR_PER_ST },

  // ── BARN_BABY ─────────────────────────────
  { nameSv: "Blöjor stl 4", brand: "Libero", sizeValue: 54, sizeUnit: "st", category: Category.BARN_BABY, subcategory: "Blöjor", basePrice: 149.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Barnmat grönsaker 6 mån", brand: "Semper", sizeValue: 190, sizeUnit: "g", category: Category.BARN_BABY, subcategory: "Barnmat", basePrice: 18.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Modersmjölksersättning", brand: "Semper", sizeValue: 400, sizeUnit: "g", category: Category.BARN_BABY, subcategory: "Mjölk", basePrice: 129.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Barnvåtservetter", brand: "Libero", sizeValue: 64, sizeUnit: "st", category: Category.BARN_BABY, subcategory: "Hygien", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Välling naturell 8 mån", brand: "Semper", sizeValue: 725, sizeUnit: "g", category: Category.BARN_BABY, subcategory: "Barnmat", basePrice: 54.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Fruktpuré äpple banan", brand: "Semper", sizeValue: 90, sizeUnit: "g", category: Category.BARN_BABY, subcategory: "Barnmat", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Nappflaska 260ml", brand: "Philips Avent", sizeValue: 1, sizeUnit: "st", category: Category.BARN_BABY, subcategory: "Tillbehör", basePrice: 99.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Barnmat kyckling ris 12 mån", brand: "Semper", sizeValue: 235, sizeUnit: "g", category: Category.BARN_BABY, subcategory: "Barnmat", basePrice: 24.9, unitType: UnitType.KR_PER_ST },

  // ── HALSA_SKONHET ─────────────────────────
  { nameSv: "Tandkräm", brand: "Colgate", sizeValue: 75, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Munvård", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Schampo", brand: "Head & Shoulders", sizeValue: 250, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Hårvård", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Deodorant", brand: "Rexona", sizeValue: 150, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Deodorant", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tvål flytande", brand: "Palmolive", sizeValue: 300, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Tvål", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tandborste medium", brand: "Jordan", sizeValue: 1, sizeUnit: "st", category: Category.HALSA_SKONHET, subcategory: "Munvård", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Balsam", brand: "Head & Shoulders", sizeValue: 250, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Hårvård", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hudkräm", brand: "Nivea", sizeValue: 200, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Hudvård", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Raklådor 8-pack", brand: "Gillette", sizeValue: 8, sizeUnit: "st", category: Category.HALSA_SKONHET, subcategory: "Rakning", basePrice: 199.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Solskydd SPF30", brand: "Nivea", sizeValue: 200, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Solskydd", basePrice: 79.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Duschgel", brand: "Dove", sizeValue: 250, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Dusch", basePrice: 39.9, unitType: UnitType.KR_PER_ST },

  // ── VEGO ──────────────────────────────────
  { nameSv: "Vegofärs", brand: "Hälsans Kök", sizeValue: 300, sizeUnit: "g", category: Category.VEGO, subcategory: "Färs", basePrice: 39.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Tofu naturell", sizeValue: 400, sizeUnit: "g", category: Category.VEGO, subcategory: "Tofu", basePrice: 29.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Vegokorv", brand: "Hälsans Kök", sizeValue: 300, sizeUnit: "g", category: Category.VEGO, subcategory: "Korv", basePrice: 39.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Hummus", sizeValue: 200, sizeUnit: "g", category: Category.VEGO, subcategory: "Dipp", basePrice: 24.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Veggobullar", brand: "ICA", sizeValue: 400, sizeUnit: "g", category: Category.VEGO, subcategory: "Bullar", basePrice: 44.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Sojafärs", sizeValue: 300, sizeUnit: "g", category: Category.VEGO, subcategory: "Färs", basePrice: 24.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan", "glutenfri"] },
  { nameSv: "Växtbaserad grädde", brand: "Oatly", sizeValue: 250, sizeUnit: "ml", category: Category.VEGO, subcategory: "Matlagning", basePrice: 22.9, unitType: UnitType.KR_PER_L, dietaryTags: ["vegan", "laktosfri"] },
  { nameSv: "Tempeh", sizeValue: 200, sizeUnit: "g", category: Category.VEGO, subcategory: "Tempeh", basePrice: 34.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Falafel", sizeValue: 300, sizeUnit: "g", category: Category.VEGO, subcategory: "Baljväxter", basePrice: 29.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Vegobacon", brand: "Hälsans Kök", sizeValue: 100, sizeUnit: "g", category: Category.VEGO, subcategory: "Pålägg", basePrice: 29.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Vegansk ost", brand: "Violife", sizeValue: 200, sizeUnit: "g", category: Category.VEGO, subcategory: "Ost", basePrice: 44.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan", "laktosfri"] },

  // ── HEM_STAD ──────────────────────────────
  { nameSv: "Diskmedel", brand: "Yes", sizeValue: 500, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Disk", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tvättmedel color", brand: "Via", sizeValue: 750, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Tvätt", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Toalettpapper 12-pack", brand: "Lambi", sizeValue: 12, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Papper", basePrice: 59.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hushållspapper", brand: "Tork", sizeValue: 4, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Papper", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Allrengöring", brand: "Ajax", sizeValue: 750, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Rengöring", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Soppåsar 30L", sizeValue: 15, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Påsar", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Diskmaskinstavletter", brand: "Finish", sizeValue: 50, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Disk", basePrice: 99.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Fönsterputs", brand: "Ajax", sizeValue: 750, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Rengöring", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Sköljmedel", brand: "Comfort", sizeValue: 750, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Tvätt", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Tvättmedel vit", brand: "Via", sizeValue: 750, sizeUnit: "ml", category: Category.HEM_STAD, subcategory: "Tvätt", basePrice: 49.9, unitType: UnitType.KR_PER_ST },

  // ── DJUR ──────────────────────────────────
  { nameSv: "Kattmat våtfoder", brand: "Whiskas", sizeValue: 400, sizeUnit: "g", category: Category.DJUR, subcategory: "Katt", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hundmat torrfoder", brand: "Pedigree", sizeValue: 2, sizeUnit: "kg", category: Category.DJUR, subcategory: "Hund", basePrice: 79.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kattmat torrfoder", brand: "Whiskas", sizeValue: 1.4, sizeUnit: "kg", category: Category.DJUR, subcategory: "Katt", basePrice: 69.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kattsand", brand: "Ever Clean", sizeValue: 10, sizeUnit: "L", category: Category.DJUR, subcategory: "Katt", basePrice: 149.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hundben tugg", sizeValue: 5, sizeUnit: "st", category: Category.DJUR, subcategory: "Hund", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Hundmat våtfoder", brand: "Pedigree", sizeValue: 400, sizeUnit: "g", category: Category.DJUR, subcategory: "Hund", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Kattsnacks", brand: "Dreamies", sizeValue: 60, sizeUnit: "g", category: Category.DJUR, subcategory: "Katt", basePrice: 24.9, unitType: UnitType.KR_PER_ST },

  // ── Extra FRUKT_GRONT ─────────────────────
  { nameSv: "Vindruvor gröna", sizeValue: 500, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Ananas", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Selleri stjälk", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Ruccola", sizeValue: 65, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Sallad", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Vattenmelon", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Palsternacka", sizeValue: 500, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Rotfrukter", basePrice: 22.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Klementiner", sizeValue: 1, sizeUnit: "kg", category: Category.FRUKT_GRONT, subcategory: "Frukt", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Grönkål", sizeValue: 200, sizeUnit: "g", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 24.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Purjolök", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Vitlök 3-pack", sizeValue: 3, sizeUnit: "st", category: Category.FRUKT_GRONT, subcategory: "Grönsaker", basePrice: 14.9, unitType: UnitType.KR_PER_ST },

  // ── Extra MEJERI_AGG ──────────────────────
  { nameSv: "Cottage cheese naturell", brand: "Keso", sizeValue: 250, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Fetaost", brand: "Apetina", sizeValue: 150, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Turkisk yoghurt 10%", sizeValue: 500, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Yoghurt", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Parmesanost riven", sizeValue: 100, sizeUnit: "g", category: Category.MEJERI_AGG, subcategory: "Ost", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Ägg 6-pack ekologisk", sizeValue: 6, sizeUnit: "st", category: Category.MEJERI_AGG, subcategory: "Ägg", basePrice: 34.9, unitType: UnitType.KR_PER_ST },

  // ── Extra KÖTT ────────────────────────────
  { nameSv: "Revbensspjäll fläsk", sizeValue: 1, sizeUnit: "kg", category: Category.KOTT, subcategory: "Fläsk", basePrice: 89.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kycklingvingar", sizeValue: 900, sizeUnit: "g", category: Category.KOTT, subcategory: "Kyckling", basePrice: 59.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Pulled pork", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 69.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Nötfärs 12% ekologisk", sizeValue: 400, sizeUnit: "g", category: Category.KOTT, subcategory: "Färs", basePrice: 64.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kassler", sizeValue: 500, sizeUnit: "g", category: Category.KOTT, subcategory: "Fläsk", basePrice: 44.9, unitType: UnitType.KR_PER_KG },

  // ── Extra FISK_SKALDJUR ───────────────────
  { nameSv: "Fisk panerad sej", brand: "Findus", sizeValue: 400, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Fisk", basePrice: 54.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Kräftstjärtar", sizeValue: 250, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Skaldjur", basePrice: 59.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Sardiner i olja", sizeValue: 120, sizeUnit: "g", category: Category.FISK_SKALDJUR, subcategory: "Konserverad fisk", basePrice: 19.9, unitType: UnitType.KR_PER_ST },

  // ── Extra CHARK_PALAGG ────────────────────
  { nameSv: "Köttbullar kylda", sizeValue: 500, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Färdigmat", basePrice: 49.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Skinka rökta skivor", sizeValue: 120, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Skinka", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Medvurst", sizeValue: 150, sizeUnit: "g", category: Category.CHARK_PALAGG, subcategory: "Korv", basePrice: 27.9, unitType: UnitType.KR_PER_KG },

  // ── Extra BRÖD_BAGERI ─────────────────────
  { nameSv: "Baguette", sizeValue: 300, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Scones 6-pack", sizeValue: 300, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Fikabröd", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Naanbröd 4-pack", sizeValue: 260, sizeUnit: "g", category: Category.BROD_BAGERI, subcategory: "Mjukt bröd", basePrice: 24.9, unitType: UnitType.KR_PER_ST },

  // ── Extra SKAFFERI ────────────────────────
  { nameSv: "Nudlar snabbnudlar", brand: "Mama", sizeValue: 5, sizeUnit: "st", category: Category.SKAFFERI, subcategory: "Asiatiskt", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Sylt jordgubb", brand: "Felix", sizeValue: 410, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Sylt & marmelad", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Ättiksgurka", brand: "Felix", sizeValue: 370, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Konserver", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Kikärtor", sizeValue: 380, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Baljväxter", basePrice: 14.9, unitType: UnitType.KR_PER_ST, dietaryTags: ["vegan"] },
  { nameSv: "Risoni pasta", brand: "Barilla", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Pasta", basePrice: 22.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Grönsaksbuljongtärning", brand: "Knorr", sizeValue: 6, sizeUnit: "st", category: Category.SKAFFERI, subcategory: "Kryddor", basePrice: 14.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Pesto verde", brand: "Barilla", sizeValue: 190, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Såser", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Cornflakes", brand: "Kelloggs", sizeValue: 500, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Flingor", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Marmelad apelsin", brand: "BOB", sizeValue: 425, sizeUnit: "g", category: Category.SKAFFERI, subcategory: "Sylt & marmelad", basePrice: 29.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Vitvinsvinäger", sizeValue: 500, sizeUnit: "ml", category: Category.SKAFFERI, subcategory: "Oljor", basePrice: 24.9, unitType: UnitType.KR_PER_L },

  // ── Extra FRYST ───────────────────────────
  { nameSv: "Frysta blåbär", sizeValue: 400, sizeUnit: "g", category: Category.FRYST, subcategory: "Bär", basePrice: 34.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Räkmacka fryst", sizeValue: 270, sizeUnit: "g", category: Category.FRYST, subcategory: "Färdigmat", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Pannkakor frysta", brand: "Findus", sizeValue: 480, sizeUnit: "g", category: Category.FRYST, subcategory: "Färdigmat", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Glass choklad", brand: "Ben & Jerrys", sizeValue: 465, sizeUnit: "ml", category: Category.FRYST, subcategory: "Glass", basePrice: 69.9, unitType: UnitType.KR_PER_L },

  // ── Extra DRYCK ───────────────────────────
  { nameSv: "Redbull energidryck", brand: "Red Bull", sizeValue: 250, sizeUnit: "ml", category: Category.DRYCK, subcategory: "Energidryck", basePrice: 19.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Festis tropical", brand: "Festis", sizeValue: 1, sizeUnit: "L", category: Category.DRYCK, subcategory: "Läsk", basePrice: 19.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Sprite", brand: "Sprite", sizeValue: 1.5, sizeUnit: "L", category: Category.DRYCK, subcategory: "Läsk", basePrice: 22.9, unitType: UnitType.KR_PER_L },
  { nameSv: "Kaffe brygg ekologisk", brand: "Zoégas", sizeValue: 450, sizeUnit: "g", category: Category.DRYCK, subcategory: "Kaffe", basePrice: 59.9, unitType: UnitType.KR_PER_KG },

  // ── Extra SNACKS_GODIS ────────────────────
  { nameSv: "Dajm påse", brand: "Marabou", sizeValue: 225, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Choklad", basePrice: 39.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Pringles original", brand: "Pringles", sizeValue: 200, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Chips", basePrice: 34.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Digestive", brand: "McVities", sizeValue: 400, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Kex", basePrice: 32.9, unitType: UnitType.KR_PER_KG },
  { nameSv: "Gott och blandat", brand: "Malaco", sizeValue: 210, sizeUnit: "g", category: Category.SNACKS_GODIS, subcategory: "Godis", basePrice: 32.9, unitType: UnitType.KR_PER_ST },

  // ── Extra HALSA_SKONHET ───────────────────
  { nameSv: "Ansiktskräm", brand: "Nivea", sizeValue: 50, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Hudvård", basePrice: 69.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Handsprit", sizeValue: 250, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Hygien", basePrice: 29.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Munskölj", brand: "Listerine", sizeValue: 500, sizeUnit: "ml", category: Category.HALSA_SKONHET, subcategory: "Munvård", basePrice: 49.9, unitType: UnitType.KR_PER_ST },

  // ── Extra HEM_STAD ────────────────────────
  { nameSv: "Mopprefill", sizeValue: 1, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Rengöring", basePrice: 49.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Matförvaring 1L 5-pack", sizeValue: 5, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Förvaring", basePrice: 39.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Bakplåtspapper", sizeValue: 10, sizeUnit: "m", category: Category.HEM_STAD, subcategory: "Förvaring", basePrice: 24.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Aluminiumfolie", sizeValue: 20, sizeUnit: "m", category: Category.HEM_STAD, subcategory: "Förvaring", basePrice: 34.9, unitType: UnitType.KR_PER_ST },
  { nameSv: "Plastpåsar 6L", sizeValue: 30, sizeUnit: "st", category: Category.HEM_STAD, subcategory: "Påsar", basePrice: 19.9, unitType: UnitType.KR_PER_ST },

  // ── Extra VEGO ────────────────────────────
  { nameSv: "Vegogryta linser", sizeValue: 390, sizeUnit: "g", category: Category.VEGO, subcategory: "Färdigmat", basePrice: 34.9, unitType: UnitType.KR_PER_ST, dietaryTags: ["vegan"] },
  { nameSv: "Vegoburger", brand: "Hälsans Kök", sizeValue: 240, sizeUnit: "g", category: Category.VEGO, subcategory: "Burgare", basePrice: 44.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
  { nameSv: "Edamame bönor", sizeValue: 400, sizeUnit: "g", category: Category.VEGO, subcategory: "Baljväxter", basePrice: 34.9, unitType: UnitType.KR_PER_KG, dietaryTags: ["vegan"] },
];

// ─── Price multipliers per chain / format ───────────────────────────────────

/** Returns a price multiplier based on chain & format. */
function priceMultiplier(chain: Chain, format: StoreFormat): number {
  switch (format) {
    case StoreFormat.WILLYS:
      return 0.92;
    case StoreFormat.WILLYS_HEMMA:
      return 0.95;
    case StoreFormat.LIDL:
      return 0.90;
    case StoreFormat.ICA_MAXI:
      return 0.97;
    case StoreFormat.ICA_KVANTUM:
      return 1.0;
    case StoreFormat.ICA_SUPERMARKET:
      return 1.02;
    case StoreFormat.ICA_NARA:
      return 1.12;
    case StoreFormat.STORA_COOP:
      return 0.96;
    case StoreFormat.COOP:
      return 1.02;
    case StoreFormat.COOP_NARA:
      return 1.10;
    case StoreFormat.HEMKOP:
      return 1.05;
    case StoreFormat.CITY_GROSS:
      return 0.98;
    default:
      return 1.0;
  }
}

/** City Gross gets an extra meat discount. */
function categoryMultiplier(chain: Chain, category: Category): number {
  if (chain === Chain.CITY_GROSS && (category === Category.KOTT || category === Category.CHARK_PALAGG)) {
    return 0.94;
  }
  if (chain === Chain.LIDL && (category === Category.BROD_BAGERI)) {
    return 0.93;
  }
  return 1.0;
}

// ─── Main seed function ─────────────────────────────────────────────────────

async function main() {
  console.log("🌱 CartWise Stockholm – seeding database …\n");

  // ─── 1. Clear existing data ─────────────────────────────────────────────
  console.log("  Clearing existing data …");
  await prisma.dealItem.deleteMany();
  await prisma.dealFlyer.deleteMany();
  await prisma.regularPrice.deleteMany();
  await prisma.shoppingListItem.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  console.log("  Done.\n");

  // ─── 2. Seed stores ────────────────────────────────────────────────────
  console.log("  Creating stores …");
  await prisma.store.createMany({
    data: STORES.map((s) => ({
      name: s.name,
      chain: s.chain,
      format: s.format,
      lat: s.lat,
      lng: s.lng,
      city: "Stockholm",
      address: s.address,
    })),
  });
  const allStores = await prisma.store.findMany();
  console.log(`  Created ${allStores.length} stores.\n`);

  // Build lookup maps
  const storeByName = new Map(allStores.map((s) => [s.name, s]));
  const storesByFormat = new Map<StoreFormat, typeof allStores>();
  for (const s of allStores) {
    const arr = storesByFormat.get(s.format) ?? [];
    arr.push(s);
    storesByFormat.set(s.format, arr);
  }

  // ─── 3. Seed products ──────────────────────────────────────────────────
  console.log("  Creating products …");
  await prisma.product.createMany({
    data: PRODUCTS.map((p) => ({
      nameSv: p.nameSv,
      brand: p.brand ?? null,
      sizeValue: p.sizeValue ?? null,
      sizeUnit: p.sizeUnit ?? null,
      category: p.category,
      subcategory: p.subcategory,
      dietaryTags: p.dietaryTags ?? [],
      gtin: p.gtin ?? null,
      normalizedKey: normalizeProductKey(p.nameSv, p.brand, p.sizeValue, p.sizeUnit),
    })),
  });
  const allProducts = await prisma.product.findMany();
  console.log(`  Created ${allProducts.length} products.\n`);

  // Build a lookup from normalizedKey to product
  const productByKey = new Map(allProducts.map((p) => [p.normalizedKey, p]));

  // Build a parallel array so we can reference basePrice & unitType from PRODUCTS
  const productSeedByKey = new Map(
    PRODUCTS.map((p) => [normalizeProductKey(p.nameSv, p.brand, p.sizeValue, p.sizeUnit), p]),
  );

  // ─── 4. Seed regular prices ────────────────────────────────────────────
  console.log("  Creating regular prices …");

  // We'll pick a random subset of 10-14 stores for each product.
  const priceBatch: Array<{
    storeId: string;
    productId: string;
    priceSek: number;
    unitPriceSek: number | null;
    unitUnit: UnitType | null;
    inStock: boolean;
    observedAt: Date;
    source: PriceSource;
  }> = [];

  for (const product of allProducts) {
    const seed = productSeedByKey.get(product.normalizedKey);
    if (!seed) continue;

    // Choose 10-14 stores at random
    const storeCount = 10 + Math.floor(Math.random() * 5); // 10..14
    const shuffled = [...allStores].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, Math.min(storeCount, shuffled.length));

    for (const store of chosen) {
      const mult = priceMultiplier(store.chain, store.format);
      const catMult = categoryMultiplier(store.chain, seed.category);
      const base = seed.basePrice * mult * catMult;
      const price = jitter(base, 0.03); // ±3 % jitter

      // Compute a unit price if we have a unitType
      let unitPriceSek: number | null = null;
      if (seed.unitType && seed.sizeValue && seed.sizeUnit) {
        const sizeVal = seed.sizeValue;
        const unit = seed.sizeUnit.toLowerCase();
        if (seed.unitType === UnitType.KR_PER_KG) {
          const kg = unit === "kg" ? sizeVal : unit === "g" ? sizeVal / 1000 : sizeVal;
          unitPriceSek = kg > 0 ? Math.round((price / kg) * 100) / 100 : null;
        } else if (seed.unitType === UnitType.KR_PER_L) {
          const l = unit === "l" ? sizeVal : unit === "ml" ? sizeVal / 1000 : sizeVal;
          unitPriceSek = l > 0 ? Math.round((price / l) * 100) / 100 : null;
        } else {
          const st = unit === "st" ? sizeVal : 1;
          unitPriceSek = st > 0 ? Math.round((price / st) * 100) / 100 : null;
        }
      }

      priceBatch.push({
        storeId: store.id,
        productId: product.id,
        priceSek: price,
        unitPriceSek,
        unitUnit: seed.unitType ?? null,
        inStock: Math.random() > 0.03, // 97 % in stock
        observedAt: daysAgo(2 + Math.floor(Math.random() * 4)), // 2-5 days ago
        source: PriceSource.SEED,
      });
    }
  }

  // Batch insert
  await prisma.regularPrice.createMany({ data: priceBatch });
  console.log(`  Created ${priceBatch.length} regular prices.\n`);

  // ─── 5. Seed deal flyers ───────────────────────────────────────────────
  console.log("  Creating deal flyers …");

  const weekStart = currentWeekMonday();
  const weekEnd = currentWeekSunday();

  // Flyer 1: Willys Hornstull
  const willysStore = storeByName.get("Willys Hornstull")!;
  const willysFlyerRow = await prisma.dealFlyer.create({
    data: {
      storeId: willysStore.id,
      sourceType: FlyerSourceType.ADMIN,
      title: "Willys veckans erbjudanden",
      weekStart,
      weekEnd,
      fetchedAt: daysAgo(1),
      parseStatus: ParseStatus.APPROVED,
    },
  });

  // Flyer 2: ICA Maxi Lindhagen
  const icaMaxiStore = storeByName.get("ICA Maxi Lindhagen")!;
  const icaFlyerRow = await prisma.dealFlyer.create({
    data: {
      storeId: icaMaxiStore.id,
      sourceType: FlyerSourceType.ADMIN,
      title: "ICA Maxi reklamblad",
      weekStart,
      weekEnd,
      fetchedAt: daysAgo(1),
      parseStatus: ParseStatus.APPROVED,
    },
  });

  console.log("  Created 2 deal flyers.\n");

  // ─── 6. Seed deal items ────────────────────────────────────────────────
  console.log("  Creating deal items …");

  // Helper to find a product by partial name + optional brand
  function findProduct(name: string, brand?: string): (typeof allProducts)[0] | undefined {
    return allProducts.find((p) => {
      const nameMatch = p.nameSv.toLowerCase().includes(name.toLowerCase());
      if (brand) return nameMatch && p.brand?.toLowerCase() === brand.toLowerCase();
      return nameMatch;
    });
  }

  // ── Willys deals ──
  interface DealItemInput {
    flyerId: string;
    productId?: string | null;
    normalizedName: string;
    brand?: string | null;
    sizeValue?: number | null;
    sizeUnit?: string | null;
    dealPriceSek: number;
    multiBuyType?: MultiBuyType;
    multiBuyX?: number | null;
    multiBuyY?: number | null;
    conditionsText?: string | null;
    memberOnly?: boolean;
    limitPerHousehold?: number | null;
    validFrom?: Date | null;
    validTo?: Date | null;
    unitPriceSek?: number | null;
    unitUnit?: UnitType | null;
    confidenceScore?: number;
    approved?: boolean;
  }

  const willysDeals: DealItemInput[] = [
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Mjölk 3% Arla 1.5L",
      brand: "Arla",
      sizeValue: 1.5,
      sizeUnit: "L",
      dealPriceSek: 35,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 35,
      conditionsText: "2 för 35 kr",
      unitPriceSek: 11.67,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Nötfärs 10% 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 39.9,
      unitPriceSek: 79.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Bananer",
      dealPriceSek: 19.9,
      unitPriceSek: 19.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Kaffe mellanrost Gevalia 450g",
      brand: "Gevalia",
      sizeValue: 450,
      sizeUnit: "g",
      dealPriceSek: 34.9,
      memberOnly: true,
      conditionsText: "Medlemspris med Willys Plus",
      unitPriceSek: 77.56,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Kycklingfilé 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 69.9,
      limitPerHousehold: 2,
      conditionsText: "Max 2 per hushåll",
      unitPriceSek: 69.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Coca-Cola 1.5L",
      brand: "Coca-Cola",
      sizeValue: 1.5,
      sizeUnit: "L",
      dealPriceSek: 45,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 3,
      multiBuyY: 45,
      conditionsText: "3 för 45 kr",
      unitPriceSek: 10,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Chips lättsaltade OLW 275g",
      brand: "OLW",
      sizeValue: 275,
      sizeUnit: "g",
      dealPriceSek: 24.9,
      unitPriceSek: 90.55,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Smör normalsaltat Bregott 500g",
      brand: "Bregott",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 44.9,
      unitPriceSek: 89.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Pasta penne Barilla 500g",
      brand: "Barilla",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 25,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 25,
      conditionsText: "2 för 25 kr",
      unitPriceSek: 25,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Krossade tomater Mutti 400g",
      brand: "Mutti",
      sizeValue: 400,
      sizeUnit: "g",
      dealPriceSek: 12.9,
      unitPriceSek: 32.25,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Äpplen Royal Gala 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 24.9,
      unitPriceSek: 24.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Fläskfilé 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 39.9,
      unitPriceSek: 79.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Toalettpapper 12-pack Lambi",
      brand: "Lambi",
      sizeValue: 12,
      sizeUnit: "st",
      dealPriceSek: 44.9,
      unitPriceSek: 3.74,
      unitUnit: UnitType.KR_PER_ST,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Gurka",
      dealPriceSek: 12.9,
      unitPriceSek: 12.9,
      unitUnit: UnitType.KR_PER_ST,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Blandfärs 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 34.9,
      unitPriceSek: 69.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Yoghurt naturell Arla 1L",
      brand: "Arla",
      sizeValue: 1,
      sizeUnit: "L",
      dealPriceSek: 22.9,
      unitPriceSek: 22.9,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Laxfilé 400g",
      sizeValue: 400,
      sizeUnit: "g",
      dealPriceSek: 69.9,
      unitPriceSek: 174.75,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Mineralvatten Ramlösa 1.5L",
      brand: "Ramlösa",
      sizeValue: 1.5,
      sizeUnit: "L",
      dealPriceSek: 30,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 3,
      multiBuyY: 30,
      conditionsText: "3 för 30 kr",
      unitPriceSek: 6.67,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Isbergssallad",
      dealPriceSek: 10.9,
      unitPriceSek: 10.9,
      unitUnit: UnitType.KR_PER_ST,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Diskmedel Yes 500ml",
      brand: "Yes",
      sizeValue: 500,
      sizeUnit: "ml",
      dealPriceSek: 19.9,
      unitPriceSek: 39.8,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Grillkorv Scan 600g",
      brand: "Scan",
      sizeValue: 600,
      sizeUnit: "g",
      dealPriceSek: 29.9,
      unitPriceSek: 49.83,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Ketchup Felix 500g",
      brand: "Felix",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 19.9,
      unitPriceSek: 39.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Choklad Marabou 200g",
      brand: "Marabou",
      sizeValue: 200,
      sizeUnit: "g",
      dealPriceSek: 49,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 49,
      conditionsText: "2 för 49 kr",
      unitPriceSek: 122.5,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Ris basmati 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 22.9,
      unitPriceSek: 22.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Falukorv Scan 800g",
      brand: "Scan",
      sizeValue: 800,
      sizeUnit: "g",
      dealPriceSek: 29.9,
      memberOnly: true,
      conditionsText: "Medlemspris med Willys Plus",
      unitPriceSek: 37.38,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: willysFlyerRow.id,
      normalizedName: "Potatis fast 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 14.9,
      unitPriceSek: 14.9,
      unitUnit: UnitType.KR_PER_KG,
    },
  ];

  // ── ICA Maxi deals ──
  const icaDeals: DealItemInput[] = [
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Ägg 12-pack",
      sizeValue: 12,
      sizeUnit: "st",
      dealPriceSek: 29.9,
      unitPriceSek: 2.49,
      unitUnit: UnitType.KR_PER_ST,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Pasta penne Barilla 500g",
      brand: "Barilla",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 25,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 25,
      conditionsText: "2 för 25 kr",
      unitPriceSek: 25,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Hushållsost Arla 1.1kg",
      brand: "Arla",
      sizeValue: 1.1,
      sizeUnit: "kg",
      dealPriceSek: 79.9,
      memberOnly: true,
      conditionsText: "ICA Stammis-pris",
      unitPriceSek: 72.64,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Bananer",
      dealPriceSek: 22.9,
      unitPriceSek: 22.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Kycklingfilé 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 74.9,
      unitPriceSek: 74.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Nötfärs 10% 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 44.9,
      unitPriceSek: 89.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Coca-Cola 1.5L",
      brand: "Coca-Cola",
      sizeValue: 1.5,
      sizeUnit: "L",
      dealPriceSek: 17.9,
      unitPriceSek: 11.93,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Kvisttomater 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 22.9,
      unitPriceSek: 45.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Smör Bregott 500g",
      brand: "Bregott",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 47.9,
      memberOnly: true,
      conditionsText: "ICA Stammis-pris",
      unitPriceSek: 95.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Kaffe mellanrost Löfbergs 450g",
      brand: "Löfbergs",
      sizeValue: 450,
      sizeUnit: "g",
      dealPriceSek: 39.9,
      unitPriceSek: 88.67,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Laxfilé 400g",
      sizeValue: 400,
      sizeUnit: "g",
      dealPriceSek: 74.9,
      unitPriceSek: 187.25,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Avokado",
      dealPriceSek: 10,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 3,
      multiBuyY: 30,
      conditionsText: "3 för 30 kr",
      unitPriceSek: 10,
      unitUnit: UnitType.KR_PER_ST,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Fläskfilé 500g",
      sizeValue: 500,
      sizeUnit: "g",
      dealPriceSek: 44.9,
      unitPriceSek: 89.8,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Morötter 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 12.9,
      unitPriceSek: 12.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Tvättmedel Via Color 750ml",
      brand: "Via",
      sizeValue: 750,
      sizeUnit: "ml",
      dealPriceSek: 39.9,
      unitPriceSek: 53.2,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Pizza Grandiosa Vesuvio",
      brand: "Grandiosa",
      sizeValue: 350,
      sizeUnit: "g",
      dealPriceSek: 50,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 50,
      conditionsText: "2 för 50 kr",
      unitPriceSek: 71.43,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Gräddfil 300ml",
      sizeValue: 300,
      sizeUnit: "ml",
      dealPriceSek: 14.9,
      unitPriceSek: 49.67,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Knäckebröd Husman Wasa 520g",
      brand: "Wasa",
      sizeValue: 520,
      sizeUnit: "g",
      dealPriceSek: 19.9,
      unitPriceSek: 38.27,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Juice apelsin Bravo 1.5L",
      brand: "Bravo",
      sizeValue: 1.5,
      sizeUnit: "L",
      dealPriceSek: 22.9,
      unitPriceSek: 15.27,
      unitUnit: UnitType.KR_PER_L,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Paprika röd",
      dealPriceSek: 29.9,
      unitPriceSek: 29.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Tortilla Santa Maria 8-pack 320g",
      brand: "Santa Maria",
      sizeValue: 320,
      sizeUnit: "g",
      dealPriceSek: 22.9,
      unitPriceSek: 71.56,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Vetemjöl Kungsörnen 2kg",
      brand: "Kungsörnen",
      sizeValue: 2,
      sizeUnit: "kg",
      dealPriceSek: 16.9,
      unitPriceSek: 8.45,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Chips OLW 275g",
      brand: "OLW",
      sizeValue: 275,
      sizeUnit: "g",
      dealPriceSek: 49.9,
      multiBuyType: MultiBuyType.X_FOR_Y,
      multiBuyX: 2,
      multiBuyY: 49.9,
      conditionsText: "2 för 49.90 kr",
      unitPriceSek: 90.73,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Kycklingben 1kg",
      sizeValue: 1,
      sizeUnit: "kg",
      dealPriceSek: 44.9,
      limitPerHousehold: 3,
      conditionsText: "Max 3 per hushåll",
      unitPriceSek: 44.9,
      unitUnit: UnitType.KR_PER_KG,
    },
    {
      flyerId: icaFlyerRow.id,
      normalizedName: "Toalettpapper Lambi 12-pack",
      brand: "Lambi",
      sizeValue: 12,
      sizeUnit: "st",
      dealPriceSek: 49.9,
      memberOnly: true,
      conditionsText: "ICA Stammis-pris",
      unitPriceSek: 4.16,
      unitUnit: UnitType.KR_PER_ST,
    },
  ];

  // Link deal items to products where possible
  const allDealInputs = [...willysDeals, ...icaDeals];

  for (const deal of allDealInputs) {
    // Try to match to an existing product
    const matched = findProduct(
      deal.normalizedName.split(" ")[0],
      deal.brand ?? undefined,
    );
    if (matched) {
      deal.productId = matched.id;
    }
  }

  await prisma.dealItem.createMany({
    data: allDealInputs.map((d) => ({
      flyerId: d.flyerId,
      productId: d.productId ?? null,
      normalizedName: d.normalizedName,
      brand: d.brand ?? null,
      sizeValue: d.sizeValue ?? null,
      sizeUnit: d.sizeUnit ?? null,
      dealPriceSek: d.dealPriceSek,
      multiBuyType: d.multiBuyType ?? MultiBuyType.NONE,
      multiBuyX: d.multiBuyX ?? null,
      multiBuyY: d.multiBuyY ?? null,
      conditionsText: d.conditionsText ?? null,
      memberOnly: d.memberOnly ?? false,
      limitPerHousehold: d.limitPerHousehold ?? null,
      validFrom: weekStart,
      validTo: weekEnd,
      unitPriceSek: d.unitPriceSek ?? null,
      unitUnit: d.unitUnit ?? null,
      confidenceScore: d.confidenceScore ?? 100,
      approved: d.approved ?? true,
    })),
  });

  console.log(`  Created ${allDealInputs.length} deal items (Willys: ${willysDeals.length}, ICA: ${icaDeals.length}).\n`);

  // ─── Summary ───────────────────────────────────────────────────────────
  const counts = {
    stores: await prisma.store.count(),
    products: await prisma.product.count(),
    regularPrices: await prisma.regularPrice.count(),
    dealFlyers: await prisma.dealFlyer.count(),
    dealItems: await prisma.dealItem.count(),
  };

  console.log("╔══════════════════════════════════════╗");
  console.log("║     CartWise Stockholm – Seeded!     ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  Stores:         ${String(counts.stores).padStart(5)}              ║`);
  console.log(`║  Products:       ${String(counts.products).padStart(5)}              ║`);
  console.log(`║  Regular prices: ${String(counts.regularPrices).padStart(5)}              ║`);
  console.log(`║  Deal flyers:    ${String(counts.dealFlyers).padStart(5)}              ║`);
  console.log(`║  Deal items:     ${String(counts.dealItems).padStart(5)}              ║`);
  console.log("╚══════════════════════════════════════╝");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
