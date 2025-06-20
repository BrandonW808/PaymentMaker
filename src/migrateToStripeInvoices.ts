import mongoose from 'mongoose';
import Stripe from 'stripe';
import Customer, { ICustomer } from './models/Customer';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_KEY || "");

async function migrateCustomersToStripe() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        // Get all customers without a Stripe ID
        const customers = await Customer.find({ 
            $or: [
                { stripeCustomerId: { $exists: false } },
                { stripeCustomerId: null },
                { stripeCustomerId: '' }
            ]
        });

        console.log(`Found ${customers.length} customers to migrate`);

        let successCount = 0;
        let errorCount = 0;

        // Process each customer
        for (const customer of customers) {
            try {
                // Check if customer already exists in Stripe by email
                const existingStripeCustomers = await stripe.customers.list({
                    email: customer.email,
                    limit: 1
                });

                let stripeCustomer;

                if (existingStripeCustomers.data.length > 0) {
                    // Use existing Stripe customer
                    stripeCustomer = existingStripeCustomers.data[0];
                    console.log(`Found existing Stripe customer for ${customer.email}`);
                } else {
                    // Create new Stripe customer
                    stripeCustomer = await stripe.customers.create({
                        email: customer.email,
                        name: customer.name,
                        phone: customer.phone,
                        address: {
                            line1: customer.address,
                        },
                        metadata: {
                            mongoId: customer._id.toString(),
                            source: 'migration'
                        }
                    });
                    console.log(`Created new Stripe customer for ${customer.email}`);
                }

                // Update the customer record with Stripe ID
                await Customer.findByIdAndUpdate(customer._id, {
                    stripeCustomerId: stripeCustomer.id
                });

                successCount++;
            } catch (error) {
                console.error(`Error migrating customer ${customer.email}:`, error);
                errorCount++;
            }
        }

        console.log(`\nMigration completed:`);
        console.log(`✓ Successfully migrated: ${successCount} customers`);
        console.log(`✗ Failed: ${errorCount} customers`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');

    } catch (error) {
        console.error('Migration error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the migration
if (require.main === module) {
    migrateCustomersToStripe()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

export default migrateCustomersToStripe;
