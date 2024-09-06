import React, { useState } from 'react';

const Points = ({ user, setCurrentView }) => {

    return (
        <div id="profile-settings">
            <div id="display-area">
                <div className="left-aligned-text">
                    <p className="text36">{user.points} {user.points === 1 ? 'point' : 'points'}</p>
                    <div className="spacer20px"/>
                    <p className="text36">Earn points from:</p>
                    <p className="text24">Posts</p>
                    <p className="text24">Inviting users to join</p>
                    <p className="text24">Moderation</p>
                    {!user.hasMembership && (
                        <>
                            <div className="spacer20px"/>
                            <p className="text24">Membership is required to claim earnings</p>
                            <button className="button join" onClick={() => setCurrentView('membership-settings')}>Join</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Points;