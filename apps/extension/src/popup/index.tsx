import React from 'react';
import { createRoot } from 'react-dom/client';

const MiniPopup = () => {
    return (
        <div style={{ padding: '20px', width: '300px' }}>
            <h2>Xjur Client</h2>
            <p>Conectado e operacional.</p>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <MiniPopup />
    </React.StrictMode>
);
