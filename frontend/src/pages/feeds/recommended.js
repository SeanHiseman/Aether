import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../../components/contentWidget';

function RecommendedPage() {
    document.title = "Home";
    return (
        <div className="home-container">
            <div className="content-feed">
            </div>
            <aside id="right-aside">
                <h1>Home</h1>
            </aside>
        </div>
    )
}

export default RecommendedPage;