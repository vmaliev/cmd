const fs = require('fs');
const path = require('path');
const dbManager = require('./db');

class DataMigration {
    constructor() {
        this.db = dbManager.getDb();
        this.jsonDataPath = path.join(__dirname, '..', 'data.json');
    }

    // Check if JSON data file exists
    checkJsonData() {
        if (!fs.existsSync(this.jsonDataPath)) {
            console.log('No existing data.json file found. Starting with empty database.');
            return false;
        }
        return true;
    }

    // Read existing JSON data
    readJsonData() {
        try {
            const data = fs.readFileSync(this.jsonDataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading JSON data:', error);
            return { tickets: [], assets: [] };
        }
    }

    // Backup existing JSON data
    backupJsonData() {
        try {
            const backupPath = path.join(__dirname, '..', 'data_backup.json');
            fs.copyFileSync(this.jsonDataPath, backupPath);
            console.log(`JSON data backed up to: ${backupPath}`);
        } catch (error) {
            console.error('Error backing up JSON data:', error);
        }
    }

    // Migrate users from tickets data
    migrateUsers(tickets) {
        console.log('Migrating users...');
        
        const userEmails = new Set();
        const users = [];

        // Extract unique users from tickets
        tickets.forEach(ticket => {
            if (ticket.email && !userEmails.has(ticket.email)) {
                userEmails.add(ticket.email);
                users.push({
                    email: ticket.email,
                    name: ticket.requester || 'Unknown User',
                    role: 'user',
                    department: null
                });
            }
        });

        // Insert users into database
        const insertUser = this.db.prepare(`
            INSERT OR IGNORE INTO users (email, name, role, department) 
            VALUES (?, ?, ?, ?)
        `);

        users.forEach(user => {
            insertUser.run(user.email, user.name, user.role, user.department);
        });

        console.log(`Migrated ${users.length} users`);
        return users;
    }

    // Migrate tickets
    migrateTickets(tickets) {
        console.log('Migrating tickets...');
        
        const insertTicket = this.db.prepare(`
            INSERT INTO tickets (
                ticket_id, subject, description, requester_id, 
                category_id, priority_id, status_id, email, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertTimeline = this.db.prepare(`
            INSERT INTO ticket_timeline (
                ticket_id, author, author_type, content, entry_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        let migratedCount = 0;

        tickets.forEach(ticket => {
            try {
                // Get requester ID
                const requester = this.db.prepare('SELECT id FROM users WHERE email = ?').get(ticket.email);
                if (!requester) {
                    console.warn(`Skipping ticket ${ticket.id}: User not found for email ${ticket.email}`);
                    return;
                }

                // Get category ID
                const category = this.db.prepare('SELECT id FROM ticket_categories WHERE name = ?').get(ticket.category || 'other');
                const categoryId = category ? category.id : 6; // Default to 'other'

                // Get priority ID
                const priority = this.db.prepare('SELECT id FROM ticket_priorities WHERE name = ?').get(ticket.priority || 'medium');
                const priorityId = priority ? priority.id : 2; // Default to 'medium'

                // Get status ID
                const status = this.db.prepare('SELECT id FROM ticket_statuses WHERE name = ?').get(ticket.status || 'open');
                const statusId = status ? status.id : 1; // Default to 'open'

                // Insert ticket
                const result = insertTicket.run(
                    ticket.id,
                    ticket.subject || 'No Subject',
                    ticket.description || '',
                    requester.id,
                    categoryId,
                    priorityId,
                    statusId,
                    ticket.email,
                    ticket.createdDate || new Date().toISOString(),
                    ticket.lastUpdated || new Date().toISOString()
                );

                const ticketDbId = result.lastInsertRowid;

                // Migrate timeline entries
                if (ticket.timeline && Array.isArray(ticket.timeline)) {
                    ticket.timeline.forEach(entry => {
                        insertTimeline.run(
                            ticketDbId,
                            entry.author || 'System',
                            entry.authorType || 'system',
                            entry.content || '',
                            entry.type || 'note',
                            entry.date || new Date().toISOString()
                        );
                    });
                }

                migratedCount++;
            } catch (error) {
                console.error(`Error migrating ticket ${ticket.id}:`, error);
            }
        });

        console.log(`Migrated ${migratedCount} tickets`);
        return migratedCount;
    }

    // Migrate assets
    migrateAssets(assets) {
        console.log('Migrating assets...');
        
        const insertAsset = this.db.prepare(`
            INSERT INTO assets (
                asset_no, asset_tag, type_id, brand, model, 
                serial_number, imei, hostname, current_user_id, 
                department, status_id, purchase_date, warranty_end_date, comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let migratedCount = 0;

        assets.forEach(asset => {
            try {
                // Get type ID
                const type = this.db.prepare('SELECT id FROM asset_types WHERE name = ?').get(asset.type || 'other');
                const typeId = type ? type.id : 8; // Default to 'other'

                // Get status ID
                const status = this.db.prepare('SELECT id FROM asset_statuses WHERE name = ?').get(asset.status || 'active');
                const statusId = status ? status.id : 1; // Default to 'active'

                // Get current user ID if email is provided
                let currentUserId = null;
                if (asset.email) {
                    const user = this.db.prepare('SELECT id FROM users WHERE email = ?').get(asset.email);
                    currentUserId = user ? user.id : null;
                }

                // Insert asset
                insertAsset.run(
                    asset.assetNo || `ASSET-${Date.now()}`,
                    asset.assetTag || '',
                    typeId,
                    asset.brand || '',
                    asset.model || '',
                    asset.serial || '',
                    asset.imei || '',
                    asset.hostname || '',
                    currentUserId,
                    asset.department || '',
                    statusId,
                    asset.purchase || asset.date || null,
                    asset.warrantyEndDate || asset.warranty || null,
                    asset.comment || ''
                );

                migratedCount++;
            } catch (error) {
                console.error(`Error migrating asset ${asset.assetNo}:`, error);
            }
        });

        console.log(`Migrated ${migratedCount} assets`);
        return migratedCount;
    }

    // Run complete migration
    async runMigration() {
        console.log('Starting data migration from JSON to SQLite...');
        
        try {
            // Initialize database schema
            dbManager.initSchema();
            
            // Check if JSON data exists
            if (!this.checkJsonData()) {
                console.log('Migration completed: No existing data to migrate');
                return;
            }

            // Backup existing data
            this.backupJsonData();

            // Read JSON data
            const jsonData = this.readJsonData();
            
            // Start transaction
            this.db.prepare('BEGIN TRANSACTION').run();

            // Migrate data
            const users = this.migrateUsers(jsonData.tickets || []);
            const ticketsMigrated = this.migrateTickets(jsonData.tickets || []);
            const assetsMigrated = this.migrateAssets(jsonData.assets || []);

            // Commit transaction
            this.db.prepare('COMMIT').run();

            console.log('\n=== Migration Summary ===');
            console.log(`Users migrated: ${users.length}`);
            console.log(`Tickets migrated: ${ticketsMigrated}`);
            console.log(`Assets migrated: ${assetsMigrated}`);
            console.log('Migration completed successfully!');

            // Show database stats
            const stats = dbManager.getStats();
            console.log('\n=== Database Statistics ===');
            console.log(`Total tickets: ${stats.tickets}`);
            console.log(`Total assets: ${stats.assets}`);
            console.log(`Total users: ${stats.users}`);

        } catch (error) {
            // Rollback transaction on error
            this.db.prepare('ROLLBACK').run();
            console.error('Migration failed:', error);
            throw error;
        }
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    const migration = new DataMigration();
    migration.runMigration()
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = DataMigration; 