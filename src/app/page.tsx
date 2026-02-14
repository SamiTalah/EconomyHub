import { HomeFlow } from "@/components/home/home-flow";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Hitta din billigaste matkorg
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Jämför priser, erbjudanden och resekostnader mellan butiker i
          Stockholm
        </p>
      </div>
      <HomeFlow />
    </div>
  );
}
