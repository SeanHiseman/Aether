import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../content_widget';

function FollowingPage() {
    document.title = "Following";
    return (
        <div className="home-container">
            <div className="content-feed">
            </div>
            <aside id="right-aside">
                <h1>Following</h1>
            </aside>
        </div>
    )
}

export default FollowingPage;