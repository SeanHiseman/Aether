document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('upload-form'); 
    const confirmationMessage = document.getElementById('confirmation-message');
    form.addEventListener('submit', function(event) {
        event.preventDefault();  // Prevent default form submission
        const formData = new FormData(form);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                console.log('File successfully uploaded.');
                form.reset();
                confirmationMessage.textContent = 'Uploaded successfully';
            } else {
                console.log(data.message);
                confirmationMessage.textContent = data.message;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            confirmationMessage.textContent = 'An error occured';
        });
    });
});


