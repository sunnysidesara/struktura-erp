-- =============================================================================
--  Struktura ERP - Construction Resource & Cost Management System
--  Database : Aiven Cloud MySQL   (target database: `defaultdb`)
--  Source   : Struktura_ERP_Final_Data_Dictionary.docx  (team's finalized ERD)
--  Build    : 18 tables * InnoDB * utf8mb4 / utf8mb4_unicode_ci
--
--  HOW TO RUN
--    VS Code -> SQLTools -> connect "Aiven-Cloud-DB" -> open this file -> Run
--
--  CONVENTIONS
--    * snake_case table names (the dictionary's `WorkforceAssignment` and
--      `LaborHourLog` are normalized to `workforce_assignment` / `labor_hour_log`)
--    * PK  = BIGINT UNSIGNED AUTO_INCREMENT ;  FK = BIGINT UNSIGNED
--    * money = DECIMAL(15,2) ;  hours / quantities = DECIMAL(8,2)
--    * column names are kept verbatim from the dictionary, including the two
--      known typos: `hourly_rate_ovveride` (override) and `charge_at` (changed_at)
--    * dictionary ids with no table in the ERD (e.g. projects.client_id) are kept
--      as plain columns with no FK (logical reference only)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
--  Drop (child -> parent) so this script is safe to re-run
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS site_task;
DROP TABLE IF EXISTS udit_logs;
DROP TABLE IF EXISTS `materials_suppliers`;
DROP TABLE IF EXISTS `material_usage`;
DROP TABLE IF EXISTS `materials`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `equipment_usage`;
DROP TABLE IF EXISTS `equipment`;
DROP TABLE IF EXISTS `labor_hour_log`;
DROP TABLE IF EXISTS `workforce_assignment`;
DROP TABLE IF EXISTS `laborer_skills`;
DROP TABLE IF EXISTS `laborer`;
DROP TABLE IF EXISTS `skill`;
DROP TABLE IF EXISTS `project_phases`;
DROP TABLE IF EXISTS `projects`;
DROP TABLE IF EXISTS `user_role`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `role`;

-- ===========================================================================
--  1. IDENTITY & ACCESS
-- ===========================================================================

-- Catalog of system roles (Admin / Project Manager / Site Supervisor).
CREATE TABLE `role` (
  `role_id`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_name`   VARCHAR(100) NOT NULL COMMENT 'Admin / Project Manager / Site Supervisor',
  `description` VARCHAR(255) NULL     COMMENT 'Short description of the role scope',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uq_role_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System accounts; also carries a direct role_id.
CREATE TABLE `users` (
  `user_id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_number`     VARCHAR(20) NOT NULL COMMENT 'Login identifier: SYS01xxxx / PM02xxxx / SUP03xxxx',
  `role_id`       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> role.role_id',
  `first_name`    VARCHAR(100) NOT NULL,
  `last_name`     VARCHAR(100) NOT NULL,
  `email`         VARCHAR(255) NOT NULL COMMENT 'Login email',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hashed credential',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Whether the account can currently log in',
  `created_at`    TIMESTAMP    NULL DEFAULT NULL COMMENT 'Account creation timestamp',
  `updated_at`    TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_id_number` (`id_number`),
  KEY `idx_users_role_id` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`)
    REFERENCES `role` (`role_id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction table also linking users to roles (see dictionary notes).
CREATE TABLE `user_role` (
  `user_role_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id`      BIGINT UNSIGNED NOT NULL COMMENT 'FK -> role.role_id',
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.user_id',
  PRIMARY KEY (`user_role_id`),
  UNIQUE KEY `uq_user_role_pair` (`user_id`, `role_id`),
  KEY `idx_user_role_role_id` (`role_id`),
  CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`)
    REFERENCES `role` (`role_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  2. CORE PROJECT DATA
-- ===========================================================================

-- One row per construction project.
CREATE TABLE `projects` (
  `project_id`       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_name`     VARCHAR(255) NOT NULL,
  `client_id`        BIGINT UNSIGNED NULL COMMENT 'Client reference - no client table in the ERD (logical reference only, no FK)',
  `user_id`          BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.user_id. The user accountable for this project',
  `site_supervisor_id` BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id. The Site Supervisor assigned to this site',
  `client_name`      VARCHAR(255) NULL COMMENT 'Client name stored directly on the project',
  `location`         VARCHAR(255) NULL COMMENT 'Site address / location',
  `latitude`         DECIMAL(10,7) NULL COMMENT 'Site latitude for the map view',
  `longitude`        DECIMAL(10,7) NULL COMMENT 'Site longitude for the map view',
  `start_date`       DATE         NULL COMMENT 'Project start date',
  `end_date`         DATE         NULL COMMENT 'Project end date',
  `approved_budget`  DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Budget ceiling approved for the project',
  `remaining_budget` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Budget left after logged costs',
  `deadline`         DATE         NULL COMMENT 'Target completion deadline',
  `status`           VARCHAR(50)  NULL COMMENT 'Current project status',
  `created_by`       BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`       TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`       BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`       TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`project_id`),
  KEY `idx_projects_client_id` (`client_id`),
  KEY `idx_projects_user_id` (`user_id`),
  KEY `idx_projects_site_supervisor_id` (`site_supervisor_id`),
  KEY `idx_projects_created_by` (`created_by`),
  KEY `idx_projects_updated_by` (`updated_by`),
  CONSTRAINT `fk_projects_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_projects_site_supervisor` FOREIGN KEY (`site_supervisor_id`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_projects_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_projects_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sequenced stages within a project.
CREATE TABLE `project_phases` (
  `phase_id`      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id`    BIGINT UNSIGNED NOT NULL COMMENT 'FK -> projects.project_id',
  `project_name`  VARCHAR(255) NULL COMMENT 'Duplicates projects.project_name in the ERD - likely the phase''s own name',
  `description`   VARCHAR(255) NULL COMMENT 'Description of the phase',
  `sequence_no`   INT UNSIGNED NULL COMMENT 'Order of this phase within the project',
  `required_skill_id` BIGINT UNSIGNED NULL COMMENT 'FK -> skill.skill_id. Skill required for this phase',
  `project_cost`  DECIMAL(15,2) NULL COMMENT 'Cost associated with this phase',
  `planned_start` DATE         NULL COMMENT 'Planned start date',
  `planned_end`   DATE         NULL COMMENT 'Planned end date',
  `status`        ENUM('Not Started','In Progress','Completed') NULL COMMENT 'Not Started / In Progress / Completed',
  `created_by`    BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`    TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`    BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`    TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`phase_id`),
  KEY `idx_project_phases_project_id` (`project_id`),
  KEY `idx_project_phases_created_by` (`created_by`),
  KEY `idx_project_phases_updated_by` (`updated_by`),
  CONSTRAINT `fk_project_phases_project` FOREIGN KEY (`project_id`)
    REFERENCES `projects` (`project_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_project_phases_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_project_phases_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  3. WORKFORCE & SKILLS
-- ===========================================================================

-- Catalog of construction trade skills.
CREATE TABLE `skill` (
  `skill_id`    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `skill_name`  VARCHAR(100) NOT NULL COMMENT 'e.g. Mason, Electrician, Welder',
  `description` VARCHAR(255) NULL COMMENT 'Short description of the skill',
  PRIMARY KEY (`skill_id`),
  UNIQUE KEY `uq_skill_skill_name` (`skill_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Construction workers available for assignment.
CREATE TABLE `laborer` (
  `laborer_id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`        VARCHAR(100) NOT NULL,
  `last_name`         VARCHAR(100) NOT NULL,
  `hourly_rate`       DECIMAL(15,2) NULL COMMENT 'Standard hourly pay rate',
  `employment_status` ENUM('Active','Inactive','Terminated') NULL COMMENT 'Active / Inactive / Terminated',
  `contact_number`    VARCHAR(50)  NULL COMMENT 'Contact phone number',
  `date_hired`        DATE         NULL COMMENT 'Date the laborer was hired',
  `created_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`laborer_id`),
  KEY `idx_laborer_created_by` (`created_by`),
  KEY `idx_laborer_updated_by` (`updated_by`),
  CONSTRAINT `fk_laborer_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_laborer_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which skills each laborer is qualified in.
CREATE TABLE `laborer_skills` (
  `laborer_skill_id`  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `laborer_id`        BIGINT UNSIGNED NOT NULL COMMENT 'FK -> laborer.laborer_id',
  `skill_id`          BIGINT UNSIGNED NOT NULL COMMENT 'FK -> skill.skill_id',
  `skill_name`        VARCHAR(100) NULL COMMENT 'Denormalized copy of skill.skill_name (per ERD)',
  `proficiency_level` ENUM('Basic','Intermediate','Expert') NULL COMMENT 'Basic / Intermediate / Expert',
  `years_experience`  INT UNSIGNED NULL COMMENT 'Years of experience in this skill',
  `date_certified`    DATE         NULL COMMENT 'Date the qualification was certified',
  `created_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`laborer_skill_id`),
  UNIQUE KEY `uq_laborer_skills_pair` (`laborer_id`, `skill_id`),
  KEY `idx_laborer_skills_skill_id` (`skill_id`),
  KEY `idx_laborer_skills_created_by` (`created_by`),
  KEY `idx_laborer_skills_updated_by` (`updated_by`),
  CONSTRAINT `fk_laborer_skills_laborer` FOREIGN KEY (`laborer_id`)
    REFERENCES `laborer` (`laborer_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_laborer_skills_skill` FOREIGN KEY (`skill_id`)
    REFERENCES `skill` (`skill_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_laborer_skills_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_laborer_skills_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Links laborers to the project phases they work on.
-- (Dictionary name `WorkforceAssignment` normalized to snake_case.)
CREATE TABLE `workforce_assignment` (
  `assignment_id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `laborer_id`            BIGINT UNSIGNED NOT NULL COMMENT 'FK -> laborer.laborer_id',
  `phase_id`              BIGINT UNSIGNED NOT NULL COMMENT 'FK -> project_phases.phase_id',
  `assigned_at`           TIMESTAMP    NULL DEFAULT NULL COMMENT 'When the assignment began',
  `role_on_task`          VARCHAR(100) NULL COMMENT 'The laborer''s role on this specific task',
  `status`                VARCHAR(50)  NULL COMMENT 'Current status of the assignment',
  `hourly_rate_ovveride`  DECIMAL(15,2) NULL COMMENT 'Phase-specific rate override, if different from laborer.hourly_rate (dictionary spelling kept: "ovveride")',
  `released_at`           TIMESTAMP    NULL DEFAULT NULL COMMENT 'When the laborer was released from this assignment',
  `created_by`            BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`            TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`            BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`            TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`assignment_id`),
  KEY `idx_workforce_assignment_laborer_id` (`laborer_id`),
  KEY `idx_workforce_assignment_phase_id` (`phase_id`),
  KEY `idx_workforce_assignment_created_by` (`created_by`),
  KEY `idx_workforce_assignment_updated_by` (`updated_by`),
  CONSTRAINT `fk_workforce_assignment_laborer` FOREIGN KEY (`laborer_id`)
    REFERENCES `laborer` (`laborer_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_workforce_assignment_phase` FOREIGN KEY (`phase_id`)
    REFERENCES `project_phases` (`phase_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_workforce_assignment_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_workforce_assignment_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily hours worked per assignment (append-only).
-- (Dictionary name `LaborHourLog` normalized to snake_case.)
CREATE TABLE `labor_hour_log` (
  `log_id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assignment_id`  BIGINT UNSIGNED NOT NULL COMMENT 'FK -> workforce_assignment.assignment_id',
  `log_date`       DATE         NULL COMMENT 'Date the hours were worked',
  `regular_hours`  DECIMAL(8,2) NULL COMMENT 'Regular hours worked',
  `overtime_hours` DECIMAL(8,2) NULL COMMENT 'Overtime hours worked',
  `computed_cost`  DECIMAL(15,2) NULL COMMENT 'Calculated labor cost for this entry',
  `created_by`     BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id. The Site Supervisor who logged it',
  `created_at`     TIMESTAMP    NULL DEFAULT NULL COMMENT 'Log entry timestamp',
  PRIMARY KEY (`log_id`),
  KEY `idx_labor_hour_log_assignment_id` (`assignment_id`),
  KEY `idx_labor_hour_log_created_by` (`created_by`),
  KEY `idx_labor_hour_log_log_date` (`log_date`),
  CONSTRAINT `fk_labor_hour_log_assignment` FOREIGN KEY (`assignment_id`)
    REFERENCES `workforce_assignment` (`assignment_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_labor_hour_log_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduled on-site work items shown on the supervisor's schedule.
CREATE TABLE `site_task` (
  `task_id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id`          BIGINT UNSIGNED NOT NULL COMMENT 'FK -> projects.project_id',
  `phase_id`            BIGINT UNSIGNED NULL COMMENT 'FK -> project_phases.phase_id',
  `title`               VARCHAR(255) NOT NULL COMMENT 'Short task description',
  `task_date`           DATE NOT NULL COMMENT 'Day the task is scheduled',
  `start_time`          TIME NULL COMMENT 'Planned start time',
  `assigned_laborer_id` BIGINT UNSIGNED NULL COMMENT 'FK -> laborer.laborer_id',
  `status`              ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `created_by`          BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`          TIMESTAMP NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`          BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`          TIMESTAMP NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`task_id`),
  KEY `idx_site_task_project_date` (`project_id`, `task_date`),
  KEY `idx_site_task_phase_id` (`phase_id`),
  KEY `idx_site_task_assigned_laborer_id` (`assigned_laborer_id`),
  CONSTRAINT `fk_site_task_project` FOREIGN KEY (`project_id`)
    REFERENCES `projects` (`project_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_site_task_phase` FOREIGN KEY (`phase_id`)
    REFERENCES `project_phases` (`phase_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_laborer` FOREIGN KEY (`assigned_laborer_id`)
    REFERENCES `laborer` (`laborer_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_site_task_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  4. EQUIPMENT
-- ===========================================================================

-- Construction equipment available for use.
CREATE TABLE `equipment` (
  `equipment_id`        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `equipment_name`      VARCHAR(255) NOT NULL COMMENT 'Name / model of the equipment',
  `equipment_type`      VARCHAR(100) NULL COMMENT 'e.g. Excavator, Crane, Mixer',
  `hourly_rental_rate`  DECIMAL(15,2) NULL COMMENT 'Standard hourly rate',
  `equipment_status`    ENUM('Available','In Use','Under Maintenance') NULL COMMENT 'Available / In Use / Under Maintenance',
  `created_by`          BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`          TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`          BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`          TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`equipment_id`),
  KEY `idx_equipment_created_by` (`created_by`),
  KEY `idx_equipment_updated_by` (`updated_by`),
  CONSTRAINT `fk_equipment_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_equipment_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logged equipment use per phase.
CREATE TABLE `equipment_usage` (
  `equipment_usage_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `equipment_id`       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> equipment.equipment_id',
  `phase_id`           BIGINT UNSIGNED NOT NULL COMMENT 'FK -> project_phases.phase_id',
  `usage_date`         DATE         NULL COMMENT 'Date the equipment was used',
  `hours_used`         DECIMAL(8,2) NULL COMMENT 'Hours the equipment was used',
  `computed_cost`      DECIMAL(15,2) NULL COMMENT 'Calculated equipment cost for this entry',
  `created_by`         BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`         TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`         BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`         TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`equipment_usage_id`),
  KEY `idx_equipment_usage_equipment_id` (`equipment_id`),
  KEY `idx_equipment_usage_phase_id` (`phase_id`),
  KEY `idx_equipment_usage_created_by` (`created_by`),
  KEY `idx_equipment_usage_updated_by` (`updated_by`),
  CONSTRAINT `fk_equipment_usage_equipment` FOREIGN KEY (`equipment_id`)
    REFERENCES `equipment` (`equipment_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_equipment_usage_phase` FOREIGN KEY (`phase_id`)
    REFERENCES `project_phases` (`phase_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_equipment_usage_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_equipment_usage_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  5. MATERIALS & SOURCING
-- ===========================================================================

-- Catalog of construction materials.
CREATE TABLE `materials` (
  `material_id`    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_name`  VARCHAR(255) NOT NULL COMMENT 'Name of the material',
  `unit_of_measure` VARCHAR(50) NULL COMMENT 'e.g. bags, kg, m3',
  `unit_cost`      DECIMAL(15,2) NULL COMMENT 'Reference cost per unit',
  `stock_quantity` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Current stock on hand',
  `created_by`     BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`     TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`     BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`     TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`material_id`),
  KEY `idx_materials_created_by` (`created_by`),
  KEY `idx_materials_updated_by` (`updated_by`),
  CONSTRAINT `fk_materials_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_materials_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logged material consumption per phase.
CREATE TABLE `material_usage` (
  `material_usage_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_id`       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> materials.material_id',
  `phase_id`          BIGINT UNSIGNED NOT NULL COMMENT 'FK -> project_phases.phase_id',
  `usage_date`        DATE         NULL COMMENT 'Date the material was used',
  `quantity_used`     DECIMAL(8,2) NULL COMMENT 'Quantity consumed',
  `computed_cost`     DECIMAL(15,2) NULL COMMENT 'Calculated material cost for this entry',
  `created_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `created_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Record creation timestamp',
  `updated_by`        BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `updated_at`        TIMESTAMP    NULL DEFAULT NULL COMMENT 'Last modification timestamp',
  PRIMARY KEY (`material_usage_id`),
  KEY `idx_material_usage_material_id` (`material_id`),
  KEY `idx_material_usage_phase_id` (`phase_id`),
  KEY `idx_material_usage_created_by` (`created_by`),
  KEY `idx_material_usage_updated_by` (`updated_by`),
  CONSTRAINT `fk_material_usage_material` FOREIGN KEY (`material_id`)
    REFERENCES `materials` (`material_id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_material_usage_phase` FOREIGN KEY (`phase_id`)
    REFERENCES `project_phases` (`phase_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_material_usage_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_material_usage_updated_by` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendors that supply construction materials.
CREATE TABLE `suppliers` (
  `supplier_id`     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_name`   VARCHAR(255) NOT NULL COMMENT 'Registered / trade name of the supplier',
  `contact_name`    VARCHAR(255) NULL COMMENT 'Primary contact at the supplier',
  `contact_num`     VARCHAR(50)  NULL COMMENT 'Contact phone number',
  `street_address`  VARCHAR(255) NULL COMMENT 'Street address',
  `city`            VARCHAR(100) NULL COMMENT 'City',
  `state_province`  VARCHAR(100) NULL COMMENT 'State or province',
  `postal_code`     VARCHAR(20)  NULL COMMENT 'Postal / ZIP code',
  `country`         VARCHAR(100) NULL COMMENT 'Country',
  PRIMARY KEY (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction: which suppliers provide which materials.
CREATE TABLE `materials_suppliers` (
  `material_suppliers_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_id`           BIGINT UNSIGNED NOT NULL COMMENT 'FK -> materials.material_id',
  `supplier_id`           BIGINT UNSIGNED NOT NULL COMMENT 'FK -> suppliers.supplier_id',
  PRIMARY KEY (`material_suppliers_id`),
  UNIQUE KEY `uq_materials_suppliers_pair` (`material_id`, `supplier_id`),
  KEY `idx_materials_suppliers_supplier_id` (`supplier_id`),
  CONSTRAINT `fk_materials_suppliers_material` FOREIGN KEY (`material_id`)
    REFERENCES `materials` (`material_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_materials_suppliers_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`supplier_id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  6. AUDIT
-- ===========================================================================

-- Change history, linked directly to the project it occurred under.
CREATE TABLE `audit_logs` (
  `audit_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id`   BIGINT UNSIGNED NOT NULL COMMENT 'FK -> projects.project_id. The project this change occurred under',
  `table_name`   VARCHAR(100) NOT NULL COMMENT 'Name of the table the change occurred in',
  `record_id`    BIGINT UNSIGNED NOT NULL COMMENT 'PK value of the affected row in that table (polymorphic; no enforced FK)',
  `action_type`  ENUM('INSERT','UPDATE','DELETE') NOT NULL COMMENT 'INSERT / UPDATE / DELETE',
  `old_value`    JSON         NULL COMMENT 'Prior value(s)',
  `new_value`    JSON         NULL COMMENT 'New value(s)',
  `changed_by`   BIGINT UNSIGNED NULL COMMENT 'FK -> users.user_id',
  `charge_at`    TIMESTAMP    NULL DEFAULT NULL COMMENT 'Dictionary spelling kept; likely intended "changed_at"',
  PRIMARY KEY (`audit_log_id`),
  KEY `idx_audit_logs_project_id` (`project_id`),
  KEY `idx_audit_logs_table_record` (`table_name`, `record_id`),
  KEY `idx_audit_logs_changed_by` (`changed_by`),
  CONSTRAINT `fk_audit_logs_project` FOREIGN KEY (`project_id`)
    REFERENCES `projects` (`project_id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_audit_logs_changed_by` FOREIGN KEY (`changed_by`)
    REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
--  DONE - re-enable foreign keys, seed roles, and verify
-- ===========================================================================

ALTER TABLE `project_phases`
  ADD CONSTRAINT `fk_project_phases_required_skill` FOREIGN KEY (`required_skill_id`)
  REFERENCES `skill` (`skill_id`) ON UPDATE CASCADE ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed the fixed set of system roles (Admin / Project Manager / Site Supervisor).
INSERT INTO `role` (`role_name`, `description`) VALUES
  ('Admin',           'Manages accounts, roles, reference data, and has full visibility across all projects and audit logs.'),
  ('Project Manager', 'Owns construction projects, defines phases and budgets, and manages equipment and material master records.'),
  ('Site Supervisor', 'Records daily labor, material, and equipment usage for assigned projects only.');

-- Verification - expect 18 tables.
SHOW TABLES;






