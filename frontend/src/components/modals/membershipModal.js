import '../../css/modal.css';
import ReactDOM from 'react-dom';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../authContext';

const MembershipModal = ({ isOpen, onClose, message, title = 'Membership' }) => {
    const { viewer } = useContext(AuthContext);
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleGetMembership = () => {
        onClose();
        navigate(`settings/${viewer?.feed_name}/membership`);
    };

    return ReactDOM.createPortal(
        <div className="confirm-modal-overlay" onClick={onClose}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-buttons">
                    <button className="confirm-modal-cancel" onClick={onClose}>
                        Not now
                    </button>
                    <button className="confirm-modal-confirm" onClick={handleGetMembership}>
                        Get membership
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MembershipModal;