CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`friendId` int NOT NULL,
	`status` enum('pending','accepted','blocked') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`winnerId` int NOT NULL,
	`totalRounds` int NOT NULL,
	`durationSeconds` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gameHistoryId` int NOT NULL,
	`userId` int NOT NULL,
	`finalPosition` int NOT NULL,
	`totalLossPoints` int NOT NULL,
	`cardsPlayed` int NOT NULL,
	CONSTRAINT `game_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`hostUserId` int NOT NULL,
	`status` enum('waiting','playing','finished') NOT NULL DEFAULT 'waiting',
	`isPrivate` int NOT NULL DEFAULT 0,
	`maxPlayers` int NOT NULL DEFAULT 4,
	`currentPlayers` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`finishedAt` timestamp,
	CONSTRAINT `game_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_rooms_roomCode_unique` UNIQUE(`roomCode`)
);
--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(50) NOT NULL,
	`avatarUrl` text,
	`isPremium` int NOT NULL DEFAULT 0,
	`premiumExpiresAt` timestamp,
	`totalGamesPlayed` int NOT NULL DEFAULT 0,
	`totalGamesWon` int NOT NULL DEFAULT 0,
	`currentWinStreak` int NOT NULL DEFAULT 0,
	`longestWinStreak` int NOT NULL DEFAULT 0,
	`totalLossPoints` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `player_profiles_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `purchased_cosmetics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cosmeticType` enum('card_back','table_theme') NOT NULL,
	`cosmeticId` varchar(50) NOT NULL,
	`purchasedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchased_cosmetics_id` PRIMARY KEY(`id`)
);
