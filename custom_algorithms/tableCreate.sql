CREATE TABLE `algorithms` (
	`algorithm_code` TEXT NOT NULL,
	`algorithm_description` TEXT NULL,
	`algorithm_id` CHAR(36) NOT NULL,
	`algorithm_name` VARCHAR(120) NOT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`user_id` CHAR(36) NOT NULL,
	PRIMARY KEY (`algorithm_id`),
	UNIQUE KEY `uniq_user_algorithm_name` (`user_id`, `algorithm_name`),
	INDEX `idx_algorithms_user` (`user_id`),
	CONSTRAINT `fk_algorithms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `feed_algorithms` (
	`id` CHAR(36) NOT NULL PRIMARY KEY,
	`algorithm_id` CHAR(36) NOT NULL,
	`feed_id` CHAR(36) NOT NULL,
	`user_id` CHAR(36) NOT NULL,
	INDEX `idx_feedalgorithms_feed` (`feed_id`),
	INDEX `idx_feedalgorithms_user` (`user_id`),
	CONSTRAINT `fk_feedalgorithms_algorithm` FOREIGN KEY (`algorithm_id`) REFERENCES `algorithms` (`algorithm_id`) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT `fk_feedalgorithms_feed` FOREIGN KEY (`feed_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT `fk_feedalgorithms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
	UNIQUE KEY `uniq_user_feed_algorithm` (`user_id`, `feed_id`, `algorithm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;