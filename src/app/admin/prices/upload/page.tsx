import { PriceUploader } from "@/components/admin/price-uploader";

export default function PriceUploadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold">Ladda upp priser</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Importera ordinarie priser via CSV-fil
      </p>
      <div className="mt-6">
        <PriceUploader />
      </div>
    </div>
  );
}
