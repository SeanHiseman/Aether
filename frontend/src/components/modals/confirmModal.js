import '../../css/modal.css';

const ConfirmModal = ({ isOpen, onConfirm, onCancel, message, title = 'Confirm' }) => {
    if (!isOpen) return null;

     return (
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>
                    <div className="confirm-modal-buttons">
                        <button className="confirm-modal-cancel" onClick={onCancel}>
                            Cancel
                        </button>
                        <button className="confirm-modal-confirm" onClick={onConfirm}>
                            Confirm
                        </button>
                    </div>
            </div>
        </div>
    );
};

export default ConfirmModal;