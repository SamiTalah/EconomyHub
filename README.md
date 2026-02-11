# EkonomiHubben 💰

A personal finance dashboard for tracking spending, investments, net worth, and savings goals. Built with a Scandinavian fintech aesthetic inspired by Avanza, Nordnet, and Klarna.

## Features

- **CSV Import** — Import transactions from Nordea, SEB, Handelsbanken, Swedbank (auto-detected)
- **Auto-Categorization** — Rule-based transaction categorization with learning from corrections
- **Budget Tracking** — Monthly budgets per category with visual progress bars
- **Investment Portfolio** — Multiple accounts (ISK, AF, KF, TJP) with holdings, P&L, and allocation
- **Net Worth** — Track all assets (property, vehicles, investments) and liabilities (mortgage, loans)
- **Savings Goals** — Set targets with progress tracking and projected completion
- **Data Backup** — Full JSON export/import for data portability

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Dexie.js (IndexedDB)
- Recharts
- Zustand

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to [vercel.com](https://vercel.com) for auto-deploys.

## Data

All data is stored locally in your browser's IndexedDB. Use **Settings → Data & Backup** to export/import your data.
