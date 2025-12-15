DROP TABLE IF EXISTS `ask_chats`;
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

DROP TABLE IF EXISTS `ask_messages`;
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

DROP TABLE IF EXISTS `chats`;
CREATE TABLE `chats` (
  `chat_id` char(36) NOT NULL,
  `title` varchar(256) DEFAULT 'New chat',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `connect_requests`;
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

DROP TABLE IF EXISTS `connections`;
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

DROP TABLE IF EXISTS `deep_feed_content`;
CREATE TABLE `deep_feed_content` (
  `content_id` varchar(36) NOT NULL,
  `deep_feed_id` varchar(36) NOT NULL,
  `feed_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`content_id`),
  KEY `deep_feed_id` (`deep_feed_id`),
  CONSTRAINT `deep_feed_content_ibfk_1` FOREIGN KEY (`deep_feed_id`) REFERENCES `deep_feeds` (`deep_feed_id`) ON DELETE CASCADE,
  CONSTRAINT `deep_feed_content_ibfk_2` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `deep_feeds`;
CREATE TABLE `deep_feeds` (
  `deep_feed_id` varchar(36) NOT NULL,
  `name` varchar(36) NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`deep_feed_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `deep_feeds_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `deep_feeds` (`deep_feed_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `feed_channel_messages`;
CREATE TABLE `feed_channel_messages` (
  `message_id` char(36) NOT NULL,
  `content` varchar(1000) NOT NULL,
  `channel_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `feed_channels`;
CREATE TABLE `feed_channels` (
  `channel_id` char(36) NOT NULL,
  `channel_name` varchar(100) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `feed_id` char(36) NOT NULL,
  `is_posts` tinyint(1) DEFAULT '1',
  `is_chat` tinyint(1) DEFAULT '1',
  `post_count` int DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `display_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`channel_id`),
  CONSTRAINT `feed_channels_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `feed_chats`;
CREATE TABLE `feed_chats` (
  `feed_id` char(36) NOT NULL,
  `chat_id` char(36) NOT NULL,
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`feed_id`,`chat_id`),
  KEY `chat_id` (`chat_id`),
  CONSTRAINT `feed_chats_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`),
  CONSTRAINT `feed_chats_ibfk_2` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `feeds`;
CREATE TABLE `feeds` (
  `feed_id` char(36) NOT NULL,
  `feed_name` varchar(100) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `feed_photo` text,
  `follower_count` int DEFAULT '0',
  `follow_requests` int DEFAULT '0',
  `connections` int DEFAULT '0',
  `connect_requests` int DEFAULT '0',
  `post_count` int DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `type` varchar(10) DEFAULT 'public',
  `is_group` tinyint(1) DEFAULT '0',
  `feed_owner` char(36) NOT NULL,
  `is_locked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`feed_id`),
  KEY `feed_owner` (`feed_owner`),
  FULLTEXT KEY `idx_fulltext_feeds` (`feed_name`, `description`),
  CONSTRAINT `feeds_ibfk_1` FOREIGN KEY (`feed_owner`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `follow_requests`;
CREATE TABLE `follow_requests` (
  `request_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `receiver_id` char(36) NOT NULL,
  `timestamp` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`request_id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `follow_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE,
  CONSTRAINT `follow_requests_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `followers`;
CREATE TABLE `followers` (
  `follow_id` char(36) NOT NULL,
  `follower_id` char(36) NOT NULL,
  `feed_id` char(36) NOT NULL,
  `is_mod` tinyint(1) DEFAULT '0',
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`follow_id`),
  CONSTRAINT `followers_ibfk_1` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE,
  CONSTRAINT `followers_ibfk_2` FOREIGN KEY (`follower_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `messages`;
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

DROP TABLE IF EXISTS `post_drafts`;
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

DROP TABLE IF EXISTS `post_notes`;
CREATE TABLE `post_notes` (
  `note_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `note_content` varchar(1000) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `is_misinfo` tinyint(1) DEFAULT '0',
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`note_id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `post_notes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `post_votes`;
CREATE TABLE `post_votes` (
  `vote_id` char(36) NOT NULL,
  `post_id` char(36) NOT NULL,
  `voter_id` char(36) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `upvotes` int DEFAULT '0',
  `downvotes` int DEFAULT '0',
  PRIMARY KEY (`vote_id`),
  CONSTRAINT `post_votes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `post_id` CHAR(36) NOT NULL,
  `parent_id` CHAR(36) DEFAULT NULL,
  `feed_id` CHAR(36) NOT NULL,
  `channel_id` CHAR(36) NOT NULL,
  `title` VARCHAR(120) DEFAULT NULL,
  `content` LONGTEXT NOT NULL,
  `replies` INT DEFAULT '0',
  `views` INT DEFAULT '0',
  `rank_hotness` DOUBLE DEFAULT NULL,
  `rank_updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `upvotes` INT DEFAULT '0',
  `downvotes` INT DEFAULT '0',
  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  `poster_id` CHAR(36) NOT NULL,
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `text_body` LONGTEXT NOT NULL,
  `text_length` INT DEFAULT 0,
  `word_count` INT DEFAULT 0,
  `sentence_count` INT DEFAULT 0,
  `has_images` BOOLEAN DEFAULT FALSE,
  `has_videos` BOOLEAN DEFAULT FALSE,
  `has_interactive` BOOLEAN DEFAULT FALSE,
  `has_external_posts` BOOLEAN DEFAULT FALSE,
  `has_embedded_websites` BOOLEAN DEFAULT FALSE,
  `has_text` BOOLEAN DEFAULT FALSE,
  `image_count` INT DEFAULT 0,
  `video_count` INT DEFAULT 0,
  `video_length` FLOAT DEFAULT 0.0,
  `sentiment_score` FLOAT DEFAULT 0.0,
  `language` VARCHAR(20) DEFAULT 'en',
  `tokens` JSON NOT NULL,
  `embeddings` JSON DEFAULT NULL,
  `is_private` BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (`post_id`),
  KEY `idx_posts_parent_id` (`parent_id`),
  KEY `idx_posts_poster_id` (`poster_id`),
  KEY `idx_feed_id` (`feed_id`),
  KEY `idx_channel_id` (`channel_id`),
  KEY `idx_feed_rank` (`feed_id`,`rank_hotness` DESC,`post_id`),
  KEY `idx_feed_created` (`feed_id`,`created_at` DESC,`post_id`),
  KEY `idx_rank_hotness_desc` (`rank_hotness` DESC,`post_id`),
  KEY `idx_created_desc` (`created_at` DESC,`post_id`),
  KEY `idx_feed_videos` (`feed_id`,`has_videos`),
  KEY `idx_sentiment` (`sentiment_score`),
  FULLTEXT KEY `idx_fulltext_posts` (`title`,`text_body`),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

DROP TABLE IF EXISTS `prompts`;
CREATE TABLE `prompts` (
  `prompt_id` varchar(36) NOT NULL,
  `prompt_content` text NOT NULL,
  `response_content` text NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`prompt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` char(36) NOT NULL,
  `username` varchar(120) NOT NULL,
  `password` varchar(120) NOT NULL,
  `email` varchar(120) NOT NULL,
  `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
  `last_active_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
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

DROP TABLE IF EXISTS `saved_posts`;
CREATE TABLE saved_posts (
	post_id			CHAR(36)	NOT NULL,
	saver_id		CHAR(36)	NOT NULL,
	feed_id			CHAR(36)	NOT NULL,
	channel_id		CHAR(36)	NOT NULL,
  saved_channel_id CHAR(36)	NOT NULL,
	created_at		DATETIME(3)	NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at		DATETIME(3)	NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	PRIMARY KEY (post_id, saver_id),
	FOREIGN KEY (post_id)	REFERENCES posts(post_id)			ON DELETE CASCADE,
	FOREIGN KEY (saver_id)	REFERENCES feeds(feed_id)			ON DELETE CASCADE,
	FOREIGN KEY (feed_id)	REFERENCES feeds(feed_id)			ON DELETE CASCADE,
	FOREIGN KEY (channel_id)REFERENCES feed_channels(channel_id)	ON DELETE CASCADE
) ENGINE = InnoDB;

DROP TABLE IF EXISTS `saved_post_channels`;
CREATE TABLE saved_post_channels (
	channel_id		CHAR(36)	NOT NULL PRIMARY KEY,
	saver_id		CHAR(36)	NOT NULL,
	channel_name	VARCHAR(50) NOT NULL,
	display_order	INT			NOT NULL DEFAULT 0,
	created_at		DATETIME(3)	NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at		DATETIME(3)	NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	UNIQUE KEY saver_channel (saver_id, channel_name),
	FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE
) ENGINE = InnoDB;

DROP TABLE IF EXISTS `viewed_posts`;
CREATE TABLE viewed_posts (
	post_id CHAR(36) NOT NULL,
	viewer_id CHAR(36) NOT NULL,
	views INT NOT NULL DEFAULT 1,
	created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
	updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
	PRIMARY KEY (post_id, viewer_id),
	FOREIGN KEY (post_id) REFERENCES posts(post_id),
	FOREIGN KEY (viewer_id) REFERENCES feeds(feed_id),
  CONSTRAINT `viewed_posts_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE
);

CREATE TABLE `external_posts` (
  `post_id` VARCHAR(255) NOT NULL,
  `source` VARCHAR(32) NOT NULL,
  `source_post_id` VARCHAR(128) NOT NULL,
  `title` TEXT DEFAULT NULL,
  `content` TEXT DEFAULT NULL,
  `text_body` TEXT DEFAULT NULL,
  `text_length` INT DEFAULT NULL,
  `word_count` INT DEFAULT NULL,
  `image_count` INT DEFAULT NULL,
  `video_count` INT DEFAULT NULL,
  `has_text` BOOLEAN DEFAULT FALSE,
  `has_images` BOOLEAN DEFAULT FALSE,
  `has_videos` BOOLEAN DEFAULT FALSE,
  `has_embedded_websites` BOOLEAN DEFAULT FALSE,
  `score` INT DEFAULT NULL,
  `replies` INT DEFAULT NULL,
  `sentiment_score` FLOAT DEFAULT NULL,
  `embeddings` JSON DEFAULT NULL,
  `fetched_at` DATETIME NOT NULL,
  `created_at_remote` DATETIME NOT NULL,
  `expired` BOOLEAN DEFAULT FALSE,
  `channel` VARCHAR(128) DEFAULT NULL,
  `author` VARCHAR(190) DEFAULT NULL,
  `author_photo` TEXT DEFAULT NULL,
  `url` TEXT NOT NULL,
  `media` JSON DEFAULT NULL,
  PRIMARY KEY (`post_id`),
  KEY `idx_created_at_remote` (`created_at_remote`),
  KEY `idx_score` (`score`),
  KEY `idx_source` (`source`),
  KEY `idx_expired` (`expired`),
  KEY `idx_fetched_at` (`fetched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `external_posts_access` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `post_id` VARCHAR(36) NOT NULL,
  `source` VARCHAR(20) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_post` (`user_id`, `post_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_post_id` (`post_id`),
  KEY `idx_source` (`source`),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `connected_accounts` (
	`id` CHAR(36) NOT NULL,
	`user_id` VARCHAR(64) NOT NULL,
	`platform` VARCHAR(32) NOT NULL,
	`handle` VARCHAR(190) NULL,
	`access_token` TEXT NULL,
	`refresh_token` TEXT DEFAULT NULL,
	`token_type` VARCHAR(32) DEFAULT NULL,
	`scope` TEXT DEFAULT NULL,
	`expires_at` DATETIME DEFAULT NULL,
	`instance_url` VARCHAR(255) DEFAULT NULL,
	`extra` JSON DEFAULT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	PRIMARY KEY (`id`),
	KEY `idx_user_id` (`user_id`),
	UNIQUE KEY `uniq_user_platform_handle` (`user_id`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pagination_tokens` (
  `id` CHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `platform` VARCHAR(20) NOT NULL,
  `cursor` TEXT DEFAULT NULL,
  `after` VARCHAR(255) DEFAULT NULL,
  `max_id` VARCHAR(255) DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_platform` (`user_id`, `platform`)
);