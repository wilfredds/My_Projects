-- Branding for shops that install AutoCare: TIN on the receipt, an accent
-- colour, and a logo. Additive only — existing rows keep working unchanged
-- and pick up the original orange ("kahel") accent.
ALTER TABLE "ShopSetting" ADD COLUMN "tin" TEXT;
ALTER TABLE "ShopSetting" ADD COLUMN "accent" TEXT NOT NULL DEFAULT 'kahel';
ALTER TABLE "ShopSetting" ADD COLUMN "logo" TEXT;
