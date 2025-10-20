import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useState } from "react";

const MessageDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };
    
    return (
        <nav className="channel-list align-right">
            {isOpen ? (
                <FaChevronUp onClick={toggleDropdown} />
            ) : (
                <FaChevronDown onClick={toggleDropdown} />
            )}
        </nav>
    )
}

export default MessageDropdown;