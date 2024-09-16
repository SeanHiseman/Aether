import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';

const rootElement = document.getElementById('root');

ReactDOM.render(
    //Don't use StrictMode for production
    <React.StrictMode> 
        <App />
    </React.StrictMode>,
    rootElement
);