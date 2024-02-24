import React, { useEffect } from 'react';

//PLaceholder for now
function HomePage() {
    useEffect(() => {
        document.title = "Home";
    }, []);

    return (
        <div className="home-container">
            <div className="content-feed">
                <header id="home-header">
                    <h1>Welcome</h1>
                </header>
            </div>
            <aside id="right-aside">
                <p>Hello</p>
            </aside>
        </div>
    )
}

export default HomePage;