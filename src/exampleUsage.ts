// Example usage of the new invoice-based payment system

// 1. Simple one-time payment with invoice generation
async function createSinglePayment() {
    const paymentData = {
        paymentMethodId: 'pm_1234567890', // Payment method ID from Stripe Elements
        customerId: 'cus_1234567890', // Stripe customer ID
        savePaymentMethod: true, // Save card for future use
        amount: 5000, // Amount in cents ($50.00)
        currency: 'usd',
        description: 'Premium subscription - Monthly'
    };

    try {
        const response = await fetch('/api/stripe/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` // Your JWT token
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (result.success) {
            console.log('Payment successful!');
            console.log('Invoice URL:', result.invoiceUrl); // Customer can view/download invoice
            console.log('Invoice PDF:', result.invoicePdf); // Direct PDF link
            console.log('Invoice ID:', result.invoice.id);
            console.log('Payment Intent:', result.paymentIntent.id);
        } else {
            console.error('Payment failed:', result.error);
        }
    } catch (error) {
        console.error('Error processing payment:', error);
    }
}

// 2. Multiple items payment (shopping cart)
async function createMultiItemPayment() {
    const cartData = {
        paymentMethodId: 'pm_1234567890',
        customerId: 'cus_1234567890',
        savePaymentMethod: false,
        currency: 'usd',
        items: [
            {
                amount: 2999, // $29.99
                description: 'Product A - Blue Widget',
                quantity: 2
            },
            {
                amount: 4999, // $49.99
                description: 'Product B - Premium Service',
                quantity: 1
            },
            {
                amount: 999, // $9.99
                description: 'Shipping and handling',
                quantity: 1
            }
        ]
    };

    try {
        const response = await fetch('/api/stripe/create-payment-with-items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(cartData)
        });

        const result = await response.json();

        if (result.success) {
            console.log('Payment successful!');
            console.log('Invoice with all items:', result.invoiceUrl);
            // The invoice will show all items with descriptions and quantities
        }
    } catch (error) {
        console.error('Error processing payment:', error);
    }
}

// 3. Retrieve customer's invoice history
async function getCustomerInvoices(customerId: string) {
    try {
        const response = await fetch(`/api/stripe/invoices/${customerId}?limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('Customer invoices:');
            result.invoices.forEach((invoice: any) => {
                console.log(`- Invoice ${invoice.number}: $${invoice.amount_paid / 100}`);
                console.log(`  Date: ${new Date(invoice.created * 1000).toLocaleDateString()}`);
                console.log(`  Status: ${invoice.status}`);
                console.log(`  View: ${invoice.hosted_invoice_url}`);
                console.log('---');
            });
        }
    } catch (error) {
        console.error('Error fetching invoices:', error);
    }
}

// 4. Get specific invoice details
async function getInvoiceDetails(invoiceId: string) {
    try {
        const response = await fetch(`/api/stripe/invoice/${invoiceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const invoice = result.invoice;
            console.log('Invoice Details:');
            console.log('Number:', invoice.number);
            console.log('Amount:', `$${invoice.amount_paid / 100}`);
            console.log('Status:', invoice.status);
            console.log('Customer Email:', invoice.customer_email);
            console.log('Download PDF:', result.invoicePdf);
            console.log('View Online:', result.invoiceUrl);
        }
    } catch (error) {
        console.error('Error fetching invoice:', error);
    }
}

// 5. Send invoice to customer via email
async function emailInvoiceToCustomer(invoiceId: string) {
    try {
        const response = await fetch(`/api/stripe/send-invoice/${invoiceId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (result.success) {
            console.log('Invoice sent successfully to customer email');
        }
    } catch (error) {
        console.error('Error sending invoice:', error);
    }
}

// 6. Frontend implementation with Stripe Elements
function setupStripePaymentForm() {
    // Initialize Stripe
    const stripe = Stripe('your_publishable_key');
    const elements = stripe.elements();

    // Create card element
    const cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                '::placeholder': {
                    color: '#aab7c4'
                }
            }
        }
    });

    // Mount card element
    cardElement.mount('#card-element');

    // Handle form submission
    document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Create payment method
        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
            billing_details: {
                name: 'Customer Name',
                email: 'customer@example.com'
            }
        });

        if (error) {
            console.error('Error creating payment method:', error);
            return;
        }

        // Send payment method to your server
        const paymentData = {
            paymentMethodId: paymentMethod.id,
            customerId: 'cus_1234567890', // Get from your backend after login
            savePaymentMethod: document.getElementById('save-card')?.checked,
            amount: 5000, // $50.00
            currency: 'usd',
            description: 'Order #12345'
        };

        // Process payment
        const response = await fetch('/api/stripe/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (result.success) {
            // Payment successful
            window.location.href = `/success?invoice=${result.invoice.id}`;
        } else {
            // Show error to customer
            alert(`Payment failed: ${result.error}`);
        }
    });
}

export {
    createSinglePayment,
    createMultiItemPayment,
    getCustomerInvoices,
    getInvoiceDetails,
    emailInvoiceToCustomer,
    setupStripePaymentForm
};
