/**
 * Admin Module for User and Permission Management
 * Handles all admin-related functionality including user management,
 * permission settings, and attribute configuration
 */
(function() {
  'use strict';

  // ============================================
  // MODULE STATE
  // ============================================

  let userPermissions = null;
  let allSettings = null;
  let editingUserEmail = null;
  let currentUser = null;
  let draggedAttributeRow = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize admin module
   * @param {string} user - Current logged-in user email
   */
  function initAdmin(user) {
    currentUser = user;
    console.log('Admin module initialized with user:', currentUser);
    loadUserPermissions();
  }

  /**
   * Load current user's permissions from server
   */
  function loadUserPermissions() {
    if (!currentUser) {
      console.error('No current user set');
      return;
    }

    fetch(`admin_user_settings.php?action=getPermissions&currentUser=${encodeURIComponent(currentUser)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          userPermissions = data.permissions;

          // Show settings button if admin
          if (userPermissions.isAdmin) {
            showSettingsButton();
          }

          console.log('User permissions loaded:', userPermissions);

          // Trigger custom event for other modules
          window.dispatchEvent(new CustomEvent('permissionsLoaded', {
            detail: { permissions: userPermissions }
          }));
        }
      })
      .catch(err => {
        console.error('Failed to load user permissions:', err);
      });
  }

  /**
   * Show settings button for admin users
   */
  function showSettingsButton() {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.style.display = 'inline-block';
    }
  }

  /**
   * Get current user permissions
   * @returns {Object|null} User permissions object
   */
  function getUserPermissions() {
    return userPermissions;
  }

  /**
   * Check if current user is admin
   * @returns {boolean}
   */
  function isAdmin() {
    return userPermissions && userPermissions.isAdmin === true;
  }

  /**
   * Check if attribute is visible to current user
   * @param {string} attributeName - Name of the attribute
   * @returns {boolean}
   */
  function isAttributeVisible(attributeName) {
    if (!userPermissions) return true; // Default to visible if permissions not loaded
    if (userPermissions.visible_attributes.includes('all')) return true;
    return userPermissions.visible_attributes.includes(attributeName);
  }

  /**
   * Check if attribute is editable by current user
   * @param {string} attributeName - Name of the attribute
   * @returns {boolean}
   */
  function isAttributeEditable(attributeName) {
    if (!userPermissions) return false; // Default to not editable
    if (userPermissions.editable_attributes.includes('all')) return true;
    return userPermissions.editable_attributes.includes(attributeName);
  }

  // ============================================
  // SETTINGS MODAL MANAGEMENT
  // ============================================

  /**
   * Open settings modal
   */
  function openSettingsModal() {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }
    loadAllSettings();
    const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
    modal.show();
  }

  /**
   * Load all settings from server
   */
  function loadAllSettings() {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }

    fetch(`admin_user_settings.php?action=get&currentUser=${encodeURIComponent(currentUser)}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          allSettings = data.settings;
          populateUsersTable();
          populateAttributesList();
        } else {
          alert('Error: ' + (data.error || 'Failed to load settings'));
        }
      })
      .catch(err => {
        console.error('Failed to load settings:', err);
        alert('Failed to load settings: ' + err.message);
      });
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Populate users table with current users
   */
  function populateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    if (!allSettings || !allSettings.users || allSettings.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found</td></tr>';
      return;
    }

    allSettings.users.forEach(user => {
      const tr = document.createElement('tr');

      // Email column
      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email;
      if (user.email === currentUser) {
        tdEmail.innerHTML += ' <span class="badge bg-info">You</span>';
      }

      // Role column
      const tdRole = document.createElement('td');
      const roleBadge = document.createElement('span');
      roleBadge.className = user.role === 'admin' ? 'badge bg-danger' : 'badge bg-secondary';
      roleBadge.textContent = user.role.toUpperCase();
      tdRole.appendChild(roleBadge);

      // Visible attributes column
      const tdVisible = document.createElement('td');
      if (user.visible_attributes.includes('all') || user.visible_attributes.length === 0) {
        tdVisible.innerHTML = '<span class="badge bg-success">All</span>';
      } else {
        tdVisible.innerHTML = `<span class="badge bg-primary">${user.visible_attributes.length} attributes</span>`;
      }

      // Editable attributes column
      const tdEditable = document.createElement('td');
      if (user.editable_attributes.includes('all')) {
        tdEditable.innerHTML = '<span class="badge bg-success">All</span>';
      } else if (user.editable_attributes.length === 0) {
        tdEditable.innerHTML = '<span class="badge bg-secondary">None</span>';
      } else {
        tdEditable.innerHTML = `<span class="badge bg-warning">${user.editable_attributes.length} attributes</span>`;
      }

      // Actions column
      const tdActions = document.createElement('td');
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-primary me-1';
      editBtn.innerHTML = '<i class="bi bi-pencil"></i> Edit';
      editBtn.onclick = () => openEditPermissionsModal(user.email);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
      deleteBtn.onclick = () => deleteUser(user.email);

      if (user.email === currentUser) {
        deleteBtn.disabled = true;
        deleteBtn.title = 'Cannot delete your own account';
      }

      tdActions.appendChild(editBtn);
      tdActions.appendChild(deleteBtn);

      tr.appendChild(tdEmail);
      tr.appendChild(tdRole);
      tr.appendChild(tdVisible);
      tr.appendChild(tdEditable);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  /**
   * Show add user form
   */
  function showAddUserForm() {
    document.getElementById('addUserForm').style.display = 'block';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserRole').value = 'user';
    document.getElementById('newUserEmail').focus();
  }

  /**
   * Hide add user form
   */
  function hideAddUserForm() {
    document.getElementById('addUserForm').style.display = 'none';
  }

  /**
   * Add new user to the system
   */
  function addNewUser() {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }

    const email = document.getElementById('newUserEmail').value.trim();
    const role = document.getElementById('newUserRole').value;

    if (!email) {
      alert('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    const requestData = {
      action: 'addUser',
      currentUser: currentUser,
      email: email,
      role: role,
      visible_attributes: ['sku', 'label', 'images', 'thumbnail', 'assets', 'categories'],
      editable_attributes: []
    };

    console.log('Adding user with data:', requestData);

    fetch('admin_user_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          alert('User added successfully. Please set their permissions by clicking Edit.');
          hideAddUserForm();
          loadAllSettings();
        } else {
          alert('Error: ' + (data.error || 'Failed to add user'));
        }
      })
      .catch(err => {
        console.error('Failed to add user:', err);
        alert('Failed to add user: ' + err.message);
      });
  }

  /**
   * Delete user from the system
   * @param {string} userEmail - Email of user to delete
   */
  function deleteUser(userEmail) {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }

    if (userEmail === currentUser) {
      alert('You cannot delete your own account');
      return;
    }

    if (!confirm(`Are you sure you want to delete user: ${userEmail}?`)) {
      return;
    }

    fetch('admin_user_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteUser',
        currentUser: currentUser,
        email: userEmail
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          alert('User deleted successfully');
          loadAllSettings();
        } else {
          alert('Error: ' + (data.error || 'Failed to delete user'));
        }
      })
      .catch(err => {
        console.error('Failed to delete user:', err);
        alert('Failed to delete user: ' + err.message);
      });
  }

  // ============================================
  // PERMISSION MANAGEMENT
  // ============================================

  /**
   * Open edit permissions modal for a user
   * @param {string} userEmail - Email of user to edit
   */
  function openEditPermissionsModal(userEmail) {
    editingUserEmail = userEmail;

    const user = allSettings.users.find(u => u.email === userEmail);
    if (!user) {
      alert('User not found');
      return;
    }

    document.getElementById('editUserEmail').textContent = userEmail;
    document.getElementById('editUserRole').value = user.role;

    populateAttributeCheckboxes(user);

    const modal = new bootstrap.Modal(document.getElementById('editPermissionsModal'));
    modal.show();
  }

  /**
   * Populate attribute checkboxes in edit modal
   * @param {Object} user - User object with permissions
   */
  function populateAttributeCheckboxes(user) {
    const visibleDiv = document.getElementById('visibleAttributesCheckboxes');
    const editableDiv = document.getElementById('editableAttributesCheckboxes');

    visibleDiv.innerHTML = '';
    editableDiv.innerHTML = '';

    const hasAllVisible = user.visible_attributes.includes('all');
    const hasAllEditable = user.editable_attributes.includes('all');

    const visibleAllCb = document.getElementById('visibleAll');
    const editableAllCb = document.getElementById('editableAll');

    visibleAllCb.checked = hasAllVisible;
    editableAllCb.checked = hasAllEditable;

    allSettings.available_attributes.forEach(attr => {
      // Visible checkbox
      const visibleCol = document.createElement('div');
      visibleCol.className = 'col-md-6 col-lg-4';
      const visibleCheck = document.createElement('div');
      visibleCheck.className = 'form-check';

      const isVisibleChecked = hasAllVisible || user.visible_attributes.includes(attr);

      visibleCheck.innerHTML = `
        <input class="form-check-input visible-attr" type="checkbox" value="${attr}" id="visible_${attr}"
               ${isVisibleChecked ? 'checked' : ''}>
        <label class="form-check-label" for="visible_${attr}">
          ${capitalizeWords(attr.replace(/_/g, ' '))}
        </label>
      `;
      visibleCol.appendChild(visibleCheck);
      visibleDiv.appendChild(visibleCol);

      // Editable checkbox
      const editableCol = document.createElement('div');
      editableCol.className = 'col-md-6 col-lg-4';
      const editableCheck = document.createElement('div');
      editableCheck.className = 'form-check';

      const isEditableChecked = hasAllEditable || user.editable_attributes.includes(attr);

      editableCheck.innerHTML = `
        <input class="form-check-input editable-attr" type="checkbox" value="${attr}" id="editable_${attr}"
               ${isEditableChecked ? 'checked' : ''}>
        <label class="form-check-label" for="editable_${attr}">
          ${capitalizeWords(attr.replace(/_/g, ' '))}
        </label>
      `;
      editableCol.appendChild(editableCheck);
      editableDiv.appendChild(editableCol);
    });

    // Smart behaviour for individual checkboxes vs “All Attributes”
    const visibleCheckboxes = document.querySelectorAll('.visible-attr');
    const editableCheckboxes = document.querySelectorAll('.editable-attr');

    visibleCheckboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        if (!this.checked) {
          visibleAllCb.checked = false;
        } else {
          const allChecked = Array.from(visibleCheckboxes).every(vcb => vcb.checked);
          if (allChecked) visibleAllCb.checked = true;
        }
      });
    });

    editableCheckboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        if (!this.checked) {
          editableAllCb.checked = false;
        } else {
          const allChecked = Array.from(editableCheckboxes).every(ecb => ecb.checked);
          if (allChecked) editableAllCb.checked = true;
        }
      });
    });
  }

  /**
   * Toggle all attributes checkboxes
   * @param {string} type - 'visible' or 'editable'
   */
  function toggleAllAttributes(type) {
    const checkbox = document.getElementById(`${type}All`);
    const checkboxes = document.querySelectorAll(`.${type}-attr`);
    checkboxes.forEach(cb => {
      cb.checked = checkbox.checked;
    });
  }

  /**
   * Save user permissions
   */
  function saveUserPermissions() {
    if (!editingUserEmail || !currentUser) return;

    const role = document.getElementById('editUserRole').value;

    // Visible attributes
    const visibleAll = document.getElementById('visibleAll').checked;
    let visibleAttributes;
    if (visibleAll) {
      visibleAttributes = ['all'];
    } else {
      visibleAttributes = Array.from(document.querySelectorAll('.visible-attr:checked')).map(cb => cb.value);
      if (visibleAttributes.length === 0) {
        visibleAttributes = [];
      }
    }

    // Editable attributes
    const editableAll = document.getElementById('editableAll').checked;
    let editableAttributes;
    if (editableAll) {
      editableAttributes = ['all'];
    } else {
      editableAttributes = Array.from(document.querySelectorAll('.editable-attr:checked')).map(cb => cb.value);
      if (editableAttributes.length === 0) {
        editableAttributes = [];
      }
    }

    console.log('Saving permissions:', {
      email: editingUserEmail,
      role: role,
      visibleAttributes: visibleAttributes,
      editableAttributes: editableAttributes
    });

    const requestBody = {
      action: 'updateUser',
      currentUser: currentUser,
      email: editingUserEmail,
      role: role,
      visible_attributes: visibleAttributes,
      editable_attributes: editableAttributes
    };

    fetch('admin_user_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        console.log('Server response:', data);
        if (data.success) {
          alert('Permissions updated successfully');
          bootstrap.Modal.getInstance(document.getElementById('editPermissionsModal')).hide();
          loadAllSettings();

          if (editingUserEmail === currentUser) {
            setTimeout(() => {
              loadUserPermissions();
            }, 500);
          }
        } else {
          alert('Error: ' + (data.error || 'Failed to update permissions'));
        }
      })
      .catch(err => {
        console.error('Failed to update permissions:', err);
        alert('Failed to update permissions: ' + err.message);
      });
  }

  // ============================================
  // ATTRIBUTE MANAGEMENT
  // ============================================

  /**
   * Populate attributes list with drag-and-drop support
   */
  function populateAttributesList() {
    const container = document.getElementById('attributesList');
    const countSpan = document.getElementById('attributeCount');

    container.innerHTML = '';

    if (!allSettings || !allSettings.available_attributes || allSettings.available_attributes.length === 0) {
      container.innerHTML = '<p class="text-muted">No attributes defined</p>';
      if (countSpan) countSpan.textContent = '0';
      return;
    }

    if (countSpan) countSpan.textContent = allSettings.available_attributes.length;

    allSettings.available_attributes.forEach((attr, index) => {
      const row = document.createElement('div');
      row.className = 'attribute-row d-flex align-items-center justify-content-between p-2 mb-2 border rounded bg-white';
      row.setAttribute('data-attr-name', attr);
      row.setAttribute('draggable', 'true');
      row.style.cursor = 'grab';

      const isHiddenFromMe = userPermissions &&
                             !userPermissions.visible_attributes.includes('all') &&
                             !userPermissions.visible_attributes.includes(attr);

      row.innerHTML = `
        <div class="d-flex align-items-center flex-grow-1">
          <span class="me-3 text-muted" style="cursor:grab; user-select:none;">⋮⋮</span>
          <span class="badge bg-secondary me-3">${index + 1}</span>
          <span>
            ${capitalizeWords(attr.replace(/_/g, ' '))}
            ${isHiddenFromMe ? '<span class="badge bg-secondary ms-2" title="Hidden from your view">👁️‍🗨️</span>' : ''}
          </span>
        </div>
        <button class="btn btn-sm btn-danger" type="button" onclick="AdminModule.removeAttribute('${attr}')">
          <i class="bi bi-x"></i>
        </button>
      `;

      row.addEventListener('dragstart', function() {
        draggedAttributeRow = this;
        this.style.opacity = '0.5';
      });

      row.addEventListener('dragend', function() {
        this.style.opacity = '1';
        draggedAttributeRow = null;

        const rows = container.querySelectorAll('.attribute-row');
        rows.forEach((r, i) => {
          const badge = r.querySelector('.badge.bg-secondary');
          if (badge) badge.textContent = i + 1;
        });

        updateAttributeOrder();
      });

      row.addEventListener('dragover', function(e) {
        e.preventDefault();
      });

      row.addEventListener('drop', function(e) {
        e.preventDefault();
        if (!draggedAttributeRow || draggedAttributeRow === this) return;

        const rect = this.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
          container.insertBefore(draggedAttributeRow, this);
        } else {
          container.insertBefore(draggedAttributeRow, this.nextSibling);
        }
      });

      container.appendChild(row);
    });
  }

  /**
   * Update attribute order after drag and drop
   */
  function updateAttributeOrder() {
    const rows = document.querySelectorAll('#attributesList .attribute-row');
    const newOrder = [];
    rows.forEach(row => {
      const name = row.getAttribute('data-attr-name');
      if (name) newOrder.push(name);
    });
    allSettings.available_attributes = newOrder;
    console.log('New attribute order:', newOrder);
    saveAllSettings();
  }

  /**
   * Scan all products and discover all attributes
   */
  function discoverAllAttributes() {
    console.log('Discovering attributes...');

    if (typeof window.allProducts === 'undefined' || !Array.isArray(window.allProducts)) {
      alert('Products not loaded yet. Please wait for products to load and try again.');
      console.error('window.allProducts not found');
      return;
    }

    if (window.allProducts.length === 0) {
      alert('No products loaded yet. Please wait for products to load and try again.');
      return;
    }

    if (userPermissions && !userPermissions.visible_attributes.includes('all')) {
      const proceed = confirm(
        'Note: This will discover ALL attributes from products, including those hidden from your view.\n\n' +
        'Newly discovered attributes will be added to the available list and you can assign them to users.\n\n' +
        'Continue?'
      );
      if (!proceed) return;
    }

    console.log('Scanning', window.allProducts.length, 'products...');

    const discoveredAttributes = new Set();

    window.allProducts.forEach(product => {
      Object.keys(product).forEach(key => {
        if (key !== 'attributes' && key !== 'relationships' && key !== 'id') {
          discoveredAttributes.add(key);
        }
      });

      if (product.attributes && typeof product.attributes === 'object') {
        Object.keys(product.attributes).forEach(attrKey => {
          discoveredAttributes.add(attrKey);
        });
      }
    });

    const attributesArray = Array.from(discoveredAttributes);

    console.log('Discovered attributes:', attributesArray);
    console.log('Total discovered:', attributesArray.length);

    const existingAttrs = new Set(allSettings.available_attributes || []);
    let newCount = 0;
    const newAttributes = [];

    attributesArray.forEach(attr => {
      if (!existingAttrs.has(attr)) {
        allSettings.available_attributes.push(attr);
        newAttributes.push(attr);
        newCount++;
      }
    });

    if (newCount > 0) {
      const newAttrList = newAttributes.slice(0, 10).join(', ') + (newAttributes.length > 10 ? '...' : '');
      alert(
        `✅ Discovered ${newCount} new attributes!\n\n` +
        `New attributes: ${newAttrList}\n\n` +
        `Total attributes: ${allSettings.available_attributes.length}\n\n` +
        `New attributes added at the end. You can drag to reorder them.`
      );
      saveAllSettings();
    } else {
      alert('✅ No new attributes found.\n\nAll ' + attributesArray.length + ' attributes are already in the list.');
      populateAttributesList();
    }
  }

  /**
   * Remove attribute from available attributes
   * @param {string} attrName - Name of attribute to remove
   */
  function removeAttribute(attrName) {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }

    if (!confirm(`Remove attribute "${attrName}"? This will also remove it from all user permissions.`)) {
      return;
    }

    allSettings.available_attributes = allSettings.available_attributes.filter(a => a !== attrName);

    allSettings.users.forEach(user => {
      user.visible_attributes = user.visible_attributes.filter(a => a !== attrName);
      user.editable_attributes = user.editable_attributes.filter(a => a !== attrName);
    });

    saveAllSettings();
  }

  /**
   * Save all settings to server
   */
  function saveAllSettings() {
    if (!currentUser) {
      alert('User not initialized');
      return;
    }

    fetch('admin_user_settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        currentUser: currentUser,
        settings: allSettings
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          loadAllSettings();
        } else {
          alert('Error: ' + (data.error || 'Failed to save settings'));
        }
      })
      .catch(err => {
        console.error('Failed to save settings:', err);
        alert('Failed to save settings: ' + err.message);
      });
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }

  // ============================================
  // PUBLIC API
  // ============================================

  window.AdminModule = {
    // Initialization
    init: initAdmin,

    // Permission checks
    getUserPermissions: getUserPermissions,
    isAdmin: isAdmin,
    isAttributeVisible: isAttributeVisible,
    isAttributeEditable: isAttributeEditable,

    // Modal management
    openSettingsModal: openSettingsModal,

    // User management
    showAddUserForm: showAddUserForm,
    hideAddUserForm: hideAddUserForm,
    addNewUser: addNewUser,
    deleteUser: deleteUser,

    // Permission management
    openEditPermissionsModal: openEditPermissionsModal,
    toggleAllAttributes: toggleAllAttributes,
    saveUserPermissions: saveUserPermissions,

    // Attribute management
    discoverAllAttributes: discoverAllAttributes,
    removeAttribute: removeAttribute
  };
})();
