/**
 * Hospital Management System (HMS) - Authentication & Role Management Layer
 * Supports 9 core roles + dynamic custom roles, session persistence, and granular RBAC permission checks.
 */

const HMSAuth = (function () {
  const USER_KEY = 'MEDPULSE_HMS_USER';

  // Standard Profiles for Core Roles
  const DEFAULT_PROFILES = {
    'Super Admin': {
      role: 'Super Admin',
      roleSlug: 'super_admin',
      name: 'Hospital Super Admin',
      title: 'Chief Systems Administrator',
      email: 'superadmin@hms.com',
      avatar: 'assets/images/avatars/admin.jpg',
      badgeClass: 'bg-danger text-white',
      isSuperAdmin: true,
      permissions: ['*'] // Super Admin possesses all permissions
    },
    'Admin': {
      role: 'Admin',
      roleSlug: 'admin',
      name: 'Dr. Arthur Pendelton',
      title: 'Medical Director & Chief Admin',
      email: 'admin@hms.com',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-primary text-white',
      isSuperAdmin: false,
      permissions: [
        'patient.view', 'patient.create', 'patient.edit',
        'appointment.view', 'appointment.book', 'appointment.manage',
        'opd.reception', 'ipd.reception', 'consultation.manage', 'prescriptions.manage', 'discharge.manage', 'health_checkup.manage',
        'billing.view', 'billing.create', 'billing.edit',
        'lab.view', 'lab.test.manage', 'lab.report.manage', 'lab.billing',
        'investigation.view', 'investigation.manage',
        'pharmacy.view', 'pharmacy.medicine.manage', 'pharmacy.stock.manage', 'pharmacy.billing.manage',
        'inventory.view', 'inventory.purchase.manage', 'inventory.stock.manage',
        'revenue.view', 'price.view', 'departments.manage', 'settings.manage'
      ]
    },
    'Receptionist': {
      role: 'Receptionist',
      roleSlug: 'receptionist',
      name: 'Karen Williams',
      title: 'Front Desk Lead Coordinator',
      email: 'reception@hms.com',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-warning text-dark',
      isSuperAdmin: false,
      permissions: [
        'patient.view', 'patient.create', 'patient.edit',
        'appointment.view', 'appointment.book', 'appointment.manage',
        'opd.reception', 'ipd.reception',
        'billing.view', 'billing.create',
        'discharge.manage'
      ]
    },
    'Doctor': {
      role: 'Doctor',
      roleSlug: 'doctor',
      id: 'DOC-101',
      name: 'Dr. Sarah Jenkins',
      title: 'Senior Cardiologist, MD',
      email: 'ananya@hms.com',
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-info text-dark',
      isSuperAdmin: false,
      permissions: [
        'patient.view',
        'appointment.view',
        'consultation.manage',
        'prescriptions.manage',
        'discharge.manage',
        'health_checkup.manage',
        'lab.report.manage',
        'investigation.view'
      ]
    },
    'Lab': {
      role: 'Lab',
      roleSlug: 'lab',
      name: 'Central Lab Incharge',
      title: 'Senior Clinical Pathologist',
      email: 'lab@hms.com',
      avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-purple text-white',
      isSuperAdmin: false,
      permissions: [
        'patient.view',
        'lab.view',
        'lab.test.manage',
        'lab.report.manage',
        'lab.billing'
      ]
    },
    'Investigation': {
      role: 'Investigation',
      roleSlug: 'investigation',
      name: 'Radiology & Imaging Unit',
      title: 'Lead Imaging Technologist',
      email: 'investigation@hms.com',
      avatar: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-teal text-white',
      isSuperAdmin: false,
      permissions: [
        'patient.view',
        'investigation.view',
        'investigation.manage'
      ]
    },
    'Pharmacy': {
      role: 'Pharmacy',
      roleSlug: 'pharmacy',
      name: 'Chief Pharmacist',
      title: 'Head of Clinical Pharmacy & Dispensary',
      email: 'pharmacy@hms.com',
      avatar: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-success text-white',
      isSuperAdmin: false,
      permissions: [
        'patient.view',
        'prescriptions.manage',
        'pharmacy.view',
        'pharmacy.medicine.manage',
        'pharmacy.stock.manage',
        'pharmacy.billing.manage'
      ]
    },
    'Store': {
      role: 'Store',
      roleSlug: 'store',
      name: 'Central Store Manager',
      title: 'Biomedical Assets & Inventory Controller',
      email: 'store@hms.com',
      avatar: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-secondary text-white',
      isSuperAdmin: false,
      permissions: [
        'inventory.view',
        'inventory.purchase.manage',
        'inventory.stock.manage'
      ]
    },
    'Patient': {
      role: 'Patient',
      roleSlug: 'patient',
      id: 'H1278',
      name: 'chandanap',
      title: 'Patient (ID: H1278)',
      email: 'chandanap.murthy@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
      badgeClass: 'bg-success text-white',
      isSuperAdmin: false,
      permissions: [
        'patient.portal',
        'appointment.book',
        'billing.view'
      ]
    }
  };

  // Normalize role string to profile key
  function normalizeRoleKey(role) {
    if (!role) return 'Super Admin';
    const clean = role.toString().trim().toLowerCase().replace(/[_-]/g, ' ');
    if (clean.includes('super')) return 'Super Admin';
    if (clean === 'admin') return 'Admin';
    if (clean.includes('recept')) return 'Receptionist';
    if (clean.includes('doc')) return 'Doctor';
    if (clean.includes('lab') || clean.includes('patho')) return 'Lab';
    if (clean.includes('invest') || clean.includes('radio') || clean.includes('scan')) return 'Investigation';
    if (clean.includes('pharm')) return 'Pharmacy';
    if (clean.includes('store') || clean.includes('invent')) return 'Store';
    if (clean.includes('patient')) return 'Patient';
    
    // Check direct match
    const found = Object.keys(DEFAULT_PROFILES).find(k => k.toLowerCase() === clean);
    return found || 'Admin';
  }

  function getCurrentUser() {
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure permissions array exists
        if (!parsed.permissions) {
          const key = normalizeRoleKey(parsed.role);
          parsed.permissions = DEFAULT_PROFILES[key] ? DEFAULT_PROFILES[key].permissions : [];
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing stored user:', e);
    }
    // Default fallback to Super Admin
    const defaultUser = DEFAULT_PROFILES['Super Admin'];
    setCurrentUser(defaultUser);
    return defaultUser;
  }

  function setCurrentUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('hms:user-changed', { detail: user }));
  }

  function isSuperAdmin() {
    const u = getCurrentUser();
    return Boolean(u.isSuperAdmin || (u.role && u.role.toLowerCase().includes('super')) || (u.permissions && u.permissions.includes('*')));
  }

  function hasPermission(permCode) {
    const u = getCurrentUser();
    if (isSuperAdmin()) return true;
    if (!u || !u.permissions || !Array.isArray(u.permissions)) return false;
    return u.permissions.includes(permCode) || u.permissions.includes('*');
  }

  function login(role, email, password, customName = '', customAvatar = '', backendPermissions = null, isSuperAdminUser = false, customId = null, customPhone = '') {
    const roleKey = normalizeRoleKey(role);
    const profile = DEFAULT_PROFILES[roleKey] || DEFAULT_PROFILES['Admin'];

    const isDemoChandana = Boolean(email && email.toLowerCase().includes('chandana'));

    // Resolve name: prioritize customName, then derived name from email, else profile default
    let finalName = customName;
    if (!finalName) {
      if (roleKey === 'Patient' && email && !isDemoChandana) {
        finalName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      } else {
        finalName = profile.name;
      }
    }

    // Resolve Patient ID
    let finalId = customId;
    if (!finalId) {
      if (roleKey === 'Patient' && email && !isDemoChandana) {
        const hash = Math.abs(email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 9000 + 1000;
        finalId = `PAT-2026-${hash}`;
      } else {
        finalId = profile.id;
      }
    }

    // Resolve Avatar
    let finalAvatar = customAvatar;
    if (!finalAvatar) {
      if (roleKey === 'Patient' && email && !isDemoChandana) {
        finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=059669&color=fff&bold=true`;
      } else {
        finalAvatar = profile.avatar;
      }
    }

    const finalPerms = Array.isArray(backendPermissions) && backendPermissions.length > 0 
      ? backendPermissions 
      : profile.permissions;

    const user = {
      ...profile,
      id: finalId,
      patientId: roleKey === 'Patient' ? finalId : undefined,
      role: profile.role,
      roleSlug: profile.roleSlug,
      name: finalName,
      email: email || profile.email,
      phone: customPhone || profile.phone || '',
      avatar: finalAvatar,
      isSuperAdmin: isSuperAdminUser || profile.isSuperAdmin,
      permissions: finalPerms
    };

    if (roleKey === 'Patient' && finalId) {
      try {
        const pObj = {
          id: finalId,
          name: finalName,
          age: profile.age || 26,
          dob: profile.dob || '2000-01-01',
          gender: profile.gender || 'General',
          phone: customPhone || profile.phone || '+91 98765 00000',
          email: email || profile.email,
          address: 'Main Health Registry',
          bloodGroup: profile.bloodGroup || 'B+',
          emergencyContact: customPhone || profile.phone || '',
          medicalHistory: 'Registered patient account',
          status: 'Active',
          registeredDate: new Date().toISOString().split('T')[0]
        };

        const rawList = localStorage.getItem('HMS_REGISTERED_PATIENTS_LIST');
        const list = rawList ? JSON.parse(rawList) : [];
        const existingIdx = list.findIndex(p => p.id === finalId || (p.email && p.email.toLowerCase() === (email || '').toLowerCase()));
        if (existingIdx !== -1) {
          list[existingIdx] = { ...list[existingIdx], ...pObj };
        } else {
          list.unshift(pObj);
        }
        localStorage.setItem('HMS_REGISTERED_PATIENTS_LIST', JSON.stringify(list));

        if (typeof HMSDataStore !== 'undefined') {
          const dsPatients = HMSDataStore.getCollection('patients');
          if (!dsPatients.some(p => p.id === finalId || (p.email && p.email.toLowerCase() === (email || '').toLowerCase()))) {
            HMSDataStore.addItem('patients', pObj);
          }
        }
      } catch (e) {
        console.warn('Could not register patient in local registry:', e);
      }
    }

    setCurrentUser(user);
    return user;
  }

  function switchRole(role) {
    const roleKey = normalizeRoleKey(role);
    const profile = DEFAULT_PROFILES[roleKey] || DEFAULT_PROFILES['Admin'];

    let customPatientId = profile.id;
    let customPatientName = profile.name;
    let customPatientEmail = profile.email;

    if (roleKey === 'Patient' && typeof HMSDataStore !== 'undefined') {
      const patients = HMSDataStore.getCollection('patients');
      const found = patients.find(p => p.email && p.email.toLowerCase().includes('chandana')) || patients[0];
      if (found) {
        customPatientId = found.id;
        customPatientName = found.name;
        customPatientEmail = found.email;
      }
    }

    const user = {
      ...profile,
      id: customPatientId,
      name: customPatientName,
      email: customPatientEmail
    };
    setCurrentUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem(USER_KEY);

    // Call backend API logout in background
    fetch('api/auth.php?action=logout', { method: 'POST' }).catch(() => {});

    // Target login.html relative to current nesting
    const path = window.location.pathname.replace(/\\/g, '/');
    const isSubRole = path.includes('/pages/admin/') ||
                      path.includes('/pages/doctor/') ||
                      path.includes('/pages/receptionist/') ||
                      path.includes('/pages/lab/') ||
                      path.includes('/pages/investigation/') ||
                      path.includes('/pages/pharmacy/') ||
                      path.includes('/pages/store/') ||
                      path.includes('/pages/patient/');
    const isInsidePages = path.includes('/pages/');

    let target = 'login.html';
    if (isSubRole) target = '../../login.html';
    else if (isInsidePages) target = '../login.html';

    window.location.href = target;
  }

  function getDashboardPath(role) {
    const roleKey = normalizeRoleKey(role);
    const slug = DEFAULT_PROFILES[roleKey] ? DEFAULT_PROFILES[roleKey].roleSlug : 'admin';

    const path = window.location.pathname.replace(/\\/g, '/');
    const isSubRole = path.includes('/pages/admin/') ||
                      path.includes('/pages/doctor/') ||
                      path.includes('/pages/receptionist/') ||
                      path.includes('/pages/lab/') ||
                      path.includes('/pages/investigation/') ||
                      path.includes('/pages/pharmacy/') ||
                      path.includes('/pages/store/') ||
                      path.includes('/pages/patient/');
    const isInsidePages = path.includes('/pages/');

    let prefix = 'pages/';
    if (isSubRole) prefix = '../';
    else if (isInsidePages) prefix = '';

    // Route Super Admin and Admin to admin dashboard
    if (slug === 'super_admin' || slug === 'admin') {
      return `${prefix}admin/dashboard.html`;
    }
    return `${prefix}${slug}/dashboard.html`;
  }

  return {
    getCurrentUser,
    setCurrentUser,
    isSuperAdmin,
    hasPermission,
    login,
    switchRole,
    logout,
    getDashboardPath,
    normalizeRoleKey,
    DEFAULT_PROFILES
  };
})();

if (typeof window !== 'undefined') {
  window.HMSAuth = HMSAuth;
}
