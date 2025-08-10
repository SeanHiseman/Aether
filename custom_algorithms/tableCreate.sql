DROP TABLE IF EXISTS `algorithm_locations`;
DROP TABLE IF EXISTS `algorithms`;

CREATE TABLE `algorithms` (
	`algorithm_code` TEXT NOT NULL,
	`algorithm_id` CHAR(36) NOT NULL,
	`algorithm_name` VARCHAR(120) NOT NULL,
	`custom_instruction` TEXT NULL,
	`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	`user_id` CHAR(36) NOT NULL,
	PRIMARY KEY (`algorithm_id`),
	UNIQUE KEY `uniq_user_algorithm_name` (`user_id`, `algorithm_name`),
	INDEX `idx_algorithms_user` (`user_id`),
	CONSTRAINT `fk_algorithms_user`
	  FOREIGN KEY (`user_id`)
	  REFERENCES `users` (`user_id`)
	  ON DELETE CASCADE
	  ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `algorithm_locations` (
	`id` CHAR(36) NOT NULL PRIMARY KEY,
	`algorithm_id` CHAR(36) NOT NULL,
	`location_id` CHAR(36) NOT NULL,
	`user_id` CHAR(36) NOT NULL,
	INDEX `idx_algorithmlocations_location` (`location_id`),
	INDEX `idx_algorithmlocations_user` (`user_id`),
	UNIQUE KEY `uniq_user_algorithm` (`user_id`, `location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;