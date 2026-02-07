import '../../css/modal.css';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';

const LoginModal = ({ isOpen, onClose, message, title = 'Login Required' }) => {
    const navigate = useNavigate();
    const location = useLocation();

    if (!isOpen) return null;

    const handleGoToLogin = () => {
        onClose();
        navigate('/login', { state: { from: location.pathname } });
    };

    return ReactDOM.createPortal(
        <div className="confirm-modal-overlay" onClick={onClose}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-buttons">
                    <button className="confirm-modal-cancel" onClick={onClose}>
                        Close
                    </button>
                    <button className="confirm-modal-confirm" onClick={handleGoToLogin}>
                        Go to login
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LoginModal;
