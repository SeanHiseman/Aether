import React from 'react';
import { Link } from 'react-router-dom';
import '../../css/welcome.css';

const Membership = () => {

    document.title="Membership";
    return (
        <div id="welcome-container">
            <p id="welcome-text">Welcome to Aether</p>
            <p className="text24">Better social media</p>
            <div id="join-login">
                <Link to="/welcome">
                    <button className="button join welcome">Back</button>
                </Link>
                <Link to="/join">
                    <button className="button join welcome">Join</button>
                </Link>
            </div>
            <div className="welcome-box single">
                <div className="left-aligned-text">
                    <p className="welcome-box-header">Membership (coming soon)</p>
                    <p>Membership grants access to premium features and revenue sharing. Only members can claim the money earnt from their posts</p>
                    <div className="spacer20px"/>
                    <p>Ask is an assistant that assists members with their use of Aether, including with creating posts. Members get much greater usage of Ask</p>
                    <div className="spacer20px"/>
                    <p>Voting for admins, new features and group decisions is exclusive to members</p>
                </div>
            </div>
        </div>
    );
};

export default Membership;