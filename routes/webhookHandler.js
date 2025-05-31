import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Users } from '../models/relationships.js';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
console.log('Environment:', isDevelopment ? 'Development' : 'Production');
const stripeConfig = {
    secretKey: isDevelopment 
        ? process.env.STRIPE_TEST_SECRET_KEY 
        : process.env.STRIPE_SECRET_KEY,
    webhookSecret: isDevelopment 
        ? process.env.STRIPE_TEST_WEBHOOK_SECRET 
        : process.env.STRIPE_WEBHOOK_SECRET
};
console.log('Stripe Secret Key:', stripeConfig.secretKey);
console.log('Stripe Webhook Secret:', stripeConfig.webhookSecret);
const stripe = new Stripe(stripeConfig.secretKey);

export async function handleStripeWebhook(req, res) {
    console.log('WEBHOOK HANDLER CALLED!');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Webhook secret exists:', !!stripeConfig.webhookSecret);
    console.log('Webhook secret preview:', stripeConfig.webhookSecret?.substring(0, 15) + '...');
    console.log('Headers received:');
    Object.keys(req.headers).forEach(key => {
        if (key.toLowerCase().includes('stripe')) {
            console.log(`  ${key}: ${req.headers[key]}`);
        }
    });
    console.log('Body type:', typeof req.body);
    console.log('Body is Buffer:', Buffer.isBuffer(req.body));
    console.log('Body length:', req.body?.length || 'undefined');
    const sig = req.headers['stripe-signature'];
    const endpointSecret = stripeConfig.webhookSecret;
    if (!sig) {
        console.error('No Stripe signature header found');
        return res.status(400).send('No signature');
    }
    if (!endpointSecret) {
        console.error('No webhook secret configured');
        console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('STRIPE')));
        return res.status(400).send('No webhook secret');
    }
    let event;
    try {
        console.log('Attempting to verify webhook signature...');
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log('Webhook signature verified successfully!');
        console.log('Event type:', event.type);
        console.log('Event ID:', event.id);
    } catch (err) {
        console.error('Webhook signature verification failed:');
        console.error('Error message:', err.message);
        console.error('Error type:', err.type);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                await handleSuccessfulPayment(session);
                break;
            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                await handleCancelledSubscription(subscription);
                break;
            case 'invoice.payment_failed':
                const invoice = event.data.object;
                await handleFailedPayment(invoice);
                break;
            case 'invoice.payment_succeeded':
                const successfulInvoice = event.data.object;
                await handleSuccessfulRenewal(successfulInvoice);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}

async function handleSuccessfulPayment(session) {
    console.log('Handling successful payment for session:', session);
    const userId = session.metadata.userId;
    const subscriptionId = session.subscription;
    console.log(`User ID: ${userId}, Subscription ID: ${subscriptionId}`);
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log('Retrieved subscription:', subscription);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        console.log('Current period end:', currentPeriodEnd);
        await Users.update({ 
            has_membership: true,
            stripe_subscription_id: subscriptionId,
            subscription_expires_at: currentPeriodEnd,
            updated_at: new Date()
        }, { 
            where: { user_id: userId } 
        });
        console.log(`User ${userId} membership activated until ${currentPeriodEnd}`);
    } catch (error) {
        console.error('Error updating user membership:', error);
        throw error;
    }
}

async function handleSuccessfulRenewal(invoice) {
    const subscriptionId = invoice.subscription;
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        const user = await Users.findOne({
            where: { stripe_subscription_id: subscriptionId }
        });
        if (user) {
            await Users.update({ 
                has_membership: true,
                subscription_expires_at: currentPeriodEnd,
                updated_at: new Date()
            }, { 
                where: { user_id: user.user_id } 
            });
            console.log(`User ${user.user_id} membership renewed until ${currentPeriodEnd}`);
        }
    } catch (error) {
        console.error('Error handling successful renewal:', error);
        throw error;
    }
}

async function handleCancelledSubscription(subscription) {
    try {
        console.log('Handling cancelled subscription:', subscription);
        const user = await Users.findOne({
            where: { stripe_subscription_id: subscription.id }
        });
        console.log('Found user for cancelled subscription:', user);
        if (user) {
            await Users.update({ 
                has_membership: false,
                stripe_subscription_id: null,
                subscription_expires_at: null,
                updated_at: new Date()
            }, { 
                where: { user_id: user.user_id } 
            });
            console.log(`User ${user.user_id} membership cancelled`);
        }
    } catch (error) {
        console.error('Error handling cancelled subscription:', error);
        throw error;
    }
}

async function handleFailedPayment(invoice) {
    const subscriptionId = invoice.subscription;
    try {
        const user = await Users.findOne({
            where: { stripe_subscription_id: subscriptionId }
        });
        if (user) {
            console.log(`Payment failed for user ${user.user_id}`);
        }
    } catch (error) {
        console.error('Error handling failed payment:', error);
        throw error;
    }
}