'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/**
 * Story 47: a customer sends an enquiry to the designer behind a project.
 * Name and email default to the customer's own details when left blank.
 */
class CreateEnquiryController {
    constructor({ projectEntity, enquiryEntity, profileEntity }) {
        this.projectEntity = projectEntity;
        this.enquiryEntity = enquiryEntity;
        this.profileEntity = profileEntity;
    }

    createEnquiry(input = {}, actor) {
        BaseController.requireRole(actor, ROLES.CUSTOMER, 'Only customers can send enquiries.');
        const projectId = Validator.id(input.projectId, 'project id');
        const project = this.projectEntity.findDetailById(projectId);
        if (!project || project.designerStatus !== ACCOUNT_STATUS.ACTIVE) {
            throw new AppError(404, 'Project not found.');
        }

        const requirements = Validator.requiredText(input.requirements, 'Renovation requirements', 2000);
        const name = Validator.optionalText(input.name, 'Name', 100) ?? this.profileEntity.findByUserId(actor.id)?.name ?? '';
        const email = Validator.optionalText(input.email, 'Email', 254) === null ? actor.email : Validator.email(input.email);
        const location = Validator.optionalText(input.location, 'Preferred location', 100);
        const budget = Validator.optionalText(input.budget, 'Estimated budget', 100);

        const id = this.enquiryEntity.create({
            customerId: actor.id, designerId: project.designerId, projectId,
            name, email, location, budget, requirements
        });
        return { id, projectId, projectTitle: project.title, designer: project.designer };
    }
}

module.exports = CreateEnquiryController;
