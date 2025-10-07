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
    if (!sig || !stripeConfig.webhookSecret) {
        return res.status(400).send('Missing Stripe signature / webhook secret');
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            stripeConfig.webhookSecret
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        switch (event.type) {
        case 'checkout.session.completed':
            await handleSuccessfulPayment(event.data.object);
            break;
        case 'invoice.payment_succeeded':
            await handleSuccessfulRenewal(event.data.object);
            break;
        case 'customer.subscription.deleted':
            await handleCancelledSubscription(event.data.object);
            break;
        case 'invoice.payment_failed':
            await handleFailedPayment(event.data.object);
            break;
        }
        res.status(200).json({ received: true });
    } catch (err) {
        res.status(500).send('Webhook handler failure');
    }
}

async function handleSuccessfulPayment(session) {
    console.log('Handling successful payment for session:', session);
    const userId = session.metadata.userId;
    const subscriptionId = session.subscription;
    console.log(`User ID: ${userId}, Subscription ID: ${subscriptionId}`);
    try {
        await Users.update({ 
            has_membership: true,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date()
        }, { 
            where: { user_id: userId } 
        });
        console.log(`User ${userId} membership activated, waiting for invoice to set expiration`);
    } catch (error) {
        console.error('Error in handleSuccessfulPayment:', error);
        throw error;
    }
}

async function handleSuccessfulRenewal(invoice) {
    console.log('Handling successful renewal/payment for invoice:', invoice.id);
    const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId) {
        console.log('No subscription ID found in invoice:', invoice);
        return;
    }
    const periodEndUnix = invoice.lines?.data?.[0]?.period?.end;
    if (!periodEndUnix) {
        console.error('No period end found in invoice');
        return;
    }
    const currentPeriodEnd = new Date(periodEndUnix * 1000);
    console.log(`Subscription ${subscriptionId} expires at ${currentPeriodEnd}`);
    const [updatedRows] = await Users.update(
        {
            has_membership: true,
            subscription_expires_at: currentPeriodEnd,
            updated_at: new Date(),
        }, 
        { where: { stripe_subscription_id: subscriptionId } }
    );
    if (updatedRows > 0) {
        console.log(`Updated expiration date for subscription ${subscriptionId}`);
    } else {
        if (invoice.billing_reason === 'subscription_create' && invoice.customer_email) {
            const [updatedByEmail] = await Users.update(
                {
                    has_membership: true,
                    subscription_expires_at: currentPeriodEnd,
                    stripe_subscription_id: subscriptionId,
                    updated_at: new Date(),
                }, 
                { where: { email: invoice.customer_email } }
            );
            console.log(`Updated ${updatedByEmail} users by email ${invoice.customer_email}`);
        }
    }
}

async function handleCancelledSubscription(subscription) {
    try {
        const user = await Users.findOne({
            where: { stripe_subscription_id: subscription.id }
        });
        if (user) {
            await Users.update({ 
                has_membership: false,
                stripe_subscription_id: null,
                subscription_expires_at: null,
                updated_at: new Date()
            }, { 
                where: { user_id: user.user_id } 
            });
        }
    } catch (error) {
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
        throw error;
    }
}