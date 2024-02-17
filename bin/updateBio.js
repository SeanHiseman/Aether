import React, { useState, useEffect } from 'react';

//Displays a text area containg the current bio, allowing it to be changed
const UpdateBioButton = ({ currentBio }) => {
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bio, setBio] = useState(currentBio);

    useEffect(() => {
        setBio(currentBio);
    }, [currentBio]);

    const handleUpdateBio = async () => {
        try {
            const response = await fetch('/api/change_bio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bio })
            });
            const result = await response.json();
            if (!response.ok){
                alert('Failed to changing bio:', result);
            }
        }
        catch (error) {
            alert('Error changing bio:', error);
        }
    };
    return (
        <div id="change-bio">
            {isEditingBio ? (
                <div>
                    <textarea id="bio-change-text-area" value={bio} onChange={(e) => setBio(e.target.value)}/>
                    <button class="light-button" onClick={() => {setIsEditingBio(false); handleUpdateBio();}}>Save</button>
                    <button className='light-button' onClick={() => setIsEditingBio(false)}>Close</button>
                </div>
            ) : (
                <button class="light-button" onClick={() => setIsEditingBio(true)}>Edit Bio</button>
            )}
        </div>
    );
};
export default UpdateBioButton;