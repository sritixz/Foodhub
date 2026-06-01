import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QRCode from '../models/QRCode.js';
import Outlet from '../models/Outlet.js';

dotenv.config();

const deleteOldQRCodes = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/foodhub');
        console.log('Connected to MongoDB');

        // Delete all QR codes
        const result = await QRCode.deleteMany({});
        console.log(`Deleted ${result.deletedCount} QR codes`);

        // Clear QR code references from outlets
        await Outlet.updateMany({}, { $unset: { qrCode: '', qrCodeUrl: '' } });
        console.log('Cleared QR code references from outlets');

        console.log('\n✅ All old QR codes deleted successfully!');
        console.log('You can now regenerate QR codes with the correct frontend URLs.');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

deleteOldQRCodes();
