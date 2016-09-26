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
  PRIMARY KEY (`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

