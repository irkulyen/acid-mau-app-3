CREATE TABLE `game_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(50) NOT NULL,
	`message` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_chat_messages_id` PRIMARY KEY(`id`)
);
