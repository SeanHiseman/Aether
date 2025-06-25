
DROP TABLE IF EXISTS `ask_chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ask_chats` (
  `chat_id` char(36) NOT NULL,
  `name` varchar(256) DEFAULT 'New chat',
  `user_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`chat_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ask_chats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ask_messages`
--

DROP TABLE IF EXISTS `ask_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ask_messages` (
  `message_id` char(36) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `content` varchar(1000) NOT NULL,
  `timestamp` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `chat_id` (`chat_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `ask_messages_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `ask_chats` (`chat_id`),
  CONSTRAINT `ask_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chats` (
  `chat_id` char(36) NOT NULL,
  `title` varchar(256) DEFAULT 'New chat',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `connect_requests`
--

DROP TABLE IF EXISTS `connect_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `connect_requests` (
  `request_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `receiver_id` char(36) NOT NULL,
  `timestamp` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`request_id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `connect_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `feeds` (`feed_id`),
  CONSTRAINT `connect_requests_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `feeds` (`feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `connections`
--

DROP TABLE IF EXISTS `connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `connections` (
  `connection_id` char(36) NOT NULL,
  `feed1_id` char(36) NOT NULL,
  `feed2_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`connection_id`),
  KEY `feed1_id` (`feed1_id`),
  KEY `feed2_id` (`feed2_id`),
  CONSTRAINT `connections_ibfk_1` FOREIGN KEY (`feed1_id`) REFERENCES `feeds` (`feed_id`),
  CONSTRAINT `connections_ibfk_2` FOREIGN KEY (`feed2_id`) REFERENCES `feeds` (`feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deep_feed_content`
--

DROP TABLE IF EXISTS `deep_feed_content`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deep_feed_content` (
  `content_id` varchar(36) NOT NULL,
  `deep_feed_id` varchar(36) NOT NULL,
  `feed_id` varchar(36) DEFAULT NULL,
  `nested_deep_feed_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`content_id`),
  KEY `deep_feed_id` (`deep_feed_id`),
  CONSTRAINT `deep_feed_content_ibfk_1` FOREIGN KEY (`deep_feed_id`) REFERENCES `deep_feeds` (`deep_feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deep_feeds`
--

DROP TABLE IF EXISTS `deep_feeds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deep_feeds` (
  `deep_feed_id` varchar(36) NOT NULL,
  `name` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`deep_feed_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `deep_feeds_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `deep_feeds` (`deep_feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feed_channel_messages`
--

DROP TABLE IF EXISTS `feed_channel_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feed_channel_messages` (
  `message_id` char(36) NOT NULL,
  `content` varchar(1000) NOT NULL,
  `channel_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feed_channels`
--

DROP TABLE IF EXISTS `feed_channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feed_channels` (
  `channel_id` char(36) NOT NULL,
  `channel_name` varchar(100) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `feed_id` char(36) NOT NULL,
  `is_posts` tinyint(1) DEFAULT '1',
  `is_chat` tinyint(1) DEFAULT '1',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `display_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feed_chats`
--

DROP TABLE IF EXISTS `feed_chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feed_chats` (
  `feed_id` char(36) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`feed_id`,`chat_id`),
  KEY `chat_id` (`chat_id`),
  CONSTRAINT `feed_chats_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`),
  CONSTRAINT `feed_chats_ibfk_2` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feeds`
--

DROP TABLE IF EXISTS `feeds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feeds` (
  `feed_id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `feed_name` varchar(100) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `feed_photo` text,
  `follower_count` int DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `type` varchar(10) DEFAULT 'public',
  `is_group` tinyint(1) DEFAULT '0',
  `feed_owner` char(36) NOT NULL,
  `is_locked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`feed_id`),
  KEY `feed_owner` (`feed_owner`),
  CONSTRAINT `feeds_ibfk_1` FOREIGN KEY (`feed_owner`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `follow_requests`
--

DROP TABLE IF EXISTS `follow_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follow_requests` (
  `request_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `receiver_id` char(36) NOT NULL,
  `timestamp` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `followers`
--

DROP TABLE IF EXISTS `followers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `followers` (
  `follow_id` char(36) NOT NULL,
  `follower_id` char(36) NOT NULL,
  `feed_id` char(36) NOT NULL,
  `is_mod` tinyint(1) DEFAULT '0',
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`follow_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `message_id` char(36) NOT NULL,
  `content` varchar(1000) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `receiver_id` char(36) NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`),
  KEY `chat_id` (`chat_id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`chat_id`),
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `feeds` (`feed_id`),
  CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `feeds` (`feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `post_drafts`
--

DROP TABLE IF EXISTS `post_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_drafts` (
  `draft_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feed_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `poster_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`draft_id`),
  KEY `idx_drafts_channel` (`channel_id`),
  KEY `idx_drafts_poster` (`poster_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `post_notes`
--

DROP TABLE IF EXISTS `post_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_notes` (
  `note_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `note_content` varchar(1000) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `is_misinfo` tinyint(1) DEFAULT '0',
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`note_id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `post_notes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `post_votes`
--

DROP TABLE IF EXISTS `post_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `post_votes` (
  `vote_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `voter_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  PRIMARY KEY (`vote_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `post_id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `feed_id` char(36) NOT NULL,
  `channel_id` char(36) NOT NULL,
  `title` varchar(120) DEFAULT NULL,
  `content` text NOT NULL,
  `replies` int DEFAULT '0',
  `views` int DEFAULT '0',
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `poster_id` char(36) NOT NULL,
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `app_builds`
--

DROP TABLE IF EXISTS `app_builds`;
CREATE TABLE `app_builds` (
  `build_id`   VARCHAR(36)    NOT NULL,
  `post_id`    VARCHAR(36)    NULL,
  `kind`       ENUM('static','webcontainer') NOT NULL DEFAULT 'static',
  `path`       VARCHAR(255)   NOT NULL,
  `created_at` DATETIME(3)    NOT NULL
     DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`build_id`),
  INDEX `idx_appbuilds_post` (`post_id`),
  CONSTRAINT `fk_appbuilds_posts`
    FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`post_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

--
-- Table structure for table `prompts`
--

DROP TABLE IF EXISTS `prompts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prompts` (
  `prompt_id` varchar(36) NOT NULL,
  `prompt_content` text NOT NULL,
  `response_content` text NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`prompt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` char(36) NOT NULL,
  `username` varchar(120) NOT NULL,
  `password` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `has_membership` tinyint(1) DEFAULT '0',
  `theme` text,
  `usage_count` int NOT NULL DEFAULT '0',
  `storage_count` float NOT NULL DEFAULT '0',
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `subscription_expires_at` datetime(3) DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT '0',
  `verification_token` text DEFAULT NULL,
  `verification_token_expires` datetime(3) DEFAULT NULL,
  `reset_token` text DEFAULT NULL,
  `reset_token_expires` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `users` (
    `user_id`,
    `username`,
    `password`,
    `email`,
    `created_at`,
    `updated_at`
) VALUES (
    'cf84729e-e00a-4ee5-a8d5-d8247e186b49',
    'Aether',
    'placeholder',
    'thing@mail.com',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);

INSERT INTO `feeds` (
    `feed_id`, 
    `feed_name`, 
    `feed_owner`, 
    `created_at`, 
    `updated_at`
) VALUES 
(
    'ce95ea4e-5b3e-4661-aaa6-e0830d2d68d2',
    'Welcome',
    'cf84729e-e00a-4ee5-a8d5-d8247e186b49',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
),
(
    '50c3bf90-53a0-470e-a4ac-3cb3c7b4f791',
    'Aether',
    'cf84729e-e00a-4ee5-a8d5-d8247e186b49', 
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);

INSERT INTO `followers` (
    `follow_id`,
    `follower_id`,
    `feed_id`,
    `is_mod`,
    `is_admin`,
    `created_at`,
    `updated_at`
) VALUES
(
    UUID(), 
    '50c3bf90-53a0-470e-a4ac-3cb3c7b4f791', 
    'ce95ea4e-5b3e-4661-aaa6-e0830d2d68d2',
    1, 
    1, 
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
)