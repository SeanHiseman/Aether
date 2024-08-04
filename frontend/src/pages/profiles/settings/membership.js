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
                    <p class="text36">Thank you for joining</p>
                    <p class="text24">Your support helps us grow</p>
                    <p class="text24">If you wish to cancel, do it here</p>
                    <button className="button delete">Cancel membership</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </div>
            ) : (
                <div id="display-area">
                    <p class="text36">Membership benefits</p>
                    <p class="text24">Earn money from posts</p>
                    <p class="text24">Copilot</p>
                    <p class="text24">Adjustable feeds</p>
                    <p class="text24">Custom appearance</p>
                    <p class="text24">Longer posts</p>
                    <p class="text24">Voting</p>
                    <button className="button join">Join</button>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;