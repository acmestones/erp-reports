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
            
            // Disable delete for current user
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
        
        // Validate email format
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
            visible_attributes: role === 'admin' ? ['all'] : ['sku', 'label', 'images', 'thumbnail', 'assets'],
            editable_attributes: role === 'admin' ? ['all'] : []
        };
        
        console.log('Adding user with data:', requestData);
        
        fetch('admin_user_settings.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                alert('User added successfully');
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deleteUser',
                currentUser: currentUser,
                email: userEmail
            })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
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
        
        // Populate attribute checkboxes
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
        
        const hasAllVisible = user.visible_attributes.includes('all') || user.visible_attributes.length === 0;
        const hasAllEditable = user.editable_attributes.includes('all');
        
        document.getElementById('visibleAll').checked = hasAllVisible;
        document.getElementById('editableAll').checked = hasAllEditable;
        
        allSettings.available_attributes.forEach(attr => {
            // Visible checkbox
            const visibleCol = document.createElement('div');
            visibleCol.className = 'col-md-6 col-lg-4';
            const visibleCheck = document.createElement('div');
            visibleCheck.className = 'form-check';
            visibleCheck.innerHTML = `
                <input class="form-check-input visible-attr" type="checkbox" value="${attr}" id="visible_${attr}" ${hasAllVisible || user.visible_attributes.includes(attr) ? 'checked' : ''}>
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
            editableCheck.innerHTML = `
                <input class="form-check-input editable-attr" type="checkbox" value="${attr}" id="editable_${attr}" ${hasAllEditable || user.editable_attributes.includes(attr) ? 'checked' : ''}>
                <label class="form-check-label" for="editable_${attr}">
                    ${capitalizeWords(attr.replace(/_/g, ' '))}
                </label>
            `;
            editableCol.appendChild(editableCheck);
            editableDiv.appendChild(editableCol);
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
        
        // Get selected visible attributes
        const visibleAll = document.getElementById('visibleAll').checked;
        let visibleAttributes;
        if (visibleAll) {
            visibleAttributes = ['all'];
        } else {
            visibleAttributes = Array.from(document.querySelectorAll('.visible-attr:checked')).map(cb => cb.value);
        }
        
        // Get selected editable attributes
        const editableAll = document.getElementById('editableAll').checked;
        let editableAttributes;
        if (editableAll) {
            editableAttributes = ['all'];
        } else {
            editableAttributes = Array.from(document.querySelectorAll('.editable-attr:checked')).map(cb => cb.value);
        }
        
        fetch('admin_user_settings.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'updateUser',
                currentUser: currentUser,
                email: editingUserEmail,
                role: role,
                visible_attributes: visibleAttributes,
                editable_attributes: editableAttributes
            })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                alert('Permissions updated successfully');
                bootstrap.Modal.getInstance(document.getElementById('editPermissionsModal')).hide();
                loadAllSettings();
                
                // Reload permissions if editing current user
                if (editingUserEmail === currentUser) {
                    loadUserPermissions();
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
 * Populate attributes list
 */
function populateAttributesList() {
    const div = document.getElementById('attributesList');
    div.innerHTML = '';
    
    if (!allSettings || !allSettings.available_attributes || allSettings.available_attributes.length === 0) {
        div.innerHTML = '<p class="text-muted">No attributes defined</p>';
        return;
    }
    
    const list = document.createElement('div');
    list.className = 'row g-2';
    
    allSettings.available_attributes.forEach(attr => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                <span>${capitalizeWords(attr.replace(/_/g, ' '))}</span>
                <button class="btn btn-sm btn-danger" onclick="AdminModule.removeAttribute('${attr}')">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
        list.appendChild(col);
    });
    
    div.appendChild(list);
}

/**
 * Scan all products and discover all attributes
 */
function discoverAllAttributes() {
    // Check if allProducts is available globally
    if (typeof window.allProducts === 'undefined' || !Array.isArray(window.allProducts)) {
        alert('Products not loaded yet. Please wait for products to load and try again.');
        return;
    }
    
    const discoveredAttributes = new Set();
    
    // Scan all products
    window.allProducts.forEach(product => {
        // Add top-level product keys
        Object.keys(product).forEach(key => {
            if (key !== 'attributes' && key !== 'relationships' && key !== 'id') {
                discoveredAttributes.add(key);
            }
        });
        
        // Add attributes
        if (product.attributes && typeof product.attributes === 'object') {
            Object.keys(product.attributes).forEach(attrKey => {
                discoveredAttributes.add(attrKey);
            });
        }
    });
    
    // Convert to array and sort
    const attributesArray = Array.from(discoveredAttributes).sort();
    
    console.log('Discovered attributes:', attributesArray);
    
    // Merge with existing attributes
    const existingAttrs = new Set(allSettings.available_attributes);
    let newCount = 0;
    
    attributesArray.forEach(attr => {
        if (!existingAttrs.has(attr)) {
            allSettings.available_attributes.push(attr);
            newCount++;
        }
    });
    
    allSettings.available_attributes.sort();
    
    if (newCount > 0) {
        alert(`Discovered ${newCount} new attributes! Total: ${allSettings.available_attributes.length}`);
        saveAllSettings();
    } else {
        alert('No new attributes found. All attributes are already in the list.');
        populateAttributesList();
    }
}

/**
 * Add new attribute to available attributes
 */
function addNewAttribute() {
    if (!currentUser) {
        alert('User not initialized');
        return;
    }
    
    const input = document.getElementById('newAttributeName');
    const attrName = input.value.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!attrName) {
        alert('Please enter an attribute name');
        return;
    }
    
    if (allSettings.available_attributes.includes(attrName)) {
        alert('This attribute already exists');
        return;
    }
    
    allSettings.available_attributes.push(attrName);
    allSettings.available_attributes.sort();
    
    saveAllSettings();
    input.value = '';
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
    
    // Remove from all users
    allSettings.users.forEach(user => {
        user.visible_attributes = user.visible_attributes.filter(a => a !== attrName);
        user.editable_attributes = user.editable_attributes.filter(a => a !== attrName);
    });
    
    saveAllSettings();
}


    /**
     * Add new attribute to available attributes
     */
    function addNewAttribute() {
        if (!currentUser) {
            alert('User not initialized');
            return;
        }
        
        const input = document.getElementById('newAttributeName');
        const attrName = input.value.trim().toLowerCase().replace(/\s+/g, '_');
        
        if (!attrName) {
            alert('Please enter an attribute name');
            return;
        }
        
        if (allSettings.available_attributes.includes(attrName)) {
            alert('This attribute already exists');
            return;
        }
        
        allSettings.available_attributes.push(attrName);
        allSettings.available_attributes.sort();
        
        saveAllSettings();
        input.value = '';
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
        
        // Remove from all users
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'save',
                currentUser: currentUser,
                settings: allSettings
            })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
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

    /**
     * Capitalize words in a string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
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
    addNewAttribute: addNewAttribute,
    removeAttribute: removeAttribute,
    discoverAllAttributes: discoverAllAttributes  // ADD THIS LINE
};

})();
