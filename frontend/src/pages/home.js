import React, { useEffect } from 'react';
import BaseLayout from './base';

//PLaceholder for now
function HomePage() {
    useEffect(() => {
        document.title = "Home";
    }, []);

    return (
        <BaseLayout>
            {/* home page content */}
        </BaseLayout>
    )
}

export default HomePage;