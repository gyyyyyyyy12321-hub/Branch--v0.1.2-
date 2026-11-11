'use strict';
/*
 * Front end for the Renovation Matching Platform.
 * Single-page app: the server holds all data and the session (an httpOnly cookie), this file only
 * renders screens and calls /api. Guests (not logged in) can search and view projects; saving favourites
 * and sending enquiries need a customer login. Reports and statistics are placeholders until the next build step.
 */
// Wireframe view: add ?wireframe to the address to see the grey, low-fidelity version (see wireframe.css).
if (typeof location !== 'undefined' && /[?&]wireframe\b/.test(location.search)) {
    document.documentElement.classList.add('wireframe');
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'wireframe.css';
    document.head.appendChild(link);
}
(() => {
    // The wireframe shows three extra gallery slots under the main project image. The platform stores one image
    // per project, so these slots are empty striped placeholders with no function.
    // true = show them (as in the wireframe), false = hide them.
    const SHOW_GALLERY_PLACEHOLDERS = false;
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    const ROLE = { CUSTOMER: 'Customer', DESIGNER: 'Interior Designer', ADMIN: 'User Admin', PLATFORM: 'Platform Management' };

    const NAV = {
        [ROLE.CUSTOMER]: {
            label: 'Customer workspace', default: 'explore',
            items: [['explore', '⌕', 'Explore Projects'], ['favorites', '♡', 'My Favourites'], ['myaccount', '◯', 'My Account']]
        },
        [ROLE.DESIGNER]: {
            label: 'Interior Designer workspace', default: 'overview',
            items: [['overview', '▦', 'Dashboard'], ['company', '▤', 'Company Profile'], ['portfolio', '▧', 'My Portfolio'],
                ['analytics', '▥', 'Project Analytics'], ['enquiries', '✉', 'Customer Enquiries'], ['credentials', '✓', 'Company Verification'], ['myaccount', '◯', 'My Account']]
        },
        [ROLE.ADMIN]: {
            label: 'User Admin workspace', default: 'adminoverview',
            items: [['adminoverview', '▦', 'Dashboard'], ['accounts', '☷', 'Manage Accounts'], ['profiles', '☺', 'Manage Profiles'],
                ['verification', '✓', 'Company Approvals'], ['myaccount', '◯', 'My Account']]
        },
        [ROLE.PLATFORM]: {
            label: 'Platform Management workspace', default: 'platformoverview',
            items: [['platformoverview', '▦', 'Dashboard'], ['categories', '▥', 'Manage Categories'], ['reports', '▤', 'Platform Reports'],
                ['traffic', '◷', 'Website Statistics'], ['myaccount', '◯', 'My Account']]
        }
    };
    const PENDING_DESIGNER_NAV = { label: 'Interior Designer workspace', default: 'credentials', items: [['credentials', '✓', 'Company Verification']] };
    const GUEST_NAV = { label: 'Welcome', default: 'explore', items: [['explore', '⌕', 'Explore Projects'], ['auth', '⇥', 'Login / Register']] };
    const GUEST_SCREENS = ['auth', 'explore', 'project'];
    // Which sidebar item stays highlighted on screens that are not in the sidebar.
    const NAV_PARENT = { project: s => s.params.from || 'explore', enquire: s => s.params.from || 'explore', projecteditor: () => 'portfolio' };

    const state = {
        user: null, screen: 'auth', params: {}, data: null,
        notice: '', noticeType: '', authTab: 'Login', busy: false, ticket: 0,
        returnTo: null, lastExplore: {}, lastProject: null
    };

    // ───────── helpers ─────────
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const $ = id => document.getElementById(id);
    const date = s => String(s ?? '').slice(0, 10);
    const qs = obj => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(obj)) if (v) p.set(k, v);
        const s = p.toString();
        return s ? `?${s}` : '';
    };

    const pill = (txt, cl = '') => `<span class="chip ${cl}">${esc(txt)}</span>`;
    const btn = (txt, action, value = '', kind = '', extra = '') =>
        `<button type="button" class="${kind}" data-action="${action}" data-value="${esc(value)}" ${extra}>${esc(txt)}</button>`;
    const field = (label, name, value = '', type = 'text', o = {}) =>
        `<div class="field ${o.cls || ''}"><label for="${name}">${esc(label)}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(o.place || '')}" ${o.required ? 'required' : ''} ${o.max ? `maxlength="${o.max}"` : ''} ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''}/></div>`;
    const area = (label, name, value = '', cls = 'wide') =>
        `<div class="field ${cls}"><label for="${name}">${esc(label)}</label><textarea id="${name}" name="${name}" maxlength="1000">${esc(value)}</textarea></div>`;
    const select = (label, name, options, selected, cls = '') =>
        `<div class="field ${cls}"><label for="${name}">${esc(label)}</label><select id="${name}" name="${name}">${options.map(o => `<option value="${esc(o)}" ${o === selected ? 'selected' : ''}>${esc(o || 'All')}</option>`).join('')}</select></div>`;
    const readonly = (label, value, cls = '') =>
        `<div class="field ${cls}"><label>${esc(label)}</label><div class="showcase"><strong>${esc(value)}</strong></div></div>`;
    const boxHead = (title, right = '') => `<div class="panelHead"><h2>${esc(title)}</h2>${right}</div>`;
    const stat = (label, value, sub = '') => `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="under">${esc(sub)}</div></div>`;
    const dotFor = status => ({ Suspended: 'dim', Pending: 'await', Deactivated: 'off' }[status] || '');
    const statusCell = status => `<span class="dot ${dotFor(status)}"></span>${esc(status)}`;
    const credChip = status => pill(status || 'No submission', { Approved: 'good', Pending: 'warn', Rejected: 'bad' }[status] || '');

    const navFor = () => {
        if (!state.user) return GUEST_NAV;
        if (state.user.status === 'Pending') return PENDING_DESIGNER_NAV;
        return NAV[state.user.role] || GUEST_NAV;
    };
    const head = (title, desc, actions = '') =>
        `<div class="crumb">${esc(navFor().label)} / ${esc(title)}</div><div class="heading"><div><h1>${esc(title)}</h1><p class="lead">${esc(desc)}</p></div><div class="headingActions">${actions}</div></div>`;
    const notice = () => state.notice ? `<div class="notice ${state.noticeType}">${esc(state.notice)}</div>` : '';
    const unavailable = title => `${head(title, '')}${notice()}<div class="empty"><strong>Could not load this page.</strong><p>Try again in a moment.</p></div>`;

    async function api(method, url, body) {
        const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
        const res = await fetch(url, {
            method,
            // For FormData the browser sets the multipart Content-Type (with its boundary) itself.
            headers: body === undefined || isForm ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
            credentials: 'same-origin'
        });
        let data = null;
        try { data = await res.json(); } catch { /* empty body */ }
        if (!res.ok) {
            const err = new Error(data?.error || `Request failed (${res.status})`);
            err.status = res.status;
            err.code = data?.code;
            throw err;
        }
        return data;
    }

    // ───────── navigation and state ─────────
    async function go(screen, params = {}, opts = {}) {
        const ticket = ++state.ticket;
        state.screen = screen;
        state.params = params;
        state.data = null;
        state.notice = opts.notice || '';
        state.noticeType = opts.isError ? 'error' : '';
        if (loaders[screen]) {
            try {
                const data = await loaders[screen](params);
                if (ticket !== state.ticket) return; // a newer navigation won
                state.data = data;
            } catch (err) {
                if (ticket !== state.ticket) return;
                render();
                handleError(err);
                return;
            }
        }
        render();
        if (!opts.keepScroll) window.scrollTo(0, 0);
    }

    const refresh = message => go(state.screen, state.params, { notice: message, keepScroll: true });

    function note(message, isError = false) {
        state.notice = message;
        state.noticeType = isError ? 'error' : '';
        render();
    }

    function handleError(err) {
        if (err.status === 401 && state.user) {
            state.user = null;
            state.screen = 'auth';
            state.authTab = 'Login';
            state.data = null;
            note('Your session has expired. Please log in again.', true);
            return;
        }
        note(err.message || 'Something went wrong.', true);
    }

    // A guest tried something that needs a customer login: send them to the login page and bring them back afterwards.
    function requireLogin(message) {
        state.returnTo = { screen: state.screen === 'enquire' ? 'project' : state.screen, params: state.screen === 'enquire' ? { id: state.params.projectId } : state.params };
        state.authTab = 'Login';
        return go('auth', {}, { notice: message });
    }

    function startSession(account) {
        state.user = account;
        const back = state.returnTo;
        state.returnTo = null;
        if (back && account.role === ROLE.CUSTOMER && account.status !== 'Pending') return go(back.screen, back.params);
        const target = account.status === 'Pending' ? PENDING_DESIGNER_NAV.default : NAV[account.role].default;
        return go(target);
    }

    async function endSession(message) {
        try { await api('POST', '/api/auth/logout'); } catch { /* cookie may already be gone */ }
        state.user = null;
        state.returnTo = null;
        state.authTab = 'Login';
        state.screen = 'auth';
        state.data = null;
        state.notice = message || '';
        state.noticeType = '';
        render();
        window.scrollTo(0, 0);
    }

    // ───────── screens: signed out ─────────
    function auth() {
        const login = state.authTab === 'Login';
        return `${head(login ? 'Log in' : 'Create an account', login ? 'Log in to your account.' : 'Customers and interior design companies can sign up here.')}${notice()}
        <div class="drawer"><div class="card panel">
            <div class="toolbar" style="margin-bottom:17px">${btn('Login', 'authswitch', 'Login', login ? 'primary' : '')}${btn('Register', 'authswitch', 'Register', login ? '' : 'primary')}</div>
            <div id="authNotice"></div>
            <form id="authForm"><div class="stack">
                ${login ? '' : `<div class="field"><label for="fullName">Full name</label><input id="fullName" name="fullName" required maxlength="100" autocomplete="name"/></div>`}
                ${field('Email address', 'email', '', 'email', { place: 'you@example.com', required: true, autocomplete: login ? 'username' : 'email' })}
                ${field('Password', 'password', '', 'password', { required: true, autocomplete: login ? 'current-password' : 'new-password', place: login ? '' : 'At least 8 characters' })}
                ${login ? '' : `<div class="field"><label for="regRole">Account type</label><select id="regRole" name="regRole"><option>Customer</option><option>Interior Designer</option></select></div>
                <div class="field" id="regNumberField" hidden><label for="registrationNumber">Company registration number</label><input id="registrationNumber" name="registrationNumber" maxlength="50"/><span class="hint">An administrator verifies this before your company account is approved.</span></div>`}
                <button class="primary" type="submit">${login ? 'Log in' : 'Create account'}</button>
            </div></form>
            <div id="reactivateBox" hidden><div class="rule"></div><div class="callout">Your account is deactivated. Enter your email and password above, then reactivate it.<div style="margin-top:10px">${btn('Reactivate my account', 'reactivate', '', 'primary')}</div></div></div>
        </div></div>`;
    }

    function showAuthMessage(message, isError, offerReactivate = false) {
        $('authNotice').innerHTML = `<div class="notice ${isError ? 'error' : ''}">${esc(message)}</div>`;
        $('reactivateBox').hidden = !offerReactivate;
    }

    // ───────── screens: account (every role) ─────────
    function myaccount() {
        if (!state.data) return unavailable('My Account');
        const { account, profile } = state.data;
        const selfService = [ROLE.CUSTOMER, ROLE.DESIGNER].includes(account.role);
        const isDesigner = account.role === ROLE.DESIGNER;
        const profileCard = isDesigner
            ? `<div class="callout">Your public company details (name, phone, location, services) are edited under ${btn('Company Profile', 'nav', 'company', 'link')}.</div>`
            : `<form class="card panel" id="profileForm">${boxHead('Personal information')}<div class="formgrid">${field('Name', 'name', profile.name, 'text', { required: true, max: 100, autocomplete: 'name' })}${field('Contact number', 'phone', profile.phone, 'tel', { max: 30, autocomplete: 'tel' })}</div><div class="formActions"><button class="primary" type="submit">Save profile</button></div></form>`;
        return `${head('My Account', 'View your account details and update your information.')}${notice()}
        <div class="twoThird"><div class="stack">
            <form class="card panel" id="accountForm">${boxHead('Account details')}<div class="formgrid">${field('Email address', 'email', account.email, 'email', { required: true, autocomplete: 'email', cls: 'wide' })}${readonly('Account role', account.role)}${readonly('Status', account.status)}${readonly('Member since', date(account.createdAt))}</div><div class="formActions"><button class="primary" type="submit">Save email</button></div></form>
            <form class="card panel" id="passwordForm">${boxHead('Change password')}<div class="formgrid">${field('Current password', 'currentPassword', '', 'password', { required: true, autocomplete: 'current-password', cls: 'wide' })}${field('New password', 'newPassword', '', 'password', { required: true, autocomplete: 'new-password', place: 'At least 8 characters' })}${field('Confirm new password', 'confirmPassword', '', 'password', { required: true, autocomplete: 'new-password' })}</div><div class="formActions"><button class="primary" type="submit">Change password</button></div></form>
            ${profileCard}
        </div><div class="card panel">${boxHead('Account actions')}
            <div class="stack-sm">${btn('Log out', 'logout')}${selfService ? btn('Deactivate my account', 'deactivateSelf', '', 'danger') : ''}</div>
            ${selfService
                ? `<p class="hint">Deactivating hides your account until you log in and reactivate it.</p><div class="rule"></div>
                   <form id="deleteForm" class="stack-sm"><strong>Delete account</strong><p class="hint">Permanently removes your account and everything linked to it. This cannot be undone.</p>${field('Confirm with your password', 'deletePassword', '', 'password', { required: true, autocomplete: 'current-password' })}<button type="submit" class="danger">Delete my account</button></form>`
                : '<p class="hint">Accounts with this role are managed by a User Admin.</p>'}
        </div></div>`;
    }

    // ───────── screens: designer ─────────
    function company() {
        if (!state.data) return unavailable('Company Profile');
        const p = state.data.profile;
        return `${head('Company Profile', 'Maintain the company information customers can see.')}${notice()}
        <div class="twoThird"><form class="card panel" id="profileForm">${boxHead('Company details')}<div class="formgrid">
            ${field('Company name', 'name', p.name, 'text', { required: true, max: 100 })}${field('Phone number', 'phone', p.phone, 'tel', { max: 30 })}${field('Location', 'location', p.location, 'text', { max: 100, cls: 'wide' })}
            ${area('Company description', 'description', p.description)}${field('Services offered', 'services', p.services, 'text', { max: 300, cls: 'wide' })}
        </div><div class="formActions"><button class="primary" type="submit">Save company profile</button></div></form>
        <div class="card panel">${boxHead('Public profile preview')}<h3 style="margin:0 0 6px">${esc(p.name)}</h3>
            <p class="muted mini">${esc(p.location || 'No location set')}${p.phone ? ' · ' + esc(p.phone) : ''}</p>
            <p class="muted mini">${esc(p.description || 'No description yet.')}</p>
            <div class="tag">Services</div><p class="mini">${esc(p.services || 'None listed')}</p></div></div>`;
    }

    function credentials() {
        if (!state.data) return unavailable('Company Verification');
        const cred = state.data.credential;
        const approved = cred?.status === 'Approved';
        const explain = {
            Pending: 'Submitted. An administrator will review your details.',
            Approved: 'Your company is verified and your account is active.',
            Rejected: 'Your details were rejected. Please correct them and submit again.'
        }[cred?.status] || 'Submit your company details so an administrator can approve your account.';
        return `${head('Company Verification', 'Your account is approved once an administrator verifies your company.')}${notice()}
        <div class="twoThird"><form class="card panel" id="credentialsForm">${boxHead('Company credentials')}<div class="formgrid">
            ${field('Registered company name', 'companyName', cred?.companyName ?? state.user.name, 'text', { required: true, max: 100 })}${field('Company registration number', 'registrationNumber', cred?.registrationNumber ?? '', 'text', { required: true, max: 50 })}
        </div><div class="formActions"><button class="primary" type="submit" ${approved ? 'disabled' : ''}>${cred ? 'Resubmit for verification' : 'Submit for verification'}</button></div></form>
        <div class="card panel">${boxHead('Verification status')}<div class="showcase">${credChip(cred?.status)}${cred ? `<div class="hint" style="margin-top:8px">Submitted ${esc(date(cred.submittedAt))}</div>` : ''}</div><p class="muted mini">${esc(explain)}</p></div></div>`;
    }

    // ───────── screens: User Admin ─────────
    function accountTable(accounts) {
        if (!accounts.length) return '<div class="empty"><strong>No matching accounts.</strong></div>';
        return `<div class="tableWrap"><table class="table"><thead><tr><th>Account / email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${accounts.map(a => `<tr><td><strong>${esc(a.name)}</strong><div class="muted mini">${esc(a.email)}</div></td><td>${esc(a.role)}</td><td>${statusCell(a.status)}</td><td>${btn('View / Edit', 'accountdetail', a.id, 'smallBtn')}</td></tr>`).join('')}</tbody></table></div>`;
    }

    function adminoverview() {
        if (!state.data) return unavailable('User Admin Dashboard');
        const all = state.data.accounts;
        const count = status => all.filter(a => a.status === status).length;
        const attention = all.filter(a => a.status !== 'Active').slice(0, 6);
        return `${head('User Admin Dashboard', 'Monitor platform accounts, roles and access.', btn('Manage accounts →', 'nav', 'accounts', 'primary'))}${notice()}
        <div class="grid cols4">${stat('Total accounts', all.length, 'All roles')}${stat('Active accounts', count('Active'), 'Can log in')}${stat('Suspended accounts', count('Suspended'), 'Locked by an admin')}${stat('Pending approvals', count('Pending'), 'Waiting for review')}</div>
        <div class="twoThird" style="margin-top:17px"><div class="card panel">${boxHead('Accounts needing attention', btn('See all', 'nav', 'accounts', 'small'))}${accountTable(attention)}</div>
        <div class="card panel">${boxHead('Administrative actions')}<div class="stack-sm">${btn('+ Create new user', 'nav', 'createaccount', 'primary')}${btn('Search user accounts', 'nav', 'accounts')}${btn('Search user profiles', 'nav', 'profiles')}${btn('Review company credentials', 'nav', 'verification')}</div></div></div>`;
    }

    function accounts() {
        if (!state.data) return unavailable('Manage User Accounts');
        const p = state.params;
        return `${head('Manage User Accounts', 'Search accounts and manage roles and access.', btn('+ Create Account', 'nav', 'createaccount', 'primary'))}${notice()}
        <form class="card filters" id="accountSearchForm"><div class="field grow"><label for="query">Search by name or email</label><input id="query" name="query" value="${esc(p.query || '')}" placeholder="Search accounts..."/></div>
            ${select('Role', 'role', ['', ...Object.values(ROLE)], p.role || '')}${select('Status', 'status', ['', 'Active', 'Pending', 'Suspended', 'Deactivated'], p.status || '')}
            <button class="primary" type="submit">Search</button>${btn('Reset', 'nav', 'accounts')}</form>
        <div class="card">${accountTable(state.data.accounts)}</div>`;
    }

    function createaccount() {
        return `${head('Create User Account', 'Create an account and assign its role.', btn('← Back to accounts', 'nav', 'accounts'))}${notice()}
        <form id="createAccountForm" class="card panel drawer">${boxHead('New user details')}<div class="formgrid">
            ${field('Full name', 'name', '', 'text', { required: true, max: 100 })}${field('Email address', 'email', '', 'email', { required: true })}
            ${field('Initial password', 'password', '', 'password', { required: true, autocomplete: 'new-password', place: 'At least 8 characters' })}
            ${select('User role', 'role', Object.values(ROLE), ROLE.CUSTOMER)}${select('Account status', 'status', ['Active', 'Pending'], 'Active')}
        </div><div class="formActions"><button class="primary" type="submit">Create account</button></div></form>`;
    }

    function accountdetail() {
        if (!state.data) return unavailable('User Account Details');
        const { account: a, profile } = state.data;
        const self = a.id === state.user.id;
        const status = a.status;
        const buttons = [];
        if (status === 'Active' && !self) buttons.push(btn('Suspend account', 'suspend', a.id), btn('Deactivate account', 'deactivateUser', a.id));
        if (status === 'Suspended' || status === 'Deactivated') buttons.push(btn('Reactivate account', 'reactivateUser', a.id, 'primary'));
        if (status === 'Pending') {
            buttons.push(btn('Approve account', 'approve', a.id, 'primary'));
            if (a.role === ROLE.DESIGNER && a.credentialStatus === 'Pending') buttons.push(btn('Reject credentials', 'reject', a.id, 'danger'));
        }
        buttons.push(btn('Reset password', 'resetpassword', a.id));
        if (!self) buttons.push(btn('Delete account', 'deleteUser', a.id, 'danger'));
        const company = a.role === ROLE.DESIGNER
            ? `<div class="rule"></div><div class="formgrid">${readonly('Company', a.companyName ?? 'Not submitted')}${readonly('Registration number', a.registrationNumber ?? '-')}${readonly('Credential status', a.credentialStatus ?? 'No submission')}</div>`
            : '';
        return `${head('User Account Details', 'Private account information and administrative actions.', btn('← Back to accounts', 'nav', 'accounts'))}${notice()}
        <div class="twoThird"><div class="stack">
            <div class="card panel">${boxHead(profile.name, pill(status))}<div class="formgrid">${readonly('Account ID', a.id)}${readonly('Member since', date(a.createdAt))}</div>${company}
                <div class="rule"></div><p class="hint">Public profile details (name, phone, location) are edited in ${btn('this profile', 'profiledetail', a.id, 'link')}.</p></div>
            <form class="card panel" id="accountForm">${boxHead('Email address')}<div class="formgrid">${field('Email', 'email', a.email, 'email', { required: true, cls: 'wide' })}</div><div class="formActions"><button class="primary" type="submit">Save email</button></div></form>
            <form class="card panel" id="roleForm">${boxHead('Assigned role')}<div class="row">${select('Role', 'role', Object.values(ROLE), a.role, 'grow')}<button class="primary" type="submit" ${self ? 'disabled' : ''}>Assign role</button></div>${self ? '<p class="hint">You cannot change your own role.</p>' : ''}</form>
        </div><div class="card panel">${boxHead('Security and status')}<p class="mini muted">Changes take effect immediately, even for people who are logged in.</p><div class="stack-sm">${buttons.join('')}</div></div></div>`;
    }

    function profiles() {
        if (!state.data) return unavailable('Manage User Profiles');
        const list = state.data.profiles;
        return `${head('Manage User Profiles', 'Search and update the public details of any user.')}${notice()}
        <form class="card filters" id="profileSearchForm"><div class="field grow"><label for="query">Search by name, location, services or description</label><input id="query" name="query" value="${esc(state.params.query || '')}" placeholder="e.g. Haven, Singapore"/></div><button class="primary" type="submit">Search</button>${btn('Reset', 'nav', 'profiles')}</form>
        <div class="card">${list.length ? `<div class="tableWrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.role)}</td><td>${esc(p.location || '-')}</td><td>${statusCell(p.status)}</td><td>${btn('View / Edit', 'profiledetail', p.userId, 'smallBtn')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>No matching profiles.</strong></div>'}</div>`;
    }

    function profiledetail() {
        if (!state.data) return unavailable('User Profile');
        const p = state.data.profile;
        return `${head('User Profile', 'The publicly displayed details for this user.', btn('← Back to profiles', 'nav', 'profiles'))}${notice()}
        <div class="twoThird"><form class="card panel" id="profileForm">${boxHead(p.name, pill(p.role))}<div class="formgrid">
            ${field('Name', 'name', p.name, 'text', { required: true, max: 100 })}${field('Phone number', 'phone', p.phone, 'tel', { max: 30 })}${field('Location', 'location', p.location, 'text', { max: 100, cls: 'wide' })}
            ${area('Description', 'description', p.description)}${field('Services', 'services', p.services, 'text', { max: 300, cls: 'wide' })}
        </div><div class="formActions"><button class="primary" type="submit">Save profile</button></div></form>
        <div class="card panel">${boxHead('Related')}<div class="stack-sm">${btn('View account details', 'accountdetail', p.userId)}</div></div></div>`;
    }

    function verification() {
        if (!state.data) return unavailable('Company Approvals');
        const list = state.data.accounts;
        return `${head('Company Approvals', 'Review credentials submitted by interior design companies.')}${notice()}
        <div class="card">${list.length ? `<div class="tableWrap"><table class="table"><thead><tr><th>Company</th><th>Registration number</th><th>Credentials</th><th>Actions</th></tr></thead><tbody>${list.map(a => `<tr><td><strong>${esc(a.companyName || a.name)}</strong><div class="muted mini">${esc(a.email)}</div></td><td>${esc(a.registrationNumber || '-')}</td><td>${credChip(a.credentialStatus)}</td><td><div class="row">${btn('Approve', 'approve', a.id, 'smallBtn primary', a.credentialStatus === 'Pending' ? '' : 'disabled')}${btn('Reject', 'reject', a.id, 'smallBtn danger', a.credentialStatus === 'Pending' ? '' : 'disabled')}${btn('Details', 'accountdetail', a.id, 'smallBtn')}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>No companies are waiting for approval.</strong></div>'}</div>`;
    }

    // ───────── screens: projects (guests, customers, designers) ─────────
    const SORTS = [['newest', 'Newest'], ['views', 'Most viewed'], ['favourites', 'Most favourited']];
    const isCustomer = () => state.user?.role === ROLE.CUSTOMER;
    const canFavourite = () => !state.user || isCustomer();

    // Striped placeholder; a real image sits on top of it. If the image cannot load, the 'error' handler removes it
    // and the placeholder shows, so a missing or deleted file never breaks the page.
    const imageBox = (p, cls = '') =>
        `<div class="ph ${cls}">${p.imagePath ? `<img src="${esc(p.imagePath)}" alt="${esc(p.title)}"/>` : ''}<span>Project image</span></div>`;

    const heart = p => `<button type="button" class="heart ${p.isFavourite ? 'on' : ''}" data-action="toggleFav" data-value="${esc(p.id)}" aria-label="${p.isFavourite ? 'Remove from favourites' : 'Add to favourites'}" title="${p.isFavourite ? 'Remove from favourites' : 'Add to favourites'}">${p.isFavourite ? '♥' : '♡'}</button>`;

    function projectCard(p) {
        return `<article class="card project">${imageBox(p)}<div class="projectBody">
            <div class="projectHead"><h3>${esc(p.title)}</h3>${canFavourite() ? heart(p) : ''}</div>
            <div class="projectMeta">${esc(p.category)} · ${esc(p.designer)}<br>${esc(p.status)}${p.year ? ' · ' + esc(p.year) : ''}<br>${esc(p.viewCount)} views · ${esc(p.favouriteCount)} favourites</div>
            <div class="bottom">${btn('View details', 'project', p.id, 'primary small')}</div></div></article>`;
    }

    function categoryOptions(categories, selected) {
        return `<option value="">All categories</option>${categories.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(selected) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
    }

    function explore() {
        if (!state.data) return unavailable('Explore Interior Design Projects');
        const p = state.params, { projects, categories } = state.data;
        return `${head('Explore Interior Design Projects', 'Search by keyword, filter by category and sort by popularity.')}${notice()}
        <form class="card filters" id="exploreForm">
            <div class="field grow"><label for="query">Search</label><input id="query" name="query" value="${esc(p.query || '')}" placeholder="Style, room, designer..."/></div>
            <div class="field"><label for="categoryId">Category</label><select id="categoryId" name="categoryId">${categoryOptions(categories, p.categoryId)}</select></div>
            <div class="field"><label for="sort">Sort by</label><select id="sort" name="sort">${SORTS.map(([v, l]) => `<option value="${v}" ${v === (p.sort || 'newest') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <button class="primary" type="submit">Search</button>${btn('Reset', 'resetExplore')}
        </form>
        <p class="count">${projects.length} project${projects.length === 1 ? '' : 's'} found</p>
        ${projects.length ? `<div class="grid cols3">${projects.map(projectCard).join('')}</div>` : '<div class="card empty"><strong>No projects match your search.</strong><p>Try a different keyword or category.</p></div>'}`;
    }

    function favorites() {
        if (!state.data) return unavailable('My Favourites');
        const list = state.data.projects;
        return `${head('My Favourites', 'Revisit the projects you saved.')}${notice()}
        ${list.length ? `<div class="grid cols3">${list.map(projectCard).join('')}</div>` : `<div class="card empty"><strong>You have not saved any projects yet.</strong><p>Tap the heart on a project to save it here.</p>${btn('Explore projects', 'nav', 'explore', 'primary')}</div>`}`;
    }

    function backAction() {
        return btn('← Back', 'back');
    }

    function project() {
        if (!state.data) return `${head('Project', '', backAction())}${notice()}<div class="empty"><strong>Could not load this project.</strong><p>It may have been removed.</p></div>`;
        const p = state.data.project;
        const owner = state.user?.id === p.designerId;
        const gallery = SHOW_GALLERY_PLACEHOLDERS ? `<div class="gallery"><div class="ph mini">Image 2</div><div class="ph mini">Image 3</div><div class="ph mini">Image 4</div></div>` : '';
        const actions = [];
        if (canFavourite()) actions.push(`<button type="button" class="heartBig ${p.isFavourite ? 'primary' : ''}" data-action="toggleFav" data-value="${esc(p.id)}">${p.isFavourite ? '♥ Saved to favourites' : '♡ Add to favourites'}</button>`);
        if (canFavourite()) actions.push(btn('Send an enquiry', 'enquire', p.id, 'primary'));
        if (owner) actions.push(btn('Edit project', 'editProject', p.id, 'primary'));
        const company = [p.designerLocation, p.designerPhone].filter(Boolean).map(esc).join(' · ');
        return `${head(p.title, `${p.category} · ${p.designer}`, backAction())}${notice()}
        <div class="detail"><div>${imageBox(p, 'large')}${gallery}</div>
            <div class="stack"><div class="card panel">
                <div class="row wrap">${pill(p.category)}${pill(p.status, p.status === 'Current' ? 'warn' : 'good')}${p.year ? pill(p.year) : ''}</div>
                <p style="margin:14px 0 0">${esc(p.description || 'No description provided.')}</p>
                <div class="statline"><span><strong>${esc(p.viewCount)}</strong> views</span><span><strong>${esc(p.favouriteCount)}</strong> favourites</span></div>
                <div class="detailActions">${actions.join('')}</div></div>
            <div class="card panel">${boxHead('Designer')}<h3 style="margin:0 0 6px">${esc(p.designer)}</h3>
                ${company ? `<p class="muted mini">${company}</p>` : ''}
                ${p.designerDescription ? `<p class="mini">${esc(p.designerDescription)}</p>` : ''}
                ${p.designerServices ? `<div class="tag">Services</div><p class="mini">${esc(p.designerServices)}</p>` : ''}</div></div></div>`;
    }

    function enquire() {
        if (!state.data) return unavailable('Send an Enquiry');
        const { projectId, title, designer, sent } = state.params;
        const back = btn('← Back to project', 'viewAgain', projectId);
        if (sent) {
            return `${head('Enquiry sent', `Your enquiry about "${title}" has been sent to ${designer}.`)}${notice()}
            <div class="card panel drawer"><p>${esc(designer)} will contact you using the email address you provided.</p><div class="row">${back}${btn('Explore more projects', 'nav', 'explore', 'primary')}</div></div>`;
        }
        const d = state.data;
        return `${head('Send an Enquiry', `About "${title}" by ${designer}`, back)}${notice()}
        <form id="enquiryForm" class="card panel drawer">${boxHead('Your details and requirements')}<div class="formgrid">
            ${field('Your name', 'name', d.name, 'text', { required: true, max: 100 })}${field('Email address', 'email', d.email, 'email', { required: true, max: 150 })}
            ${field('Location of the property', 'location', '', 'text', { max: 100 })}${field('Budget', 'budget', '', 'text', { max: 50, place: 'e.g. $30,000 - $40,000' })}
            ${area('Requirements', 'requirements', '')}
        </div><div class="formActions"><button class="primary" type="submit">Send enquiry</button></div></form>`;
    }

    // ───────── screens: designer ─────────
    function overview() {
        if (!state.data) return unavailable('Interior Designer Dashboard');
        const { projects, totals, enquiries } = state.data;
        const recent = enquiries.slice(0, 5);
        return `${head('Interior Designer Dashboard', 'Overview of your portfolio and customer interest.', btn('+ Add project', 'newProject', '', 'primary'))}${notice()}
        <div class="grid cols4">${stat('Projects', totals.projects, 'In your portfolio')}${stat('Total views', totals.views, 'Across all projects')}${stat('Total favourites', totals.shortlists, 'Customers who saved them')}${stat('Enquiries', enquiries.length, 'Received from customers')}</div>
        <div class="twoThird" style="margin-top:17px"><div class="card panel">${boxHead('Recent enquiries', btn('See all', 'nav', 'enquiries', 'small'))}${enquiryTable(recent)}</div>
        <div class="card panel">${boxHead('Most viewed project')}${totals.mostViewed ? `<h3 style="margin:0 0 6px">${esc(totals.mostViewed.title)}</h3><p class="muted mini">${esc(totals.mostViewed.viewCount)} views</p>` : '<p class="muted mini">No projects yet.</p>'}
            <div class="rule"></div><div class="stack-sm">${btn('Manage portfolio', 'nav', 'portfolio')}${btn('View analytics', 'nav', 'analytics')}</div></div></div>`;
    }

    function enquiryTable(list) {
        if (!list.length) return '<div class="empty"><strong>No enquiries yet.</strong><p>They appear here when customers contact you.</p></div>';
        return `<div class="tableWrap"><table class="table"><thead><tr><th>Date</th><th>Customer</th><th>Project</th><th>Details</th></tr></thead><tbody>${list.map(e => `<tr><td>${esc(date(e.createdAt))}</td><td><strong>${esc(e.name)}</strong><div class="muted mini">${esc(e.email)}</div></td><td>${esc(e.projectTitle || '(project removed)')}</td><td class="mini">${[e.location && 'Location: ' + e.location, e.budget && 'Budget: ' + e.budget].filter(Boolean).map(esc).join('<br>')}<div>${esc(e.requirements)}</div></td></tr>`).join('')}</tbody></table></div>`;
    }

    function enquiries() {
        if (!state.data) return unavailable('Customer Enquiries');
        return `${head('Customer Enquiries', 'Messages from customers interested in your projects.')}${notice()}<div class="card">${enquiryTable(state.data.enquiries)}</div>`;
    }

    function portfolio() {
        if (!state.data) return unavailable('My Portfolio');
        const list = state.data.projects;
        return `${head('My Portfolio', 'Add, edit and remove your design projects.', btn('+ Add project', 'newProject', '', 'primary'))}${notice()}
        <div class="card">${list.length ? `<div class="tableWrap"><table class="table"><thead><tr><th>Project</th><th>Status</th><th>Views</th><th>Favourites</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td><strong>${esc(p.title)}</strong><div class="muted mini">${esc(p.category)}${p.year ? ' · ' + esc(p.year) : ''}</div></td><td>${esc(p.status)}</td><td>${esc(p.viewCount)}</td><td>${esc(p.favouriteCount)}</td><td><div class="row">${btn('View', 'project', p.id, 'smallBtn')}${btn('Edit', 'editProject', p.id, 'smallBtn')}${btn('Delete', 'deleteProject', p.id, 'smallBtn danger')}</div></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><strong>Your portfolio is empty.</strong><p>Add your first project so customers can find you.</p>${btn('+ Add project', 'newProject', '', 'primary')}</div>`}</div>`;
    }

    function projecteditor() {
        if (!state.data) return unavailable('Project');
        const { categories, project: p } = state.data;
        const editing = Boolean(p);
        const v = p || { title: '', description: '', categoryId: '', status: 'Current', year: '', imagePath: null };
        return `${head(editing ? 'Edit Project' : 'Add Project', 'Project details and image shown to customers.', btn('← Back to portfolio', 'nav', 'portfolio'))}${notice()}
        <form id="projectForm" class="card panel drawer" enctype="multipart/form-data">${boxHead(editing ? v.title : 'New project')}<div class="formgrid">
            ${field('Title', 'title', v.title, 'text', { required: true, max: 120, cls: 'wide' })}
            <div class="field"><label for="categoryId">Category</label><select id="categoryId" name="categoryId" required>${categories.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(v.categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="status">Project status</label><select id="status" name="status"><option ${v.status === 'Current' ? 'selected' : ''}>Current</option><option ${v.status === 'Past' ? 'selected' : ''}>Past</option></select></div>
            ${field('Year', 'year', v.year ?? '', 'number', { place: 'e.g. 2026' })}
            ${area('Description', 'description', v.description)}
            <div class="field wide"><label for="image">Project image (JPEG, PNG or WebP, up to 5 MB)</label>
                <div class="preview" id="imagePreview">${imageBox(v)}</div>
                <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp"/>
                <span class="hint" id="imageHint">${editing && v.imagePath ? 'Choose a file to replace the current image.' : 'Optional. A placeholder is shown when there is no image.'}</span>
                ${editing && v.imagePath ? '<label class="checkline"><input type="checkbox" name="removeImage" value="true"/> Remove the current image</label>' : ''}</div>
        </div><div class="formActions"><button class="primary" type="submit">${editing ? 'Save changes' : 'Add project'}</button></div></form>`;
    }

    function analytics() {
        if (!state.data) return unavailable('Project Analytics');
        const { projects, totals } = state.data;
        const sorted = [...projects].sort((a, b) => b.viewCount - a.viewCount);
        const max = Math.max(1, ...sorted.map(p => p.viewCount));
        return `${head('Project Analytics', 'How customers are responding to your projects.')}${notice()}
        <div class="grid cols3">${stat('Total views', totals.views, 'Every opening of a project page')}${stat('Total favourites', totals.shortlists, 'Customers who saved your projects')}${stat('Most viewed', totals.mostViewed?.title ?? '-', totals.mostViewed ? `${totals.mostViewed.viewCount} views` : '')}</div>
        ${sorted.length ? `<div class="card panel" style="margin-top:17px">${boxHead('Views per project')}<div class="barChart">${sorted.map(p => `<div class="barcol" title="${esc(p.title)}: ${esc(p.viewCount)} views"><div class="bar" style="height:${Math.round(p.viewCount / max * 100)}%"></div><div class="barlabel">${esc(p.viewCount)}</div></div>`).join('')}</div>
        <div class="tableWrap" style="margin-top:17px"><table class="table"><thead><tr><th>Project</th><th>Views</th><th>Favourites</th></tr></thead><tbody>${sorted.map(p => `<tr><td>${esc(p.title)}</td><td>${esc(p.viewCount)}</td><td>${esc(p.favouriteCount)}</td></tr>`).join('')}</tbody></table></div></div>` : '<div class="card empty" style="margin-top:17px"><strong>No projects yet.</strong></div>'}`;
    }

    // ───────── screens: Platform Management ─────────
    function categories() {
        if (!state.data) return unavailable('Manage Project Categories');
        const list = state.data.categories;
        return `${head('Manage Project Categories', 'Add, rename, search and remove categories.')}${notice()}
        <div class="twoThird"><div class="stack">
            <form class="card filters" id="categorySearchForm"><div class="field grow"><label for="query">Search categories</label><input id="query" name="query" value="${esc(state.params.query || '')}" placeholder="e.g. Modern"/></div><button class="primary" type="submit">Search</button>${btn('Reset', 'nav', 'categories')}</form>
            <div class="card">${list.length ? `<div class="tableWrap"><table class="table"><thead><tr><th>Category</th><th>Projects</th><th></th></tr></thead><tbody>${list.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.projectCount)}</td><td><div class="row">${btn('Rename', 'renameCategory', c.id, 'smallBtn')}${btn('Delete', 'deleteCategory', c.id, 'smallBtn danger')}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><strong>No matching categories.</strong></div>'}</div>
        </div><form class="card panel" id="categoryForm">${boxHead('Add a category')}<div class="stack-sm">${field('Category name', 'name', '', 'text', { required: true, max: 50 })}<button class="primary" type="submit">Add category</button></div></form></div>`;
    }

    // ───────── screens: Platform Management statistics and reports ─────────
    const num = n => Number(n ?? 0).toLocaleString('en-US');
    const shortDay = d => String(d).slice(5).replace('-', '/'); // 2026-11-08 -> 11/08

    // A simple bar chart. items: [{ label, value, tip }]. Values are printed above the bars when there are few of them,
    // and with long periods only every n-th label is printed (the tooltip still names every bar).
    function barChart(items, { compact = false } = {}) {
        const max = Math.max(1, ...items.map(i => i.value));
        const showValues = items.length <= 14;
        const every = items.length > 14 ? Math.ceil(items.length / 10) : 1;
        return `<div class="barChart ${compact ? 'compact' : ''}">${items.map((item, i) => {
            const showLabel = i % every === 0;
            return `<div class="barcol" title="${esc(item.tip ?? `${item.label}: ${item.value}`)}">
                <div class="barvalue">${showValues ? esc(num(item.value)) : ''}</div>
                <div class="bar" style="height:${Math.round(item.value / max * 100)}%"></div>
                <div class="barlabel">${showLabel ? esc(item.label) : ''}</div></div>`;
        }).join('')}</div>`;
    }

    // Site visits per day (the dashboard and Website Statistics pages).
    const visitChart = rows => barChart(rows.map(r => ({ label: shortDay(r.day), value: r.count, tip: `${r.day}: ${r.count} visits` })));

    // The six statistics of a platform report, in the order the report lists them.
    const REPORT_STATS = [
        ['siteVisits', 'Site visits'], ['newCustomers', 'New customers'], ['newDesigners', 'New designer companies'],
        ['newProjects', 'New projects'], ['favouritesAdded', 'Favourites added'], ['enquiriesSent', 'Enquiries sent']
    ];

    function reportCharts(r) {
        const summary = REPORT_STATS.map(([key, label]) => ({ label, value: r.activity[key] }));
        const perDay = r.dailyActivity.length > 1
            ? `<div class="rule"></div><h3 style="margin:0 0 12px">Each statistic by day</h3>
               <div class="grid cols2">${REPORT_STATS.map(([key, label]) => `<div class="card panel chartCard">
                    <div class="panelHead"><h3>${esc(label)}</h3><span class="hint">${esc(num(r.activity[key]))} in total</span></div>
                    ${barChart(r.dailyActivity.map(d => ({ label: shortDay(d.day), value: d[key], tip: `${d.day}: ${d[key]}` })), { compact: true })}
                </div>`).join('')}</div>`
            : '';
        return `<div class="rule"></div><h3 style="margin:0 0 12px">Activity in this period</h3>${barChart(summary)}${perDay}`;
    }

    function platformoverview() {
        if (!state.data) return unavailable('Platform Management Dashboard');
        const { visits, customers, designers, categories } = state.data;
        return `${head('Platform Management Dashboard', 'Traffic, accounts and reports at a glance.', btn('Generate a report →', 'nav', 'reports', 'primary'))}${notice()}
        <div class="grid cols4">${stat('Site visits', num(visits.total), `${num(visits.today)} today`)}${stat('Active customers', num(customers.active), `${num(customers.registered)} registered`)}${stat('Active designers', num(designers.active), `${num(designers.registered)} registered`)}${stat('Categories', categories.length, 'Used to group projects')}</div>
        <div class="twoThird" style="margin-top:17px"><div class="card panel">${boxHead('Visits, last 14 days', btn('Details', 'nav', 'traffic', 'small'))}${visitChart(visits.lastDays)}</div>
        <div class="card panel">${boxHead('Shortcuts')}<div class="stack-sm">${btn('Manage categories', 'nav', 'categories')}${btn('Website statistics', 'nav', 'traffic')}${btn('Platform reports', 'nav', 'reports')}</div></div></div>`;
    }

    function traffic() {
        if (!state.data) return unavailable('Website Statistics');
        const { visits, customers, designers } = state.data;
        return `${head('Website Statistics', 'Site visits and active registered users.')}${notice()}
        <div class="grid cols4">${stat('Total site visits', num(visits.total), 'One per browser session')}${stat('Visits today', num(visits.today), `${num(visits.thisWeek)} this week`)}${stat('Active customers', num(customers.active), `of ${num(customers.registered)} registered customers`)}${stat('Active designer companies', num(designers.active), `of ${num(designers.registered)} registered companies`)}</div>
        <div class="card panel" style="margin-top:17px">${boxHead('Visits, last 14 days')}${visitChart(visits.lastDays)}
            <p class="hint">A visit is counted once each time someone opens the site in a new browser session, whether or not they are logged in. "Active" means the account status is Active (not suspended, deactivated or pending).</p></div>`;
    }

    function reports() {
        if (!state.data) return unavailable('Platform Reports');
        const { report: r, query } = state.data;
        const label = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[r.period];
        const range = r.from === r.to ? r.from : `${r.from} to ${r.to}`;
        const a = r.activity;
        return `${head('Platform Reports', 'Generate a daily, weekly or monthly report.')}${notice()}
        <form class="card filters" id="reportForm">
            <div class="field"><label for="period">Report type</label><select id="period" name="period">${['daily', 'weekly', 'monthly'].map(p => `<option value="${p}" ${p === query.period ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></div>
            <div class="field"><label for="date">Any date in the period (empty = today)</label><input id="date" name="date" type="date" value="${esc(query.date)}"/></div>
            <button class="primary" type="submit">Generate report</button>
        </form>
        <div class="card panel" style="margin-top:17px">${boxHead(`${label} report: ${range}`)}
            <div class="grid cols3">${stat('Site visits', num(a.siteVisits))}${stat('New customers', num(a.newCustomers))}${stat('New designer companies', num(a.newDesigners))}${stat('New projects', num(a.newProjects))}${stat('Favourites added', num(a.favouritesAdded))}${stat('Enquiries sent', num(a.enquiriesSent))}</div>
            ${reportCharts(r)}
            <div class="rule"></div><h3 style="margin:0 0 10px">Platform right now</h3>
            <div class="statline"><span><strong>${num(r.platform.activeCustomers)}</strong> active customers</span><span><strong>${num(r.platform.activeDesigners)}</strong> active designer companies</span><span><strong>${num(r.platform.totalProjects)}</strong> projects in total</span></div>
            <p class="hint">Dates and days use Singapore time. Generated ${esc(String(r.generatedAt).replace('T', ' ').slice(0, 16))} UTC.</p></div>`;
    }

    const screens = {
        auth, myaccount, company, credentials, adminoverview, accounts, createaccount, accountdetail, profiles, profiledetail, verification,
        explore, project, enquire, favorites, overview, enquiries, portfolio, projecteditor, analytics,
        platformoverview, categories, reports, traffic
    };

    // Data each screen needs before it renders.
    const loaders = {
        explore: async p => {
            state.lastExplore = p;
            const [projects, categories] = await Promise.all([
                api('GET', `/api/projects${qs({ query: p.query, categoryId: p.categoryId, sort: p.sort })}`),
                api('GET', '/api/categories')
            ]);
            return { projects: projects.projects, categories: categories.categories };
        },
        // Opening a project page counts as one view. "reuse" shows the project already loaded, without counting again.
        project: async p => {
            if (p.reuse && state.lastProject && String(state.lastProject.id) === String(p.id)) return { project: state.lastProject };
            const { project } = await api('GET', `/api/projects/${p.id}`);
            state.lastProject = project;
            return { project };
        },
        enquire: async () => {
            const { profile } = await api('GET', `/api/profiles/${state.user.id}`);
            return { name: profile.name, email: state.user.email };
        },
        favorites: async () => ({ projects: (await api('GET', '/api/favourites')).projects }),
        overview: async () => {
            const [portfolio, enquiries] = await Promise.all([api('GET', '/api/portfolio'), api('GET', '/api/enquiries')]);
            return { projects: portfolio.projects, totals: portfolio.totals, enquiries: enquiries.enquiries };
        },
        enquiries: async () => ({ enquiries: (await api('GET', '/api/enquiries')).enquiries }),
        portfolio: async () => api('GET', '/api/portfolio'),
        analytics: async () => api('GET', '/api/portfolio'),
        projecteditor: async p => {
            const [cats, proj] = await Promise.all([api('GET', '/api/categories'), p.id ? api('GET', `/api/projects/${p.id}`) : null]);
            return { categories: cats.categories, project: proj?.project ?? null };
        },
        categories: async p => ({ categories: (await api('GET', `/api/categories${qs({ query: p.query })}`)).categories }),
        platformoverview: async () => {
            const [v, c, d, cat] = await Promise.all([
                api('GET', '/api/statistics/visits'), api('GET', '/api/statistics/active-customers'),
                api('GET', '/api/statistics/active-designers'), api('GET', '/api/categories')
            ]);
            return { visits: v.visits, customers: c, designers: d, categories: cat.categories };
        },
        traffic: async () => {
            const [v, c, d] = await Promise.all([
                api('GET', '/api/statistics/visits'), api('GET', '/api/statistics/active-customers'), api('GET', '/api/statistics/active-designers')
            ]);
            return { visits: v.visits, customers: c, designers: d };
        },
        // The report is for the chosen period and date; with no date it is today.
        reports: async p => {
            const query = { period: p.period || 'daily', date: p.date || '' };
            return { query, report: (await api('GET', `/api/reports${qs(query)}`)).report };
        },
        myaccount: async () => {
            const id = state.user.id;
            const [a, p] = await Promise.all([api('GET', `/api/accounts/${id}`), api('GET', `/api/profiles/${id}`)]);
            return { account: a.account, profile: p.profile };
        },
        company: async () => ({ profile: (await api('GET', `/api/profiles/${state.user.id}`)).profile }),
        credentials: async () => ({ credential: (await api('GET', '/api/credentials/me')).credential }),
        adminoverview: async () => ({ accounts: (await api('GET', '/api/accounts')).accounts }),
        accounts: async p => ({ accounts: (await api('GET', `/api/accounts${qs({ query: p.query, role: p.role, status: p.status })}`)).accounts }),
        accountdetail: async p => {
            const [a, pr] = await Promise.all([api('GET', `/api/accounts/${p.id}`), api('GET', `/api/profiles/${p.id}`)]);
            return { account: a.account, profile: pr.profile };
        },
        profiles: async p => ({ profiles: (await api('GET', `/api/profiles${qs({ query: p.query })}`)).profiles }),
        profiledetail: async p => ({ profile: (await api('GET', `/api/profiles/${p.id}`)).profile }),
        verification: async () => ({ accounts: (await api('GET', `/api/accounts${qs({ role: ROLE.DESIGNER, status: 'Pending' })}`)).accounts })
    };

    function userBox() {
        if (!state.user) return state.screen === 'auth' ? '' : `<div class="userBox">${btn('Log in', 'nav', 'auth', 'small primary')}</div>`;
        return `<div class="userBox"><div class="userChip"><strong>${esc(state.user.name)}</strong><span>${esc(state.user.role)}</span></div>${btn('Log out', 'logout', '', 'small')}</div>`;
    }

    function render() {
        originalPreview = null;
        if (!state.user && !GUEST_SCREENS.includes(state.screen)) state.screen = 'auth';
        const navConfig = navFor();
        const activeKey = NAV_PARENT[state.screen] ? NAV_PARENT[state.screen](state) : state.screen;
        $('userBox').innerHTML = userBox();
        $('navLabel').textContent = navConfig.label;
        $('nav').innerHTML = navConfig.items.map(([key, icon, title]) =>
            `<button type="button" data-action="nav" data-value="${key}" class="${activeKey === key ? 'active' : ''}"><span class="navIcon">${icon}</span>${esc(title)}</button>`).join('');
        $('main').innerHTML = (screens[state.screen] || auth)();
    }

    // ───────── actions (buttons) ─────────
    async function accountOp(id, op, message, confirmText) {
        if (confirmText && !confirm(confirmText)) return;
        await api('POST', `/api/accounts/${id}/${op}`);
        await refresh(message);
    }

    const actions = {
        nav: value => go(value),
        authswitch: value => { state.authTab = value; state.notice = ''; render(); },
        logout: () => endSession('You have been logged out.'),

        reactivate: async () => {
            const email = $('email').value.trim(), password = $('password').value;
            await api('POST', '/api/auth/reactivate', { email, password });
            const { account } = await api('POST', '/api/auth/login', { email, password });
            await startSession(account);
            note('Welcome back. Your account has been reactivated.');
        },
        deactivateSelf: async () => {
            if (!confirm('Deactivate your account? You will be logged out and can reactivate it by logging in again.')) return;
            await api('POST', `/api/accounts/${state.user.id}/deactivate`);
            await endSession('Your account is deactivated. Log in again at any time to reactivate it.');
        },

        accountdetail: id => go('accountdetail', { id }),
        profiledetail: id => go('profiledetail', { id }),
        suspend: id => accountOp(id, 'suspend', 'Account suspended.', 'Suspend this account? The user is locked out immediately.'),
        deactivateUser: id => accountOp(id, 'deactivate', 'Account deactivated.', 'Deactivate this account?'),
        reactivateUser: id => accountOp(id, 'reactivate', 'Account reactivated.'),
        approve: id => accountOp(id, 'approve', 'Account approved.'),
        reject: id => accountOp(id, 'reject', 'Credentials rejected. The company can submit them again.', 'Reject these credentials?'),
        resetpassword: async id => {
            if (!confirm('Reset this user\'s password? Their current password stops working.')) return;
            const { temporaryPassword } = await api('POST', `/api/accounts/${id}/reset-password`);
            await refresh(`Temporary password: ${temporaryPassword}  (shown once; share it with the user securely and ask them to change it).`);
        },
        resetExplore: () => go('explore'),
        project: id => go('project', { id, from: ['favorites', 'portfolio'].includes(state.screen) ? state.screen : undefined }),
        viewAgain: id => go('project', { id, reuse: true }),
        back: () => {
            const from = state.params.from;
            if (from === 'favorites' || from === 'portfolio') return go(from);
            return go('explore', state.lastExplore);
        },
        toggleFav: async id => {
            if (!state.user) return requireLogin('Log in or create a customer account to save projects to your favourites.');
            if (!isCustomer()) return;
            const shown = [state.data?.project, ...(state.data?.projects ?? [])].filter(p => p && String(p.id) === String(id));
            const adding = !shown[0]?.isFavourite;
            const result = await api(adding ? 'POST' : 'DELETE', `/api/favourites/${id}`);
            for (const p of shown) { p.isFavourite = result.isFavourite; p.favouriteCount = result.favouriteCount; }
            if (state.screen === 'favorites' && !result.isFavourite) state.data.projects = state.data.projects.filter(p => String(p.id) !== String(id));
            state.notice = '';
            render();
        },
        enquire: id => {
            if (!state.user) return requireLogin('Log in or create a customer account to send an enquiry to a designer.');
            if (!isCustomer()) return;
            const p = state.data.project;
            return go('enquire', { projectId: id, title: p.title, designer: p.designer });
        },
        newProject: () => go('projecteditor'),
        editProject: id => go('projecteditor', { id }),
        deleteProject: async id => {
            if (!confirm('Delete this project? Its image is removed too. This cannot be undone.')) return;
            await api('DELETE', `/api/projects/${id}`);
            await refresh('Project deleted.');
        },
        renameCategory: async id => {
            const current = state.data.categories.find(c => String(c.id) === String(id));
            const name = prompt('New name for this category:', current?.name ?? '');
            if (name === null || !name.trim() || name.trim() === current?.name) return;
            await api('PATCH', `/api/categories/${id}`, { name });
            await refresh('Category renamed.');
        },
        deleteCategory: async id => {
            const current = state.data.categories.find(c => String(c.id) === String(id));
            if (!confirm(`Delete the category "${current?.name}"?`)) return;
            await api('DELETE', `/api/categories/${id}`);
            await refresh('Category deleted.');
        },
        deleteUser: async id => {
            if (!confirm('Permanently delete this account and everything linked to it? This cannot be undone.')) return;
            await api('DELETE', `/api/accounts/${id}`);
            await go('accounts', {}, { notice: 'Account deleted.' });
        }
    };

    // ───────── forms (submit) ─────────
    // The account/profile forms are shared between "my own" and "admin viewing someone" screens.
    const targetId = () => (['accountdetail', 'profiledetail'].includes(state.screen) ? state.params.id : state.user.id);
    const isSelf = id => Number(id) === state.user.id;

    const forms = {
        authForm: async data => {
            const email = String(data.get('email') ?? '').trim();
            const password = String(data.get('password') ?? '');
            try {
                if (state.authTab === 'Register') {
                    await api('POST', '/api/auth/register', {
                        name: data.get('fullName'), email, password, role: data.get('regRole'),
                        registrationNumber: data.get('registrationNumber')
                    });
                }
                const { account } = await api('POST', '/api/auth/login', { email, password });
                await startSession(account);
                if (state.authTab === 'Register' && account.status === 'Pending') {
                    note('Account created. Submit your company details below so an administrator can approve it.');
                }
            } catch (err) {
                showAuthMessage(err.message, true, err.code === 'ACCOUNT_DEACTIVATED');
            }
        },

        accountForm: async data => {
            const id = targetId();
            const { account } = await api('PATCH', `/api/accounts/${id}`, { email: data.get('email') });
            if (isSelf(id)) state.user.email = account.email;
            await refresh('Email saved.');
        },
        passwordForm: async data => {
            if (data.get('newPassword') !== data.get('confirmPassword')) {
                return note('The new passwords do not match.', true);
            }
            await api('PATCH', `/api/accounts/${state.user.id}`, {
                currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword')
            });
            await refresh('Password changed.');
        },
        roleForm: async data => {
            const role = data.get('role');
            if (!confirm(`Change this user's role to "${role}"?`)) return;
            await api('POST', `/api/accounts/${state.params.id}/role`, { role });
            await refresh('Role updated.');
        },
        profileForm: async data => {
            const id = targetId();
            const body = {};
            for (const key of ['name', 'phone', 'description', 'location', 'services']) {
                if (data.has(key)) body[key] = data.get(key);
            }
            const { profile } = await api('PATCH', `/api/profiles/${id}`, body);
            if (isSelf(id)) state.user.name = profile.name;
            await refresh('Profile saved.');
        },
        deleteForm: async data => {
            if (!confirm('Permanently delete your account? This cannot be undone.')) return;
            await api('DELETE', `/api/accounts/${state.user.id}`, { password: data.get('deletePassword') });
            await endSession('Your account has been deleted.');
        },

        credentialsForm: async data => {
            await api('POST', '/api/credentials', { companyName: data.get('companyName'), registrationNumber: data.get('registrationNumber') });
            await refresh('Credentials submitted. An administrator will review them.');
        },

        exploreForm: data => go('explore', { query: String(data.get('query') ?? '').trim(), categoryId: data.get('categoryId'), sort: data.get('sort') }),
        enquiryForm: async data => {
            const body = {};
            for (const key of ['name', 'email', 'location', 'budget', 'requirements']) body[key] = data.get(key);
            body.projectId = state.params.projectId;
            await api('POST', '/api/enquiries', body);
            // Show the confirmation on this screen without reloading the project (reloading would count another view).
            state.params = { ...state.params, sent: true };
            state.notice = '';
            render();
            window.scrollTo(0, 0);
        },
        projectForm: async data => {
            const file = data.get('image');
            if (file && file.size > MAX_IMAGE_BYTES) return note('That image is larger than 5 MB. Please choose a smaller one.', true);
            if (!file || !file.name || file.size === 0) data.delete('image'); // no file chosen: keep the current image
            const id = state.params.id;
            await api(id ? 'PATCH' : 'POST', id ? `/api/projects/${id}` : '/api/projects', data);
            await go('portfolio', {}, { notice: id ? 'Project saved.' : 'Project added to your portfolio.' });
        },
        reportForm: data => go('reports', { period: data.get('period'), date: data.get('date') }),
        categorySearchForm: data => go('categories', { query: String(data.get('query') ?? '').trim() }),
        categoryForm: async data => {
            await api('POST', '/api/categories', { name: data.get('name') });
            await go('categories', {}, { notice: 'Category added.' });
        },
        accountSearchForm: data => go('accounts', { query: data.get('query'), role: data.get('role'), status: data.get('status') }),
        profileSearchForm: data => go('profiles', { query: data.get('query') }),
        createAccountForm: async data => {
            const { account } = await api('POST', '/api/accounts', {
                name: data.get('name'), email: data.get('email'), password: data.get('password'),
                role: data.get('role'), status: data.get('status')
            });
            await go('accountdetail', { id: account.id }, { notice: 'Account created.' });
        }
    };

    // ───────── event wiring ─────────
    async function guarded(fn) {
        if (state.busy) return;
        state.busy = true;
        try { await fn(); } catch (err) { handleError(err); } finally { state.busy = false; }
    }

    document.addEventListener('click', e => {
        const button = e.target.closest('[data-action]');
        if (!button || button.disabled) return;
        const handler = actions[button.dataset.action];
        if (handler) guarded(() => handler(button.dataset.value));
    });

    document.addEventListener('submit', e => {
        const form = e.target;
        const handler = forms[form.id];
        if (!handler) return;
        e.preventDefault();
        guarded(() => handler(new FormData(form), form));
    });

    // Registration form: show the registration-number field only for designers.
    document.addEventListener('change', e => {
        if (e.target.id === 'image') return previewImage(e.target);
        if (e.target.name === 'removeImage') return removeTicked(e.target);
        if (e.target.id !== 'regRole') return;
        const designer = e.target.value === ROLE.DESIGNER;
        $('regNumberField').hidden = !designer;
        $('registrationNumber').required = designer;
        document.querySelector('label[for="fullName"]').textContent = designer ? 'Company name' : 'Full name';
    });

    // Project editor: check the chosen file and show a preview before uploading.
    let originalPreview = null;
    function previewImage(input) {
        const file = input.files && input.files[0];
        const hint = $('imageHint'), box = $('imagePreview');
        if (!file) return;
        if (originalPreview === null) originalPreview = box.innerHTML;
        // Choosing a new image replaces the old one, so "Remove the current image" no longer applies.
        const remove = document.querySelector('input[name="removeImage"]');
        if (remove) remove.checked = false;
        if (file.size > MAX_IMAGE_BYTES) {
            input.value = '';
            hint.textContent = 'That image is larger than 5 MB. Please choose a smaller one.';
            return;
        }
        hint.textContent = `${file.name} will be uploaded when you save.`;
        if (typeof URL !== 'undefined' && URL.createObjectURL) {
            box.innerHTML = `<div class="ph"><img src="${esc(URL.createObjectURL(file))}" alt="Preview"/><span>Project image</span></div>`;
        }
    }

    // Ticking "Remove the current image" cancels any new file chosen, so the two choices never conflict.
    function removeTicked(checkbox) {
        if (!checkbox.checked) return;
        $('image').value = '';
        if (originalPreview !== null) $('imagePreview').innerHTML = originalPreview;
        $('imageHint').textContent = 'The current image will be removed when you save.';
    }

    // A project image that cannot be loaded is removed so the striped placeholder underneath shows instead.
    document.addEventListener('error', e => {
        const el = e.target;
        if (el && el.tagName === 'IMG' && el.closest && el.closest('.ph')) el.remove();
    }, true);

    // ───────── start ─────────
    (async function init() {
        try {
            const { account } = await api('GET', '/api/auth/me');
            await startSession(account);
        } catch {
            state.user = null;
            await go('explore'); // guests can browse projects without an account
        }
    })();
})();
