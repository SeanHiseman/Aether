import React, { useEffect } from 'react';

//PLaceholder for now
function HomePage() {
    useEffect(() => {
        document.title = "Home";
    }, []);

    return (
        <p>Hello!</p>
    )
}

export default HomePage;