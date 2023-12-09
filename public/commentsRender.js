async function toggleCommentSection(postId) {
    var commentSection = document.getElementById(`comment-section-${postId}`);
    commentSection.style.display = (commentSection.style.display === 'none' || commentSection.style.display === '') ? 'block' : 'none';
  
    if (commentSection.style.display === 'block') {
        fetchAndRenderComments(postId);
    }
}

//Renders each individual comment
function renderComments(comments, parentId, container, depth, postId){
    if (!Array.isArray(comments)) {
        console.error('Comments is not an array:', comments);
        return;
    }
    const filteredComments = comments.filter(c => c.parent_id === parentId);
    filteredComments.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
    //Iterates over comments
    filteredComments.forEach(comment => {
        //Container for each comment
        const commentContainer = document.createElement('div');
        commentContainer.className = 'comment-container';
        //indents by 20px for every reply
        commentContainer.style.marginLeft = `${depth*20}px`;

        //for profile photo and username
        const commentProfileContainer = document.createElement('div');
        commentProfileContainer.className = 'comment-profile-container';

        //Profile photo
        const profilePhoto = document.createElement('img');
        profilePhoto.className = 'profile-photo';
        profilePhoto.src = `/static/${comment.User.Profile.profile_photo}` || '/static/images/site_images/blank-profile.png';
        commentProfileContainer.appendChild(profilePhoto);

        //Username
        const usernameElement = document.createElement('div');
        usernameElement.className = 'username';
        const username = comment.User.username || 'Anonymous';
        usernameElement.textContent = username
        commentProfileContainer.appendChild(usernameElement) 

        //for appending features to
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-element';        

        //contains everything except username (so it can appear above)
        const horizontalContainer = document.createElement('div');
        horizontalContainer.className = 'horizontal-container';
        horizontalContainer.appendChild(commentElement);             
        
        //comment text
        const commentText = document.createElement('span');
        commentText.className = `comment-text`
        commentText.textContent = comment.comment_text;
        commentElement.appendChild(commentText);

        //container for like/dislike total and buttons
        const likeDislikeContainer = document.createElement('div');
        likeDislikeContainer.className = 'like-dislike-container';

        //like button
        const likeButton = document.createElement('button');
        likeButton.className = "like-dislike-arrows"
        likeButton.style.backgroundImage = "url('/static/images/site_images/up.png')";
        likeButton.style.width = '20px';  
        likeButton.style.height = '20px';  
        likeButton.onclick = () => likeComment(comment.comment_id, postId);
        likeDislikeContainer.appendChild(likeButton);

        //Like/dislike total
        const netLikes = comment.likes - comment.dislikes;
        const netLikesElement = document.createElement('span');
        netLikesElement.className = 'net-likes';
        netLikesElement.textContent = `${netLikes}`;
        likeDislikeContainer.appendChild(netLikesElement)

        //Dislike button
        const dislikeButton = document.createElement('button');
        dislikeButton.className = "like-dislike-arrows"
        dislikeButton.style.backgroundImage = "url('/static/images/site_images/down.png')";
        dislikeButton.style.width = '20px'; 
        dislikeButton.style.height = '20px';  
        dislikeButton.onclick = () => dislikeComment(comment.comment_id, postId);
        likeDislikeContainer.appendChild(dislikeButton);              

        //reply buttons
        const replyButton = document.createElement('button');
        replyButton.textContent = 'Reply';
        replyButton.onclick = () => {
            let existingReplyInput = document.getElementById(`reply-input-${comment.comment_id}`);
            let existingSubmitReplyButton = document.getElementById(`submit-reply-button-${comment.comment_id}`);
        
            if (!existingReplyInput) {
                //Div so reply box is below comment
                const replyContainer = document.createElement('div');
                replyContainer.className = 'reply-container';
                
                const replyInput = document.createElement('textarea');
                replyInput.placeholder = 'Type your reply here...';
                replyInput.id = `reply-input-${comment.comment_id}`;
                replyContainer.appendChild(replyInput);
        
                //Create and append 'Submit Reply' button if it doesn't already exist
                const submitReplyButton = document.createElement('button');
                submitReplyButton.textContent = 'Post';
                submitReplyButton.id = `submit-reply-button-${comment.comment_id}`;
                submitReplyButton.onclick = () => {
                    const replyText = replyInput.value;
                    addComment(comment.post_id, comment.comment_id, replyText);
                };
                
                replyContainer.appendChild(submitReplyButton);
                commentContainer.appendChild(replyContainer);

            } else {
                //Remove existing reply input box and 'Submit Reply' button
                existingReplyInput.parentNode.remove();
                if (existingSubmitReplyButton) {
                    existingSubmitReplyButton.remove();
                }
            }
        };
        replyButton.classList.add('reply-button');
        
        //brings elements together
        commentElement.appendChild(likeDislikeContainer);
        commentElement.appendChild(replyButton);
        commentContainer.appendChild(commentProfileContainer);
        commentContainer.appendChild(horizontalContainer)
        container.appendChild(commentContainer);

        // Recursion for nested replies
        renderComments(comments, comment.comment_id, container, depth + 1, postId);
    });
}

//Gathers list of comments for a post
async function fetchAndRenderComments(postId) {
    const response = await fetch(`/get_comments/${postId}`);
    const comments = await response.json();

    const commentList = document.getElementById(`comment-list-${postId}`);
    if (!commentList){
        console.log(`Comments for post ${postId} not found.`);
        return;    
    }
    commentList.innerHTML = '';
    renderComments(comments, null, commentList, 0, postId);
}

async function addComment(postId, parentId, commentText) {
    try{
        const response = await fetch('/add_comment',{
            method: 'POST',
            headers:{
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                post_id: postId,
                parent_id: parentId,
                comment_text: commentText,    
            }),
        });
        const data = await response.json();

        if (data.success){
            fetchAndRenderComments(postId);
        }
        else{
            console.error(`Error adding comment: ${data.message}`);
        }
    }
    catch (error){
        console.error(`Error adding comment: ${error}`);
    }
}

async function like_dislike_comment(reaction_type, commentId, postId){
    try{
        const response = await fetch('/like_dislike',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({comment_id: commentId, reaction_type:reaction_type})
        });
        const data = await response.json();
        if (data.success){
            fetchAndRenderComments(postId);
        }
        else{
            console.error('Error updating reaction', data.message);
        }
    }
    catch (error){
        console.error('Error updating reaction', error);
    }
}

function likeComment(commentId, postId){
    like_dislike_comment('like', commentId, postId);
} 
function dislikeComment(commentId, postId){
    like_dislike_comment('dislike', commentId, postId);
}