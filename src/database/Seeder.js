'use strict';

const fs = require('node:fs');
const path = require('node:path');
const PasswordHasher = require('../utils/PasswordHasher');
const { ROLES, ACCOUNT_STATUS, CREDENTIAL_STATUS } = require('../constants');

// ─── Edit these to change the sample data ────────────────────────────────────

// Which file in /seed-images each sample project uses as its cover image (project 1 to 8).
// A missing file is fine: that project is seeded with no image and the UI shows a placeholder.
const SEED_IMAGE_FILES = [
    'project-1.jpg', 'project-2.jpg', 'project-3.jpg', 'project-4.jpg',
    'project-5.jpg', 'project-6.jpg', 'project-7.jpg', 'project-8.jpg'
];

// Every seeded account uses this password (documented in the README).
const SEED_PASSWORD = 'Password123!';

const CATEGORIES = ['Scandinavian', 'Modern', 'Japandi', 'Industrial', 'Minimalist'];

const USERS = [
    { email: 'admin@example.com', role: ROLES.USER_ADMIN, status: ACCOUNT_STATUS.ACTIVE, name: 'Admin User', phone: '+65 6000 0001' },
    { email: 'ops@example.com', role: ROLES.PLATFORM_MANAGEMENT, status: ACCOUNT_STATUS.ACTIVE, name: 'Platform Operator', phone: '+65 6000 0002' },

    { email: 'alicia@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.ACTIVE, name: 'Alicia Tan', phone: '+65 9000 0001' },
    { email: 'priya@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.ACTIVE, name: 'Priya Nair', phone: '+65 9000 0002' },
    { email: 'daniel@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.ACTIVE, name: 'Daniel Wong', phone: '+65 9000 0003' },
    { email: 'mei@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.ACTIVE, name: 'Mei Chen', phone: '+65 9000 0004' },
    { email: 'hakim@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.ACTIVE, name: 'Hakim Yusof', phone: '+65 9000 0005' },
    { email: 'marcus@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.SUSPENDED, name: 'Marcus Lim', phone: '+65 9000 0006' },
    { email: 'olivia@example.com', role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.DEACTIVATED, name: 'Olivia Ng', phone: '+65 9000 0007' },

    {
        email: 'contact@haven.example', role: ROLES.DESIGNER, status: ACCOUNT_STATUS.ACTIVE, name: 'Haven Studio', phone: '+65 6000 0000',
        description: 'Interior design and renovation for contemporary homes.', location: 'Singapore',
        services: 'Residential interior design, renovation planning', credential: { reg: 'UEN201900001A', status: CREDENTIAL_STATUS.APPROVED }
    },
    {
        email: 'hello@formspace.example', role: ROLES.DESIGNER, status: ACCOUNT_STATUS.ACTIVE, name: 'Form & Space', phone: '+65 6000 0010',
        description: 'Practical, space-smart interiors for kitchens and bedrooms.', location: 'Singapore',
        services: 'Kitchen design, bedroom fit-outs, carpentry', credential: { reg: 'UEN201800002B', status: CREDENTIAL_STATUS.APPROVED }
    },
    {
        email: 'contact@atelier.example', role: ROLES.DESIGNER, status: ACCOUNT_STATUS.ACTIVE, name: 'Atelier North', phone: '+65 6000 0020',
        description: 'Industrial and modern spaces with honest materials.', location: 'Singapore',
        services: 'Loft conversions, compact apartment design', credential: { reg: 'UEN202000003C', status: CREDENTIAL_STATUS.APPROVED }
    },
    {
        email: 'studio@arc.example', role: ROLES.DESIGNER, status: ACCOUNT_STATUS.ACTIVE, name: 'Studio Arc', phone: '+65 6000 0030',
        description: 'Warm, natural interiors with custom joinery.', location: 'Singapore',
        services: 'Custom shelving, home offices, reading nooks', credential: { reg: 'UEN201700004D', status: CREDENTIAL_STATUS.APPROVED }
    },
    {
        // Pending designer: lets the User Admin try the approval flow (story 4).
        email: 'hello@nova.example', role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING, name: 'Nova Interiors', phone: '+65 6000 0040',
        description: 'New studio focused on small-space living.', location: 'Singapore',
        services: 'Small-space design', credential: { reg: 'UEN202300005E', status: CREDENTIAL_STATUS.PENDING }
    }
];

const PROJECTS = [
    { title: 'Scandinavian Living Room', designer: 'contact@haven.example', category: 'Scandinavian', status: 'Past', views: 342, year: 2025, description: 'Light wood finishes and functional storage for a compact apartment.' },
    { title: 'Modern Kitchen Makeover', designer: 'hello@formspace.example', category: 'Modern', status: 'Past', views: 584, year: 2026, description: 'Contemporary kitchen with practical work zones and concealed cabinets.' },
    { title: 'Japandi Family Home', designer: 'contact@haven.example', category: 'Japandi', status: 'Current', views: 261, year: 2026, description: 'Natural tones and an uncluttered layout for a family home.' },
    { title: 'Industrial Loft Concept', designer: 'contact@atelier.example', category: 'Industrial', status: 'Past', views: 418, year: 2024, description: 'Warm concrete texture, raw metal and flexible living spaces.' },
    { title: 'Minimalist Bedroom', designer: 'hello@formspace.example', category: 'Minimalist', status: 'Current', views: 187, year: 2026, description: 'Built-in cabinetry and calm neutral finishes.' },
    { title: 'Modern Compact Apartment', designer: 'contact@atelier.example', category: 'Modern', status: 'Past', views: 469, year: 2025, description: 'Smart storage design for a small-city residence.' },
    { title: 'Japandi Reading Nook', designer: 'studio@arc.example', category: 'Japandi', status: 'Current', views: 151, year: 2026, description: 'Custom wooden shelving and natural lighting.' },
    { title: 'Industrial Home Office', designer: 'studio@arc.example', category: 'Industrial', status: 'Past', views: 224, year: 2025, description: 'Durable materials and ergonomic layout for remote work.' }
];

// Customers who favourite each project (by project number, 1-based) so shortlist counts look real.
const FAVOURITES = {
    1: ['alicia@example.com', 'priya@example.com', 'daniel@example.com'],
    2: ['alicia@example.com', 'priya@example.com', 'mei@example.com', 'hakim@example.com', 'daniel@example.com'],
    3: ['mei@example.com', 'hakim@example.com'],
    4: ['alicia@example.com', 'daniel@example.com', 'hakim@example.com', 'mei@example.com'],
    5: ['priya@example.com'],
    6: ['daniel@example.com', 'mei@example.com', 'priya@example.com'],
    7: ['hakim@example.com'],
    8: ['alicia@example.com', 'daniel@example.com']
};

const ENQUIRIES = [
    {
        customer: 'alicia@example.com', project: 1, location: 'Sengkang', budget: '$35,000-$50,000',
        requirements: 'Looking to redo a 4-room flat in a Scandinavian style. Hoping to start in January.'
    },
    {
        customer: 'priya@example.com', project: 2, location: 'Tampines', budget: '$20,000-$30,000',
        requirements: 'Need a kitchen renovation with more storage and a breakfast counter.'
    }
];

// ─────────────────────────────────────────────────────────────────────────────

/** Fills an empty database with sample data. Safe to call on every start. */
class Seeder {
    constructor({ db, config, imageStorage }) {
        this.db = db;
        this.config = config;
        this.imageStorage = imageStorage;
    }

    /** Seeds only when there are no users yet. Returns true if it seeded. */
    seedIfEmpty() {
        if (this.db.get('SELECT COUNT(*) AS n FROM users').n > 0) return false;
        this.run();
        return true;
    }

    run() {
        const passwordHash = PasswordHasher.hash(SEED_PASSWORD);
        this.db.transaction(() => {
            const categoryIds = this.#seedCategories();
            const userIds = this.#seedUsers(passwordHash);
            const projectIds = this.#seedProjects(userIds, categoryIds);
            this.#seedFavourites(userIds, projectIds);
            this.#seedEnquiries(userIds, projectIds);
            this.#seedSiteVisits();
        });
    }

    #seedCategories() {
        const ids = {};
        for (const name of CATEGORIES) {
            ids[name] = this.db.run('INSERT INTO categories (name) VALUES (?)', [name]).lastInsertRowid;
        }
        return ids;
    }

    #seedUsers(passwordHash) {
        const ids = {};
        USERS.forEach((u, i) => {
            const createdAt = Seeder.#timestamp(120 - i * 5);
            const id = this.db.run(
                'INSERT INTO users (email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [u.email, passwordHash, u.role, u.status, createdAt, createdAt]
            ).lastInsertRowid;
            ids[u.email] = id;

            this.db.run(
                'INSERT INTO profiles (user_id, name, phone, description, location, services) VALUES (?, ?, ?, ?, ?, ?)',
                [id, u.name, u.phone, u.description ?? null, u.location ?? null, u.services ?? null]
            );

            if (u.credential) {
                const reviewed = u.credential.status === CREDENTIAL_STATUS.PENDING ? null : Seeder.#timestamp(100 - i * 5);
                this.db.run(
                    'INSERT INTO credentials (user_id, company_name, registration_number, status, submitted_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, u.name, u.credential.reg, u.credential.status, createdAt, reviewed]
                );
            }
        });
        return ids;
    }

    #seedProjects(userIds, categoryIds) {
        return PROJECTS.map((p, index) => {
            const createdAt = Seeder.#timestamp(90 - index * 9);
            return this.db.run(
                `INSERT INTO projects
                    (designer_id, category_id, title, description, status, year, image_path, view_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userIds[p.designer], categoryIds[p.category], p.title, p.description, p.status, p.year,
                    this.#seedImage(index), p.views, createdAt, createdAt]
            ).lastInsertRowid;
        });
    }

    /** Copies the matching seed image into uploads/ and returns its public path, or null if absent. */
    #seedImage(index) {
        const wanted = SEED_IMAGE_FILES[index];
        if (!wanted) return null;
        const stem = path.parse(wanted).name;
        const extensions = [...new Set([path.extname(wanted), '.jpg', '.jpeg', '.png', '.webp'])];
        for (const ext of extensions) {
            const source = path.join(this.config.seedImageDir, stem + ext);
            if (fs.existsSync(source)) {
                return this.imageStorage.copyIn(source, `seed-project-${index + 1}${ext.toLowerCase()}`);
            }
        }
        return null;
    }

    #seedFavourites(userIds, projectIds) {
        for (const [number, emails] of Object.entries(FAVOURITES)) {
            for (const email of emails) {
                this.db.run(
                    'INSERT OR IGNORE INTO favourites (customer_id, project_id, created_at) VALUES (?, ?, ?)',
                    [userIds[email], projectIds[Number(number) - 1], Seeder.#timestamp(Number(number) * 3)]
                );
            }
        }
    }

    #seedEnquiries(userIds, projectIds) {
        for (const e of ENQUIRIES) {
            const project = PROJECTS[e.project - 1];
            const profile = USERS.find(u => u.email === e.customer);
            this.db.run(
                `INSERT INTO enquiries (customer_id, designer_id, project_id, name, email, location, budget, requirements, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userIds[e.customer], userIds[project.designer], projectIds[e.project - 1], profile.name, e.customer,
                    e.location, e.budget, e.requirements, Seeder.#timestamp(e.project)]
            );
        }
    }

    /** About 30 days of visits with a repeatable pseudo-random spread, so reports have data. */
    #seedSiteVisits() {
        let state = 12345;
        const random = () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
        for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
            const visits = 8 + Math.floor(random() * 30);
            for (let i = 0; i < visits; i++) {
                const when = new Date(Date.now() - daysAgo * 86400000 - Math.floor(random() * 86400000));
                this.db.run('INSERT INTO site_visits (visited_at) VALUES (?)', [Seeder.#format(when)]);
            }
        }
    }

    static #timestamp(daysAgo) {
        return Seeder.#format(new Date(Date.now() - daysAgo * 86400000));
    }

    static #format(date) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }
}

Seeder.SEED_PASSWORD = SEED_PASSWORD;

module.exports = Seeder;
