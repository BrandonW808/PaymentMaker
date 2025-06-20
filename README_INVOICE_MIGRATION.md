# Migration from Payment Intents to Invoice-based Payments

## Overview
This update migrates the payment system from using direct Payment Intents to using Stripe Invoices, which automatically generate proper invoice documentation while maintaining the same payment functionality.

## Key Benefits

### 1. **Automatic Invoice Generation**
- Every payment now generates a professional invoice automatically
- Invoices include all transaction details, line items, and customer information
- No need for separate invoice generation logic

### 2. **Better Record Keeping**
- All payments are documented with numbered invoices
- Easy access to invoice history for customers and admins
- PDF invoices available for download
- Hosted invoice URLs for easy sharing

### 3. **Compliance and Tax Benefits**
- Proper invoice documentation for tax purposes
- Sequential invoice numbering
- Includes all required invoice elements (date, amount, items, etc.)
- Better for accounting and bookkeeping

### 4. **Enhanced Customer Experience**
- Customers receive professional invoices automatically
- Can view and download invoices anytime
- Email invoice functionality built-in
- Invoice history readily available

### 5. **Maintained Functionality**
- Same payment flow from user perspective
- Card saving functionality preserved
- 3D Secure authentication supported
- Off-session payments still work

## What Changed

### Previous Implementation (Payment Intents only):
```javascript
// Direct payment intent creation
const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method: paymentMethod.id,
    off_session: true,
    confirm: true,
});
```

### New Implementation (Invoice-based):
```javascript
// Create invoice item
await stripe.invoiceItems.create({
    customer: customerId,
    amount,
    currency,
    description: 'Payment description'
});

// Create and pay invoice (generates payment intent internally)
const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
    collection_method: 'charge_automatically'
});

const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
const paidInvoice = await stripe.invoices.pay(invoice.id, {
    payment_method: paymentMethodId
});
```

## New Features Added

### 1. **Multiple Endpoints**
- `/api/stripe/create-payment` - Single payment with invoice
- `/api/stripe/create-payment-with-items` - Multiple line items (cart checkout)
- `/api/stripe/invoices/:customerId` - Get customer's invoice history
- `/api/stripe/invoice/:invoiceId` - Get specific invoice details
- `/api/stripe/send-invoice/:invoiceId` - Email invoice to customer

### 2. **Enhanced Response Data**
```javascript
{
    success: true,
    invoice: { /* Full invoice object */ },
    paymentIntent: { /* Payment intent details */ },
    invoiceUrl: "https://...", // View/download invoice online
    invoicePdf: "https://..." // Direct PDF download link
}
```

### 3. **Line Item Support**
- Support for multiple items in a single invoice
- Each item can have description, quantity, and amount
- Perfect for shopping cart implementations

## Migration Steps

### 1. **Update Database Schema**
Add `stripeCustomerId` field to your Customer model:
```javascript
stripeCustomerId: { type: String, unique: true, sparse: true }
```

### 2. **Run Migration Script**
```bash
npm run migrate:stripe-invoices
```
This will create Stripe customers for all existing users.

### 3. **Update Environment Variables**
Ensure you have:
```env
STRIPE_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_... (if using webhooks)
```

### 4. **Update Frontend**
- Same payment method collection process
- Update API endpoint from direct payment intent to invoice endpoint
- Add invoice viewing/downloading UI components

### 5. **Test the Implementation**
- Test payment with new card
- Test payment with saved card
- Test invoice generation
- Test invoice history retrieval
- Test PDF download functionality

## API Usage Examples

### Create Payment with Invoice
```javascript
const response = await fetch('/api/stripe/create-payment', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        paymentMethodId: 'pm_...',
        customerId: 'cus_...',
        amount: 5000, // $50.00
        currency: 'usd',
        description: 'Monthly subscription',
        savePaymentMethod: true
    })
});
```

### Retrieve Invoice History
```javascript
const response = await fetch(`/api/stripe/invoices/${customerId}?limit=10`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

## Important Notes

1. **Payment Intent Still Available**: The invoice system creates payment intents internally, so you can still track payment status the same way.

2. **Webhook Compatibility**: If you're using webhooks, you'll now receive both `invoice.*` and `payment_intent.*` events.

3. **Refunds**: Refunds work the same way but will be reflected in credit notes on the invoice.

4. **Subscription Compatibility**: This system works seamlessly with Stripe Subscriptions, which already use invoices.

5. **Testing**: Use Stripe test mode to thoroughly test the implementation before going live.

## Rollback Plan

If you need to rollback to the previous implementation:
1. Keep the old payment intent code in a separate branch
2. The invoice system is backward compatible - old payment intents still work
3. Customer data remains intact in both systems

## Support

For any issues or questions:
- Check Stripe Invoice documentation: https://stripe.com/docs/invoicing
- Review the example usage in `exampleUsage.ts`
- Check logs for detailed error messages
