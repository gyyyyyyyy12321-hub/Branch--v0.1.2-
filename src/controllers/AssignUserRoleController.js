'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 3: a User Admin assigns a role to another user's account. */
class AssignUserRoleController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    assignUserRole(userId, input = {}, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        if (actor.id === id) throw new AppError(400, 'You cannot change your own role.');
        const role = Validator.oneOf(input.role, Object.values(ROLES), 'Role');

        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');

        if (user.role !== role) this.userEntity.updateRole(id, role);
        return this.userEntity.findAccountById(id);
    }
}

module.exports = AssignUserRoleController;
