CREATE TABLE `users` (
  `user_id` char(36) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `pass` varchar(64) DEFAULT NULL,
  `status` enum('ACTIVE','DEACTIVE') DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


CREATE TABLE `auth_requests` (
  `token_id` varchar(255) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `updateDate` datetime DEFAULT NULL,
  `sessionid` varchar(100) DEFAULT NULL,
  `csrftoken` varchar(255) DEFAULT NULL,
  `state` enum('AUTH_NONE','AUTH_WAIT','AUTH_SUCCESS','AUTH_REJECTED') DEFAULT NULL,
  `controlStatus` tinyint(1) DEFAULT NULL,
  `account_id` int,
  `account_name` varchar(255),
  `bot_config_id` char(36),
  PRIMARY KEY (`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `bot_configs` (
  `bot_config_id` char(36),
  `user_id` char(36) DEFAULT NULL,
  `share` bool default false,
  `bot_config_name` varchar(255),
  `auto_take_cards` bool default true,
  `auto_combine_auction` bool default false,
  `auto_combine_not_auction` bool default false,
  PRIMARY KEY (`bot_config_id`),
  UNIQUE KEY key_user_config_name(`user_id`, `bot_config_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `bot_config_blocks` (
  `config_block_id` char(36),
  `bot_config_id` char(36),
  `config_block_name` varchar(255),
  PRIMARY KEY (`config_block_id`),
  UNIQUE KEY key_config_block_name(`bot_config_id`, `config_block_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `bot_config_block_rules` (
  `rule_id` char(36),
  `config_block_id` char(36),
  `param` varchar(255),
  `rel` varchar(255),
  `value` varchar(255),
  PRIMARY KEY (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `bot_config_cards_limits` (
  `bot_config_id` char(36),
  `card_name` varchar(255),
  `minimal_stack` int default 1,
  PRIMARY KEY (`bot_config_id`, `card_name`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

