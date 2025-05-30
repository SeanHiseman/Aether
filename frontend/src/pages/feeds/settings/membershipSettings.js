import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { Check, Star, Zap, Shield, Crown, ListFilter } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const MembershipSettings = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState('monthly');
    const [showConfirm, setShowConfirm] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const { user } = useOutletContext();

    useEffect(() => {
        if (user?.has_membership) {
            fetchSubscriptionStatus();
        }
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            setSuccessMessage('Payment successful! Your membership is now active.');
        } else if (urlParams.get('canceled') === 'true') {
            setErrorMessage('Payment was cancelled. You can try again anytime.');
        }
    }, [user]);

    const fetchSubscriptionStatus = async () => {
        try {
            const response = await axios.get('/api/subscription-status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setSubscriptionStatus(response.data);
        } catch (error) {
            console.error('Error fetching subscription status:', error);
        }
    };

    const handleSubscribe = async (planType) => {
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const response = await axios.post('/api/create-checkout-session', {
                planType,
                userId: user?.user_id
            }, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            console.log('Checkout session response', response);
            if (response.data.url) {
                window.location.href = response.data.url;
            } else {
                setErrorMessage(response.data.error || 'Failed to initiate payment. Please try again.');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            if (error.response) {
                setErrorMessage(error.response.data.error || 'Failed to initiate payment. Please try again.');
            } else if (error.request) {
                setErrorMessage('Network error. Please check your connection and try again.');
            } else {
                setErrorMessage('An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancelMembership = () => {
        setShowConfirm(true);
    };

    // Also add this right after your state declarations:
    useEffect(() => {
        console.log('showConfirm changed to:', showConfirm);
    }, [showConfirm]);

    const proceedCancel = async () => {            
        console.log('Cancelling membership...');
        setShowConfirm(false);
        setLoading(true);
        setErrorMessage('');
        try {
            const response = await axios.post('/api/cancel-subscription', {}, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            console.log('Cancellation response:', response);
            setSuccessMessage(response.data.message || 'Subscription cancelled successfully.');
            fetchSubscriptionStatus(); 
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            if (error.response) {
                setErrorMessage(error.response.data.error || 'Failed to cancel membership. Please contact support.');
            } else if (error.request) {
                setErrorMessage('Network error. Please try again.');
            } else {
                setErrorMessage('An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: <Zap className="feature-icon" />, text: "Highest quality post generation" },
        { icon: <Star className="feature-icon" />, text: "Unlimited access to all features" },
        //{ icon: <Shield className="feature-icon" />, text: "Access all posts for free" },
        //{ icon: <Crown className="feature-icon" />, text: "Premium features" },
        //{ icon: <Check className="feature-icon" />, text: "Improved customisation" },
        { icon: <ListFilter className="feature-icon" />, text: "Create longer posts" }
    ];

    if (user?.has_membership) {
        return (
            <div className="membership-container">
                <div className="membership-card">
                    <div className="crown-icon">
                        <Crown />
                    </div>
                    <h1 className="welcome-title">Welcome {user.username}!</h1>
                    <p className="welcome-subtitle">Thank you for supporting Aether</p>
                    <div className="status-card">
                        <p className="status-text">
                            Your membership is active and all premium features are unlocked
                        </p>
                        {subscriptionStatus?.expires_at && (
                            <p className="expiry-text">
                                Expires: {new Date(subscriptionStatus.expires_at).toLocaleDateString()}
                            </p>
                        )}
                        {subscriptionStatus?.subscription?.cancel_at_period_end && (
                            <p className="cancel-notice">
                                Your subscription will cancel at the end of the billing period
                            </p>
                        )}
                    </div>
                    <div className="action-buttons">
                        {!subscriptionStatus?.subscription?.cancel_at_period_end && (
                            <button 
                                onClick={handleCancelMembership}
                                disabled={loading}
                                className="cancel-button"
                            >
                                {loading ? 'Processing...' : 'Cancel Membership'}
                            </button>
                        )}
                    </div>
                    {errorMessage && (
                        <div className="error-message">
                            {errorMessage}
                        </div>
                    )}
                    {successMessage && (
                        <div className="success-message">
                            {successMessage}
                        </div>
                    )}
                </div>
                {showConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2 className="modal-title">Cancel Membership?</h2>
                            <p className="modal-text">Are you sure you want to cancel your membership?</p>
                            <div className="modal-buttons">
                                <button
                                    onClick={proceedCancel}
                                    className="modal-button confirm-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Processing...' : 'Yes, Cancel'}
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="modal-button cancel-button-modal"
                                    disabled={loading}
                                >
                                    Go Back
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="membership-container">
            <div className="header-section">
                <h1 className="main-title">Get Membership</h1>
                <p className="main-subtitle">
                    Experience the best of Aether 
                </p>
            </div>
            <div className="features-grid">
                {features.map((feature, index) => (
                    <div key={index} className="feature-card">
                        <div className="feature-content">
                            {feature.icon}
                            <p className="feature-text">{feature.text}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="plans-container">
                <div className={`plan-card monthly-plan ${selectedPlan === 'monthly' ? 'selected' : ''}`}>
                    <div className="plan-content">
                        <h3 className="plan-title">Monthly</h3>
                        <div className="plan-price">
                            <span className="price-amount">£9</span>
                            <span className="price-period">/month</span>
                        </div>
                        <p className="plan-description">Perfect for getting started</p>
                        <button
                            onClick={() => {
                                setSelectedPlan('monthly');
                                handleSubscribe('monthly');
                            }}
                            disabled={loading}
                            className="plan-button monthly-button"
                        >
                            {loading && selectedPlan === 'monthly' ? 'Processing...' : 'Start Monthly Plan'}
                        </button>
                    </div>
                </div>
                <div className={`plan-card yearly-plan ${selectedPlan === 'yearly' ? 'selected' : ''}`}>
                    <div className="save-badge">Save 20%</div>
                    <div className="plan-content">
                        <h3 className="plan-title">Yearly</h3>
                        <div className="plan-price">
                            <span className="price-amount">£90</span>
                            <span className="price-period">/year</span>
                        </div>
                        <p className="plan-description">Best value for committed users</p>
                        <button
                            onClick={() => {
                                setSelectedPlan('yearly');
                                handleSubscribe('yearly');
                            }}
                            disabled={loading}
                            className="plan-button yearly-button"
                        >
                            {loading && selectedPlan === 'yearly' ? 'Processing...' : 'Start Yearly Plan'}
                        </button>
                    </div>
                </div>
            </div>
            <div className="trust-indicators">
                <div className="trust-item">
                    <Zap className="trust-icon" />
                    <span>Powered by Stripe</span>
                </div>
                <div className="trust-item">
                    <Check className="trust-icon" />
                    <span>Cancel Anytime</span>
                </div>
            </div>
            {errorMessage && (
                <div className="error-toast">
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className="success-toast">
                    {successMessage}
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;