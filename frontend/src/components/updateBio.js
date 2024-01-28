import React, { useState } from 'react';
import '../css/profile.css';

const UpdateBioButton = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [bio, setBio] = useState('');

    const handleUpdateBio = async () => {
        try {
            const response = await fetch('/update_bio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bio })
            });
            const result = await response.json();
            if (!response.ok){
                console.error('Failed to update bio:', result);
            }
        }
        catch (error) {
            console.error('Error updating bio:', error);
        }
    };
    return (
        <div>
            {isEditing ? (
                <div>
                    <textarea id="bio-change-text-area" value={bio} onChange={(e) => setBio(e.target.value)}/>
                    <button class="button" onClick={() => {setIsEditing(false); handleUpdateBio();}}>Save</button>
                    <button className='button' onClick={() => setIsEditing(false)}>Close</button>
                </div>
            ) : (
                <button class="button" onClick={() => setIsEditing(true)}>Edit Bio</button>
            )}
        </div>
    );
};
export default UpdateBioButton;