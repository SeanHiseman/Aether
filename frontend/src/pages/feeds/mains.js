import axios from 'axios';
import React, { useEffect, useState } from 'react';
import ContentWidget from '../content_widget';

function MainPage() {
    document.title = "Main";
    return (
        <div className="home-container">
            <div className="content-feed">
                <header id="home-header">
                    <h1>Main</h1>
                </header>
            </div>
            <aside id="right-aside">
                <p>Hello</p>
            </aside>
        </div>
    )
}

export default MainPage;