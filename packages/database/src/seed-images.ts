/**
 * Updates all product media with real Unsplash image URLs.
 * Run after seed-demo.ts to replace placeholder images with beautiful photos.
 *
 * Usage: DATABASE_URL="..." npx tsx src/seed-images.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_prototype';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ─── Unsplash image URLs mapped by product keyword ───────────────────────────
// Using Unsplash Source for direct-link, royalty-free images (no API key needed)

const techVaultImages: Record<string, string> = {
  'ProBook Laptop 15"': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
  'UltraSlim Laptop 13"': 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80',
  'Gaming Desktop Tower': 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80',
  'ChromeBook Student Edition': 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80',
  'Flagship Phone Pro': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
  'Budget Phone SE': 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80',
  'Foldable Phone Flex': 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800&q=80',
  'Rugged Phone Armor': 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&q=80',
  'Wireless Noise-Cancel Headphones': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  'True Wireless Earbuds Pro': 'https://images.unsplash.com/photo-1590658268037-6bf12f8fffe2?w=800&q=80',
  'Studio Monitor Speakers': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',
  'Gaming Headset RGB': 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80',
  'Mirrorless Camera Pro': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
  'Action Camera 5K': 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80',
  'Instant Film Camera': 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80',
  'Drone Pro 4K': 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80',
  'USB-C Hub 10-in-1': 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&q=80',
  'Mechanical Keyboard': 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80',
  'Wireless Charging Pad': 'https://images.unsplash.com/photo-1586953208270-767889c78f3e?w=800&q=80',
  'Tablet Pro 11"': 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
};

const styleHausImages: Record<string, string> = {
  'Classic Oxford Shirt': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80',
  'Graphic Tee Collection': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
  'Silk Blouse Elegant': 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800&q=80',
  'Cashmere Sweater': 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80',
  'Slim Fit Chinos': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80',
  'High-Rise Jeans': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',
  'Linen Wide-Leg Pants': 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80',
  'Cargo Joggers': 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80',
  'Midi Wrap Dress': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80',
  'Cocktail Mini Dress': 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80',
  'Maxi Summer Dress': 'https://images.unsplash.com/photo-1495385794356-15371f348c31?w=800&q=80',
  'Knit Bodycon Dress': 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=800&q=80',
  'Leather Ankle Boots': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80',
  'White Sneakers Classic': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
  'Strappy Heeled Sandals': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80',
  'Running Sneakers Air': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
  'Leather Tote Bag': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
  'Crossbody Mini Bag': 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80',
  'Silk Scarf Print': 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80',
  'Oversized Sunglasses': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80',
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedImages() {
  console.log('🖼️  Updating product images with Unsplash photos...\n');

  // Get all products using raw select
  const allProducts = await db.select().from(schema.products);

  if (allProducts.length === 0) {
    console.log('❌ No products found. Run seed-demo.ts first.');
    await client.end();
    return;
  }

  let updatedCount = 0;
  const allImages = { ...techVaultImages, ...styleHausImages };

  for (const product of allProducts) {
    const imageUrl = allImages[product.title];
    if (!imageUrl) continue;

    // Find media records for this product
    const mediaRecords = await db.select()
      .from(schema.media)
      .where(eq(schema.media.productId, product.id));

    if (mediaRecords.length > 0) {
      // Update existing media records with real Unsplash URL
      for (const media of mediaRecords) {
        await db.update(schema.media)
          .set({
            url: imageUrl,
            altText: product.title,
            mimeType: 'image/jpeg',
            size: 85000,
          })
          .where(eq(schema.media.id, media.id));
      }
      updatedCount++;
    } else {
      // Insert new media record
      await db.insert(schema.media).values({
        tenantId: product.tenantId,
        productId: product.id,
        url: imageUrl,
        altText: product.title,
        mimeType: 'image/jpeg',
        size: 85000,
        sortOrder: 0,
      });
      updatedCount++;
    }

    console.log(`  ✅ ${product.title}`);
  }

  console.log(`\n🖼️  Updated ${updatedCount} products with real images.`);
  await client.end();
}

seedImages().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
