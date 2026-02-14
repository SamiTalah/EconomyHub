import { NextResponse } from "next/server";

export function GET() {
  const csv = `store_name;chain;format;city;lat;lng;gtin;product_name_sv;brand;size_value;size_unit;category;subcategory;price_sek;unit_price_sek;unit_unit;in_stock;observed_at
Willys Hornstull;WILLYS;WILLYS;Stockholm;59.3158;18.0340;;Mjölk 3% 1.5L;Arla;1.5;L;MEJERI_AGG;MJOLK;17.90;11.93;KR_PER_L;true;2025-01-15
ICA Maxi Lindhagen;ICA;ICA_MAXI;Stockholm;59.3355;18.0100;;Bananer;Chiquita;1;kg;FRUKT_GRONT;FRUKT;24.90;24.90;KR_PER_KG;true;2025-01-15`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="cartwise_price_template.csv"',
    },
  });
}
