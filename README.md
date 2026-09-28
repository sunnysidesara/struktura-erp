# Struktura ERP: Construction Resource & Cost Management System

A construction resource and project cost management system that centralizes workforce allocation, skill management, project phases, equipment resources, material usage, and operational costs.

## Overview

Struktura ERP centralizes and automates workforce resource allocation, trade skill management, project phase tracking, and operational cost calculations across active construction sites.

Rather than relying on client-side application scripts or manual spreadsheet entries, Struktura ERP moves core business logic into the database layer using server-side automation:

- **Automated Cost Deduction** — When daily labor hours are logged by site supervisors, an automated database trigger calculates total labor cost (`hours_worked × hourly_rate`) and immediately deducts that amount from the corresponding project's remaining budget in real time.
- **Skill & Resource Mapping** — Manages complex assignment constraints by linking laborers with specialized trade skills and assigning them to active project phases via junction tables.
- **Data Integrity & Access Control** — Enforces 3rd Normal Form (3NF) relational constraints, foreign key cascades, and role-based data isolation across all system operations.

## The Problem It Solves

Construction firms often rely on spreadsheets and separate records to manage workers, skills, project phases, resources, and project costs. This makes resource allocation difficult and causes delays in detecting changes in project costs.

Struktura ERP centralizes these operations and uses database-level automation to record resource usage, calculate operational costs, update project budgets, and maintain data integrity.
