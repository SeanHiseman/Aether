import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

function MainPage() {
    document.title = "Main";
    return (
        <div className="home-container">
            <div className="content-feed">
            </div>
            <aside id="right-aside">
                <h1>Main</h1>
            </aside>
        </div>
    )
}

export default MainPage;