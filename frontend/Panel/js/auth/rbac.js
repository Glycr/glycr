// ===============================================
// RBAC
// ===============================================

function canSuspendUser(user)   { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canDeleteUser(user)    { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canEditUser(user)      { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canResetPassword(user) { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && (user.role === 'customer' || user.role === 'organizer')); }
function canEditSettings()      { return currentAdmin.role === 'admin'; }
