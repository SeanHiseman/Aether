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
                    <div className="error-message">{errorMessage}</div>
                </div>
            ) : (
                <div id="display-area">
                    <div className="left-aligned-text">
                        <p class="text36">Membership</p>
                        <div className="spacer20px"/>
                        <p class="text36">Ask</p>
                        <p class="text24">-Ask is an assistant that aids throughout Aether</p>
                        <p class="text24">-Need to check the accuracy of a post, find the perfect content or get help using the site? Just Ask</p>
                        <div className="spacer20px"/>
                        <p class="text36">Benefits</p>
                        <p class="text24">-Earn money from posts. The more upvotes and fewer downvotes, the more you make per view</p>
                        <p class="text24">-Custom personal feeds. Full control over how you sort your content</p>
                        <p class="text24">-Dive in to detail by writing longer posts. Up to 100,000 characters</p>
                        <p class="text24">-Voting for moderators, admins, leaders and features</p>
                        <p class="text24"></p>
                    </div>
                    <button className="button join">Join</button>
                    <div className="error-message">{errorMessage}</div>
                </div>
            )}
        </div>
    );
};

export default MembershipSettings;