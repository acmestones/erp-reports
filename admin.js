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
    
    // By default, give basic permissions (not 'all')
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
    
    // Check if 'all' is explicitly set
    const hasAllVisible = user.visible_attributes.includes('all');
    const hasAllEditable = user.editable_attributes.includes('all');
    
    document.getElementById('visibleAll').checked = hasAllVisible;
    document.getElementById('editableAll').checked = hasAllEditable;
    
    console.log('Populating checkboxes for:', user.email);
    console.log('Visible attributes:', user.visible_attributes);
    console.log('Editable attributes:', user.editable_attributes);
    
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
    
    // Add event listeners for smart behavior
    setupAttributeCheckboxListeners();
}





/**
 * Setup event listeners for smart checkbox behavior
 */
function setupAttributeCheckboxListeners() {
    const visibleCheckboxes = document.querySelectorAll('.visible-attr');
    const editableCheckboxes = document.querySelectorAll('.editable-attr');
    const visibleAll = document.getElementById('visibleAll');
    const editableAll = document.getElementById('editableAll');
    
    // When individual visible checkbox changes
    visibleCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            // If any checkbox is unchecked, uncheck "All"
            if (!this.checked) {
                visibleAll.checked = false;
            }
            // If all checkboxes are now checked, check "All"
            else {
                const allChecked = Array.from(visibleCheckboxes).every(vcb => vcb.checked);
                if (allChecked) {
                    visibleAll.checked = true;
                }
            }
        });
    });
    
    // When individual editable checkbox changes
    editableCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            // If any checkbox is unchecked, uncheck "All"
            if (!this.checked) {
                editableAll.checked = false;
            }
            // If all checkboxes are now checked, check "All"
            else {
                const allChecked = Array.from(editableCheckboxes).every(ecb => ecb.checked);
                if (allChecked) {
                    editableAll.checked = true;
                }
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
    
    // Simply check or uncheck all boxes based on "All" checkbox state
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
        // If no attributes selected, set to empty array (nothing visible)
        if (visibleAttributes.length === 0) {
            visibleAttributes = [];
        }
    }
    
    // Get selected editable attributes
    const editableAll = document.getElementById('editableAll').checked;
    let editableAttributes;
    if (editableAll) {
        editableAttributes = ['all'];
    } else {
        editableAttributes = Array.from(document.querySelectorAll('.editable-attr:checked')).map(cb => cb.value);
        // If no attributes selected, set to empty array (nothing editable)
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
    
    console.log('Request body being sent:', requestBody);
    
    fetch('admin_user_settings.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(data => {
        console.log('Server response:', data);
        if (data.success) {
            alert('Permissions updated successfully');
            bootstrap.Modal.getInstance(document.getElementById('editPermissionsModal')).hide();
            loadAllSettings();
            
            // Reload permissions if editing current user
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

// Drag and drop state
let draggedElement = null;

/**
 * Populate attributes list with drag-and-drop support
 */
function populateAttributesList() {
    const div = document.getElementById('attributesList');
    const countSpan = document.getElementById('attributeCount');
    
    div.innerHTML = '';
    
    if (!allSettings || !allSettings.available_attributes || allSettings.available_attributes.length === 0) {
        div.innerHTML = '<p class="text-muted">No attributes defined</p>';
        if (countSpan) countSpan.textContent = '0';
        return;
    }
    
    // Update count
    if (countSpan) countSpan.textContent = allSettings.available_attributes.length;
    
    const list = document.createElement('div');
    list.id = 'sortableAttributesList';
    
    allSettings.available_attributes.forEach((attr, index) => {
        const row = document.createElement('div');
        row.className = 'attribute-row d-flex align-items-center justify-content-between p-2 mb-2 border rounded';
        row.style.cursor = 'move';
        row.style.backgroundColor = '#fff';
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-attr-name', attr);
        
        // Show if attribute is hidden from current admin
        const isHiddenFromMe = userPermissions && 
                               !userPermissions.visible_attributes.includes('all') && 
                               !userPermissions.visible_attributes.includes(attr);
        
        if (isHiddenFromMe) {
            row.style.backgroundColor = '#f8f9fa';
        }
        
        row.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1">
                <span class="me-3 text-muted" style="cursor: move; user-select: none;">⋮⋮</span>
                <span class="badge bg-secondary me-3">${index + 1}</span>
                <span>
                    ${capitalizeWords(attr.replace(/_/g, ' '))}
                    ${isHiddenFromMe ? '<span class="badge bg-secondary ms-2" title="Hidden from your view">👁️‍🗨️</span>' : ''}
                </span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="AdminModule.removeAttribute('${attr}')" type="button">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        // Add drag event listeners
        row.addEventListener('dragstart', function(e) {
            draggedElement = this;
            this.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        row.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedElement === this) return;
            
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                this.parentNode.insertBefore(draggedElement, this);
            } else {
                this.parentNode.insertBefore(draggedElement, this.nextSibling);
            }
        });
        
        row.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            updateAttributeOrder();
            populateAttributesList(); // Refresh to update numbers
        });
        
        list.appendChild(row);
    });
    
    div.appendChild(list);
}

/**
 * Update attribute order after drag and drop
 */
function updateAttributeOrder() {
    const items = document.querySelectorAll('#sortableAttributesList .attribute-row');
    const newOrder = [];
    
    items.forEach(item => {
        const attrName = item.getAttribute('data-attr-name');
        if (attrName) {
            newOrder.push(attrName);
        }
    });
    
    console.log('New attribute order:', newOrder);
    
    // Update settings
    allSettings.available_attributes = newOrder;
    
    // Save to server
    saveAllSettings();
}

/**
 * Scan all products and discover all attributes
 */
function discoverAllAttributes() {
    console.log('Discovering attributes...');
    
    // Check if allProducts is available globally
    if (typeof window.allProducts === 'undefined' || !Array.isArray(window.allProducts)) {
        alert('Products not loaded yet. Please wait for products to load and try again.');
        console.error('window.allProducts not found');
        return;
    }
    
    if (window.allProducts.length === 0) {
        alert('No products loaded yet. Please wait for products to load and try again.');
        return;
    }
    
    // Show info message about discovery scope
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
    
    // Convert to array (don't sort, keep existing order and append new ones)
    const attributesArray = Array.from(discoveredAttributes);
    
    console.log('Discovered attributes:', attributesArray);
    console.log('Total discovered:', attributesArray.length);
    
    // Merge with existing attributes, maintaining order
    const existingAttrs = new Set(allSettings.available_attributes || []);
    let newCount = 0;
    const newAttributes = [];
    
    attributesArray.forEach(attr => {
        if (!existingAttrs.has(attr)) {
            allSettings.available_attributes.push(attr); // Append to end
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






    

/**
 * Drag and drop handlers
 */
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(this.parentElement, e.clientY);
    if (afterElement == null) {
        this.parentElement.appendChild(draggedElement);
    } else {
        this.parentElement.insertBefore(draggedElement, afterElement);
    }
    
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    // Don't do anything if dropping on itself
    if (draggedElement !== this) {
        // Update the order in settings
        updateAttributeOrder();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    
    // Update the order numbers
    const items = document.querySelectorAll('#sortableAttributesList > div');
    items.forEach((item, index) => {
        const badge = item.querySelector('.badge.bg-secondary');
        if (badge) {
            badge.textContent = index + 1;
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.opacity-40)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Update attribute order after drag and drop
 */
function updateAttributeOrder() {
    const items = document.querySelectorAll('#sortableAttributesList > div');
    const newOrder = [];
    
    items.forEach(item => {
        const attrName = item.getAttribute('data-attr-name');
        if (attrName) {
            newOrder.push(attrName);
        }
    });
    
    // Update settings
    allSettings.available_attributes = newOrder;
    
    // Save to server
    saveAllSettings();
}



/**
 * Scan all products and discover all attributes
 */
function discoverAllAttributes() {
    console.log('Discovering attributes...');
    
    // Check if allProducts is available globally
    if (typeof window.allProducts === 'undefined' || !Array.isArray(window.allProducts)) {
        alert('Products not loaded yet. Please wait for products to load and try again.');
        console.error('window.allProducts not found');
        return;
    }
    
    if (window.allProducts.length === 0) {
        alert('No products loaded yet. Please wait for products to load and try again.');
        return;
    }
    
    // Show info message about discovery scope
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
    console.log('Total discovered:', attributesArray.length);
    
    // Merge with existing attributes
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
    
    allSettings.available_attributes.sort();
    
    if (newCount > 0) {
        const newAttrList = newAttributes.slice(0, 10).join(', ') + (newAttributes.length > 10 ? '...' : '');
        alert(
            `✅ Discovered ${newCount} new attributes!\n\n` +
            `New attributes: ${newAttrList}\n\n` +
            `Total attributes: ${allSettings.available_attributes.length}`
        );
        saveAllSettings();
    } else {
        alert('✅ No new attributes found.\n\nAll ' + attributesArray.length + ' attributes are already in the list.');
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
    removeAttribute: removeAttribute,
    discoverAllAttributes: discoverAllAttributes
};

})();
