const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'it_support.db');
        this.db = null;
        this.init();
    }

    init() {
        try {
            // Create database directory if it doesn't exist
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Initialize database connection
            this.db = new Database(this.dbPath);
            
            // Enable foreign keys
            this.db.pragma('foreign_keys = ON');
            
            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    // Initialize database schema
    initSchema() {
        try {
            // Try to use enhanced schema first
            let schemaPath = path.join(__dirname, 'schema-enhanced.sql');
            if (!fs.existsSync(schemaPath)) {
                // Fallback to basic schema
                schemaPath = path.join(__dirname, 'schema.sql');
            }
            
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute schema
            this.db.exec(schema);
            console.log(`Database schema initialized successfully using: ${path.basename(schemaPath)}`);
        } catch (error) {
            console.error('Schema initialization error:', error);
            throw error;
        }
    }

    // Get database instance
    getDb() {
        return this.db;
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            console.log('Database connection closed');
        }
    }

    // Backup database
    backup(backupPath) {
        try {
            const backup = new Database(backupPath);
            this.db.backup(backup);
            backup.close();
            console.log(`Database backed up to: ${backupPath}`);
        } catch (error) {
            console.error('Backup error:', error);
            throw error;
        }
    }

    // Get database statistics
    getStats() {
        try {
            const stats = {
                tickets: this.db.prepare('SELECT COUNT(*) as count FROM tickets').get().count,
                assets: this.db.prepare('SELECT COUNT(*) as count FROM assets').get().count,
                users: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count,
                kb_articles: this.db.prepare('SELECT COUNT(*) as count FROM kb_articles').get().count
            };
            return stats;
        } catch (error) {
            console.error('Error getting database stats:', error);
            return null;
        }
    }

    // Health check
    healthCheck() {
        try {
            this.db.prepare('SELECT 1').get();
            return true;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager; 