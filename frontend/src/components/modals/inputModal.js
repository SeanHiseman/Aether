import '../../css/modal.css';
import { useState, useEffect } from 'react';

const InputModal = ({ isOpen, maxLength = 999999, onConfirm, onCancel, inputText = '', title = '', placeholder = '' }) => {
    const [text, setText] = useState(inputText);
    const [error, setError] = useState('');

    //Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setText(inputText);
            setError('');
        }
    }, [isOpen, inputText]);

    const handleConfirm = () => {
        const trimmedText = text.trim();
        if (!trimmedText) {
            setError('Cannot be empty');
            return;
        }
        if (trimmedText.length > maxLength) {
            setError('Must be 30 characters or less');
            return;
        }
        onConfirm(trimmedText);
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
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
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

export default InputModal;