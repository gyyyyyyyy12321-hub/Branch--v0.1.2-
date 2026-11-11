'use strict';

const fs = require('node:fs');
const path = require('node:path');
const PasswordHasher = require('../utils/PasswordHasher');
const { ROLES, ACCOUNT_STATUS, CREDENTIAL_STATUS } = require('../constants');

// ─── Edit these to change how much data is generated ────────────────────────
const COUNTS = {
    customers: 700,
    designers: 520,
    projects: 1800,
    favourites: 4500,
    enquiries: 1200,
    siteVisits: 8000,
    // Real platforms have a few dozen categories, and a 500-item filter is unusable, so the default is small.
    // To have 500+ category rows too, run:  BULK_CATEGORIES=500 npm run seed:bulk
    categories: Number(process.env.BULK_CATEGORIES) || 30
};

// Every timestamp falls between these two moments, in Singapore time (UTC+8).
// The database stores UTC, so 1 Oct 00:00 SGT is 30 Sep 16:00 UTC.
const WINDOW_START = Date.UTC(2026, 8, 30, 16, 0, 0);   // 2026-10-01 00:00 SGT
const WINDOW_END = Date.UTC(2026, 10, 16, 15, 59, 59);  // 2026-11-16 23:59 SGT
const SPAN = WINDOW_END - WINDOW_START;

const SEED_PASSWORD = 'Password123!';

const STYLES = [
    'Scandinavian', 'Modern', 'Japandi', 'Industrial', 'Minimalist', 'Contemporary', 'Mid-Century', 'Rustic',
    'Bohemian', 'Coastal', 'Art Deco', 'Traditional', 'Tropical', 'Wabi-Sabi', 'Luxe', 'Farmhouse',
    'Mediterranean', 'Eclectic', 'Transitional', 'Urban', 'Peranakan', 'Zen', 'Biophilic', 'Retro',
    'Colonial', 'Maximalist', 'Nordic', 'Parisian', 'Resort', 'Classic'
];
const ROOMS = [
    'Living Room', 'Kitchen', 'Bedroom', 'Home Office', 'Dining Area', 'Bathroom', 'Study Nook', 'Balcony',
    'Walk-in Wardrobe', 'Entryway', 'Kids Room', 'Studio Apartment', 'Master Suite', 'Family Home', 'Loft', 'Pantry', 'Play Room'
];
const HOME_TYPES = ['3-room flat', '4-room flat', '5-room flat', 'condominium', 'landed house', 'studio apartment', 'executive maisonette', 'shophouse'];
const DISTRICTS = [
    'Sengkang', 'Tampines', 'Bishan', 'Punggol', 'Jurong East', 'Woodlands', 'Clementi', 'Bedok', 'Toa Payoh', 'Queenstown',
    'Yishun', 'Hougang', 'Pasir Ris', 'Bukit Timah', 'Serangoon', 'Ang Mo Kio', 'Bukit Batok', 'Choa Chu Kang', 'Geylang', 'Marine Parade'
];
const FIRST_NAMES = [
    'Alicia', 'Priya', 'Daniel', 'Mei', 'Hakim', 'Marcus', 'Olivia', 'Wei Jie', 'Siti', 'Arjun', 'Hui Min', 'Farah', 'Kumar', 'Jia Hao', 'Nurul',
    'Ethan', 'Sophie', 'Ravi', 'Li Ting', 'Amir', 'Grace', 'Benjamin', 'Shu Fen', 'Irfan', 'Deepa', 'Kai Xin', 'Zul', 'Rachel', 'Jun Kai', 'Aisha',
    'Nathan', 'Pei Shan', 'Vikram', 'Lydia', 'Haikal', 'Chloe', 'Ming Yuan', 'Sarah', 'Dinesh', 'Yi Ling', 'Syafiq', 'Natalie', 'Zhi Hao', 'Anjali', 'Isaac',
    'Mei Ling', 'Faizal', 'Jasmine', 'Darren', 'Kavitha'
];
const LAST_NAMES = [
    'Tan', 'Lim', 'Lee', 'Ng', 'Wong', 'Chen', 'Goh', 'Teo', 'Koh', 'Chua', 'Ong', 'Yeo', 'Sim', 'Chew', 'Ho', 'Low', 'Tay', 'Foo', 'Ang', 'Lau',
    'Nair', 'Kumar', 'Singh', 'Pillai', 'Rajan', 'Menon', 'Yusof', 'Rahman', 'Ismail', 'Hassan', 'Abdullah', 'Salleh', 'Ahmad', 'Osman', 'Zainal',
    'Tan', 'Wee', 'Quek', 'Seah', 'Toh'
];
const COMPANY_PREFIXES = [
    'Haven', 'Form', 'Atelier', 'Studio', 'Nova', 'Oak', 'Willow', 'Slate', 'Linen', 'Ember', 'Harbour', 'Maple', 'Cedar', 'Ivory', 'Indigo',
    'Terra', 'Lumen', 'Fern', 'Alder', 'Birch', 'Copper', 'Dune', 'Echo', 'Flint', 'Grove', 'Hazel', 'Iris', 'Juniper', 'Kite', 'Lotus',
    'Moss', 'Nest', 'Olive', 'Pebble', 'Quill', 'Reed', 'Sage', 'Tide', 'Umber', 'Vale'
];
const COMPANY_SUFFIXES = ['Studio', 'Interiors', 'Design', '& Co', 'Atelier', 'Collective', 'Works', 'Habitat', 'Spaces', 'Living', 'Concepts', 'Lab'];
const SERVICES = [
    'Residential interior design', 'Renovation planning', 'Kitchen design', 'Bedroom fit-outs', 'Custom carpentry', 'Space planning',
    'Lighting design', 'Furniture selection', 'Project management', 'Loft conversions', 'Home offices', 'Reading nooks', 'Built-in storage', 'Colour consultation'
];
const FEATURES = [
    'Light wood finishes and functional storage', 'Warm natural tones and layered lighting', 'Concealed cabinetry with clean lines',
    'Honest materials and a calm colour palette', 'Flexible zones for work, rest and family time', 'Custom joinery sized to the room',
    'A clear flow between living and dining areas', 'Durable finishes chosen for daily family use', 'Soft textures against raw concrete and metal',
    'Smart storage that keeps surfaces clear', 'Plenty of natural light and greenery', 'Statement lighting over a restrained base'
];
const BUDGETS = ['$10,000-$20,000', '$20,000-$30,000', '$30,000-$45,000', '$45,000-$60,000', '$60,000-$90,000', '$90,000-$150,000', 'Below $10,000', 'Flexible'];
const MONTHS = ['December', 'January', 'February', 'March', 'April', 'June'];
const NEEDS = [
    'more storage and a breakfast counter', 'a brighter, more open living area', 'a quiet home office for two people',
    'child-friendly finishes that are easy to clean', 'built-in wardrobes and a better bedroom layout', 'a full renovation before we move in',
    'a refresh of the kitchen and bathrooms only', 'a layout that works for elderly parents', 'a pet-friendly living space'
];

// The accounts named in the README, so the usual logins still work after bulk seeding.
const DEMO_STAFF = [
    { email: 'admin@example.com', role: ROLES.USER_ADMIN, name: 'Admin User' },
    { email: 'ops@example.com', role: ROLES.PLATFORM_MANAGEMENT, name: 'Platform Operator' },
    { email: 'admin2@example.com', role: ROLES.USER_ADMIN, name: 'Hui Ling Admin' },
    { email: 'ops2@example.com', role: ROLES.PLATFORM_MANAGEMENT, name: 'Jonathan Operations' }
];
const DEMO_CUSTOMERS = [
    ['alicia@example.com', 'Alicia Tan', ACCOUNT_STATUS.ACTIVE], ['priya@example.com', 'Priya Nair', ACCOUNT_STATUS.ACTIVE],
    ['daniel@example.com', 'Daniel Wong', ACCOUNT_STATUS.ACTIVE], ['mei@example.com', 'Mei Chen', ACCOUNT_STATUS.ACTIVE],
    ['hakim@example.com', 'Hakim Yusof', ACCOUNT_STATUS.ACTIVE], ['marcus@example.com', 'Marcus Lim', ACCOUNT_STATUS.SUSPENDED],
    ['olivia@example.com', 'Olivia Ng', ACCOUNT_STATUS.DEACTIVATED]
];
const DEMO_DESIGNERS = [
    ['contact@haven.example', 'Haven Studio', ACCOUNT_STATUS.ACTIVE], ['hello@formspace.example', 'Form & Space', ACCOUNT_STATUS.ACTIVE],
    ['contact@atelier.example', 'Atelier North', ACCOUNT_STATUS.ACTIVE], ['studio@arc.example', 'Studio Arc', ACCOUNT_STATUS.ACTIVE],
    ['hello@nova.example', 'Nova Interiors', ACCOUNT_STATUS.PENDING]
];

/** Small repeatable random generator (mulberry32) so the same seed always gives the same data. */
function makeRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fills an empty database with a large, realistic data set (500+ rows in every table except categories, see COUNTS).
 * Usage: npm run seed:bulk (wipes the database file first, like npm run seed).
 */
class BulkSeeder {
    constructor({ db, config = null, imageStorage = null, counts = COUNTS }) {
        this.db = db;
        this.config = config;
        this.imageStorage = imageStorage;
        this.counts = counts;
        this.random = makeRandom(20261001);
    }

    // ----- random helpers -----
    int(min, max) { return min + Math.floor(this.random() * (max - min + 1)); }
    pick(list) { return list[Math.floor(this.random() * list.length)]; }
    chance(p) { return this.random() < p; }
    /** A moment between lo and hi (inclusive range in ms since epoch). */
    between(lo, hi) { return lo >= hi ? lo : lo + Math.floor(this.random() * (hi - lo + 1)); }
    static fmt(ms) { return new Date(Math.min(ms, WINDOW_END)).toISOString().slice(0, 19).replace('T', ' '); }
    /** Index into a list of weights, picked proportionally. */
    weighted(weights, total) {
        let r = this.random() * total;
        for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
        return weights.length - 1;
    }
    phone(prefix) { return `+65 ${prefix}${this.int(100, 999)} ${this.int(1000, 9999)}`; }

    run() {
        const passwordHash = PasswordHasher.hash(SEED_PASSWORD); // one hash reused: every seeded account shares the password
        this.db.transaction(() => {
            const categories = this.#categories();
            const users = this.#users(passwordHash);
            this.#credentials(users);
            const projects = this.#projects(users, categories);
            this.#favourites(users, projects);
            this.#enquiries(users, projects);
            this.#siteVisits();
            this.#coverImages();
        });
    }

    #categories() {
        const list = [];
        const n = this.counts.categories;
        if (n <= STYLES.length) {
            STYLES.slice(0, n).forEach(s => list.push({ name: s, style: s, room: null }));
        } else {
            outer: for (const room of ROOMS) {
                for (const style of STYLES) {
                    list.push({ name: `${style} ${room}`, style, room });
                    if (list.length >= n) break outer;
                }
            }
        }
        for (const c of list) c.id = this.db.run('INSERT INTO categories (name) VALUES (?)', [c.name]).lastInsertRowid;
        return list;
    }

    #users(passwordHash) {
        const users = [];
        const usedEmails = new Set();
        const usedCompanies = new Set();
        let serial = 0;
        const add = u => {
            u.createdMs = u.createdMs ?? this.between(WINDOW_START, WINDOW_START + SPAN * 0.7);
            const updatedMs = this.chance(0.15) ? this.between(u.createdMs, WINDOW_END) : u.createdMs;
            u.id = this.db.run(
                'INSERT INTO users (email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [u.email, passwordHash, u.role, u.status, BulkSeeder.fmt(u.createdMs), BulkSeeder.fmt(updatedMs)]
            ).lastInsertRowid;
            this.db.run(
                'INSERT INTO profiles (user_id, name, phone, description, location, services) VALUES (?, ?, ?, ?, ?, ?)',
                [u.id, u.name, u.phone, u.description ?? null, u.location ?? null, u.services ?? null]
            );
            usedEmails.add(u.email);
            users.push(u);
        };
        const status = (activeP, suspendedP, deactivatedP) => {
            const r = this.random();
            if (r < activeP) return ACCOUNT_STATUS.ACTIVE;
            if (r < activeP + suspendedP) return ACCOUNT_STATUS.SUSPENDED;
            if (r < activeP + suspendedP + deactivatedP) return ACCOUNT_STATUS.DEACTIVATED;
            return ACCOUNT_STATUS.PENDING;
        };
        const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

        // Staff and the README's named accounts come first and are created early in the window.
        DEMO_STAFF.forEach(s => add({ ...s, status: ACCOUNT_STATUS.ACTIVE, phone: this.phone('6'), createdMs: WINDOW_START + this.int(0, 3600000 * 6) }));
        DEMO_CUSTOMERS.forEach(([email, name, st]) => add({
            email, name, role: ROLES.CUSTOMER, status: st, phone: this.phone('9'), createdMs: this.between(WINDOW_START, WINDOW_START + SPAN * 0.1)
        }));
        DEMO_DESIGNERS.forEach(([email, name, st]) => {
            usedCompanies.add(name);
            add({
                email, name, role: ROLES.DESIGNER, status: st, phone: this.phone('6'), location: 'Singapore',
                description: 'Interior design and renovation for contemporary homes.', services: 'Residential interior design, renovation planning',
                createdMs: this.between(WINDOW_START, WINDOW_START + SPAN * 0.1)
            });
        });

        const nCustomers = this.counts.customers - DEMO_CUSTOMERS.length;
        for (let i = 0; i < nCustomers; i++) {
            const first = this.pick(FIRST_NAMES), last = this.pick(LAST_NAMES);
            serial += 1;
            add({
                email: `${slug(first)}.${slug(last)}${serial}@example.com`, name: `${first} ${last}`, role: ROLES.CUSTOMER,
                status: status(0.9, 0.04, 0.04), phone: this.phone(this.pick(['8', '9'])),
                location: this.chance(0.6) ? this.pick(DISTRICTS) : null,
                createdMs: this.between(WINDOW_START, WINDOW_START + SPAN * 0.9)
            });
        }

        const nDesigners = this.counts.designers - DEMO_DESIGNERS.length;
        for (let i = 0; i < nDesigners; i++) {
            let name = `${this.pick(COMPANY_PREFIXES)} ${this.pick(COMPANY_SUFFIXES)}`;
            if (usedCompanies.has(name)) name = `${name} ${this.pick(DISTRICTS)}`;
            if (usedCompanies.has(name)) name = `${name} ${i + 1}`;
            usedCompanies.add(name);
            serial += 1;
            const services = [...new Set([this.pick(SERVICES), this.pick(SERVICES), this.pick(SERVICES)])].join(', ');
            const style = this.pick(STYLES);
            add({
                email: `contact${serial}@${slug(name)}.example`, name, role: ROLES.DESIGNER, status: status(0.84, 0.03, 0.04),
                phone: this.phone('6'), location: 'Singapore', services,
                description: `${style} and ${this.pick(STYLES).toLowerCase()} interiors for ${this.pick(HOME_TYPES)}s across Singapore.`
            });
        }
        return users;
    }

    #credentials(users) {
        for (const u of users.filter(x => x.role === ROLES.DESIGNER)) {
            const reg = () => `UEN${this.int(2015, 2026)}${String(this.int(0, 99999)).padStart(5, '0')}${String.fromCharCode(65 + this.int(0, 25))}`;
            const submitted = u.createdMs + this.int(60000, 7200000);
            const insert = (company, status, submittedMs, reviewedMs) => this.db.run(
                'INSERT INTO credentials (user_id, company_name, registration_number, status, submitted_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)',
                [u.id, company, reg(), status, BulkSeeder.fmt(submittedMs), reviewedMs === null ? null : BulkSeeder.fmt(reviewedMs)]
            );
            if (u.status === ACCOUNT_STATUS.PENDING) {
                if (this.chance(0.25)) insert(u.name, CREDENTIAL_STATUS.REJECTED, submitted, submitted + this.int(3600000, 3 * 86400000)); // rejected, account stays Pending
                else insert(u.name, CREDENTIAL_STATUS.PENDING, submitted, null);
            } else {
                let firstSubmitted = submitted;
                if (this.chance(0.12)) { // rejected once, then resubmitted and approved
                    const reviewed = submitted + this.int(3600000, 2 * 86400000);
                    insert(u.name, CREDENTIAL_STATUS.REJECTED, submitted, reviewed);
                    firstSubmitted = reviewed + this.int(3600000, 86400000);
                }
                insert(u.name, CREDENTIAL_STATUS.APPROVED, firstSubmitted, firstSubmitted + this.int(3600000, 3 * 86400000));
            }
        }
    }

    #projects(users, categories) {
        const designers = users.filter(u => u.role === ROLES.DESIGNER && u.status === ACCOUNT_STATUS.ACTIVE);
        // Some designers are far busier than others.
        const weights = designers.map(() => Math.pow(this.random(), 2) + 0.05);
        const total = weights.reduce((a, b) => a + b, 0);
        const projects = [];
        for (let i = 0; i < this.counts.projects; i++) {
            const designer = designers[this.weighted(weights, total)];
            const category = this.pick(categories);
            const room = category.room ?? this.pick(ROOMS);
            const style = category.style;
            const district = this.pick(DISTRICTS);
            const title = this.pick([
                `${style} ${room}`, `${room} in ${style}`, `${district} ${this.pick(HOME_TYPES)} ${style} Makeover`,
                `The ${this.pick(['Quiet', 'Bright', 'Warm', 'Calm', 'Open', 'Layered'])} ${room}`, `${style} ${room} Refresh`
            ]).slice(0, 120);
            const description = `A ${style.toLowerCase()} approach to the ${room.toLowerCase()} of a ${this.pick(HOME_TYPES)} in ${district}. ${this.pick(FEATURES)}.`;
            const createdMs = designer.createdMs + Math.floor(Math.pow(this.random(), 1.4) * (WINDOW_END - designer.createdMs));
            const updatedMs = this.chance(0.2) ? this.between(createdMs, WINDOW_END) : createdMs;
            const current = this.chance(0.4);
            const ageShare = (WINDOW_END - createdMs) / SPAN;
            const views = Math.floor(Math.pow(this.random(), 2) * 900 * (0.3 + 0.7 * ageShare));
            const id = this.db.run(
                `INSERT INTO projects (designer_id, category_id, title, description, status, year, image_path, view_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
                [designer.id, category.id, title, description, current ? 'Current' : 'Past',
                    current ? this.pick([2025, 2026, 2026]) : this.int(2019, 2026), views, BulkSeeder.fmt(createdMs), BulkSeeder.fmt(updatedMs)]
            ).lastInsertRowid;
            projects.push({ id, designerId: designer.id, createdMs });
        }
        return projects;
    }

    /** How many items in a list sorted by createdMs already existed at time t. */
    static #existingAt(sorted, t) {
        let lo = 0, hi = sorted.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid].createdMs <= t) lo = mid + 1; else hi = mid; }
        return lo;
    }

    /** A moment in the window, getting slightly busier towards the end (the platform is growing). */
    #growingTime() { return WINDOW_START + Math.floor(Math.pow(this.random(), 0.85) * SPAN); }

    // Time is drawn first, then a customer and a project that already existed at that moment, so no row can pre-date what it refers to.
    #favourites(users, projects) {
        const customers = users.filter(u => u.role === ROLES.CUSTOMER && u.status === ACCOUNT_STATUS.ACTIVE).sort((a, b) => a.createdMs - b.createdMs);
        const byAge = [...projects].sort((a, b) => a.createdMs - b.createdMs);
        const seen = new Set();
        let made = 0, guard = 0;
        while (made < this.counts.favourites && guard++ < this.counts.favourites * 50) {
            const t = this.#growingTime();
            const c = BulkSeeder.#existingAt(customers, t), p = BulkSeeder.#existingAt(byAge, t);
            if (!c || !p) continue;
            const customer = customers[Math.floor(this.random() * c)];
            const project = byAge[Math.floor(Math.pow(this.random(), 2) * p)]; // older projects collect more favourites
            const key = `${customer.id}:${project.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            this.db.run('INSERT INTO favourites (customer_id, project_id, created_at) VALUES (?, ?, ?)', [customer.id, project.id, BulkSeeder.fmt(t)]);
            made += 1;
        }
    }

    #enquiries(users, projects) {
        const customers = users.filter(u => u.role === ROLES.CUSTOMER && u.status === ACCOUNT_STATUS.ACTIVE).sort((a, b) => a.createdMs - b.createdMs);
        const byAge = [...projects].sort((a, b) => a.createdMs - b.createdMs);
        let made = 0, guard = 0;
        while (made < this.counts.enquiries && guard++ < this.counts.enquiries * 50) {
            const t = this.#growingTime();
            const c = BulkSeeder.#existingAt(customers, t), p = BulkSeeder.#existingAt(byAge, t);
            if (!c || !p) continue;
            const customer = customers[Math.floor(this.random() * c)];
            const project = byAge[Math.floor(Math.pow(this.random(), 1.5) * p)];
            const district = this.pick(DISTRICTS);
            this.db.run(
                `INSERT INTO enquiries (customer_id, designer_id, project_id, name, email, location, budget, requirements, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [customer.id, project.designerId, project.id, customer.name, customer.email, district, this.pick(BUDGETS),
                    `Looking to renovate a ${this.pick(HOME_TYPES)} in ${district}. We need ${this.pick(NEEDS)}. Hoping to start in ${this.pick(MONTHS)}.`,
                    BulkSeeder.fmt(t)]
            );
            made += 1;
        }
    }

    /**
     * Gives projects a cover image from /seed-images so that the top of every Explore sort order has pictures.
     * The images (any file names, sorted by name) are split into three equal groups, one per sort order:
     *   group 1 -> the newest projects, group 2 -> the most viewed, group 3 -> the most favourited.
     * Each project gets at most one image and no file is shared, so deleting a project never removes another project's picture.
     * If a project is near the top of two lists it keeps the first image it was given, and the next project down is used for the other list.
     * With fewer images than projects the rest keep a placeholder; extra images beyond the number of projects are ignored.
     */
    #coverImages() {
        if (!this.config || !this.imageStorage || !fs.existsSync(this.config.seedImageDir)) return;
        const files = fs.readdirSync(this.config.seedImageDir)
            .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        if (!files.length) return;

        const base = Math.floor(files.length / 3), extra = files.length % 3; // e.g. 7 images -> groups of 3, 2, 2
        const groups = [0, 1, 2].map(i => base + (i < extra ? 1 : 0));
        const orders = [
            { name: 'newest', sql: 'p.created_at DESC, p.id DESC' },
            { name: 'most viewed', sql: 'p.view_count DESC, p.id DESC' },
            { name: 'most favourited', sql: 'favouriteCount DESC, p.view_count DESC, p.id DESC' }
        ];
        const taken = new Set();
        let next = 0;
        this.imagesByOrder = {};
        orders.forEach((order, i) => {
            // Same ordering the Explore page uses (public projects only: Active designers).
            const ranked = this.db.all(
                `SELECT p.id, (SELECT COUNT(*) FROM favourites f WHERE f.project_id = p.id) AS favouriteCount
                 FROM projects p JOIN users du ON du.id = p.designer_id
                 WHERE du.status = 'Active' ORDER BY ${order.sql}`
            );
            let given = 0;
            for (const { id } of ranked) {
                if (given >= groups[i]) break;
                if (taken.has(id)) continue;
                taken.add(id);
                const file = files[next++];
                const ext = path.extname(file).toLowerCase();
                const publicPath = this.imageStorage.copyIn(path.join(this.config.seedImageDir, file), `seed-project-${id}${ext}`);
                this.db.run('UPDATE projects SET image_path = ? WHERE id = ?', [publicPath, id]);
                given += 1;
            }
            this.imagesByOrder[order.name] = given;
        });
        this.imagesUsed = next;
    }

    /** Visits spread over every day in the window: busier on weekdays, slowly growing, mostly daytime and evening (Singapore time). */
    #siteVisits() {
        const days = Math.ceil(SPAN / 86400000);
        const dayWeights = [];
        for (let d = 0; d < days; d++) {
            const local = new Date(WINDOW_START + d * 86400000 + 8 * 3600000); // Singapore calendar day
            const weekend = [0, 6].includes(local.getUTCDay());
            dayWeights.push((weekend ? 0.7 : 1) * (1 + 0.012 * d) * (0.8 + this.random() * 0.4));
        }
        const dayTotal = dayWeights.reduce((a, b) => a + b, 0);
        const hourWeights = [1, 1, 1, 1, 1, 2, 4, 7, 10, 12, 12, 13, 15, 15, 13, 12, 12, 13, 14, 16, 17, 16, 10, 4];
        const hourTotal = hourWeights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < this.counts.siteVisits; i++) {
            const d = this.weighted(dayWeights, dayTotal);
            const h = this.weighted(hourWeights, hourTotal);
            const ms = WINDOW_START + d * 86400000 + h * 3600000 + this.int(0, 3599) * 1000;
            this.db.run('INSERT INTO site_visits (visited_at) VALUES (?)', [BulkSeeder.fmt(ms)]);
        }
    }
}

BulkSeeder.COUNTS = COUNTS;
BulkSeeder.SEED_PASSWORD = SEED_PASSWORD;
module.exports = BulkSeeder;
