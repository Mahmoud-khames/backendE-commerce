const mongose = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongose.connect(process.env.MONGO_URI);
        console.log(`======================MongoDB Connected 🚀🚀🚀🚀======================`);
        
        // إنشاء الفهارس إذا لم تكن موجودة
        const Product = mongose.model('Product');
        if (Product) {
            await Product.createIndexes();
            console.log("Product indexes created or verified");
        }
    } catch (error) {
        console.log(error);
        process.exit(1); 
    }
};

module.exports = connectDB;
