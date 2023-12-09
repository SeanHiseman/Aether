document.addEventListener("DOMContentLoaded", function() {
    let offset = 0;
    const limit = 10;

    function loadMoreContent() {
        fetch(`/load_more?offset=${offset}&limit=${limit}`)
            .then(response => response.json())
            .then(data => {
                offset += data.length;

                const contentContainer = document.getElementById('content-container');
                data.forEach(item => {
                    const contentItem = document.createElement('div');
                    contentItem.className = 'content-item';
                    contentItem.innerHTML = `
                        <h2>${item.title}</h2>
                        <!-- ... other fields ... -->
                    `;
                    contentContainer.appendChild(contentItem);
                });
            });
    }

    loadMoreContent();

    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            //Load more if user 500px from bottom of content feed
            loadMoreContent();
        }
    });
});