/**
 * Hospital Management System (HMS) - Dynamic Navigation & Layout Generator
 * Generates unified Header and Sidebar across all HMS pages with granular RBAC permission awareness.
 */

const HMSNav = (function () {
  function getPathContext() {
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

    return {
      rootPrefix: isSubRole ? '../../' : (isInsidePages ? '../' : './'),
      pagesPrefix: isSubRole ? '../' : (isInsidePages ? '' : 'pages/'),
      currentPath: path
    };
  }

  function renderSidebar(activeKey = '') {
    const sidebarEl = document.getElementById('hms-sidebar');
    if (!sidebarEl) return;

    const ctx = getPathContext();
    const currentUser = HMSAuth.getCurrentUser();
    const role = currentUser.role || 'Super Admin';
    const isSuperAdmin = HMSAuth.isSuperAdmin();

    // Determine role's landing dashboard
    const dashboardLink = HMSAuth.getDashboardPath(role);

    // Nav Definitions with Granular Required Permissions
    const navDefinition = [
      { section: 'Main Overview' },
      { key: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill', href: dashboardLink, perm: null }, // Everyone sees their role dashboard
      
      { section: 'Administration & RBAC', perm: ['users.manage', 'roles.manage', 'revenue.view', 'price.manage'] },
      { key: 'users', label: 'User Management', icon: 'bi-people-fill', href: `${ctx.pagesPrefix}admin/users.html`, perm: 'users.manage' },
      { key: 'roles', label: 'Roles & Permissions', icon: 'bi-shield-lock-fill', href: `${ctx.pagesPrefix}admin/roles.html`, perm: 'roles.manage' },
      { key: 'revenue', label: 'Revenue Dashboard', icon: 'bi-graph-up-arrow', href: `${ctx.pagesPrefix}admin/revenue.html`, perm: 'revenue.view' },
      { key: 'prices', label: 'Price Management', icon: 'bi-tag-fill', href: `${ctx.pagesPrefix}admin/prices.html`, perm: 'price.view' },

      { section: 'Department Portals', perm: ['lab.view', 'investigation.view', 'pharmacy.view', 'inventory.view'] },
      { key: 'lab-portal', label: 'Laboratory', icon: 'bi-eyedropper', href: `${ctx.pagesPrefix}lab/dashboard.html`, perm: 'lab.view' },
      { key: 'investigation-portal', label: 'Investigation Suite', icon: 'bi-cpu-fill', href: `${ctx.pagesPrefix}investigation/dashboard.html`, perm: 'investigation.view' },
      { key: 'pharmacy-portal', label: 'Pharmacy & Stock', icon: 'bi-capsule', href: `${ctx.pagesPrefix}pharmacy/dashboard.html`, perm: 'pharmacy.view' },
      { key: 'store-portal', label: 'Store & Inventory', icon: 'bi-box-seam-fill', href: `${ctx.pagesPrefix}store/dashboard.html`, perm: 'inventory.view' },

      { section: 'Clinical & OPD', perm: ['patient.view', 'appointment.view', 'consultation.manage', 'prescriptions.manage'] },
      { key: 'patients', label: 'Patients Directory', icon: 'bi-person-lines-fill', href: `${ctx.pagesPrefix}patients.html`, perm: 'patient.view' },
      { key: 'appointments', label: 'Appointments', icon: 'bi-calendar-check-fill', href: `${ctx.pagesPrefix}appointments.html`, perm: 'appointment.view' },
      { key: 'doctors', label: 'Doctors & Schedule', icon: 'bi-person-badge-fill', href: `${ctx.pagesPrefix}doctors.html`, perm: 'appointment.view' },
      { key: 'consultation', label: 'Consultation Suite', icon: 'bi-clipboard2-pulse-fill', href: `${ctx.pagesPrefix}consultation.html`, perm: 'consultation.manage' },
      { key: 'prescriptions', label: 'Prescriptions', icon: 'bi-prescription2', href: `${ctx.pagesPrefix}prescriptions.html`, perm: 'prescriptions.manage' },
      { key: 'departments', label: 'Clinical Departments', icon: 'bi-hospital-fill', href: `${ctx.pagesPrefix}departments.html`, perm: 'patient.view' },
      { key: 'health-checkup', label: 'Health Packages', icon: 'bi-heart-pulse-fill', href: `${ctx.pagesPrefix}health-checkup.html`, perm: 'health_checkup.manage' },
      { key: 'discharge-summary', label: 'Discharge Summary', icon: 'bi-file-earmark-medical-fill', href: `${ctx.pagesPrefix}discharge-summary.html`, perm: 'discharge.manage' },

      { section: 'Hospital Operations', perm: ['billing.view', 'opd.reception', 'lab.report.manage', 'inventory.view'] },
      { key: 'billing', label: 'Billing & Invoicing', icon: 'bi-receipt-cutoff', href: `${ctx.pagesPrefix}billing.html`, perm: 'billing.view' },
      { key: 'waiting-time', label: 'OPD Queue Tracker', icon: 'bi-clock-history', href: `${ctx.pagesPrefix}waiting-time.html`, perm: 'opd.reception' },
      { key: 'documents', label: 'Document Archives', icon: 'bi-folder2-open', href: `${ctx.pagesPrefix}documents.html`, perm: 'patient.view' },
      { key: 'assets', label: 'Hospital Assets', icon: 'bi-tools', href: `${ctx.pagesPrefix}assets.html`, perm: 'inventory.view' },

      { section: 'System & Feedback', perm: null },
      { key: 'ratings', label: 'Ratings & Reviews', icon: 'bi-star-fill', href: `${ctx.pagesPrefix}ratings.html`, perm: 'patient.view' },
      { key: 'settings', label: 'System Settings', icon: 'bi-gear-fill', href: `${ctx.pagesPrefix}settings.html`, perm: null }
    ];

    let navHtml = '';
    let currentSectionPermitted = true;

    navDefinition.forEach(item => {
      if (item.section) {
        if (!item.perm) {
          currentSectionPermitted = true;
          navHtml += `<div class="hms-nav-group-label">${item.section}</div>`;
        } else {
          // Check if user has at least one permission in the section
          const perms = Array.isArray(item.perm) ? item.perm : [item.perm];
          const hasAny = isSuperAdmin || perms.some(p => HMSAuth.hasPermission(p));
          currentSectionPermitted = hasAny;
          if (hasAny) {
            navHtml += `<div class="hms-nav-group-label">${item.section}</div>`;
          }
        }
      } else {
        if (!currentSectionPermitted) return;

        // Check if item has permission requirement
        let isVisible = true;
        if (item.perm) {
          isVisible = isSuperAdmin || HMSAuth.hasPermission(item.perm);
        }

        if (isVisible) {
          const isActive = activeKey === item.key ? 'active' : '';
          navHtml += `
            <a href="${item.href}" class="hms-nav-item ${isActive}">
              <i class="bi ${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `;
        }
      }
    });

    // Badge styling for user
    const badgeClass = currentUser.badgeClass || (isSuperAdmin ? 'bg-danger' : 'bg-primary');

    sidebarEl.innerHTML = `
      <div class="hms-sidebar-brand d-flex align-items-center justify-content-between">
        <a href="${dashboardLink}" class="d-flex align-items-center gap-2 text-decoration-none">
          <div class="logo-circle d-inline-flex align-items-center justify-content-center" style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #0d6efd 0%, #0052cc 100%); color: #fff; font-weight: 800; font-size: 0.85rem; box-shadow: 0 2px 6px rgba(13,110,253,0.4);">
            HMS
          </div>
          <div>
            <span class="fw-bold fs-5 text-white tracking-tight">MedPulse</span>
            <span class="badge bg-secondary-subtle text-white-50 px-1 ms-1" style="font-size: 0.6rem; letter-spacing: 0.5px;">PRO</span>
          </div>
        </a>
        <button class="hms-sidebar-close-btn d-lg-none" onclick="HMSNav.toggleMobileSidebar()" title="Close Sidebar" aria-label="Close menu">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="hms-sidebar-nav">
        ${navHtml}
      </div>

      <div class="hms-sidebar-footer">
        <div class="d-flex align-items-center gap-2">
          <img src="${currentUser.avatar || 'assets/images/avatars/admin.jpg'}" alt="Avatar" class="rounded-circle border border-secondary" width="38" height="38" style="object-fit: cover;">
          <div class="flex-grow-1 overflow-hidden">
            <div class="text-truncate fw-semibold text-white user-profile-name" style="font-size: 0.82rem;" title="${currentUser.name}">${currentUser.name}</div>
            <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px;">${currentUser.role}</span>
          </div>
          <button class="btn btn-sm btn-outline-danger p-1" title="Log Out" onclick="HMSAuth.logout()">
            <i class="bi bi-box-arrow-right fs-6"></i>
          </button>
        </div>
      </div>
    `;

    // Mobile sidebar toggle behavior
    sidebarEl.querySelectorAll('.hms-nav-item').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 992) {
          toggleMobileSidebar();
        }
      });
    });

    let backdrop = document.querySelector('.hms-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'hms-sidebar-backdrop';
      backdrop.onclick = toggleMobileSidebar;
      document.body.appendChild(backdrop);
    }
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('hms-sidebar');
    const backdrop = document.querySelector('.hms-sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('show');
    if (backdrop) backdrop.classList.toggle('show');
  }

  function renderHeader(pageTitle = 'Dashboard', breadcrumbs = ['Home']) {
    const headerEl = document.getElementById('hms-header');
    if (!headerEl) return;

    const ctx = getPathContext();
    const currentUser = HMSAuth.getCurrentUser();
    const isSuperAdmin = HMSAuth.isSuperAdmin();

    const breadcrumbHtml = breadcrumbs.map((b, idx) => {
      const isLast = idx === breadcrumbs.length - 1;
      return `<li class="breadcrumb-item ${isLast ? 'active fw-bold' : ''}" style="${isLast ? 'color: #0f172a !important;' : 'color: #64748b !important;'}">${b}</li>`;
    }).join('');

    const coreRolesList = [
      { name: 'Super Admin', icon: 'bi-shield-shaded', color: 'text-danger' },
      { name: 'Admin', icon: 'bi-shield-check', color: 'text-primary' },
      { name: 'Receptionist', icon: 'bi-person-workspace', color: 'text-warning' },
      { name: 'Doctor', icon: 'bi-heart-pulse', color: 'text-info' },
      { name: 'Lab', icon: 'bi-eyedropper', color: 'text-purple' },
      { name: 'Investigation', icon: 'bi-cpu', color: 'text-teal' },
      { name: 'Pharmacy', icon: 'bi-capsule', color: 'text-success' },
      { name: 'Store', icon: 'bi-box-seam', color: 'text-secondary' },
      { name: 'Patient', icon: 'bi-person-heart', color: 'text-dark' }
    ];

    const roleDropdownItems = coreRolesList.map(r => {
      const isCurrent = (currentUser.role === r.name);
      const active = isCurrent ? 'active fw-bold' : '';
      const textStyle = isCurrent ? 'color: #ffffff !important;' : 'color: #0f172a !important;';
      return `
        <li>
          <a class="dropdown-item d-flex align-items-center gap-2 ${active}" href="javascript:void(0)" onclick="HMSNav.switchAndRefresh('${r.name}')" style="${textStyle}">
            <i class="bi ${r.icon} ${r.color}"></i> <span>${r.name}</span>
          </a>
        </li>
      `;
    }).join('');

    headerEl.innerHTML = `
      <div class="d-flex align-items-center gap-2 gap-md-3 min-w-0 overflow-hidden">
        <button class="btn btn-light d-lg-none p-2 border flex-shrink-0" onclick="HMSNav.toggleMobileSidebar()" aria-label="Toggle navigation">
          <i class="bi bi-list fs-5"></i>
        </button>
        <div class="overflow-hidden">
          <h1 class="hms-header-title h5 mb-0 fw-bold text-dark text-truncate" title="${pageTitle}">${pageTitle}</h1>
          <nav aria-label="breadcrumb" class="d-none d-md-block">
            <ol class="breadcrumb mb-0" style="font-size: 0.75rem;">
              ${breadcrumbHtml}
            </ol>
          </nav>
        </div>
      </div>

      <div class="d-flex align-items-center gap-2 gap-md-3 flex-shrink-0">
        <!-- GLOBAL SEARCH BAR -->
        <div class="position-relative d-none d-lg-block" style="width: 220px;">
          <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" style="font-size: 0.85rem;"></i>
          <input type="text" class="form-control form-control-sm ps-5 bg-light rounded-pill border-0 shadow-none" placeholder="Search patients, doctors..." id="globalSearchInput">
        </div>

        <!-- SIMULATE ROLE VIEW (Testing & Evaluation Shortcut) -->
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-primary dropdown-toggle d-flex align-items-center gap-1 shadow-sm role-switcher-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Switch user role to test permissions">
            <i class="bi bi-person-gear"></i>
            <span class="role-label d-none d-md-inline">Role:</span> <strong class="role-name-text">${currentUser.role}</strong>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm" style="min-width: 210px;">
            <li><h6 class="dropdown-header text-uppercase" style="font-size: 0.68rem; letter-spacing: 0.5px;">Simulate Role View</h6></li>
            ${roleDropdownItems}
          </ul>
        </div>

        <!-- NOTIFICATIONS -->
        <div class="dropdown">
          <button class="btn btn-sm btn-light border position-relative p-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-bell fs-6 text-secondary"></i>
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-lg py-0 border-0" style="width: min(320px, 88vw); font-size: 0.85rem;">
            <li class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
              <span class="fw-bold">Notifications</span>
              <span class="badge bg-primary rounded-pill">3 New</span>
            </li>
            <li>
              <a class="dropdown-item p-3 border-bottom d-flex gap-2 align-items-start" href="${ctx.pagesPrefix}waiting-time.html">
                <i class="bi bi-person-check-fill text-success fs-5"></i>
                <div>
                  <div class="fw-semibold text-dark">Patient Checked In</div>
                  <div class="text-muted" style="font-size: 0.78rem;">Robert Harrison arrived for Cardiology OPD</div>
                  <div class="text-primary mt-1" style="font-size: 0.7rem;">Just now</div>
                </div>
              </a>
            </li>
            <li>
              <a class="dropdown-item p-3 border-bottom d-flex gap-2 align-items-start" href="${ctx.pagesPrefix}documents.html">
                <i class="bi bi-file-earmark-medical text-info fs-5"></i>
                <div>
                  <div class="fw-semibold text-dark">Lab Report Verified</div>
                  <div class="text-muted" style="font-size: 0.78rem;">Complete Blood Count report uploaded</div>
                  <div class="text-primary mt-1" style="font-size: 0.7rem;">15 mins ago</div>
                </div>
              </a>
            </li>
          </ul>
        </div>

        <!-- PROFILE MENU -->
        <div class="dropdown">
          <button class="btn btn-sm p-0 border-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <img src="${currentUser.avatar || 'assets/images/avatars/admin.jpg'}" alt="Avatar" class="rounded-circle border" width="38" height="38" style="object-fit: cover;">
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm">
            <li class="px-3 py-2 border-bottom">
              <div class="fw-bold text-dark">${currentUser.name}</div>
              <div class="text-muted small">${currentUser.email}</div>
              <span class="badge bg-secondary-subtle text-primary border mt-1" style="font-size: 0.68rem;">${currentUser.role}</span>
            </li>
            <li><a class="dropdown-item d-flex align-items-center gap-2" href="${ctx.pagesPrefix}settings.html"><i class="bi bi-person"></i> Account Settings</a></li>
            ${isSuperAdmin ? `<li><a class="dropdown-item d-flex align-items-center gap-2" href="${ctx.pagesPrefix}admin/roles.html"><i class="bi bi-shield-lock"></i> Roles & Permissions</a></li>` : ''}
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger d-flex align-items-center gap-2" href="javascript:void(0)" onclick="HMSAuth.logout()"><i class="bi bi-box-arrow-right"></i> Log Out</a></li>
          </ul>
        </div>
      </div>
    `;
  }

  function switchAndRefresh(roleName) {
    HMSAuth.switchRole(roleName);
    const targetDashboard = HMSAuth.getDashboardPath(roleName);
    window.location.href = targetDashboard;
  }

  // Page-Level RBAC Guard
  function enforcePagePermission(requiredPermCode, pageDisplayName = 'this module') {
    const isSuperAdmin = HMSAuth.isSuperAdmin();
    if (isSuperAdmin) return true;

    if (!HMSAuth.hasPermission(requiredPermCode)) {
      const mainContent = document.querySelector('.hms-content-body') || document.querySelector('main');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="card border-0 shadow-sm rounded-4 text-center p-5 my-4 bg-white">
            <div class="mb-3">
              <div class="d-inline-flex p-3 rounded-circle bg-danger-subtle text-danger fs-1">
                <i class="bi bi-shield-slash"></i>
              </div>
            </div>
            <h3 class="fw-bold text-dark mb-2">Access Restricted</h3>
            <p class="text-muted mx-auto mb-4" style="max-width: 520px;">
              Your current user role (<strong>${HMSAuth.getCurrentUser().role}</strong>) does not have the required permission (<code>${requiredPermCode}</code>) to access ${pageDisplayName}.
            </p>
            <div>
              <a href="${HMSAuth.getDashboardPath(HMSAuth.getCurrentUser().role)}" class="btn btn-primary px-4 rounded-pill">
                <i class="bi bi-arrow-left me-1"></i> Return to My Dashboard
              </a>
            </div>
          </div>
        `;
      }
      return false;
    }
    return true;
  }

  function init(activeKey = 'dashboard', pageTitle = 'Dashboard', breadcrumbs = ['Home', 'Dashboard'], requiredPerm = null) {
    renderSidebar(activeKey);
    renderHeader(pageTitle, breadcrumbs);

    if (requiredPerm) {
      enforcePagePermission(requiredPerm, pageTitle);
    }
  }

  return {
    init,
    renderSidebar,
    renderHeader,
    toggleMobileSidebar,
    switchAndRefresh,
    enforcePagePermission
  };
})();

if (typeof window !== 'undefined') {
  window.HMSNav = HMSNav;
}
