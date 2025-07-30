# Database Migration and Enhancement

## Overview

This directory contains the database migration from JSON file storage to SQLite database for the IT Management System. The migration provides better data integrity, performance, and scalability.

## Files

- `schema.sql` - Database schema definition with all tables and relationships
- `db.js` - Database connection and management utilities
- `migrate.js` - Migration script to transfer data from JSON to SQLite
- `services.js` - Database service layer for all CRUD operations

## Database Schema

### Core Tables

#### Users
- `id` - Primary key
- `email` - Unique email address
- `name` - User's full name
- `role` - User role (admin, technician, user)
- `department` - User's department
- `created_at`, `updated_at` - Timestamps
- `last_login` - Last login timestamp
- `is_active` - Account status

#### Tickets
- `id` - Primary key
- `ticket_id` - Unique ticket identifier (e.g., TKT-001)
- `subject` - Ticket subject
- `description` - Ticket description
- `requester_id` - Foreign key to users table
- `assignee_id` - Foreign key to users table
- `category_id` - Foreign key to ticket_categories table
- `priority_id` - Foreign key to ticket_priorities table
- `status_id` - Foreign key to ticket_statuses table
- `email` - Requester email
- `created_at`, `updated_at` - Timestamps
- `resolved_at` - Resolution timestamp

#### Assets
- `id` - Primary key
- `asset_no` - Unique asset number
- `asset_tag` - Asset tag/label
- `type_id` - Foreign key to asset_types table
- `brand`, `model` - Asset details
- `serial_number`, `imei` - Serial numbers
- `hostname` - Computer hostname
- `current_user_id` - Foreign key to users table
- `department` - Asset department
- `status_id` - Foreign key to asset_statuses table
- `purchase_date`, `warranty_end_date` - Important dates
- `comment` - Additional notes
- `created_at`, `updated_at` - Timestamps

### Supporting Tables

#### Authentication & Sessions
- `user_sessions` - User authentication sessions
- `admin_sessions` - Admin authentication sessions
- `otp_store` - Email OTP storage

#### Lookup Tables
- `ticket_categories` - Ticket categories (hardware, software, etc.)
- `ticket_priorities` - Priority levels with SLA hours
- `ticket_statuses` - Ticket statuses (open, in-progress, etc.)
- `asset_types` - Asset types (laptop, desktop, etc.)
- `asset_statuses` - Asset statuses (active, retired, etc.)

#### Related Data
- `ticket_timeline` - Ticket history and comments
- `asset_history` - Asset ownership and status changes
- `kb_categories` - Knowledge base categories
- `kb_articles` - Knowledge base articles
- `notifications` - System notifications

## Migration Process

### 1. Data Migration
The migration script (`migrate.js`) performs the following steps:

1. **Backup existing data** - Creates `data_backup.json`
2. **Initialize database schema** - Creates all tables and indexes
3. **Migrate users** - Extracts unique users from tickets
4. **Migrate tickets** - Transfers all ticket data with relationships
5. **Migrate assets** - Transfers all asset data with relationships
6. **Verify migration** - Shows migration statistics

### 2. Migration Results
- **Users migrated**: 4 unique users
- **Tickets migrated**: 4 tickets with timeline entries
- **Assets migrated**: 3 assets with detailed information
- **Data integrity**: All relationships preserved

## Database Services

The `services.js` file provides a comprehensive service layer with the following features:

### User Services
- `getUsers()` - Get all users
- `getUserById(id)` - Get user by ID
- `getUserByEmail(email)` - Get user by email
- `createUser(userData)` - Create new user
- `updateUser(id, userData)` - Update user
- `deleteUser(id)` - Delete user

### Ticket Services
- `getTickets()` - Get all tickets with related data
- `getTicketById(id)` - Get ticket by ID with timeline
- `getTicketByTicketId(ticketId)` - Get ticket by ticket ID
- `createTicket(ticketData)` - Create new ticket with timeline
- `updateTicket(id, ticketData)` - Update ticket
- `createTimelineEntry(ticketId, entryData)` - Add timeline entry

### Asset Services
- `getAssets()` - Get all assets with related data
- `getAssetById(id)` - Get asset by ID
- `getAssetByAssetNo(assetNo)` - Get asset by asset number
- `createAsset(assetData)` - Create new asset
- `updateAsset(id, assetData)` - Update asset
- `deleteAsset(id)` - Delete asset

### Session Services
- `createUserSession(userId, sessionToken, deviceId)` - Create user session
- `getUserSession(sessionToken)` - Get user session
- `deleteUserSession(sessionToken)` - Delete user session
- `createAdminSession(username, sessionToken)` - Create admin session
- `getAdminSession(sessionToken)` - Get admin session
- `deleteAdminSession(sessionToken)` - Delete admin session

### OTP Services
- `storeOTP(email, otp)` - Store OTP for email
- `getOTP(email)` - Get valid OTP for email
- `deleteOTP(email)` - Delete OTP for email

### Utility Services
- `getDashboardStats()` - Get dashboard statistics
- `cleanupExpired()` - Clean up expired sessions and OTPs

## Benefits of Database Migration

### Performance Improvements
- **Indexed queries** - Fast lookups on frequently accessed fields
- **Optimized joins** - Efficient relationship queries
- **WAL mode** - Better concurrency for multiple users
- **Prepared statements** - Faster query execution

### Data Integrity
- **Foreign key constraints** - Ensures data relationships
- **Unique constraints** - Prevents duplicate data
- **Data validation** - Proper data types and constraints
- **Transaction support** - Atomic operations

### Scalability
- **Concurrent access** - Multiple users can access simultaneously
- **Data relationships** - Proper normalization
- **Backup and recovery** - Database backup capabilities
- **Migration support** - Easy schema updates

### Security
- **Session management** - Proper session storage
- **Data isolation** - User data separation
- **Audit trail** - Timeline and history tracking
- **Access control** - Role-based permissions

## Usage

### Initialize Database
```javascript
const dbManager = require('./database/db');
dbManager.initSchema();
```

### Run Migration
```bash
node database/migrate.js
```

### Use Services
```javascript
const dbServices = require('./database/services');

// Get all tickets
const tickets = dbServices.getTickets();

// Create new ticket
const newTicket = dbServices.createTicket({
    subject: 'New Issue',
    description: 'Description here',
    email: 'user@example.com',
    category: 'hardware',
    priority: 'medium'
});

// Get dashboard stats
const stats = dbServices.getDashboardStats();
```

## Next Steps

1. **Update server.js** - Replace JSON file operations with database services
2. **Add input validation** - Validate data before database operations
3. **Implement error handling** - Proper error handling for database operations
4. **Add logging** - Database operation logging
5. **Performance monitoring** - Query performance monitoring
6. **Backup strategy** - Automated database backups

## Database File Location

The SQLite database file is located at:
```
database/it_support.db
```

This file contains all the migrated data and should be included in backup strategies. 