import express from 'express';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_KEY || "");

// Endpoint to handle payment with invoice creation
router.post('/create-payment', async (req, res) => {
    const { paymentMethodId, customerId, savePaymentMethod, amount, currency, description } = req.body;

    try {
        // Attach payment method to customer if they opted to save it
        let paymentMethod;
        if (savePaymentMethod) {
            paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });

            // Set as default payment method for invoices
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
        } else {
            paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        }

        // Create an invoice item for the customer
        const invoiceItem = await stripe.invoiceItems.create({
            customer: customerId,
            amount,
            currency,
            description: description || 'One-time payment',
        });

        // Create and finalize the invoice
        const invoice = await stripe.invoices.create({
            customer: customerId,
            auto_advance: true, // Auto-finalize the invoice
            collection_method: 'charge_automatically',
            payment_settings: {
                payment_method_options: {
                    card: {
                        request_three_d_secure: 'any' // Enable 3D Secure when required
                    }
                },
                payment_method_types: ['card']
            }
        });

        // Finalize the invoice (makes it ready for payment)
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

        // Pay the invoice immediately
        const paidInvoice = await stripe.invoices.pay(invoice.id, {
            payment_method: paymentMethod.id,
            off_session: true,
        });

        // Get the payment intent associated with the invoice for status tracking
        const paymentIntent = await stripe.paymentIntents.retrieve(paidInvoice.payment_intent as string);

        // Handle post-payment logic
        res.status(200).json({
            success: true,
            invoice: paidInvoice,
            paymentIntent,
            invoiceUrl: paidInvoice.hosted_invoice_url, // URL to view/download the invoice
            invoicePdf: paidInvoice.invoice_pdf // Direct PDF link
        });
    } catch (error: any) {
        console.error('Payment error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeCardError') {
            res.status(400).json({
                success: false,
                error: error.message,
                code: error.code
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'An error occurred during payment processing'
            });
        }
    }
});

// Endpoint to create a payment with multiple line items (useful for shopping carts)
router.post('/create-payment-with-items', async (req, res) => {
    const { paymentMethodId, customerId, savePaymentMethod, items, currency } = req.body;

    try {
        // Attach payment method to customer if they opted to save it
        if (savePaymentMethod) {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });

            // Set as default payment method for invoices
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
        }

        // Create invoice items for each item in the cart
        const invoiceItemPromises = items.map((item: any) =>
            stripe.invoiceItems.create({
                customer: customerId,
                amount: item.amount,
                currency: currency || 'usd',
                description: item.description,
                quantity: item.quantity || 1,
            })
        );

        await Promise.all(invoiceItemPromises);

        // Create and finalize the invoice
        const invoice = await stripe.invoices.create({
            customer: customerId,
            auto_advance: true,
            collection_method: 'charge_automatically',
            payment_settings: {
                payment_method_options: {
                    card: {
                        request_three_d_secure: 'any'
                    }
                },
                payment_method_types: ['card']
            }
        });

        // Finalize the invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

        // Pay the invoice
        const paidInvoice = await stripe.invoices.pay(invoice.id, {
            payment_method: paymentMethodId,
            off_session: true,
        });

        // Get the payment intent for status tracking
        const paymentIntent = await stripe.paymentIntents.retrieve(paidInvoice.payment_intent as string);

        res.status(200).json({
            success: true,
            invoice: paidInvoice,
            paymentIntent,
            invoiceUrl: paidInvoice.hosted_invoice_url,
            invoicePdf: paidInvoice.invoice_pdf
        });
    } catch (error: any) {
        console.error('Payment error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred during payment processing'
        });
    }
});

// Endpoint to retrieve invoice history for a customer
router.get('/invoices/:customerId', async (req, res) => {
    const { customerId } = req.params;
    const { limit = 10, starting_after } = req.query;

    try {
        const invoices = await stripe.invoices.list({
            customer: customerId,
            limit: Number(limit),
            starting_after: starting_after as string,
        });

        res.status(200).json({
            success: true,
            invoices: invoices.data,
            has_more: invoices.has_more
        });
    } catch (error: any) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while fetching invoices'
        });
    }
});

// Endpoint to retrieve a specific invoice
router.get('/invoice/:invoiceId', async (req, res) => {
    const { invoiceId } = req.params;

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);

        res.status(200).json({
            success: true,
            invoice,
            invoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf
        });
    } catch (error: any) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while fetching the invoice'
        });
    }
});

// Endpoint to send invoice to customer email
router.post('/send-invoice/:invoiceId', async (req, res) => {
    const { invoiceId } = req.params;

    try {
        const invoice = await stripe.invoices.sendInvoice(invoiceId);

        res.status(200).json({
            success: true,
            message: 'Invoice sent successfully',
            invoice
        });
    } catch (error: any) {
        console.error('Error sending invoice:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while sending the invoice'
        });
    }
});

export default router;
