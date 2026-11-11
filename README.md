# Interior Design Matching Platform

CSIT314 project. Node.js + Express backend, SQLite database (no database server to set up), structured with the BCE pattern.

## Run it

Requires Node 22.5 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 and check http://localhost:3000/api/health.

On first start the app creates the database (`data/app.db`) and fills it with sample data. To reset to fresh sample data at any time:

```bash
npm run seed
```

## Seeded accounts

Every seeded account uses the password **`Password123!`**

### Large data set (500+ rows per table)

```
npm run seed:bulk
```

Wipes the database file and loads 1,224 users (with profiles), 574 credentials, 30 categories, 1,800 projects, 4,500 favourites, 1,200 enquiries and 8,000 site visits. Every timestamp falls between 1 October and 16 November 2026 (Singapore time), and no row pre-dates the rows it refers to. The usual demo logins (`admin@example.com` and so on) still exist. Cover images: any `.jpg`, `.jpeg`, `.png` or `.webp` files in `seed-images/` are used, with any file names, sorted by name (so `IMG_2` comes before `IMG_10`). They are split into three equal groups: the first group goes to the newest projects, the second to the most viewed, the third to the most favourited, so the top of each Explore sort order has pictures. Each project gets one image and no file is shared. If a project is near the top of two lists it keeps its first image and the next project down gets the other. With fewer images than projects the rest show placeholders, and extra images are ignored. Run it again after adding images. For 500 categories as well, run `BULK_CATEGORIES=500 npm run seed:bulk`. Change the numbers at the top of `src/database/BulkSeeder.js`. Run `npm run seed` to go back to the small demo data.


| Role | Email | Notes |
|---|---|---|
| User Admin | admin@example.com | |
| Platform Management | ops@example.com | |
| Customer | alicia@example.com | has favourites and an enquiry |
| Customer | priya@example.com, daniel@example.com, mei@example.com, hakim@example.com | |
| Customer | marcus@example.com | **Suspended** (try logging in) |
| Customer | olivia@example.com | **Deactivated** (reactivation flow) |
| Interior Designer | contact@haven.example, hello@formspace.example, contact@atelier.example, studio@arc.example | approved, each with projects |
| Interior Designer | hello@nova.example | **Pending** (approval flow) |

## Sample images

Put your images in `seed-images/` named `project-1.jpg` to `project-8.jpg` (`.png` and `.webp` also work). On seeding they are copied into `uploads/` and used as the cover image of the 8 sample projects. A missing file is fine: that project has no image and the page shows a placeholder.

To use different file names, edit `SEED_IMAGE_FILES` at the top of `src/database/Seeder.js`. Run `npm run seed` afterwards.

## Project structure and naming (BCE)

```
database/schema.sql        SQLite schema (8 tables)
src/App.js                 wires entities, middleware, controls and boundaries together
src/entities/              Entity: <Noun>               e.g. User, Project
src/controllers/           Control: <Verb><Noun>Controller   e.g. CreateUserAccountController
src/boundaries/            Boundary: <Noun>Boundary     e.g. HealthBoundary
src/middleware/            <Purpose>Middleware          e.g. AuthMiddleware, RoleMiddleware
src/utils/                 helpers (password hashing, tokens, image files)
public/                    front end
```

Rules:
- One class per file, file named exactly like the class.
- Only Entities run SQL. Controls hold business rules. Boundaries handle HTTP and call Controls.
- A Control has one public method per user story, named after the story (`createUserAccount()`).
- Verbs are fixed: create, view, update, delete, search, suspend, approve. Do not use "get", "add" or "remove" for stories (a favourite is *created* and *deleted*).
- Entities receive the `Database` in the constructor, so tests can pass an in-memory one (`DB_PATH=:memory:`).

## What is built so far

| Step | Stories | Status |
|---|---|---|
| 1. Foundation | database, seed data, base classes, middleware | done |
| 2. Auth and accounts | 1-27, 33-40, 53-54 | done |
| 3. Projects, categories, favourites, enquiries | 28-32, 41-52 | done |
| 4. Dashboards and reports | 55-58 | done (this build) |

All 58 stories now have a screen and an API.

## Statistics and reports (Platform Management)

- **Site visit:** one per browser session (a session cookie), whether or not the visitor logs in. Opening the site in a new browser or after closing the browser counts again.
- **Active customers / designers:** accounts whose status is Active. Suspended, deactivated and pending accounts are not counted.
- **Reports:** daily, weekly (Monday to Sunday) or monthly, for the period containing the chosen date (empty = today). Each shows visits, new customers, new designer companies, new projects, favourites added and enquiries sent, plus a bar graph comparing the six figures and, for weekly and monthly reports, a bar graph of each figure by day, and the current active totals.
- Days are calendar days in the platform timezone, set by `REPORT_UTC_OFFSET_HOURS` (default 8, Singapore). The database stores UTC.
- Demo data: `npm run seed` creates visits spread over recent weeks so the charts have something to show.

## Browsing, images and counts

- **Guests can browse.** Searching, filtering, sorting and viewing project pages need no login. Saving a favourite or sending an enquiry needs a customer login (a guest is sent to the login page and brought back).
- Only projects of **Active** designers are public. Suspended, deactivated and pending designers' projects disappear from the site.
- **Views:** every opening of a project page counts as one view, except when the project's own designer opens it. There is no unique-visitor tracking.
- **Favourite counts** are always counted from the favourites table.
- **Images:** one image per project (JPEG, PNG or WebP, up to 5 MB), saved to `uploads/` under a random name. The file's real type is checked, not just its name. A project without an image (or whose file is missing) shows a striped placeholder. Replacing or removing an image, or deleting a project or account, deletes the old file.
- The three small striped slots under the main image on a project page are placeholders from the wireframe. Hide them by setting `SHOW_GALLERY_PLACEHOLDERS = false` at the top of `public/app.js`.
- Uploaded images are not touched by `npm run seed`, so old uploads can pile up in `uploads/`; delete them by hand if you want a clean folder.

## Account rules

- Sign-up is open to Customers and Interior Designers only. Admin and Platform Management accounts are created by a User Admin (or seeded).
- A designer signs up with a company registration number and starts **Pending**. They can log in to see their verification status and resubmit details, but nothing else, until a User Admin approves them. Rejected credentials can be corrected and resubmitted.
- **Suspended** accounts cannot log in and are locked out immediately, even if already logged in. Only a User Admin can reactivate them.
- **Deactivated** accounts cannot log in, but the owner can reactivate from the login page with their password.
- Deleting an account is permanent and removes its profile, projects (and their image files), favourites and enquiries. Customers and designers confirm with their password.
- A User Admin cannot suspend, deactivate, delete or change the role of their own account.
- Passwords are at least 8 characters. Resetting a password gives the admin a one-time temporary password to pass on.

## API reference

All responses are JSON. Errors look like `{ "error": "message", "code": "OPTIONAL_TAG" }`. The session is an httpOnly cookie set by login.

| Method and path | Who | Story |
|---|---|---|
| `GET /api/health` | anyone | |
| `POST /api/auth/register` | anyone | 17, 33 |
| `POST /api/auth/login` | anyone | 14, 26, 39, 53 |
| `POST /api/auth/logout` | anyone | 15, 27, 40, 54 |
| `POST /api/auth/reactivate` | owner (email + password) | 23, 38 |
| `GET /api/auth/me` | logged in (incl. Pending) | |
| `POST /api/accounts` | admin | 1 |
| `GET /api/accounts?query=&role=&status=` | admin | 5 |
| `GET /api/accounts/:id` | self or admin | 2, 18, 34 |
| `PATCH /api/accounts/:id` (email, password) | self or admin | 6, 20, 35 |
| `DELETE /api/accounts/:id` | self (password) or admin | 8, 21, 36 |
| `POST /api/accounts/:id/role` | admin | 3 |
| `POST /api/accounts/:id/suspend` | admin | 7 |
| `POST /api/accounts/:id/deactivate` | self or admin | 9, 22, 37 |
| `POST /api/accounts/:id/reactivate` | admin | 10 |
| `POST /api/accounts/:id/approve`, `/reject` | admin | 4 |
| `POST /api/accounts/:id/reset-password` | admin | 16 |
| `GET /api/profiles?query=` | admin | 11 |
| `GET /api/profiles/:userId` | self or admin | 12, 24 |
| `PATCH /api/profiles/:userId` | self or admin | 13, 25 |
| `GET /api/credentials/me`, `POST /api/credentials` | designer (incl. Pending) | 19 |
| `GET /api/categories?query=` | anyone | 49, 52 |
| `POST /api/categories` | platform | 48 |
| `PATCH /api/categories/:id` | platform | 50 |
| `DELETE /api/categories/:id` (refused if projects use it) | platform | 51 |
| `GET /api/projects?query=&categoryId=&sort=newest\|views\|favourites` | anyone | 41, 42 |
| `GET /api/projects/:id` (counts a view) | anyone | 43 |
| `POST /api/projects` (multipart, optional `image`) | designer | 28 |
| `PATCH /api/projects/:id` (multipart, `image`, `removeImage`) | owner | 29 |
| `DELETE /api/projects/:id` | owner | 30 |
| `GET /api/portfolio` (own projects with view and favourite counts) | designer | 31, 32 |
| `GET /api/favourites` | customer | 45 |
| `POST /api/favourites/:projectId` | customer | 44 |
| `DELETE /api/favourites/:projectId` | customer | 46 |
| `POST /api/enquiries` | customer | 47 |
| `GET /api/enquiries` (received by me) | designer | |
| `GET /api/statistics/visits` | platform | 55 |
| `GET /api/statistics/active-customers` | platform | 56 |
| `GET /api/statistics/active-designers` | platform | 57 |
| `GET /api/reports?period=daily\|weekly\|monthly&date=YYYY-MM-DD` | platform | 58 |

## Configuration

All optional; see `.env.example`.
