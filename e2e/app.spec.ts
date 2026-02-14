import { test, expect } from "@playwright/test";

test.describe("CartWise Stockholm E2E", () => {
  test("loads app, uses preset basket, optimizes, and verifies results", async ({
    page,
  }) => {
    // Navigate to home
    await page.goto("/");

    // Verify page title
    await expect(page.locator("h1")).toContainText("billigaste matkorg");

    // Verify step sections exist
    await expect(page.getByText("Din plats")).toBeVisible();
    await expect(page.getByText("Bilprofil")).toBeVisible();
    await expect(page.getByText("Inköpslista")).toBeVisible();

    // Click on preset "Standardkasse: Basvaror"
    await page.getByText("Standardkasse: Basvaror").click();

    // Wait for items to appear
    await expect(page.getByText("varor")).toBeVisible({ timeout: 5000 });

    // Verify optimize button is enabled
    const optimizeBtn = page.getByText("Hitta billigaste korgen");
    await expect(optimizeBtn).toBeEnabled();

    // Click optimize
    await optimizeBtn.click();

    // Should navigate to /results
    await page.waitForURL("**/results", { timeout: 15000 });

    // Wait for loading to finish
    await expect(page.locator("h1")).toContainText("Resultat", {
      timeout: 30000,
    });

    // Verify recommended store card appears
    await expect(
      page.getByText("Rekommenderat val").or(page.getByText("Bästa butik"))
    ).toBeVisible({ timeout: 10000 });

    // Verify cost breakdown elements exist
    await expect(page.getByText("Matkostnad")).toBeVisible();
    await expect(page.getByText("Resa")).toBeVisible();

    // Verify coverage badge exists
    await expect(page.getByText(/\d+% täckning/)).toBeVisible();

    // Check that distance method is shown
    await expect(
      page.getByText("Haversine").or(page.getByText("rak linje"))
    ).toBeVisible();
  });
});
