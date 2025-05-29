import authenticateCheck from '../functions/checks/authenticateCheck.js';
import sortPostsByWeightedRatio from '../functions/postSorting.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { Feeds, Users } from '../models/relationships.js';
import { Router } from 'express';
import { Op } from 'sequelize';

dotenv.config();
const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/change_email', authenticateCheck, async (req, res) => {
    try {
        const { email, userId } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email required' });
        }
        const user = await Users.findOne({ where: { user_id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        user.email = email;
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update email' });
    }
});

router.post('/change_theme', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session?.user_id;
        let { theme } = req.body;
        if (typeof theme === 'object') {
            theme = JSON.stringify(theme);
        }
        await Users.update({ theme: theme }, { where: { user_id: userId } });
        res.status(200).json({ success: true });
    } catch (error) {
		res.status(500).json({ success: false });
    }
});

router.post('/change_username', authenticateCheck, async (req, res) => {
    try {
        const { feed_id, newName, user_id } = req.body;
        if (!newName || newName.trim().length < 3) {
            return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
        }
        const feed = await Feeds.findOne({ where: { feed_id } });
        const user = await Users.findOne({ where: { user_id } });
        if (!feed || !user) {
            return res.status(404).json({ success: false, error: 'Feed or user not found' });
        }
        feed.feed_name = newName.trim();
        user.username = newName.trim();
        await feed.save();
        await user.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error changing username:', error);
        res.status(500).json({ success: false, error: 'Failed to update username' });
    }
});

router.get('/get_theme', async (req, res) => {
    try {
        const userId = req.session?.user_id;
        if (!userId) {
            return res.status(200).json({ theme: 'dark' });
        }
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['theme']
        });
        if (!user) {
            return res.status(200).json({ theme: 'dark' });
        }
        res.status(200).json({ success: true, theme: user.theme || 'dark' });
    } catch (error) {
        console.error('Error getting theme:', error);
        res.status(500).json({ success: false, theme: 'dark' });
    }
});

router.post('/create-checkout-session', authenticateCheck, async (req, res) => {
    try {
        const { planType } = req.body;
        console.log('Creating checkout session for planType:', planType);
        const userId = req.session?.user_id;
        const userEmail = req.session?.email;  
        console.log('User ID:', userId);
        console.log('User Email:', userEmail);
        const priceId = planType === 'yearly'
            ? process.env.STRIPE_YEARLY_PRICE_ID
            : process.env.STRIPE_MONTHLY_PRICE_ID;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            //success_url: `${process.env.FRONTEND_URL}/feed_settings?success=true`,
            //cancel_url: `${process.env.FRONTEND_URL}/feed_settings?canceled=true`,
            success_url: `${process.env.FRONTEND_URL}/feed_settings/${req.session.username}`,
            cancel_url: `${process.env.FRONTEND_URL}/feed_settings/${req.session.username}`,
            metadata: { userId: userId.toString() },
            customer_email: userEmail,
        });
        console.log("session:", session);
        res.status(200).json({ success: true, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
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
});

async function handleSuccessfulPayment(session) {
    console.log('Handling successful payment for session:', session);
    const userId = session.user_id;
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

router.post('/cancel-subscription', authenticateCheck, async (req, res) => {
    try {
        console.log('Cancelling subscription for user');
        const userId = req.session?.user_id;
        console.log('User ID:', userId);
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['stripe_subscription_id']
        });
        console.log('User found:', user);
        if (!user?.stripe_subscription_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'No active subscription found' 
            });
        }
        await stripe.subscriptions.update(user.stripe_subscription_id, {
            cancel_at_period_end: true
        });
        res.status(200).json({ 
            success: true, 
            message: 'Subscription will be cancelled at the end of the billing period' 
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
    }
});

router.get('/subscription-status', authenticateCheck, async (req, res) => {
    try {
        const userId = req.session?.user_id;
        const user = await Users.findOne({
            where: { user_id: userId },
            attributes: ['has_membership', 'stripe_subscription_id', 'subscription_expires_at']
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        let subscriptionDetails = null;
        if (user.stripe_subscription_id) {
            try {
                subscriptionDetails = await stripe.subscriptions.retrieve(
                    user.stripe_subscription_id
                );
            } catch (stripeError) {
                console.error('Error fetching subscription from Stripe:', stripeError);
                if (stripeError.code === 'resource_missing') {
                    await Users.update({
                        stripe_subscription_id: null,
                        has_membership: false
                    }, {
                        where: { user_id: userId }
                    });
                }
            }
        }
        res.status(200).json({
            has_membership: user.has_membership,
            expires_at: user.subscription_expires_at,
            subscription: subscriptionDetails ? {
                status: subscriptionDetails.status,
                current_period_end: subscriptionDetails.current_period_end,
                cancel_at_period_end: subscriptionDetails.cancel_at_period_end,
                cancel_at: subscriptionDetails.cancel_at,
                canceled_at: subscriptionDetails.canceled_at
            } : null
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch subscription status' });
    }
});

//Check for expired subscriptions (runs every hour)
cron.schedule('0 * * * *', async () => {
    try {
        const now = new Date();
        const expiredUsers = await Users.findAll({
            where: {
                has_membership: true,
                subscription_expires_at: {
                    [Op.lt]: now
                }
            }
        });
        for (const user of expiredUsers) {
            let shouldDeactivate = true;
            if (user.stripe_subscription_id) {
                try {
                    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
                    if (subscription.status === 'active') {
                        const newExpirationDate = new Date(subscription.current_period_end * 1000);
                        await Users.update({ 
                            subscription_expires_at: newExpirationDate,
                            updated_at: new Date()
                        }, { 
                            where: { user_id: user.user_id } 
                        });
                        shouldDeactivate = false;
                        console.log(`Updated expiration for user ${user.user_id} to ${newExpirationDate}`);
                    }
                } catch (stripeError) {
                    console.log(`Stripe subscription ${user.stripe_subscription_id} not found or error occurred`);
                }
            }
            if (shouldDeactivate) {
                await Users.update({ 
                    has_membership: false,
                    stripe_subscription_id: null,
                    subscription_expires_at: null,
                    updated_at: new Date()
                }, { 
                    where: { user_id: user.user_id } 
                });
                console.log(`Deactivated expired membership for user ${user.user_id}`);
            }
        }
        if (expiredUsers.length > 0) {
            console.log(`Processed ${expiredUsers.length} expired subscriptions`);
        }
    } catch (error) {
        console.error('Error in subscription expiration check:', error);
    }
});

export default router;