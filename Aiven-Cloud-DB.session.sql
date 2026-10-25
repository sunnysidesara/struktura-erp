-- Aiven-Cloud-DB.session.sql
-- Removes the obsolete supplier tables from the Aiven `defaultdb` database.
-- Safe to run more than once because both statements use IF EXISTS.
--
-- Backup taken before the drop:
-- backend/storage/backups/2026-10-26_suppliers_before_drop.sql
--
-- Drop the junction table first: materials_suppliers.supplier_id references
-- suppliers.supplier_id.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `materials_suppliers`;
DROP TABLE IF EXISTS `suppliers`;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification: both result sets should be empty.
SHOW TABLES LIKE 'suppliers';
SHOW TABLES LIKE 'materials_suppliers';
