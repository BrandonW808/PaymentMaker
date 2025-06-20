import express from 'express';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_KEY || "");

// Endpoint to handle payment
router.post('/create-payment', async (req, res) => {
    const { paymentMethodId, customerId, savePaymentMethod, amount, currency } = req.body;

    try {
        // Attach payment method to customer if they opted to save it
        let paymentMethod;
        if (savePaymentMethod) {
            paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
        } else {
            paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        }

        // Create a payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            customer: customerId,
            payment_method: paymentMethod.id,
            off_session: true,
            confirm: true,
        });

        // Handle post-payment logic
        res.status(200).json({ success: true, paymentIntent });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;