-- Project Manager schema additions + demo data (idempotent)

SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'project_phases' AND column_name = 'required_skill_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE project_phases ADD COLUMN required_skill_id BIGINT UNSIGNED NULL AFTER sequence_no', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'project_phases' AND constraint_name = 'fk_project_phases_required_skill');
SET @sql := IF(@fk = 0, 'ALTER TABLE project_phases ADD CONSTRAINT fk_project_phases_required_skill FOREIGN KEY (required_skill_id) REFERENCES skill (skill_id) ON UPDATE CASCADE ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'materials' AND column_name = 'stock_quantity');
SET @sql := IF(@exists = 0, 'ALTER TABLE materials ADD COLUMN stock_quantity INT UNSIGNED NOT NULL DEFAULT 0 AFTER unit_cost', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE project_phases SET required_skill_id = CASE phase_id
  WHEN 1 THEN 7 WHEN 2 THEN 9 WHEN 3 THEN 7 WHEN 4 THEN 2 WHEN 5 THEN 8
  WHEN 6 THEN 2 WHEN 7 THEN 7 WHEN 8 THEN 6 WHEN 9 THEN 3 WHEN 10 THEN 5
  ELSE required_skill_id END
WHERE phase_id BETWEEN 1 AND 10;

UPDATE materials SET stock_quantity = CASE material_id
  WHEN 1 THEN 420 WHEN 2 THEN 85 WHEN 3 THEN 64 WHEN 4 THEN 310 WHEN 5 THEN 120
  WHEN 6 THEN 75 WHEN 7 THEN 48 WHEN 8 THEN 22 WHEN 9 THEN 60 WHEN 10 THEN 250
  ELSE stock_quantity END
WHERE material_id BETWEEN 1 AND 10;

INSERT IGNORE INTO labor_hour_log (log_id, assignment_id, log_date, regular_hours, overtime_hours, computed_cost, created_by, created_at) VALUES
(1,1,'2026-09-05',8.00,0.00,2000.00,1,NOW()),
(2,1,'2026-09-06',8.00,2.00,2625.00,1,NOW()),
(3,2,'2026-09-05',8.00,0.00,2080.00,1,NOW()),
(4,2,'2026-09-06',8.00,2.00,2730.00,1,NOW()),
(5,3,'2026-09-07',8.00,0.00,1920.00,1,NOW()),
(6,3,'2026-09-08',8.00,2.00,2520.00,1,NOW()),
(7,4,'2026-06-15',8.00,0.00,2160.00,1,NOW()),
(8,4,'2026-06-16',8.00,1.00,2497.50,1,NOW()),
(9,5,'2026-02-10',8.00,0.00,2040.00,1,NOW()),
(10,5,'2026-02-11',8.00,2.00,2677.50,1,NOW()),
(11,6,'2026-04-10',8.00,0.00,2120.00,1,NOW()),
(12,6,'2026-04-11',8.00,2.00,2782.50,1,NOW()),
(13,7,'2026-09-10',8.00,0.00,2240.00,1,NOW()),
(14,7,'2026-09-11',8.00,2.00,2940.00,1,NOW()),
(15,8,'2026-09-12',8.00,0.00,2000.00,1,NOW()),
(16,8,'2026-09-13',8.00,2.00,2625.00,1,NOW()),
(17,9,'2026-01-15',8.00,0.00,1960.00,1,NOW()),
(18,9,'2026-01-16',8.00,2.00,2572.50,1,NOW()),
(19,10,'2026-09-15',8.00,0.00,2080.00,1,NOW()),
(20,10,'2026-09-16',8.00,2.00,2730.00,1,NOW()),
(21,11,'2026-10-02',8.00,0.00,2000.00,1,NOW()),
(22,11,'2026-10-03',8.00,2.00,2625.00,1,NOW()),
(23,12,'2026-10-02',8.00,0.00,2080.00,1,NOW()),
(24,12,'2026-10-03',8.00,2.00,2730.00,1,NOW());

INSERT IGNORE INTO material_usage (material_usage_id, material_id, phase_id, usage_date, quantity_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(11,1,2,'2026-09-20',2000.00,560000.00,1,NOW(),1,NOW()),
(12,4,2,'2026-09-21',500.00,210000.00,1,NOW(),1,NOW()),
(13,3,2,'2026-09-22',40.00,72000.00,1,NOW(),1,NOW()),
(14,1,4,'2026-09-20',1500.00,420000.00,1,NOW(),1,NOW()),
(15,4,4,'2026-09-21',400.00,168000.00,1,NOW(),1,NOW()),
(16,5,4,'2026-09-22',40.00,38000.00,1,NOW(),1,NOW()),
(17,1,5,'2026-09-20',2000.00,560000.00,1,NOW(),1,NOW()),
(18,4,5,'2026-09-21',800.00,336000.00,1,NOW(),1,NOW()),
(19,3,5,'2026-09-22',100.00,180000.00,1,NOW(),1,NOW()),
(20,3,7,'2026-06-20',150.00,270000.00,1,NOW(),1,NOW()),
(21,1,7,'2026-06-21',500.00,140000.00,1,NOW(),1,NOW()),
(22,4,9,'2026-09-25',400.00,168000.00,1,NOW(),1,NOW()),
(23,9,9,'2026-09-26',120.00,102000.00,1,NOW(),1,NOW()),
(24,1,9,'2026-09-27',250.00,70000.00,1,NOW(),1,NOW());

INSERT IGNORE INTO equipment_usage (equipment_usage_id, equipment_id, phase_id, usage_date, hours_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(11,1,5,'2026-09-23',80.00,120000.00,1,NOW(),1,NOW()),
(12,4,7,'2026-06-22',30.00,54000.00,1,NOW(),1,NOW());

UPDATE projects p SET remaining_budget = p.approved_budget - (
  SELECT COALESCE(SUM(t.cost), 0) FROM (
    SELECT ph.project_id AS project_id, lhl.computed_cost AS cost
      FROM labor_hour_log lhl
      JOIN workforce_assignment wa ON wa.assignment_id = lhl.assignment_id
      JOIN project_phases ph ON ph.phase_id = wa.phase_id
    UNION ALL
    SELECT ph.project_id, mu.computed_cost
      FROM material_usage mu JOIN project_phases ph ON ph.phase_id = mu.phase_id
    UNION ALL
    SELECT ph.project_id, eu.computed_cost
      FROM equipment_usage eu JOIN project_phases ph ON ph.phase_id = eu.phase_id
  ) t WHERE t.project_id = p.project_id
);