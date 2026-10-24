-- Struktura ERP - Site Supervisor schema additions + demo data (idempotent)

-- ---------------------------------------------------------------------------
-- 1. projects.site_supervisor_id (which supervisor owns which site)
-- ---------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'site_supervisor_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE projects ADD COLUMN site_supervisor_id BIGINT UNSIGNED NULL AFTER user_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'projects' AND constraint_name = 'fk_projects_site_supervisor');
SET @sql := IF(@fk = 0, 'ALTER TABLE projects ADD CONSTRAINT fk_projects_site_supervisor FOREIGN KEY (site_supervisor_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'projects' AND index_name = 'idx_projects_site_supervisor_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE projects ADD KEY idx_projects_site_supervisor_id (site_supervisor_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2. projects.latitude / longitude (My Site -> Map)
-- ---------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'latitude');
SET @sql := IF(@exists = 0, 'ALTER TABLE projects ADD COLUMN latitude DECIMAL(10,7) NULL AFTER location', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'longitude');
SET @sql := IF(@exists = 0, 'ALTER TABLE projects ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 3. site_task (Schedule -> Today / This Week / All Tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_task` (
  `task_id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id`         BIGINT UNSIGNED NOT NULL COMMENT 'FK -> projects.project_id',
  `phase_id`           BIGINT UNSIGNED NULL COMMENT 'FK -> project_phases.phase_id',
  `title`              VARCHAR(255) NOT NULL COMMENT 'Short task description',
  `task_date`          DATE NOT NULL COMMENT 'Day the task is scheduled',
  `start_time`         TIME NULL COMMENT 'Planned start time',
  `assigned_laborer_id` BIGINT UNSIGNED NULL COMMENT 'FK -> laborer.laborer_id',
  `status`             ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `created_by`         BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`         TIMESTAMP NULL DEFAULT NULL,
  `updated_by`         BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`         TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`task_id`),
  KEY `idx_site_task_project_date` (`project_id`, `task_date`),
  KEY `idx_site_task_phase_id` (`phase_id`),
  KEY `idx_site_task_assigned_laborer_id` (`assigned_laborer_id`),
  CONSTRAINT `fk_site_task_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_site_task_phase` FOREIGN KEY (`phase_id`) REFERENCES `project_phases` (`phase_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_laborer` FOREIGN KEY (`assigned_laborer_id`) REFERENCES `laborer` (`laborer_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. Assign a supervisor + map coordinates to every project
--    SUP030001 (user 8) owns Bridge Phase 2 (project 1) - the demo site.
-- ---------------------------------------------------------------------------
UPDATE projects SET
  site_supervisor_id = CASE project_id WHEN 1 THEN 8 WHEN 2 THEN 9 WHEN 3 THEN 10 WHEN 4 THEN 11 WHEN 5 THEN 9 ELSE site_supervisor_id END,
  latitude = CASE project_id WHEN 1 THEN 14.6760000 WHEN 2 THEN 14.5547000 WHEN 3 THEN 14.5995000 WHEN 4 THEN 14.5764000 WHEN 5 THEN 14.6538000 ELSE latitude END,
  longitude = CASE project_id WHEN 1 THEN 121.0437000 WHEN 2 THEN 121.0244000 WHEN 3 THEN 120.9842000 WHEN 4 THEN 121.0851000 WHEN 5 THEN 121.0685000 ELSE longitude END
WHERE project_id BETWEEN 1 AND 5;

-- ---------------------------------------------------------------------------
-- 5. Site tasks (dates are relative to CURDATE so Today/Week stay useful)
-- ---------------------------------------------------------------------------
INSERT INTO site_task (task_id, project_id, phase_id, title, task_date, start_time, assigned_laborer_id, status, created_by, created_at, updated_by, updated_at) VALUES
(1001,1,1,'Site clearing review',DATE_ADD(CURDATE(),INTERVAL -6 DAY),'09:00:00',9,'Done',8,NOW(),8,NOW()),
(1002,1,2,'Excavation - Pier 1',DATE_ADD(CURDATE(),INTERVAL -12 DAY),'07:00:00',7,'Done',8,NOW(),8,NOW()),
(1003,1,2,'Excavation - Pier 2',DATE_ADD(CURDATE(),INTERVAL -11 DAY),'07:00:00',7,'Done',8,NOW(),8,NOW()),
(1004,1,2,'Gravel bedding - Pier 1',DATE_ADD(CURDATE(),INTERVAL -10 DAY),'08:00:00',1,'Done',8,NOW(),8,NOW()),
(1005,1,2,'Rebar delivery - Pier 1',DATE_ADD(CURDATE(),INTERVAL -9 DAY),'10:00:00',2,'Done',8,NOW(),8,NOW()),
(1006,1,2,'Footing formwork - Pier 1',DATE_ADD(CURDATE(),INTERVAL -8 DAY),'08:00:00',2,'Done',8,NOW(),8,NOW()),
(1007,1,2,'Concrete pour - Footing 1',DATE_ADD(CURDATE(),INTERVAL -7 DAY),'09:00:00',1,'Done',8,NOW(),8,NOW()),
(1008,1,2,'Concrete pour - Footing 2',DATE_ADD(CURDATE(),INTERVAL -5 DAY),'09:00:00',1,'Done',8,NOW(),8,NOW()),
(1009,1,2,'Steel fixing - Grid B',DATE_ADD(CURDATE(),INTERVAL -4 DAY),'08:00:00',7,'Done',8,NOW(),8,NOW()),
(1010,1,2,'Formwork stripping - Footing 1',DATE_ADD(CURDATE(),INTERVAL -3 DAY),'13:00:00',2,'Done',8,NOW(),8,NOW()),
(1011,1,2,'Rebar placement - Grid A',DATE_ADD(CURDATE(),INTERVAL -2 DAY),'08:00:00',7,'Done',8,NOW(),8,NOW()),
(1012,1,2,'Material delivery - cement',DATE_ADD(CURDATE(),INTERVAL -1 DAY),'13:00:00',2,'Done',8,NOW(),8,NOW()),
(1013,1,2,'Concrete pour - Footing 3',DATE_ADD(CURDATE(),INTERVAL -1 DAY),'10:00:00',1,'Done',8,NOW(),8,NOW()),
(1014,1,2,'Morning safety briefing',CURDATE(),'07:00:00',1,'Done',8,NOW(),8,NOW()),
(1015,1,2,'Rebar placement - Grid A',CURDATE(),'08:00:00',7,'In Progress',8,NOW(),8,NOW()),
(1016,1,2,'Concrete pour - Footing 3',CURDATE(),'10:00:00',1,'In Progress',8,NOW(),8,NOW()),
(1017,1,2,'Formwork inspection',CURDATE(),'13:00:00',2,'Pending',8,NOW(),8,NOW()),
(1018,1,2,'Equipment maintenance check',CURDATE(),'15:00:00',7,'Pending',8,NOW(),8,NOW()),
(1019,1,2,'Daily safety briefing',DATE_ADD(CURDATE(),INTERVAL 1 DAY),'07:00:00',1,'Pending',8,NOW(),8,NOW()),
(1020,1,2,'Concrete pour - Footing 4',DATE_ADD(CURDATE(),INTERVAL 1 DAY),'08:00:00',1,'Pending',8,NOW(),8,NOW()),
(1021,1,2,'Rebar layout - Pier 1',DATE_ADD(CURDATE(),INTERVAL 2 DAY),'09:00:00',7,'Pending',8,NOW(),8,NOW()),
(1022,1,2,'Material delivery - steel bars',DATE_ADD(CURDATE(),INTERVAL 2 DAY),'13:00:00',2,'Pending',8,NOW(),8,NOW()),
(1023,1,2,'Formwork stripping - Footing 2',DATE_ADD(CURDATE(),INTERVAL 3 DAY),'08:00:00',2,'Pending',8,NOW(),8,NOW()),
(1024,1,2,'Scaffolding inspection',DATE_ADD(CURDATE(),INTERVAL 3 DAY),'14:00:00',7,'Pending',8,NOW(),8,NOW()),
(1025,1,2,'Concrete curing check',DATE_ADD(CURDATE(),INTERVAL 4 DAY),'08:00:00',1,'Pending',8,NOW(),8,NOW()),
(1026,1,2,'Deck slab preparation',DATE_ADD(CURDATE(),INTERVAL 5 DAY),'09:00:00',7,'Pending',8,NOW(),8,NOW()),
(1027,1,2,'Weekly progress walkthrough',DATE_ADD(CURDATE(),INTERVAL 6 DAY),'07:30:00',1,'Pending',8,NOW(),8,NOW()),
(1101,2,4,'Structural framing - Level 3',DATE_ADD(CURDATE(),INTERVAL -2 DAY),'08:00:00',2,'Done',9,NOW(),9,NOW()),
(1102,2,4,'Column formwork - Level 4',CURDATE(),'08:00:00',8,'In Progress',9,NOW(),9,NOW()),
(1103,2,4,'Rebar inspection - Level 4',DATE_ADD(CURDATE(),INTERVAL 1 DAY),'10:00:00',2,'Pending',9,NOW(),9,NOW()),
(1201,3,5,'Piling rig setup',CURDATE(),'07:30:00',6,'In Progress',10,NOW(),10,NOW()),
(1202,3,5,'Pile driving - Section A',DATE_ADD(CURDATE(),INTERVAL 1 DAY),'08:00:00',6,'Pending',10,NOW(),10,NOW()),
(1301,5,9,'Electrical conduit layout',CURDATE(),'09:00:00',3,'In Progress',9,NOW(),9,NOW()),
(1302,5,9,'Panel installation',DATE_ADD(CURDATE(),INTERVAL 2 DAY),'09:00:00',10,'Pending',9,NOW(),9,NOW())
ON DUPLICATE KEY UPDATE task_date = VALUES(task_date), title = VALUES(title), status = VALUES(status), updated_at = NOW();
-- ---------------------------------------------------------------------------
-- 6. Live activity for Bridge Phase 2 (project 1) in the last 7 days
--    Rates: assignment 1 -> laborer 1 (P250), assignment 7 -> laborer 7 (P280),
--    assignment 12 -> laborer 2 (P260). Overtime = rate * 1.25.
-- ---------------------------------------------------------------------------
INSERT INTO labor_hour_log (log_id, assignment_id, log_date, regular_hours, overtime_hours, computed_cost, created_by, created_at) VALUES
(1001,1,DATE_ADD(CURDATE(),INTERVAL -6 DAY),8.00,0.00,2000.00,8,NOW()),
(1002,7,DATE_ADD(CURDATE(),INTERVAL -6 DAY),8.00,2.00,2940.00,8,NOW()),
(1003,1,DATE_ADD(CURDATE(),INTERVAL -5 DAY),8.00,0.00,2000.00,8,NOW()),
(1004,12,DATE_ADD(CURDATE(),INTERVAL -5 DAY),8.00,1.00,2405.00,8,NOW()),
(1005,7,DATE_ADD(CURDATE(),INTERVAL -4 DAY),8.00,0.00,2240.00,8,NOW()),
(1006,12,DATE_ADD(CURDATE(),INTERVAL -4 DAY),8.00,2.00,2730.00,8,NOW()),
(1007,1,DATE_ADD(CURDATE(),INTERVAL -3 DAY),8.00,2.00,2625.00,8,NOW()),
(1008,7,DATE_ADD(CURDATE(),INTERVAL -3 DAY),8.00,0.00,2240.00,8,NOW()),
(1009,1,DATE_ADD(CURDATE(),INTERVAL -2 DAY),8.00,0.00,2000.00,8,NOW()),
(1010,12,DATE_ADD(CURDATE(),INTERVAL -2 DAY),8.00,0.00,2080.00,8,NOW()),
(1011,7,DATE_ADD(CURDATE(),INTERVAL -1 DAY),8.00,1.00,2590.00,8,NOW()),
(1012,12,DATE_ADD(CURDATE(),INTERVAL -1 DAY),8.00,0.00,2080.00,8,NOW()),
(1013,1,CURDATE(),8.00,2.00,2625.00,8,NOW()),
(1014,7,CURDATE(),6.00,1.00,2030.00,8,NOW())
ON DUPLICATE KEY UPDATE log_date = VALUES(log_date), regular_hours = VALUES(regular_hours), overtime_hours = VALUES(overtime_hours), computed_cost = VALUES(computed_cost);

SET @pre_material := (SELECT COUNT(*) FROM material_usage WHERE material_usage_id BETWEEN 1001 AND 1099);

INSERT INTO material_usage (material_usage_id, material_id, phase_id, usage_date, quantity_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(1001,1,2,DATE_ADD(CURDATE(),INTERVAL -6 DAY),120.00,33600.00,8,NOW(),8,NOW()),
(1002,2,2,DATE_ADD(CURDATE(),INTERVAL -5 DAY),12.00,18000.00,8,NOW(),8,NOW()),
(1003,4,2,DATE_ADD(CURDATE(),INTERVAL -4 DAY),60.00,25200.00,8,NOW(),8,NOW()),
(1004,5,2,DATE_ADD(CURDATE(),INTERVAL -3 DAY),20.00,19000.00,8,NOW(),8,NOW()),
(1005,1,2,DATE_ADD(CURDATE(),INTERVAL -2 DAY),80.00,22400.00,8,NOW(),8,NOW()),
(1006,6,2,DATE_ADD(CURDATE(),INTERVAL -1 DAY),15.00,1350.00,8,NOW(),8,NOW()),
(1007,10,2,DATE_ADD(CURDATE(),INTERVAL -1 DAY),90.00,4950.00,8,NOW(),8,NOW()),
(1008,1,2,CURDATE(),60.00,16800.00,8,NOW(),8,NOW())
ON DUPLICATE KEY UPDATE usage_date = VALUES(usage_date), quantity_used = VALUES(quantity_used), computed_cost = VALUES(computed_cost);

INSERT INTO equipment_usage (equipment_usage_id, equipment_id, phase_id, usage_date, hours_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(1001,1,2,DATE_ADD(CURDATE(),INTERVAL -6 DAY),6.00,9000.00,8,NOW(),8,NOW()),
(1002,8,2,DATE_ADD(CURDATE(),INTERVAL -5 DAY),5.00,4500.00,8,NOW(),8,NOW()),
(1003,3,2,DATE_ADD(CURDATE(),INTERVAL -4 DAY),4.00,3200.00,8,NOW(),8,NOW()),
(1004,6,2,DATE_ADD(CURDATE(),INTERVAL -2 DAY),8.00,1200.00,8,NOW(),8,NOW()),
(1005,1,2,DATE_ADD(CURDATE(),INTERVAL -1 DAY),5.00,7500.00,8,NOW(),8,NOW()),
(1006,3,2,CURDATE(),6.00,4800.00,8,NOW(),8,NOW())
ON DUPLICATE KEY UPDATE usage_date = VALUES(usage_date), hours_used = VALUES(hours_used), computed_cost = VALUES(computed_cost);

-- Draw the seeded material quantities from stock exactly once.
SET @post_material := (SELECT COUNT(*) FROM material_usage WHERE material_usage_id BETWEEN 1001 AND 1099);
UPDATE materials m
SET m.stock_quantity = GREATEST(0, m.stock_quantity - COALESCE((
  SELECT SUM(mu.quantity_used) FROM material_usage mu
  WHERE mu.material_id = m.material_id AND mu.material_usage_id BETWEEN 1001 AND 1099
), 0))
WHERE @post_material > @pre_material AND m.material_id IN (1,2,4,5,6,10);

-- ---------------------------------------------------------------------------
-- 7. Re-derive remaining_budget from every logged cost so PM and SS agree
-- ---------------------------------------------------------------------------
UPDATE projects p
SET p.remaining_budget = p.approved_budget - (
  COALESCE((SELECT SUM(l.computed_cost) FROM labor_hour_log l
            JOIN workforce_assignment wa ON wa.assignment_id = l.assignment_id
            JOIN project_phases ph ON ph.phase_id = wa.phase_id
            WHERE ph.project_id = p.project_id), 0)
  + COALESCE((SELECT SUM(mu.computed_cost) FROM material_usage mu
              JOIN project_phases ph2 ON ph2.phase_id = mu.phase_id
              WHERE ph2.project_id = p.project_id), 0)
  + COALESCE((SELECT SUM(eu.computed_cost) FROM equipment_usage eu
              JOIN project_phases ph3 ON ph3.phase_id = eu.phase_id
              WHERE ph3.project_id = p.project_id), 0)
)
WHERE p.project_id BETWEEN 1 AND 5;
