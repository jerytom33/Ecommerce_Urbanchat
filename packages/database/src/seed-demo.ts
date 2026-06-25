import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_prototype';
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductVariant {
  sku: string;
  options: Record<string, string>;
  price: string;
  qty: number;
}

interface ProductData {
  title: string;
  description: string;
  category: string;
  variants: ProductVariant[];
}

interface CustomerData {
  email: string;
  firstName: string;
  lastName: string;
  totalOrders: number;
  totalSpend: string;
  avgOrder: string;
  tags: string[];
}

interface PromotionData {
  code: string;
  type: string;
  value: string;
  conditions: Record<string, unknown>;
  maxRedemptions: number | null;
  currentRedemptions: number;
  perCustomerLimit: number | null;
  startsAt: Date;
  endsAt: Date | null;
}

// Helper to generate a date within the last N days
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Helper to generate a random date within range
function randomDateInRange(startDaysAgo: number, endDaysAgo: number): Date {
  const range = startDaysAgo - endDaysAgo;
  const offset = Math.floor(Math.random() * range) + endDaysAgo;
  return daysAgo(offset);
}

// ─── TECHVAULT DATA ──────────────────────────────────────────────────────────

const techVaultProducts: ProductData[] = [
  { title: 'ProBook Laptop 15"', description: 'High-performance laptop with 15.6" display, Intel i7, 16GB RAM', category: 'Computers', variants: [{ sku: 'TV-PB15-SLV', options: { color: 'Silver' }, price: '1299.99', qty: 25 }, { sku: 'TV-PB15-GRY', options: { color: 'Space Gray' }, price: '1299.99', qty: 18 }, { sku: 'TV-PB15-BLK', options: { color: 'Black' }, price: '1349.99', qty: 12 }] },
  { title: 'UltraSlim Laptop 13"', description: 'Ultralight laptop with 13" Retina display, M2 chip, 8GB RAM', category: 'Computers', variants: [{ sku: 'TV-US13-SLV', options: { color: 'Silver' }, price: '999.99', qty: 30 }, { sku: 'TV-US13-GLD', options: { color: 'Gold' }, price: '1049.99', qty: 20 }] },
  { title: 'Gaming Desktop Tower', description: 'RTX 4070 graphics, 32GB RAM, 1TB NVMe SSD gaming desktop', category: 'Computers', variants: [{ sku: 'TV-GDT-BLK', options: { color: 'Black' }, price: '1899.99', qty: 10 }, { sku: 'TV-GDT-WHT', options: { color: 'White' }, price: '1899.99', qty: 8 }] },
  { title: 'ChromeBook Student Edition', description: 'Budget-friendly Chromebook for students with 14" display', category: 'Computers', variants: [{ sku: 'TV-CBS-BLU', options: { color: 'Blue' }, price: '349.99', qty: 50 }, { sku: 'TV-CBS-GRN', options: { color: 'Green' }, price: '349.99', qty: 40 }] },
  { title: 'Flagship Phone Pro', description: '6.7" AMOLED, 256GB storage, 108MP camera system', category: 'Phones', variants: [{ sku: 'TV-FPP-128', options: { storage: '128GB' }, price: '899.99', qty: 35 }, { sku: 'TV-FPP-256', options: { storage: '256GB' }, price: '999.99', qty: 25 }, { sku: 'TV-FPP-512', options: { storage: '512GB' }, price: '1149.99', qty: 15 }] },
  { title: 'Budget Phone SE', description: '6.1" LCD, 64GB storage, dual camera, all-day battery', category: 'Phones', variants: [{ sku: 'TV-BPS-64', options: { storage: '64GB' }, price: '399.99', qty: 60 }, { sku: 'TV-BPS-128', options: { storage: '128GB' }, price: '449.99', qty: 45 }] },
  { title: 'Foldable Phone Flex', description: 'Foldable 7.6" inner display, 512GB, cutting-edge design', category: 'Phones', variants: [{ sku: 'TV-FPF-BLK', options: { color: 'Black' }, price: '1799.99', qty: 8 }, { sku: 'TV-FPF-PRP', options: { color: 'Purple' }, price: '1799.99', qty: 6 }] },
  { title: 'Rugged Phone Armor', description: 'IP69 rated, military-grade drop protection, 5000mAh battery', category: 'Phones', variants: [{ sku: 'TV-RPA-BLK', options: { color: 'Black' }, price: '599.99', qty: 20 }, { sku: 'TV-RPA-ORG', options: { color: 'Orange' }, price: '599.99', qty: 15 }] },
  { title: 'Wireless Noise-Cancel Headphones', description: 'Premium ANC headphones with 30h battery, Hi-Res audio', category: 'Audio', variants: [{ sku: 'TV-WNC-BLK', options: { color: 'Black' }, price: '349.99', qty: 40 }, { sku: 'TV-WNC-WHT', options: { color: 'White' }, price: '349.99', qty: 35 }, { sku: 'TV-WNC-BLU', options: { color: 'Navy' }, price: '359.99', qty: 20 }] },
  { title: 'True Wireless Earbuds Pro', description: 'ANC earbuds with spatial audio, 24h total battery', category: 'Audio', variants: [{ sku: 'TV-TWE-BLK', options: { color: 'Black' }, price: '199.99', qty: 55 }, { sku: 'TV-TWE-WHT', options: { color: 'White' }, price: '199.99', qty: 50 }] },
  { title: 'Studio Monitor Speakers', description: 'Pair of studio-quality monitor speakers with Bluetooth 5.3', category: 'Audio', variants: [{ sku: 'TV-SMS-BLK', options: { color: 'Black' }, price: '499.99', qty: 15 }, { sku: 'TV-SMS-WLN', options: { color: 'Walnut' }, price: '549.99', qty: 10 }] },
  { title: 'Gaming Headset RGB', description: '7.1 surround sound, retractable mic, RGB lighting', category: 'Audio', variants: [{ sku: 'TV-GHR-BLK', options: { color: 'Black' }, price: '129.99', qty: 45 }, { sku: 'TV-GHR-RED', options: { color: 'Red' }, price: '129.99', qty: 30 }] },
  { title: 'Mirrorless Camera Pro', description: 'Full-frame 45MP mirrorless camera with 4K 120fps video', category: 'Cameras', variants: [{ sku: 'TV-MCP-BDY', options: { kit: 'Body Only' }, price: '2499.99', qty: 8 }, { sku: 'TV-MCP-KIT', options: { kit: 'With 24-70mm Lens' }, price: '3199.99', qty: 5 }] },
  { title: 'Action Camera 5K', description: 'Waterproof action cam with 5K recording, HyperSmooth stabilization', category: 'Cameras', variants: [{ sku: 'TV-AC5-STD', options: { bundle: 'Standard' }, price: '399.99', qty: 30 }, { sku: 'TV-AC5-PRO', options: { bundle: 'Pro Bundle' }, price: '549.99', qty: 20 }] },
  { title: 'Instant Film Camera', description: 'Retro-style instant camera with auto-exposure, built-in flash', category: 'Cameras', variants: [{ sku: 'TV-IFC-PNK', options: { color: 'Pink' }, price: '89.99', qty: 40 }, { sku: 'TV-IFC-BLK', options: { color: 'Black' }, price: '89.99', qty: 35 }, { sku: 'TV-IFC-MNT', options: { color: 'Mint' }, price: '89.99', qty: 30 }] },
  { title: 'Drone Pro 4K', description: '4K drone with 45min flight time, obstacle avoidance', category: 'Cameras', variants: [{ sku: 'TV-DP4-STD', options: { bundle: 'Standard' }, price: '1299.99', qty: 12 }, { sku: 'TV-DP4-FLY', options: { bundle: 'Fly More Combo' }, price: '1699.99', qty: 8 }] },
  { title: 'USB-C Hub 10-in-1', description: '10-port USB-C hub with HDMI, SD card, Ethernet, PD charging', category: 'Accessories', variants: [{ sku: 'TV-UCH-SLV', options: { color: 'Silver' }, price: '69.99', qty: 80 }, { sku: 'TV-UCH-GRY', options: { color: 'Gray' }, price: '69.99', qty: 60 }] },
  { title: 'Mechanical Keyboard', description: 'Hot-swappable mechanical keyboard with RGB backlighting', category: 'Accessories', variants: [{ sku: 'TV-MKB-BLK', options: { color: 'Black' }, price: '149.99', qty: 35 }, { sku: 'TV-MKB-WHT', options: { color: 'White' }, price: '149.99', qty: 30 }] },
  { title: 'Wireless Charging Pad', description: 'Fast wireless charger 15W with LED indicator', category: 'Accessories', variants: [{ sku: 'TV-WCP-BLK', options: { color: 'Black' }, price: '39.99', qty: 100 }, { sku: 'TV-WCP-WHT', options: { color: 'White' }, price: '39.99', qty: 90 }] },
  { title: 'Tablet Pro 11"', description: '11" tablet with M2 chip, Apple Pencil support, 128GB', category: 'Computers', variants: [{ sku: 'TV-TP11-128', options: { storage: '128GB' }, price: '799.99', qty: 25 }, { sku: 'TV-TP11-256', options: { storage: '256GB' }, price: '899.99', qty: 20 }, { sku: 'TV-TP11-512', options: { storage: '512GB' }, price: '1099.99', qty: 10 }] },
];

// ─── STYLEHAUS DATA ──────────────────────────────────────────────────────────

const styleHausProducts: ProductData[] = [
  { title: 'Classic Oxford Shirt', description: 'Premium cotton oxford button-down shirt, tailored fit', category: 'Tops', variants: [{ sku: 'SH-COS-S-WHT', options: { size: 'S', color: 'White' }, price: '79.99', qty: 30 }, { sku: 'SH-COS-M-WHT', options: { size: 'M', color: 'White' }, price: '79.99', qty: 40 }, { sku: 'SH-COS-L-BLU', options: { size: 'L', color: 'Blue' }, price: '79.99', qty: 35 }, { sku: 'SH-COS-XL-BLU', options: { size: 'XL', color: 'Blue' }, price: '79.99', qty: 20 }] },
  { title: 'Graphic Tee Collection', description: 'Organic cotton graphic t-shirt with unique artwork', category: 'Tops', variants: [{ sku: 'SH-GTC-S-BLK', options: { size: 'S', color: 'Black' }, price: '34.99', qty: 50 }, { sku: 'SH-GTC-M-BLK', options: { size: 'M', color: 'Black' }, price: '34.99', qty: 60 }, { sku: 'SH-GTC-L-WHT', options: { size: 'L', color: 'White' }, price: '34.99', qty: 45 }] },
  { title: 'Silk Blouse Elegant', description: 'Luxurious silk blouse with hidden button placket', category: 'Tops', variants: [{ sku: 'SH-SBE-S-IVR', options: { size: 'S', color: 'Ivory' }, price: '129.99', qty: 20 }, { sku: 'SH-SBE-M-BLK', options: { size: 'M', color: 'Black' }, price: '129.99', qty: 25 }, { sku: 'SH-SBE-L-NVY', options: { size: 'L', color: 'Navy' }, price: '129.99', qty: 18 }] },
  { title: 'Cashmere Sweater', description: '100% cashmere crew neck sweater, ultra-soft', category: 'Tops', variants: [{ sku: 'SH-CSW-S-GRY', options: { size: 'S', color: 'Gray' }, price: '189.99', qty: 15 }, { sku: 'SH-CSW-M-CML', options: { size: 'M', color: 'Camel' }, price: '189.99', qty: 20 }, { sku: 'SH-CSW-L-NVY', options: { size: 'L', color: 'Navy' }, price: '189.99', qty: 12 }, { sku: 'SH-CSW-XL-BLK', options: { size: 'XL', color: 'Black' }, price: '189.99', qty: 10 }] },
  { title: 'Slim Fit Chinos', description: 'Stretch cotton chinos with tailored slim fit', category: 'Bottoms', variants: [{ sku: 'SH-SFC-S-KHK', options: { size: 'S', color: 'Khaki' }, price: '89.99', qty: 30 }, { sku: 'SH-SFC-M-NVY', options: { size: 'M', color: 'Navy' }, price: '89.99', qty: 35 }, { sku: 'SH-SFC-L-OLV', options: { size: 'L', color: 'Olive' }, price: '89.99', qty: 25 }] },
  { title: 'High-Rise Jeans', description: 'Premium denim high-rise straight leg jeans', category: 'Bottoms', variants: [{ sku: 'SH-HRJ-S-IND', options: { size: 'S', color: 'Indigo' }, price: '119.99', qty: 25 }, { sku: 'SH-HRJ-M-IND', options: { size: 'M', color: 'Indigo' }, price: '119.99', qty: 30 }, { sku: 'SH-HRJ-L-BLK', options: { size: 'L', color: 'Black' }, price: '119.99', qty: 22 }, { sku: 'SH-HRJ-XL-BLK', options: { size: 'XL', color: 'Black' }, price: '119.99', qty: 15 }] },
  { title: 'Linen Wide-Leg Pants', description: 'Relaxed fit linen pants perfect for warm weather', category: 'Bottoms', variants: [{ sku: 'SH-LWP-S-WHT', options: { size: 'S', color: 'White' }, price: '99.99', qty: 20 }, { sku: 'SH-LWP-M-TAN', options: { size: 'M', color: 'Tan' }, price: '99.99', qty: 25 }, { sku: 'SH-LWP-L-BLK', options: { size: 'L', color: 'Black' }, price: '99.99', qty: 18 }] },
  { title: 'Cargo Joggers', description: 'Modern cargo joggers with tapered fit and zip pockets', category: 'Bottoms', variants: [{ sku: 'SH-CJG-S-OLV', options: { size: 'S', color: 'Olive' }, price: '69.99', qty: 35 }, { sku: 'SH-CJG-M-BLK', options: { size: 'M', color: 'Black' }, price: '69.99', qty: 40 }, { sku: 'SH-CJG-L-GRY', options: { size: 'L', color: 'Gray' }, price: '69.99', qty: 30 }] },
  { title: 'Midi Wrap Dress', description: 'Flattering wrap dress in flowing viscose fabric', category: 'Dresses', variants: [{ sku: 'SH-MWD-S-FLR', options: { size: 'S', color: 'Floral' }, price: '149.99', qty: 18 }, { sku: 'SH-MWD-M-BLK', options: { size: 'M', color: 'Black' }, price: '149.99', qty: 22 }, { sku: 'SH-MWD-L-RED', options: { size: 'L', color: 'Red' }, price: '149.99', qty: 15 }] },
  { title: 'Cocktail Mini Dress', description: 'Sequined cocktail dress perfect for evening events', category: 'Dresses', variants: [{ sku: 'SH-CMD-S-GLD', options: { size: 'S', color: 'Gold' }, price: '199.99', qty: 12 }, { sku: 'SH-CMD-M-BLK', options: { size: 'M', color: 'Black' }, price: '199.99', qty: 15 }, { sku: 'SH-CMD-L-SLV', options: { size: 'L', color: 'Silver' }, price: '199.99', qty: 10 }] },
  { title: 'Maxi Summer Dress', description: 'Lightweight maxi dress with adjustable straps', category: 'Dresses', variants: [{ sku: 'SH-MSD-S-SKY', options: { size: 'S', color: 'Sky Blue' }, price: '109.99', qty: 25 }, { sku: 'SH-MSD-M-CRL', options: { size: 'M', color: 'Coral' }, price: '109.99', qty: 30 }, { sku: 'SH-MSD-L-WHT', options: { size: 'L', color: 'White' }, price: '109.99', qty: 20 }] },
  { title: 'Knit Bodycon Dress', description: 'Ribbed knit bodycon dress with long sleeves', category: 'Dresses', variants: [{ sku: 'SH-KBD-S-BLK', options: { size: 'S', color: 'Black' }, price: '89.99', qty: 22 }, { sku: 'SH-KBD-M-BRG', options: { size: 'M', color: 'Burgundy' }, price: '89.99', qty: 25 }, { sku: 'SH-KBD-L-GRN', options: { size: 'L', color: 'Forest Green' }, price: '89.99', qty: 18 }] },
  { title: 'Leather Ankle Boots', description: 'Italian leather ankle boots with block heel', category: 'Shoes', variants: [{ sku: 'SH-LAB-S-BLK', options: { size: '7', color: 'Black' }, price: '249.99', qty: 15 }, { sku: 'SH-LAB-M-BRN', options: { size: '8', color: 'Brown' }, price: '249.99', qty: 18 }, { sku: 'SH-LAB-L-TAN', options: { size: '9', color: 'Tan' }, price: '249.99', qty: 12 }] },
  { title: 'White Sneakers Classic', description: 'Minimalist white leather sneakers, cushioned insole', category: 'Shoes', variants: [{ sku: 'SH-WSC-7-WHT', options: { size: '7', color: 'White' }, price: '139.99', qty: 30 }, { sku: 'SH-WSC-8-WHT', options: { size: '8', color: 'White' }, price: '139.99', qty: 35 }, { sku: 'SH-WSC-9-WHT', options: { size: '9', color: 'White' }, price: '139.99', qty: 25 }, { sku: 'SH-WSC-10-WHT', options: { size: '10', color: 'White' }, price: '139.99', qty: 20 }] },
  { title: 'Strappy Heeled Sandals', description: 'Elegant strappy sandals with 3" kitten heel', category: 'Shoes', variants: [{ sku: 'SH-SHS-6-GLD', options: { size: '6', color: 'Gold' }, price: '169.99', qty: 14 }, { sku: 'SH-SHS-7-BLK', options: { size: '7', color: 'Black' }, price: '169.99', qty: 18 }, { sku: 'SH-SHS-8-NDE', options: { size: '8', color: 'Nude' }, price: '169.99', qty: 16 }] },
  { title: 'Running Sneakers Air', description: 'Performance running shoes with air cushion technology', category: 'Shoes', variants: [{ sku: 'SH-RSA-8-BLK', options: { size: '8', color: 'Black/Red' }, price: '159.99', qty: 25 }, { sku: 'SH-RSA-9-GRY', options: { size: '9', color: 'Gray/Blue' }, price: '159.99', qty: 30 }, { sku: 'SH-RSA-10-WHT', options: { size: '10', color: 'White/Green' }, price: '159.99', qty: 22 }] },
  { title: 'Leather Tote Bag', description: 'Full-grain leather tote with laptop compartment', category: 'Accessories', variants: [{ sku: 'SH-LTB-BLK', options: { color: 'Black' }, price: '299.99', qty: 20 }, { sku: 'SH-LTB-CML', options: { color: 'Camel' }, price: '299.99', qty: 15 }, { sku: 'SH-LTB-BRG', options: { color: 'Burgundy' }, price: '299.99', qty: 12 }] },
  { title: 'Crossbody Mini Bag', description: 'Compact crossbody bag with chain strap', category: 'Accessories', variants: [{ sku: 'SH-CMB-BLK', options: { color: 'Black' }, price: '149.99', qty: 25 }, { sku: 'SH-CMB-PNK', options: { color: 'Blush Pink' }, price: '149.99', qty: 20 }, { sku: 'SH-CMB-GRN', options: { color: 'Emerald' }, price: '149.99', qty: 18 }] },
  { title: 'Silk Scarf Print', description: 'Large silk scarf with exclusive print design', category: 'Accessories', variants: [{ sku: 'SH-SSP-FLR', options: { pattern: 'Floral' }, price: '89.99', qty: 30 }, { sku: 'SH-SSP-GEO', options: { pattern: 'Geometric' }, price: '89.99', qty: 25 }] },
  { title: 'Oversized Sunglasses', description: 'UV400 oversized sunglasses with polarized lenses', category: 'Accessories', variants: [{ sku: 'SH-OSG-BLK', options: { color: 'Black' }, price: '79.99', qty: 40 }, { sku: 'SH-OSG-TRT', options: { color: 'Tortoise' }, price: '79.99', qty: 35 }, { sku: 'SH-OSG-PNK', options: { color: 'Rose' }, price: '79.99', qty: 25 }] },
];

// ─── CUSTOMERS DATA ──────────────────────────────────────────────────────────

const techVaultCustomers: CustomerData[] = [
  { email: 'alex.chen@email.com', firstName: 'Alex', lastName: 'Chen', totalOrders: 4, totalSpend: '3249.96', avgOrder: '812.49', tags: ['vip', 'repeat-buyer'] },
  { email: 'sarah.miller@email.com', firstName: 'Sarah', lastName: 'Miller', totalOrders: 2, totalSpend: '1399.98', avgOrder: '699.99', tags: ['new'] },
  { email: 'james.wilson@email.com', firstName: 'James', lastName: 'Wilson', totalOrders: 3, totalSpend: '2549.97', avgOrder: '849.99', tags: ['repeat-buyer'] },
  { email: 'maria.garcia@email.com', firstName: 'Maria', lastName: 'Garcia', totalOrders: 1, totalSpend: '349.99', avgOrder: '349.99', tags: ['new'] },
  { email: 'david.park@email.com', firstName: 'David', lastName: 'Park', totalOrders: 5, totalSpend: '4899.95', avgOrder: '979.99', tags: ['vip', 'repeat-buyer', 'early-adopter'] },
];

const styleHausCustomers: CustomerData[] = [
  { email: 'emma.thompson@email.com', firstName: 'Emma', lastName: 'Thompson', totalOrders: 3, totalSpend: '569.97', avgOrder: '189.99', tags: ['loyal', 'fashion-forward'] },
  { email: 'olivia.martinez@email.com', firstName: 'Olivia', lastName: 'Martinez', totalOrders: 5, totalSpend: '1249.95', avgOrder: '249.99', tags: ['vip', 'repeat-buyer'] },
  { email: 'noah.johnson@email.com', firstName: 'Noah', lastName: 'Johnson', totalOrders: 2, totalSpend: '329.98', avgOrder: '164.99', tags: ['new'] },
  { email: 'sophia.lee@email.com', firstName: 'Sophia', lastName: 'Lee', totalOrders: 4, totalSpend: '879.96', avgOrder: '219.99', tags: ['loyal', 'sale-hunter'] },
  { email: 'liam.brown@email.com', firstName: 'Liam', lastName: 'Brown', totalOrders: 1, totalSpend: '139.99', avgOrder: '139.99', tags: ['new'] },
];

// ─── PROMOTIONS DATA ─────────────────────────────────────────────────────────

const techVaultPromotions: PromotionData[] = [
  { code: 'WELCOME10', type: 'percentage', value: '10.00', conditions: { minItems: 1 }, maxRedemptions: 1000, currentRedemptions: 156, perCustomerLimit: 1, startsAt: daysAgo(30), endsAt: daysAgo(-60) },
  { code: 'TECHSAVE20', type: 'percentage', value: '20.00', conditions: { minOrderValue: 100 }, maxRedemptions: 500, currentRedemptions: 89, perCustomerLimit: 2, startsAt: daysAgo(14), endsAt: daysAgo(-30) },
  { code: 'FREESHIP', type: 'free_shipping', value: '0.00', conditions: {}, maxRedemptions: null, currentRedemptions: 234, perCustomerLimit: null, startsAt: daysAgo(60), endsAt: null },
];

const styleHausPromotions: PromotionData[] = [
  { code: 'STYLE15', type: 'percentage', value: '15.00', conditions: { minItems: 1 }, maxRedemptions: 800, currentRedemptions: 203, perCustomerLimit: 1, startsAt: daysAgo(20), endsAt: daysAgo(-45) },
  { code: 'VIP25', type: 'percentage', value: '25.00', conditions: { minOrderValue: 200, customerTags: ['vip'] }, maxRedemptions: 200, currentRedemptions: 42, perCustomerLimit: 3, startsAt: daysAgo(10), endsAt: daysAgo(-20) },
  { code: 'NEWLOOK', type: 'free_shipping', value: '0.00', conditions: {}, maxRedemptions: null, currentRedemptions: 178, perCustomerLimit: null, startsAt: daysAgo(45), endsAt: null },
];

// ─── MAIN SEED FUNCTION ──────────────────────────────────────────────────────

async function seedDemo() {
  console.log('🚀 Starting demo data seed...\n');

  // ─── Check idempotency ───
  const existingTechVault = await db.query.tenants.findFirst({
    where: (t, { eq }) => eq(t.subdomain, 'techvault'),
  });
  if (existingTechVault) {
    console.log('⏭️  Demo data already exists (TechVault found). Skipping seed.');
    await client.end();
    return;
  }

  // ─── 1. Create Tenants ───
  console.log('🏪 Creating merchant stores...');

  const [techVaultTenant] = await db.insert(schema.tenants).values({
    name: 'TechVault',
    subdomain: 'techvault',
    subscriptionTier: 'professional',
    status: 'active',
    settings: { currency: 'USD', timezone: 'America/New_York', logo: '/demo/techvault-logo.svg' },
  }).returning();
  console.log(`  ✅ TechVault (ID: ${techVaultTenant.id})`);

  const [styleHausTenant] = await db.insert(schema.tenants).values({
    name: 'StyleHaus',
    subdomain: 'stylehaus',
    subscriptionTier: 'professional',
    status: 'active',
    settings: { currency: 'USD', timezone: 'America/Los_Angeles', logo: '/demo/stylehaus-logo.svg' },
  }).returning();
  console.log(`  ✅ StyleHaus (ID: ${styleHausTenant.id})`);

  // ─── 2. Assign Themes ───
  console.log('\n🎨 Assigning themes...');

  const modernTheme = await db.query.themes.findFirst({
    where: (t, { eq }) => eq(t.name, 'Modern'),
  });
  const boldTheme = await db.query.themes.findFirst({
    where: (t, { eq }) => eq(t.name, 'Bold'),
  });

  if (modernTheme) {
    await db.insert(schema.themeCustomizations).values({
      tenantId: techVaultTenant.id,
      themeId: modernTheme.id,
      isActive: 'true',
      customizations: { heroText: 'Premium Tech, Unbeatable Prices', accentOverride: '#4F46E5' },
    });
    console.log('  ✅ TechVault → Modern theme (indigo)');
  }

  if (boldTheme) {
    await db.insert(schema.themeCustomizations).values({
      tenantId: styleHausTenant.id,
      themeId: boldTheme.id,
      isActive: 'true',
      customizations: { heroText: 'Discover Your Style', accentOverride: '#F97316' },
    });
    console.log('  ✅ StyleHaus → Bold theme (orange)');
  }

  // ─── 3. Create Admin Users ───
  console.log('\n👤 Creating admin users...');

  await db.insert(schema.users).values([
    { tenantId: techVaultTenant.id, email: 'admin@techvault.store', passwordHash: '$2b$10$demohashedpassword1234567890abcdefghijklmnopqrstuv', role: 'owner', firstName: 'Tech', lastName: 'Admin' },
    { tenantId: styleHausTenant.id, email: 'admin@stylehaus.store', passwordHash: '$2b$10$demohashedpassword1234567890abcdefghijklmnopqrstuv', role: 'owner', firstName: 'Style', lastName: 'Admin' },
  ]);
  console.log('  ✅ Admin users created');

  // ─── 4. Seed Categories & Products ───
  console.log('\n📦 Seeding TechVault products...');
  const tvCategoryMap = await seedCategoriesAndProducts(techVaultTenant.id, ['Computers', 'Phones', 'Audio', 'Cameras', 'Accessories'], techVaultProducts);

  console.log('\n👗 Seeding StyleHaus products...');
  const shCategoryMap = await seedCategoriesAndProducts(styleHausTenant.id, ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Accessories'], styleHausProducts);

  // ─── 5. Seed Customers ───
  console.log('\n👥 Seeding customers...');
  const tvCustomerIds = await seedCustomers(techVaultTenant.id, techVaultCustomers);
  const shCustomerIds = await seedCustomers(styleHausTenant.id, styleHausCustomers);
  console.log(`  ✅ ${tvCustomerIds.length} TechVault customers`);
  console.log(`  ✅ ${shCustomerIds.length} StyleHaus customers`);

  // ─── 6. Seed Orders ───
  console.log('\n🛒 Seeding orders...');
  await seedOrders(techVaultTenant.id, tvCustomerIds, techVaultProducts);
  await seedOrders(styleHausTenant.id, shCustomerIds, styleHausProducts);
  console.log('  ✅ 10 orders per merchant created');

  // ─── 7. Seed Promotions ───
  console.log('\n🏷️  Seeding promotions...');
  await seedPromotions(techVaultTenant.id, techVaultPromotions);
  await seedPromotions(styleHausTenant.id, styleHausPromotions);
  console.log('  ✅ 3 promotions per merchant created');

  // ─── 8. Seed Analytics ───
  console.log('\n📊 Seeding analytics events...');
  await seedAnalytics(techVaultTenant.id);
  await seedAnalytics(styleHausTenant.id);
  console.log('  ✅ Analytics events seeded for last 30 days');

  console.log('\n✨ Demo data seed complete!');
  await client.end();
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

async function seedCategoriesAndProducts(
  tenantId: string,
  categoryNames: string[],
  products: ProductData[],
): Promise<Record<string, string>> {
  // Create categories
  const categoryMap: Record<string, string> = {};
  for (const name of categoryNames) {
    const [cat] = await db.insert(schema.categories).values({
      tenantId,
      name,
      path: `/${name.toLowerCase().replace(/\s+/g, '-')}`,
      depth: 0,
    }).returning();
    categoryMap[name] = cat.id;
  }
  console.log(`  ✅ ${categoryNames.length} categories created`);

  // Create products with listings and media
  let productCount = 0;
  let listingCount = 0;
  for (const product of products) {
    const [prod] = await db.insert(schema.products).values({
      tenantId,
      title: product.title,
      description: product.description,
      status: 'active',
      categoryId: categoryMap[product.category],
      metadata: { brand: tenantId.includes('tech') ? 'TechVault Originals' : 'StyleHaus Collection' },
    }).returning();

    // Add a product image
    await db.insert(schema.media).values({
      tenantId,
      productId: prod.id,
      url: `https://placehold.co/800x600/png?text=${encodeURIComponent(product.title)}`,
      altText: product.title,
      mimeType: 'image/png',
      size: 45000,
      sortOrder: 0,
    });

    // Create listings (variants)
    for (const variant of product.variants) {
      await db.insert(schema.listings).values({
        tenantId,
        productId: prod.id,
        sku: variant.sku,
        price: variant.price,
        inventoryQuantity: variant.qty,
        options: variant.options,
        status: 'active',
      });
      listingCount++;
    }
    productCount++;
  }
  console.log(`  ✅ ${productCount} products, ${listingCount} listings created`);
  return categoryMap;
}

async function seedCustomers(
  tenantId: string,
  customers: CustomerData[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const cust of customers) {
    const [inserted] = await db.insert(schema.customers).values({
      tenantId,
      email: cust.email,
      firstName: cust.firstName,
      lastName: cust.lastName,
      totalOrders: cust.totalOrders,
      totalSpend: cust.totalSpend,
      averageOrderValue: cust.avgOrder,
      lastPurchaseDate: randomDateInRange(15, 1),
      tags: cust.tags,
    }).returning();
    ids.push(inserted.id);
  }
  return ids;
}

async function seedOrders(
  tenantId: string,
  customerIds: string[],
  products: ProductData[],
): Promise<void> {
  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'shipped', 'processing', 'pending'];

  for (let i = 0; i < 10; i++) {
    const customerId = customerIds[i % customerIds.length];
    const product = products[i % products.length];
    const variant = product.variants[0];
    const quantity = Math.floor(Math.random() * 3) + 1;
    const unitPrice = parseFloat(variant.price);
    const subtotal = (unitPrice * quantity).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.08).toFixed(2);
    const shipping = i % 3 === 0 ? '0.00' : '9.99';
    const total = (parseFloat(subtotal) + parseFloat(tax) + parseFloat(shipping)).toFixed(2);

    const [order] = await db.insert(schema.orders).values({
      tenantId,
      customerId,
      status: statuses[i],
      subtotal,
      tax,
      shipping,
      discount: '0.00',
      total,
      currency: 'USD',
      shippingAddress: { street: '123 Demo St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'US' },
      billingAddress: { street: '123 Demo St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'US' },
      createdAt: randomDateInRange(28, 1),
    }).returning();

    await db.insert(schema.orderLineItems).values({
      tenantId,
      orderId: order.id,
      listingId: null,
      title: product.title,
      sku: variant.sku,
      quantity,
      unitPrice: variant.price,
      fulfillmentStatus: statuses[i] === 'completed' ? 'fulfilled' : 'pending',
    });
  }
}

async function seedPromotions(
  tenantId: string,
  promotions: PromotionData[],
): Promise<void> {
  for (const promo of promotions) {
    await db.insert(schema.promotions).values({
      tenantId,
      type: promo.type,
      code: promo.code,
      value: promo.value,
      conditions: promo.conditions,
      stackingRules: {},
      maxRedemptions: promo.maxRedemptions,
      currentRedemptions: promo.currentRedemptions,
      perCustomerLimit: promo.perCustomerLimit,
      active: true,
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
    });
  }
}

async function seedAnalytics(tenantId: string): Promise<void> {
  const eventTypes = ['page_view', 'product_view', 'add_to_cart', 'purchase', 'search'];
  const events: Array<{
    tenantId: string;
    eventType: string;
    sessionId: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  // Generate events for the last 30 days
  for (let day = 0; day < 30; day++) {
    // Simulate 20-50 events per day with some variance
    const dailyEvents = 20 + Math.floor(Math.random() * 30);
    for (let e = 0; e < dailyEvents; e++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() - day);
      eventDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

      events.push({
        tenantId,
        eventType,
        sessionId: `session_${day}_${e}_${Math.random().toString(36).slice(2, 8)}`,
        metadata: {
          source: ['organic', 'direct', 'social', 'email'][Math.floor(Math.random() * 4)],
          device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          ...(eventType === 'purchase' ? { revenue: (Math.random() * 500 + 50).toFixed(2) } : {}),
        },
        createdAt: eventDate,
      });
    }
  }

  // Batch insert in chunks of 100
  for (let i = 0; i < events.length; i += 100) {
    const chunk = events.slice(i, i + 100);
    await db.insert(schema.analyticsEvents).values(chunk);
  }
  console.log(`  ✅ ${events.length} analytics events for tenant`);
}

// ─── RUN ─────────────────────────────────────────────────────────────────────

seedDemo().catch((err) => {
  console.error('❌ Error seeding demo data:', err);
  process.exit(1);
});
