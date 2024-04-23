//single function for liking and disliking comments
function contentReaction(contentId, action) {
    fetch(`/${action}/${contentId}`,{
        method: 'POST'
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            let countSpan = document.getElementById(`${action}-count-${contentId}`);
            let newCount = parseInt(countSpan.textContent, 10) + 1;
            countSpan.textContent = newCount;
        }
    });
}
