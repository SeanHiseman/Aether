import React, { useEffect } from 'react';

//PLaceholder for now
function HomePage() {
    useEffect(() => {
        document.title = "Home";
    }, []);

    return (
        <div id="home-container">
            <header id="home-header">
                <h1>Welcome</h1>
            </header>
            <aside id="right-aside">
                <p>Hello</p>
            </aside>
        </div>
    )
}

export default HomePage;