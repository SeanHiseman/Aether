DROP TABLE IF EXISTS `algorithm_locations`;
DROP TABLE IF EXISTS `algorithms`;

CREATE TABLE `algorithms` (
   `algorithm_code` text NOT NULL,
   `algorithm_id` varchar(36) NOT NULL,
   `algorithm_name` varchar(120) NOT NULL,
   `custom_instruction` text,
   `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
   `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
   `viewer_id` varchar(36) NOT NULL,
   `boost_embedding` json DEFAULT NULL,
   `suppress_embedding` json DEFAULT NULL,
   `political_opinion_encrypted` text,
   `political_opinion_embedding` json DEFAULT NULL,
   PRIMARY KEY (`algorithm_id`),
   UNIQUE KEY `uniq_viewer_algorithm_name` (`viewer_id`,`algorithm_name`),
   KEY `idx_algorithms_viewer` (`viewer_id`),
   CONSTRAINT `fk_algorithms_user` FOREIGN KEY (`viewer_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE ON UPDATE CASCADE
 );

CREATE TABLE `algorithm_locations` (
	`id` VARCHAR(36) NOT NULL PRIMARY KEY,
	`algorithm_id` VARCHAR(36) NOT NULL,
	`location_id` VARCHAR(255) NOT NULL,
	`viewer_id` VARCHAR(36) NOT NULL,
	INDEX `idx_algorithmlocations_location` (`location_id`),
	INDEX `idx_algorithmlocations_viewer` (`viewer_id`),
	UNIQUE KEY `uniq_viewer_algorithm` (`viewer_id`, `location_id`)
);