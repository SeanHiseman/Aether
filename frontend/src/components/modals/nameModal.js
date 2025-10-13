import '../../css/modal.css';
import { useState, useEffect } from 'react';

const NameModal = ({ isOpen, onConfirm, onCancel, initialName = '', title = 'Name Your Feed', placeholder = 'Enter feed name...' }) => {
    const [name, setName] = useState(initialName);
    const [error, setError] = useState('');

    //Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setError('');
        }
    }, [isOpen, initialName]);

    const handleConfirm = () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Name cannot be empty');
            return;
        }
        if (trimmedName.length > 30) {
            setError('Name must be 30 characters or less');
            return;
        }
        onConfirm(trimmedName);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <input
                    className="name-modal-input"
                    type="text"
                    placeholder={placeholder}
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError(''); 
                    }}
                    onKeyPress={handleKeyPress}
                    autoFocus
                />
                {error && <p className="name-modal-error">{error}</p>}
                <div className="confirm-modal-buttons">
                    <button className="confirm-modal-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="confirm-modal-confirm" onClick={handleConfirm}>
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NameModal;