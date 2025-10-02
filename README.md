Most users are referred to by their feed_id, not their user_id. E.g. when a user follows a feed, the user's feed_id is recorded in the followers table. 
This is because users view and interact with each other through their feeds, not their user accounts. user_id is only used when relating to feed ownership.

The style a variable is written in distinguishes its origin. Variables defined in the code are written with camelCase e.g. userId, whereas variables originating from the database use underscores e.g. user_id. 
File names use camelCase, beginning with lowercase, e.g. fileName.js. Folders are all lowercase, using underscores e.g. folder_name

Combined feeds are referred to by their old name of 'deep feeds'

Run the commands in dbStructure.sql to create a local version of the MySQL database

Currently paused features:
App build uploads
Ask chatbot
Ask notes
Multi voting
Clicking to edit dynamic content
Connections
Messaging
Branched replies
Replies accessing parent post code
Expand content heigh chevron
Saved post channels

Code related to the Customisable Social Media Algorithms Master's project is contained within the custom_algorithms folder of the main directory, frontend/src/algorithms, or marked with //Project code