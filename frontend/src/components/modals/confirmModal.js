import '../../css/modal.css';
import ReactDOM from 'react-dom';

const ConfirmModal = ({ isOpen, onConfirm, onCancel, message, title = 'Confirm' }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-buttons">
                    <button className="confirm-modal-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="confirm-modal-confirm red" onClick={onConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;