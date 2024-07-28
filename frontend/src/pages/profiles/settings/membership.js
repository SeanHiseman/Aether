import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MembershipSettings = ({ user }) => {
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    return (
        <div id="profile-settings">
            {user.hasMembership ? (
                <div id="display-area">
                    <p style={{fontSize: 36}}>Thank you for joining</p>
                    <p style={{fontSize: 24}}>Your support helps us grow</p>
                    <p style={{fontSize: 24}}>If you wish to cancel, do it here</p>
                    <button className="button delete">Cancel membership</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </div>
            ) : (
                <div id="display-area">
                    <p style={{fontSize: 36}}>Membership benefits</p>
                    <p style={{fontSize: 24}}>Earn money from posts</p>
                    <p style={{fontSize: 24}}>Copilot</p>
                    <p style={{fontSize: 24}}>Adjustable feeds</p>
                    <p style={{fontSize: 24}}>Custom appearance</p>
                    <p style={{fontSize: 24}}>Voting</p>
                    <button className="button join">Join</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;