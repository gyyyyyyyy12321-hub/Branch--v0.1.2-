'use strict';

const express = require('express');
const path = require('node:path');

const Database = require('./database/Database');
const Seeder = require('./database/Seeder');
const ImageStorage = require('./utils/ImageStorage');
const TokenService = require('./utils/TokenService');

const User = require('./entities/User');
const Profile = require('./entities/Profile');
const Credential = require('./entities/Credential');
const Project = require('./entities/Project');
const Category = require('./entities/Category');
const Favourite = require('./entities/Favourite');
const Enquiry = require('./entities/Enquiry');
const SiteVisit = require('./entities/SiteVisit');

const AuthMiddleware = require('./middleware/AuthMiddleware');
const RoleMiddleware = require('./middleware/RoleMiddleware');
const SiteVisitMiddleware = require('./middleware/SiteVisitMiddleware');
const ErrorMiddleware = require('./middleware/ErrorMiddleware');
const UploadMiddleware = require('./middleware/UploadMiddleware');

const ViewHealthController = require('./controllers/ViewHealthController');
const LoginController = require('./controllers/LoginController');
const LogoutController = require('./controllers/LogoutController');
const CreateUserAccountController = require('./controllers/CreateUserAccountController');
const ViewUserAccountController = require('./controllers/ViewUserAccountController');
const UpdateUserAccountController = require('./controllers/UpdateUserAccountController');
const DeleteUserAccountController = require('./controllers/DeleteUserAccountController');
const DeactivateUserAccountController = require('./controllers/DeactivateUserAccountController');
const ReactivateUserAccountController = require('./controllers/ReactivateUserAccountController');
const SuspendUserAccountController = require('./controllers/SuspendUserAccountController');
const AssignUserRoleController = require('./controllers/AssignUserRoleController');
const ApproveUserAccountController = require('./controllers/ApproveUserAccountController');
const RejectUserAccountController = require('./controllers/RejectUserAccountController');
const ResetUserPasswordController = require('./controllers/ResetUserPasswordController');
const SearchUserAccountController = require('./controllers/SearchUserAccountController');
const SearchUserProfileController = require('./controllers/SearchUserProfileController');
const ViewUserProfileController = require('./controllers/ViewUserProfileController');
const UpdateUserProfileController = require('./controllers/UpdateUserProfileController');
const SubmitCredentialsController = require('./controllers/SubmitCredentialsController');
const ViewCredentialsController = require('./controllers/ViewCredentialsController');
const CreateProjectCategoryController = require('./controllers/CreateProjectCategoryController');
const ViewProjectCategoryController = require('./controllers/ViewProjectCategoryController');
const SearchProjectCategoryController = require('./controllers/SearchProjectCategoryController');
const UpdateProjectCategoryController = require('./controllers/UpdateProjectCategoryController');
const DeleteProjectCategoryController = require('./controllers/DeleteProjectCategoryController');
const CreateProjectController = require('./controllers/CreateProjectController');
const UpdateProjectController = require('./controllers/UpdateProjectController');
const DeleteProjectController = require('./controllers/DeleteProjectController');
const ViewProjectController = require('./controllers/ViewProjectController');
const SearchProjectController = require('./controllers/SearchProjectController');
const ViewPortfolioController = require('./controllers/ViewPortfolioController');
const CreateFavouriteController = require('./controllers/CreateFavouriteController');
const ViewFavouriteController = require('./controllers/ViewFavouriteController');
const DeleteFavouriteController = require('./controllers/DeleteFavouriteController');
const CreateEnquiryController = require('./controllers/CreateEnquiryController');
const ViewEnquiryController = require('./controllers/ViewEnquiryController');

const HealthBoundary = require('./boundaries/HealthBoundary');
const AuthBoundary = require('./boundaries/AuthBoundary');
const AccountBoundary = require('./boundaries/AccountBoundary');
const ProfileBoundary = require('./boundaries/ProfileBoundary');
const CredentialBoundary = require('./boundaries/CredentialBoundary');
const CategoryBoundary = require('./boundaries/CategoryBoundary');
const ProjectBoundary = require('./boundaries/ProjectBoundary');
const FavouriteBoundary = require('./boundaries/FavouriteBoundary');
const EnquiryBoundary = require('./boundaries/EnquiryBoundary');
const StatisticsBoundary = require('./boundaries/StatisticsBoundary');
const ViewSiteVisitController = require('./controllers/ViewSiteVisitController');
const ViewActiveCustomerController = require('./controllers/ViewActiveCustomerController');
const ViewActiveDesignerController = require('./controllers/ViewActiveDesignerController');
const CreateReportController = require('./controllers/CreateReportController');

/**
 * Wires everything together: entities, middleware, controls, boundaries and the Express app.
 * Later steps add their entities, controls and boundaries in the marked places.
 */
class App {
    constructor({ config, db, imageStorage }) {
        this.config = config;
        this.db = db;
        this.imageStorage = imageStorage;

        // ── Entities ─────────────────────────────────────────────
        this.userEntity = new User(db);
        this.profileEntity = new Profile(db);
        this.credentialEntity = new Credential(db);
        this.projectEntity = new Project(db);
        this.categoryEntity = new Category(db);
        this.favouriteEntity = new Favourite(db);
        this.enquiryEntity = new Enquiry(db);
        this.siteVisitEntity = new SiteVisit(db);

        // ── Middleware ───────────────────────────────────────────
        this.tokenService = new TokenService(config.jwtSecret);
        this.authMiddleware = new AuthMiddleware({
            userEntity: this.userEntity,
            tokenService: this.tokenService,
            cookieName: config.authCookieName
        });
        this.roleMiddleware = new RoleMiddleware();
        this.siteVisitMiddleware = new SiteVisitMiddleware({
            siteVisitEntity: this.siteVisitEntity,
            cookieName: config.visitCookieName
        });
        this.uploadMiddleware = new UploadMiddleware({
            uploadDir: config.uploadDir,
            maxBytes: config.maxUploadBytes
        });
        this.errorMiddleware = new ErrorMiddleware({ isProduction: config.isProduction });

        // ── Controls ─────────────────────────────────────────────
        const offsetHours = config.reportUtcOffsetHours;
        const { userEntity, profileEntity, credentialEntity, projectEntity, categoryEntity, favouriteEntity, enquiryEntity } = this;
        this.controllers = {
            viewHealth: new ViewHealthController({ userEntity }),
            login: new LoginController({ userEntity, tokenService: this.tokenService, ttlSeconds: config.tokenTtlSeconds }),
            logout: new LogoutController(),
            createUserAccount: new CreateUserAccountController({ db, userEntity, profileEntity, credentialEntity }),
            viewUserAccount: new ViewUserAccountController({ userEntity }),
            updateUserAccount: new UpdateUserAccountController({ userEntity }),
            deleteUserAccount: new DeleteUserAccountController({ userEntity, projectEntity, imageStorage }),
            deactivateUserAccount: new DeactivateUserAccountController({ userEntity }),
            reactivateUserAccount: new ReactivateUserAccountController({ userEntity }),
            suspendUserAccount: new SuspendUserAccountController({ userEntity }),
            assignUserRole: new AssignUserRoleController({ userEntity }),
            approveUserAccount: new ApproveUserAccountController({ db, userEntity, credentialEntity }),
            rejectUserAccount: new RejectUserAccountController({ userEntity, credentialEntity }),
            resetUserPassword: new ResetUserPasswordController({ userEntity }),
            searchUserAccount: new SearchUserAccountController({ userEntity }),
            searchUserProfile: new SearchUserProfileController({ profileEntity }),
            viewUserProfile: new ViewUserProfileController({ profileEntity }),
            updateUserProfile: new UpdateUserProfileController({ profileEntity }),
            submitCredentials: new SubmitCredentialsController({ credentialEntity }),
            viewCredentials: new ViewCredentialsController({ credentialEntity }),
            createProjectCategory: new CreateProjectCategoryController({ categoryEntity }),
            viewProjectCategory: new ViewProjectCategoryController({ categoryEntity }),
            searchProjectCategory: new SearchProjectCategoryController({ categoryEntity }),
            updateProjectCategory: new UpdateProjectCategoryController({ categoryEntity }),
            deleteProjectCategory: new DeleteProjectCategoryController({ categoryEntity }),
            createProject: new CreateProjectController({ projectEntity, categoryEntity, imageStorage }),
            updateProject: new UpdateProjectController({ projectEntity, categoryEntity, imageStorage }),
            deleteProject: new DeleteProjectController({ projectEntity, imageStorage }),
            viewProject: new ViewProjectController({ projectEntity, favouriteEntity }),
            searchProject: new SearchProjectController({ projectEntity, favouriteEntity }),
            viewPortfolio: new ViewPortfolioController({ projectEntity }),
            createFavourite: new CreateFavouriteController({ projectEntity, favouriteEntity }),
            viewFavourite: new ViewFavouriteController({ projectEntity }),
            deleteFavourite: new DeleteFavouriteController({ favouriteEntity }),
            createEnquiry: new CreateEnquiryController({ projectEntity, enquiryEntity, profileEntity }),
            viewEnquiry: new ViewEnquiryController({ enquiryEntity }),
            viewSiteVisit: new ViewSiteVisitController({ siteVisitEntity: this.siteVisitEntity, offsetHours }),
            viewActiveCustomer: new ViewActiveCustomerController({ userEntity }),
            viewActiveDesigner: new ViewActiveDesignerController({ userEntity }),
            createReport: new CreateReportController({
                userEntity, projectEntity, favouriteEntity, enquiryEntity, siteVisitEntity: this.siteVisitEntity, offsetHours
            })
        };

        // ── Boundaries ───────────────────────────────────────────
        const c = this.controllers;
        const { authMiddleware, roleMiddleware, uploadMiddleware } = this;
        this.boundaries = [
            new HealthBoundary({ viewHealthController: c.viewHealth }),
            new AuthBoundary({
                createUserAccountController: c.createUserAccount,
                loginController: c.login,
                logoutController: c.logout,
                reactivateUserAccountController: c.reactivateUserAccount,
                viewUserAccountController: c.viewUserAccount,
                authMiddleware,
                cookie: { name: config.authCookieName, maxAgeMs: config.tokenTtlSeconds * 1000, secure: config.isProduction }
            }),
            new AccountBoundary({
                createUserAccountController: c.createUserAccount,
                searchUserAccountController: c.searchUserAccount,
                viewUserAccountController: c.viewUserAccount,
                updateUserAccountController: c.updateUserAccount,
                deleteUserAccountController: c.deleteUserAccount,
                assignUserRoleController: c.assignUserRole,
                suspendUserAccountController: c.suspendUserAccount,
                deactivateUserAccountController: c.deactivateUserAccount,
                reactivateUserAccountController: c.reactivateUserAccount,
                approveUserAccountController: c.approveUserAccount,
                rejectUserAccountController: c.rejectUserAccount,
                resetUserPasswordController: c.resetUserPassword,
                authMiddleware,
                roleMiddleware
            }),
            new ProfileBoundary({
                searchUserProfileController: c.searchUserProfile,
                viewUserProfileController: c.viewUserProfile,
                updateUserProfileController: c.updateUserProfile,
                authMiddleware,
                roleMiddleware
            }),
            new CredentialBoundary({
                submitCredentialsController: c.submitCredentials,
                viewCredentialsController: c.viewCredentials,
                authMiddleware,
                roleMiddleware
            }),
            new CategoryBoundary({
                createProjectCategoryController: c.createProjectCategory,
                viewProjectCategoryController: c.viewProjectCategory,
                searchProjectCategoryController: c.searchProjectCategory,
                updateProjectCategoryController: c.updateProjectCategory,
                deleteProjectCategoryController: c.deleteProjectCategory,
                authMiddleware,
                roleMiddleware
            }),
            new ProjectBoundary({
                searchProjectController: c.searchProject,
                viewProjectController: c.viewProject,
                createProjectController: c.createProject,
                updateProjectController: c.updateProject,
                deleteProjectController: c.deleteProject,
                viewPortfolioController: c.viewPortfolio,
                authMiddleware,
                roleMiddleware,
                uploadMiddleware
            }),
            new FavouriteBoundary({
                createFavouriteController: c.createFavourite,
                viewFavouriteController: c.viewFavourite,
                deleteFavouriteController: c.deleteFavourite,
                authMiddleware,
                roleMiddleware
            }),
            new EnquiryBoundary({
                createEnquiryController: c.createEnquiry,
                viewEnquiryController: c.viewEnquiry,
                authMiddleware,
                roleMiddleware
            }),
            new StatisticsBoundary({
                viewSiteVisitController: c.viewSiteVisit,
                viewActiveCustomerController: c.viewActiveCustomer,
                viewActiveDesignerController: c.viewActiveDesigner,
                createReportController: c.createReport,
                authMiddleware,
                roleMiddleware
            })
        ];

        this.express = express();
        this.#configure();
    }

    /** Opens the database, creates tables, seeds sample data on first run, and builds the app. */
    static build(config) {
        const db = Database.open(config.dbPath);
        db.initialise(config.schemaPath);
        const imageStorage = new ImageStorage(config.uploadDir);
        new Seeder({ db, config, imageStorage }).seedIfEmpty();
        return new App({ config, db, imageStorage });
    }

    #configure() {
        const app = this.express;
        const { config } = this;

        app.disable('x-powered-by');
        app.use(express.json());
        app.use('/uploads', express.static(config.uploadDir));
        app.use(this.authMiddleware.authenticate);

        // The home page counts a site visit; it must come before express.static serves index.html.
        app.get(['/', '/index.html'], this.siteVisitMiddleware.record, (req, res) => {
            res.sendFile(path.join(config.publicDir, 'index.html'));
        });
        app.use(express.static(config.publicDir));

        for (const boundary of this.boundaries) {
            app.use('/api', boundary.getRouter());
        }

        app.use(this.errorMiddleware.notFound);
        app.use(this.errorMiddleware.handle);
    }

    listen(port = this.config.port) {
        return this.express.listen(port, () => {
            console.log(`Interior Design Platform running at http://localhost:${port}`);
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = App;
