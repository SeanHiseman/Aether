Most users are referred to by their feed_id, not their user_id. E.g. when a user follows a feed, the user's feed_id is recorded in the followers table. 
This is because users view and interact with each other through their feeds, not their user accounts. user_id is only used when relating to feed ownership.

The style a variable is written in distinguishes its origin. Variables defined in the code are written with camelCase e.g. userId, whereas variables originating from the database use underscores e.g. user_id. 

Run the commands in dbStructure.sql to create a local version of the MySQL database

Currently paused features:
Ask chatbot
Ask notes
Deep feeds
Multi voting
Clicking to edit dynamic content
Connections
Messaging
Branched replies
Replies accessing parent post code