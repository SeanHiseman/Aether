import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MembershipSettings = ({ user }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    return (
        <div className="feed-settings">
            {user.has_membership ? (
                <div className="display-area">
                    <p className="text36">Thank you for joining</p>
                    <p className="text24">Your support helps us grow</p>
                    <p className="text24">If you wish to cancel, do it here</p>
                    <button className="button delete">Cancel membership</button>
                    <div className="error-message">{errorMessage}</div>
                </div>
            ) : (
                <div className="display-area">
                    <div className="left-aligned-text">
                        <p className="text36">Membership coming soon!</p>
                    </div>
                    <div className="error-message">{errorMessage}</div>
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;