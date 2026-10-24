-- Struktura ERP - SA demo data (part 1)
-- Idempotent: explicit IDs + INSERT IGNORE

INSERT IGNORE INTO skill (skill_id, skill_name, description) VALUES
(1,'Mason','Lays bricks, blocks and stone'),
(2,'Carpenter','Builds and installs wooden structures'),
(3,'Electrician','Installs and repairs electrical systems'),
(4,'Welder','Joins metal parts using welding techniques'),
(5,'Plumber','Installs and repairs water and drainage pipes'),
(6,'Painter','Applies paint and finishes to surfaces'),
(7,'Heavy Equipment Operator','Operates excavators, cranes and similar machinery'),
(8,'Steel Fixer','Positions and secures steel reinforcement bars'),
(9,'Concrete Worker','Prepares and pours concrete'),
(10,'Roofer','Installs and repairs roofing systems'),
(11,'Safety Officer','Enforces site safety regulations'),
(12,'Surveyor','Measures and maps site conditions');

INSERT IGNORE INTO laborer (laborer_id, first_name, last_name, hourly_rate, employment_status, contact_number, date_hired, created_by, created_at, updated_by, updated_at) VALUES
(1,'Juan','Dela Cruz',250.00,'Active','0917-100-0001','2024-01-15',1,NOW(),1,NOW()),
(2,'Pedro','Reyes',260.00,'Active','0917-100-0002','2024-02-20',1,NOW(),1,NOW()),
(3,'Mario','Santos',240.00,'Active','0917-100-0003','2024-03-05',1,NOW(),1,NOW()),
(4,'Andres','Bonifacio',270.00,'Active','0917-100-0004','2024-04-11',1,NOW(),1,NOW()),
(5,'Jose','Rizal',255.00,'Inactive','0917-100-0005','2024-05-18',1,NOW(),1,NOW()),
(6,'Emilio','Aguinaldo',265.00,'Active','0917-100-0006','2024-06-22',1,NOW(),1,NOW()),
(7,'Lapu','Lapu',280.00,'Active','0917-100-0007','2024-07-30',1,NOW(),1,NOW()),
(8,'Gabriela','Silang',250.00,'Active','0917-100-0008','2024-08-14',1,NOW(),1,NOW()),
(9,'Apolinario','Mabini',245.00,'Terminated','0917-100-0009','2024-09-09',1,NOW(),1,NOW()),
(10,'Melchora','Aquino',260.00,'Active','0917-100-0010','2024-10-01',1,NOW(),1,NOW());

INSERT IGNORE INTO laborer_skills (laborer_skill_id, laborer_id, skill_id, skill_name, proficiency_level, years_experience, date_certified, created_by, created_at, updated_by, updated_at) VALUES
(1,1,1,'Mason','Expert',8,'2018-05-10',1,NOW(),1,NOW()),
(2,1,9,'Concrete Worker','Intermediate',5,'2021-02-15',1,NOW(),1,NOW()),
(3,2,2,'Carpenter','Expert',10,'2016-08-20',1,NOW(),1,NOW()),
(4,3,3,'Electrician','Intermediate',4,'2022-03-11',1,NOW(),1,NOW()),
(5,4,4,'Welder','Expert',9,'2017-11-05',1,NOW(),1,NOW()),
(6,5,8,'Steel Fixer','Basic',2,'2024-01-08',1,NOW(),1,NOW()),
(7,6,7,'Heavy Equipment Operator','Expert',12,'2014-06-30',1,NOW(),1,NOW()),
(8,7,2,'Carpenter','Intermediate',6,'2020-09-17',1,NOW(),1,NOW()),
(9,8,6,'Painter','Intermediate',5,'2021-04-21',1,NOW(),1,NOW()),
(10,9,11,'Safety Officer','Expert',7,'2019-07-12',1,NOW(),1,NOW()),
(11,10,5,'Plumber','Basic',3,'2023-02-02',1,NOW(),1,NOW()),
(12,1,12,'Surveyor','Basic',2,'2024-05-19',1,NOW(),1,NOW()),
(13,3,10,'Roofer','Basic',3,'2023-10-10',1,NOW(),1,NOW()),
(14,4,9,'Concrete Worker','Expert',0,'2024-06-01',1,NOW(),1,NOW()),
(15,8,1,'Mason','Intermediate',4,'2022-12-12',1,NOW(),1,NOW());

INSERT IGNORE INTO projects (project_id, project_name, client_id, user_id, client_name, location, start_date, end_date, approved_budget, remaining_budget, deadline, status, created_by, created_at, updated_by, updated_at) VALUES
(1,'Bridge Phase 2',101,4,'DPWH','Quezon City','2026-01-10','2026-11-30',2400000.00,1850000.00,'2026-12-15','On Track',1,NOW(),1,NOW()),
(2,'North Tower Residences',102,5,'Ayala Land','Makati City','2026-02-01','2027-01-31',1850000.00,1200000.00,'2027-02-15','On Track',1,NOW(),1,NOW()),
(3,'Harbor Logistics Hub',103,6,'Port Authority','Manila','2026-03-15','2026-12-31',3100000.00,2400000.00,'2027-01-20','On Track',1,NOW(),1,NOW()),
(4,'Roadway Rehabilitation',104,7,'Pasig LGU','Pasig City','2025-06-01','2026-08-31',1200000.00,300000.00,'2026-09-15','Completed',1,NOW(),1,NOW()),
(5,'Campus Utility Upgrade',105,4,'University of the Philippines','Diliman, Quezon City','2026-04-01','2026-10-31',980000.00,700000.00,'2026-11-10','Delayed',1,NOW(),1,NOW());

INSERT IGNORE INTO project_phases (phase_id, project_id, project_name, description, sequence_no, project_cost, planned_start, planned_end, status, created_by, created_at, updated_by, updated_at) VALUES
(1,1,'Site Preparation','Clearing and leveling the site',1,300000.00,'2026-01-10','2026-02-10','Completed',1,NOW(),1,NOW()),
(2,1,'Foundation Works','Piling and foundation concreting',2,800000.00,'2026-02-11','2026-06-30','In Progress',1,NOW(),1,NOW()),
(3,2,'Excavation','Excavation for tower footings',1,250000.00,'2026-02-01','2026-03-15','Completed',1,NOW(),1,NOW()),
(4,2,'Structural Framing','Rebar and formwork for floors',2,700000.00,'2026-03-16','2026-10-31','In Progress',1,NOW(),1,NOW()),
(5,3,'Piling','Marine piling works',1,400000.00,'2026-03-15','2026-06-15','In Progress',1,NOW(),1,NOW()),
(6,3,'Deck Construction','Warehouse deck and roofing',2,900000.00,'2026-06-16','2026-12-15','Not Started',1,NOW(),1,NOW()),
(7,4,'Asphalt Paving','Base course and asphalt laying',1,500000.00,'2025-06-01','2026-06-30','Completed',1,NOW(),1,NOW()),
(8,4,'Road Marking','Lane markings and signage',2,100000.00,'2026-07-01','2026-08-15','Completed',1,NOW(),1,NOW()),
(9,5,'Electrical Wiring','Campus-wide electrical upgrade',1,300000.00,'2026-04-01','2026-08-31','In Progress',1,NOW(),1,NOW()),
(10,5,'HVAC Installation','Air-conditioning installation',2,200000.00,'2026-09-01','2026-10-31','Not Started',1,NOW(),1,NOW());

INSERT IGNORE INTO workforce_assignment (assignment_id, laborer_id, phase_id, assigned_at, role_on_task, status, hourly_rate_ovveride, released_at, created_by, created_at, updated_by, updated_at) VALUES
(1,1,2,'2026-09-01 08:00:00','Mason Foreman','Active',NULL,NULL,1,NOW(),1,NOW()),
(2,2,4,'2026-09-02 08:00:00','Lead Carpenter','Active',NULL,NULL,1,NOW(),1,NOW()),
(3,3,9,'2026-09-03 08:00:00','Electrician','Active',NULL,NULL,1,NOW(),1,NOW()),
(4,4,7,'2026-06-10 08:00:00','Welder','Completed',NULL,'2026-08-15 17:00:00',1,NOW(),1,NOW()),
(5,5,3,'2026-02-05 08:00:00','Steel Fixer','Completed',NULL,'2026-03-15 17:00:00',1,NOW(),1,NOW()),
(6,6,5,'2026-04-01 08:00:00','Excavator Operator','Active',NULL,NULL,1,NOW(),1,NOW()),
(7,7,2,'2026-09-05 08:00:00','Carpenter','Active',NULL,NULL,1,NOW(),1,NOW()),
(8,8,4,'2026-09-06 08:00:00','Painter','Active',NULL,NULL,1,NOW(),1,NOW()),
(9,9,1,'2026-01-12 08:00:00','Safety Officer','Completed',NULL,'2026-02-10 17:00:00',1,NOW(),1,NOW()),
(10,10,9,'2026-09-08 08:00:00','Plumber','Active',NULL,NULL,1,NOW(),1,NOW()),
(11,1,4,'2026-10-01 08:00:00','Mason','Active',NULL,NULL,1,NOW(),1,NOW()),
(12,2,2,'2026-10-02 08:00:00','Carpenter','Active',NULL,NULL,1,NOW(),1,NOW());-- Part 2
INSERT IGNORE INTO equipment (equipment_id, equipment_name, equipment_type, hourly_rental_rate, equipment_status, created_by, created_at, updated_by, updated_at) VALUES
(1,'CAT 320 Excavator','Excavator',1500.00,'In Use',1,NOW(),1,NOW()),
(2,'Liebherr 81K Tower Crane','Crane',2500.00,'In Use',1,NOW(),1,NOW()),
(3,'SANY Concrete Mixer','Mixer',800.00,'Available',1,NOW(),1,NOW()),
(4,'Komatsu D65 Bulldozer','Bulldozer',1800.00,'Available',1,NOW(),1,NOW()),
(5,'JCB 3CX Backhoe','Backhoe',1200.00,'Under Maintenance',1,NOW(),1,NOW()),
(6,'Scaffolding Set (50 pcs)','Scaffolding',150.00,'In Use',1,NOW(),1,NOW()),
(7,'Lincoln Welding Machine','Welder',200.00,'Available',1,NOW(),1,NOW()),
(8,'Isuzu Dump Truck','Truck',900.00,'In Use',1,NOW(),1,NOW());

INSERT IGNORE INTO equipment_usage (equipment_usage_id, equipment_id, phase_id, usage_date, hours_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(1,1,2,'2026-09-02',8.00,12000.00,1,NOW(),1,NOW()),
(2,2,4,'2026-09-03',10.00,25000.00,1,NOW(),1,NOW()),
(3,3,1,'2026-01-20',6.00,4800.00,1,NOW(),1,NOW()),
(4,4,3,'2026-02-10',8.00,14400.00,1,NOW(),1,NOW()),
(5,5,5,'2026-04-05',5.00,6000.00,1,NOW(),1,NOW()),
(6,6,4,'2026-09-10',12.00,1800.00,1,NOW(),1,NOW()),
(7,7,7,'2026-06-15',4.00,800.00,1,NOW(),1,NOW()),
(8,8,5,'2026-09-18',7.00,6300.00,1,NOW(),1,NOW()),
(9,1,9,'2026-09-25',8.00,12000.00,1,NOW(),1,NOW()),
(10,6,2,'2026-10-02',9.00,1350.00,1,NOW(),1,NOW());

INSERT IGNORE INTO materials (material_id, material_name, unit_of_measure, unit_cost, created_by, created_at, updated_by, updated_at) VALUES
(1,'Portland Cement','bags',280.00,1,NOW(),1,NOW()),
(2,'Washed Sand','cubic meter',1500.00,1,NOW(),1,NOW()),
(3,'Crushed Gravel','cubic meter',1800.00,1,NOW(),1,NOW()),
(4,'Deformed Steel Bars (16mm)','pieces',420.00,1,NOW(),1,NOW()),
(5,'Marine Plywood','sheets',950.00,1,NOW(),1,NOW()),
(6,'Common Nails','kilograms',90.00,1,NOW(),1,NOW()),
(7,'Latex Paint','gallons',1200.00,1,NOW(),1,NOW()),
(8,'Waterproofing Membrane','rolls',2600.00,1,NOW(),1,NOW()),
(9,'Ceramic Tiles','boxes',850.00,1,NOW(),1,NOW()),
(10,'Coco Lumber','board feet',55.00,1,NOW(),1,NOW());

INSERT IGNORE INTO material_usage (material_usage_id, material_id, phase_id, usage_date, quantity_used, computed_cost, created_by, created_at, updated_by, updated_at) VALUES
(1,1,2,'2026-09-03',120.00,33600.00,1,NOW(),1,NOW()),
(2,2,2,'2026-09-03',15.00,22500.00,1,NOW(),1,NOW()),
(3,3,1,'2026-01-25',10.00,18000.00,1,NOW(),1,NOW()),
(4,4,4,'2026-09-12',80.00,33600.00,1,NOW(),1,NOW()),
(5,5,3,'2026-02-15',25.00,23750.00,1,NOW(),1,NOW()),
(6,6,4,'2026-09-20',50.00,4500.00,1,NOW(),1,NOW()),
(7,7,8,'2026-07-10',12.00,14400.00,1,NOW(),1,NOW()),
(8,8,5,'2026-06-01',8.00,20800.00,1,NOW(),1,NOW()),
(9,9,9,'2026-09-28',30.00,25500.00,1,NOW(),1,NOW()),
(10,10,2,'2026-10-03',200.00,11000.00,1,NOW(),1,NOW());

INSERT IGNORE INTO suppliers (supplier_id, supplier_name, contact_name, contact_num, street_address, city, state_province, postal_code, country) VALUES
(1,'BuildRight Trading','Ana Cruz','0918-200-0001','12 Mabini St','Quezon City','Metro Manila','1100','Philippines'),
(2,'SteelWorks Philippines','Ben Lim','0918-200-0002','88 Bonifacio Ave','Caloocan City','Metro Manila','1400','Philippines'),
(3,'CementOne Supply','Cara Diaz','0918-200-0003','5 Ortigas Ave','Pasig City','Metro Manila','1600','Philippines'),
(4,'Timber and Boards Co.','Dino Reyes','0918-200-0004','22 Marcos Hwy','Antipolo City','Rizal','1870','Philippines'),
(5,'PaintPro Depot','Elena Santos','0918-200-0005','7 Shaw Blvd','Mandaluyong City','Metro Manila','1550','Philippines'),
(6,'HeavyParts Trading','Fred Gomez','0918-200-0006','31 Quirino Ave','Paranaque City','Metro Manila','1700','Philippines');

INSERT IGNORE INTO materials_suppliers (material_suppliers_id, material_id, supplier_id) VALUES
(1,1,1),(2,1,3),(3,2,1),(4,3,1),(5,4,2),(6,5,4),(7,6,1),(8,7,5),(9,8,3),(10,9,1),(11,10,4),(12,4,1);

-- Audit rows are no longer seeded: the AuditObserver writes real entries to
-- audit_logs whenever User/Skill/Project/ProjectPhase records change.
