'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/** Stories 2, 18, 34: view a user account (private details). Own account, or any account for a User Admin. */
class ViewUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    viewUserAccount(userId, actor) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        const account = this.userEntity.findAccountById(id);
        if (!account) throw new AppError(404, 'User account not found.');
        return account;
    }
}

module.exports = ViewUserAccountController;
