import dotenv from 'dotenv';
import Stripe from 'stripe';
import { Users } from '../models/relationships.js';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const stripeConfig = {
    secretKey: isDevelopment 
        ? process.env.STRIPE_TEST_SECRET_KEY 
        : process.env.STRIPE_SECRET_KEY,
    webhookSecret: isDevelopment 
        ? process.env.STRIPE_TEST_WEBHOOK_SECRET 
        : process.env.STRIPE_WEBHOOK_SECRET
};

const stripe = new Stripe(stripeConfig.secretKey);

export async function handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = stripeConfig.webhookSecret;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log('Webhook event received:', event.type);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
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
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
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