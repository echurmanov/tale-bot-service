INSERT INTO bot_configs VALUES
  ('17e01c44-1eb9-4536-a5b2-59072f776bf0', null, true, "Стандартный (- миролюбие)", true, false, false),
  ('7ac97d2b-f079-4936-a4ce-9b961dd8ab01', null, true, "Стандартный (+ миролюбие)", true, false, false);

INSERT INTO bot_config_blocks VALUES
  ('e0a15126-bad2-40db-b691-0436f56c8ff1', '17e01c44-1eb9-4536-a5b2-59072f776bf0', 'Воскресить'),
  ('7c4a4e50-09bc-4cd1-9aaf-da74067ad907', '17e01c44-1eb9-4536-a5b2-59072f776bf0', 'Прервать отдых'),
  ('eed0f548-89e9-496e-b9c6-dd86f03231f5', '17e01c44-1eb9-4536-a5b2-59072f776bf0', 'Помочь в бою'),

  ('799d161a-c7d8-4526-965b-7c7dae877a65', '7ac97d2b-f079-4936-a4ce-9b961dd8ab01', 'Воскресить'),
  ('7460999e-2872-41c2-937a-357641c59ec7', '7ac97d2b-f079-4936-a4ce-9b961dd8ab01', 'Прервать отдых'),
  ('246eeef7-3872-4d0d-94fd-645d4d6a7e4c', '7ac97d2b-f079-4936-a4ce-9b961dd8ab01', 'Помочь в пути');

INSERT INTO bot_config_block_rules VALUES
 -- Стандартный (- миролюбие) -> Воскресить
 ("0b7bd21e-96ac-45aa-b2f4-76b42032dc06", "e0a15126-bad2-40db-b691-0436f56c8ff1", "HERO_ACTION", "IS", 4),
 ("1ad53617-04f5-40e5-bdf0-01a1e46e166d", "e0a15126-bad2-40db-b691-0436f56c8ff1", "HERO_TOTAL_ENERGY", "GREATER", 3),
 -- Стандартный (- миролюбие) -> Прервать отдых
 ("a46fad8e-2a3b-4c59-a7a3-350fe08972eb", "7c4a4e50-09bc-4cd1-9aaf-da74067ad907", "HERO_ACTION", "IS", 0),
 ("64eed392-b4ba-49de-ab5c-ae09cab10b25", "7c4a4e50-09bc-4cd1-9aaf-da74067ad907", "HERO_TOTAL_ENERGY", "GREATER", 3),
 ("2fa7b380-ee52-4a27-97f0-c952f4224323", "7c4a4e50-09bc-4cd1-9aaf-da74067ad907", "HERO_ACTION_PERCENT", "GREATER", 0),
 ("6a0035e9-1f77-4f66-9ba3-17d66c18fd9a", "7c4a4e50-09bc-4cd1-9aaf-da74067ad907", "HERO_ACTION_PERCENT", "LOWER", 1),

 -- Стандартный (- миролюбие) -> Помочь в бою
 ("ab02866c-0bf8-4472-b6a1-dcb0291f269e", "eed0f548-89e9-496e-b9c6-dd86f03231f5", "HERO_ACTION", "IS", 3),
 ("79e336ef-8fe4-451c-a72c-52c0b799bfab", "eed0f548-89e9-496e-b9c6-dd86f03231f5", "HERO_ENERGY_CURRENT", "GREATER", 11),
 ("5a45db64-1212-42c4-994f-23b80440a6f8", "eed0f548-89e9-496e-b9c6-dd86f03231f5", "HERO_ACTION_PERCENT", "LOWER", 0.9),

 -- Стандартный (+ миролюбие) -> Воскресить
  ("1e24cf63-8ed2-43ee-8b49-5a19f5e0e4b0", "799d161a-c7d8-4526-965b-7c7dae877a65", "HERO_ACTION", "IS", 4),
  ("9bca742c-7c05-4fe9-9c39-0abfd6dc5911", "799d161a-c7d8-4526-965b-7c7dae877a65", "HERO_TOTAL_ENERGY", "GREATER", 3),
  -- Стандартный (+ миролюбие) -> Прервать отдых
  ("da84750b-7651-49aa-b113-3326fadff5c3", "7460999e-2872-41c2-937a-357641c59ec7", "HERO_ACTION", "IS", 0),
  ("865c901d-b0b2-48e7-a196-4312b11b2172", "7460999e-2872-41c2-937a-357641c59ec7", "HERO_TOTAL_ENERGY", "GREATER", 3),
  ("51dfa8d7-99cf-45cd-bcf5-b6cd978cdfe5", "7460999e-2872-41c2-937a-357641c59ec7", "HERO_ACTION_PERCENT", "GREATER", 0),
  ("36facc76-9138-4215-b746-11d54daaf4dc", "7460999e-2872-41c2-937a-357641c59ec7", "HERO_ACTION_PERCENT", "LOWER", 1),

  -- Стандартный (+ миролюбие) -> Помочь в пути
  ("10d5285c-486c-4c42-ad41-eed3ff1b994a", "246eeef7-3872-4d0d-94fd-645d4d6a7e4c", "HERO_ACTION", "IS", 2),
  ("6f8d03a3-8c1f-4166-b5d7-da6ecfbf8545", "246eeef7-3872-4d0d-94fd-645d4d6a7e4c", "HERO_ENERGY_CURRENT", "GREATER", 11),
  ("4285a1c9-d1f2-4b2e-aff8-75c6a97fc204", "246eeef7-3872-4d0d-94fd-645d4d6a7e4c", "HERO_ACTION_PERCENT", "LOWER", 1),
  ("af88d975-e4ed-49ac-b17e-fb7bf67a5057", "246eeef7-3872-4d0d-94fd-645d4d6a7e4c", "HERO_ACTION_PERCENT", "GREATER", 0);
