import { FaInfoCircle } from 'react-icons/fa';
import { useState } from 'react';

export function InfoIconWithTooltip({ info }) {
    const [visible, setVisible] = useState(false);
    return (
        <div
            className="info-icon"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
        >
            <FaInfoCircle />
            {visible && (
                <div className="custom-tooltip" style={{ zIndex: 9999 }}>
                    {info}
                </div>
            )}
        </div>
    );
}