// Script to drop old ProductTextIndex and recreate it with new schema
const mongoose = require("mongoose");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function fixProductIndex() {
  try {
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGO_URI;
 
    if (!mongoUri) {
      console.error("❌ Error: MONGO_URI not found in .env file");
      console.log("Please make sure your .env file contains MONGO_URI");
      process.exit(1);
    }

    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Get the Product collection
    const db = mongoose.connection.db;
    const collection = db.collection("products");

    // Drop the old index
    console.log("🔄 Dropping old ProductTextIndex...");
    try {
      await collection.dropIndex("ProductTextIndex");
      console.log("✅ Dropped old ProductTextIndex");
    } catch (error) {
      if (error.code === 27) {
        console.log("ℹ️  Index does not exist, skipping drop");
      } else {
        throw error;
      }
    }

    // Create the new index
    console.log("🔄 Creating new ProductTextIndex...");
    await collection.createIndex(
      {
        productNameEn: "text",
        productNameAr: "text",
        productDescriptionEn: "text",
        productDescriptionAr: "text",
      },
      {
        weights: {
          productNameEn: 10,
          productNameAr: 10,
          productDescriptionEn: 5,
          productDescriptionAr: 5,
        },
        name: "ProductTextIndex",
        background: true,
      }
    );
    console.log("✅ Created new ProductTextIndex with updated schema");

    // Close connection
    await mongoose.connection.close();
    console.log("✅ Done! You can now restart your server.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixProductIndex();
