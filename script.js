const API_BASE = "erp_proxy.php";
let userEmail = localStorage.getItem("userEmail");
let currentUser = null;
let currentColumns = 5;
let allReports = [];
let fieldLabels = {};
let currentReportData = null;
let reportConfig = {};
let linkFieldOptions = {};
let currentReportColumns = [];

if (!userEmail) {
    window.location.replace("login.html");
}

document.getElementById("userEmail").textContent = userEmail;

(async function init() {
    try {
        const users = await getUsers();
        currentUser = users.users.find(u => u.email === userEmail);
        
        if (!currentUser) {
            alert("User not found!");
            localStorage.removeItem("userEmail");
            window.location.replace("login.html");
            return;
        }
        
        if (currentUser.role === 'admin') {
            document.getElementById("adminControls").style.display = 'block';
            document.getElementById("settingsBtn").addEventListener("click", openAdminSettings);
        }



        document.getElementById('addUserBtn').onclick = function () {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;

    // Check if a blank new user email input already exists - prevent multiple empties
    const existingEmpty = usersList.querySelector('.card.border-success .new-user-email[value=""], .card.border-success .new-user-email:not([value])');
    if (existingEmpty) {
        alert("Please enter an email for the existing new user before adding another.");
        existingEmpty.focus();
        return;
    }

    const newCard = document.createElement('div');
    newCard.className = 'card mb-3 border-success';
    newCard.innerHTML = `
        <div class="card-body">
            <div class="mb-2">
                <label class="form-label small fw-bold">Email</label>
                <input type="email" class="form-control form-control-sm new-user-email" placeholder="Enter email" required>
            </div>
            <div class="mb-2">
                <label class="form-label small fw-bold">Role</label>
                <select class="form-select form-select-sm user-role" data-idx="new">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div class="mb-2">
                <label class="form-label small fw-bold">Can Edit Records</label>
                <input type="checkbox" class="form-check-input user-edit" data-idx="new">
            </div>
            <div class="mb-2">
                <label class="form-label small fw-bold">Allowed Reports</label>
                <div class="border rounded p-2" style="max-height: 150px; overflow-y: auto;">
                    ${(window.allReports || []).map(r => `
                        <div class="form-check">
                            <input class="form-check-input user-report-check" type="checkbox" value="${r}" data-idx="new" id="newreport-${r}">
                            <label class="form-check-label" for="newreport-${r}">${r}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    usersList.prepend(newCard);
    newCard.querySelector('.new-user-email').focus();
};



        



        
        reportConfig = await getReportConfig();
        
        if (currentUser.allowed_reports && currentUser.allowed_reports.length > 0) {
            renderReportsList(currentUser.allowed_reports);
        } else {
            document.getElementById("reportArea").innerHTML = "<p class='text-center text-muted'>No reports assigned to you. Please contact admin.</p>";
        }
        
        const colSelector = document.getElementById("columnSelector");
        if (window.innerWidth >= 768) {
            colSelector.addEventListener("change", (e) => {
                currentColumns = parseInt(e.target.value);
                if (currentReportData) {
                    renderGroupedCards(currentReportData.grouped, currentReportData.columns, currentReportData.reportName);
                }
            });
        }
    } catch (err) {
        console.error("Init error:", err);
        alert("Error initializing app: " + err.message);
    }
})();

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("userEmail");
    window.location.replace("login.html");
});

async function getUsers() {
    const res = await fetch(`${API_BASE}?action=get_users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
}

async function getReport(name) {
    const res = await fetch(`${API_BASE}?report=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error("Failed to fetch report");
    return res.json();
}

async function getAllReports() {
    const res = await fetch(`${API_BASE}?action=get_all_reports`);
    if (!res.ok) throw new Error("Failed to fetch reports list");
    return res.json();
}

async function getReportConfig() {
    const res = await fetch(`${API_BASE}?action=get_report_config`);
    if (!res.ok) return {};
    return res.json();
}

async function saveReportConfig(config) {
    const res = await fetch(`${API_BASE}?action=save_report_config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({config})
    });
    return res.json();
}

async function getLinkOptions(doctype) {
    if (linkFieldOptions[doctype]) {
        return linkFieldOptions[doctype];
    }
    
    const res = await fetch(`${API_BASE}?action=get_link_options&doctype=${encodeURIComponent(doctype)}`);
    if (!res.ok) return [];
    const data = await res.json();
    
    if (data.data && Array.isArray(data.data)) {
        linkFieldOptions[doctype] = data.data.map(d => d.name);
        return linkFieldOptions[doctype];
    }
    return [];
}

async function updateField(doctype, docname, fieldname, value) {
    const res = await fetch(`${API_BASE}?action=update_field`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({doctype, docname, fieldname, value})
    });
    
    const responseText = await res.text();
    console.log("Update response:", responseText);
    
    if (!res.ok) {
        throw new Error("Server error: " + res.status);
    }
    
    try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.exc || jsonResponse.exception) {
            throw new Error(jsonResponse.exception || jsonResponse.exc || "Update failed");
        }
        return jsonResponse;
    } catch (e) {
        if (responseText.includes('error')) {
            throw new Error(responseText);
        }
        return { message: "Updated successfully" };
    }
}

function extractImageFromRow(row, columns, imageFieldsList) {
    if (imageFieldsList && imageFieldsList.length > 0) {
        for (const fieldname of imageFieldsList) {
            if (row[fieldname]) {
                const imgUrl = extractImageUrl(row[fieldname]);
                if (imgUrl) return imgUrl;
            }
        }
    }
    
    for (const col of columns) {
        if (col.fieldname.toLowerCase().includes('description')) {
            if (row[col.fieldname]) {
                const imgUrl = extractImageUrl(row[col.fieldname]);
                if (imgUrl) return imgUrl;
            }
        }
    }
    
    return null;
}

function extractImageUrl(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') return null;
    
    const patterns = [
        /<img[^>]+src=["']([^"']+)["']/i,
        /src=["']([^"']+)["']/i,
        /url\(["']?([^"')]+)["']?\)/i
    ];
    
    for (const pattern of patterns) {
        const match = htmlContent.match(pattern);
        if (match && match[1]) {
            return fixImageUrl(match[1]);
        }
    }
    
    return null;
}

// Replace the existing fixImageUrl function with this enhanced version
function fixImageUrl(url) {
    if (!url) return null;
    url = url.trim();
    
    // Already absolute URL
    if (url.startsWith("http") || url.startsWith("https")) {
        return url;
    }
    
    // Protocol-relative URL
    if (url.startsWith("//")) {
        return "https:" + url;
    }
    
    // Handle private files by proxying through PHP
    if (url.includes('/private/files/')) {
        // Proxy through PHP to add authentication
        return `${API_BASE}?action=proxy_image&file_url=${encodeURIComponent(url)}`;
    }
    
    // Root-relative URL (including public /files/)
    if (url.startsWith("/")) {
        return `https://acmestones.erpnext.com${url}`;
    }
    
    // Relative URL
    return `https://acmestones.erpnext.com/${url}`;
}




function renderReportsList(reports) {
    const div = document.getElementById("reportSelector");
    div.innerHTML = "";
    
    if (!reports || reports.length === 0) {
        div.innerHTML = "<p class='text-muted'>No reports available</p>";
        return;
    }
    
    reports.forEach(r => {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline-primary btn-sm me-2 mb-2";
        btn.textContent = r;
        btn.dataset.report = r;
        btn.addEventListener("click", function() {
            document.querySelectorAll("#reportSelector button").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            loadReport(r);
        });
        div.appendChild(btn);
    });
    
    if (reports.length > 0) {
        div.firstChild.classList.add("active");
        loadReport(reports[0]);
    }
}











// Build a mapping of report field names to actual database field names
function buildFieldMapping(columns) {
    const mapping = {};
    
    // List of standard ERPNext Work Order fields (non-custom)
    const standardFields = [
        'name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx',
        'status', 'company', 'qty', 'description', 'remarks', 'workstation', 
        'operation', 'production_item', 'sales_order', 'bom_no', 'item_name',
        'fg_warehouse', 'wip_warehouse', 'source_warehouse', 'planned_start_date',
        'planned_end_date', 'expected_delivery_date', 'stock_uom', 'produced_qty',
        'material_transferred_for_manufacturing', 'transaction_date'
    ];
    
    columns.forEach(col => {
        const reportFieldname = col.fieldname;
        
        // If it already has custom_ prefix, use as-is
        if (reportFieldname.startsWith('custom_')) {
            mapping[reportFieldname] = reportFieldname;
        }
        // If it's a standard field, use as-is
        else if (standardFields.includes(reportFieldname)) {
            mapping[reportFieldname] = reportFieldname;
        }
        // Otherwise, assume it needs custom_ prefix
        else {
            mapping[reportFieldname] = 'custom_' + reportFieldname;
            console.log(`📋 Auto-mapping: ${reportFieldname} → custom_${reportFieldname}`);
        }
    });
    
    return mapping;
}


































async function loadReport(reportName) {
    try {
        console.log(`Fetching report: ${reportName}`);
        const data = await getReport(reportName);
        console.log("Report data received:", data);
        
        if (!data.message || !data.message.result) {
            alert("No data returned from report");
            return;
        }
        
        const columns = data.message.columns || [];
        const rows = data.message.result || [];
        
        console.log("Rows:", rows.length, "Columns:", columns.length);
        
        currentReportColumns = columns;
        
        // Build field name mapping from report names to actual database field names
        const fieldMapping = buildFieldMapping(columns);
        window.reportFieldMapping = fieldMapping;
        console.log("Field mapping created:", fieldMapping);
        
        // Build field labels from columns
        fieldLabels = {};
        columns.forEach(col => {
            fieldLabels[col.fieldname] = col.label || col.fieldname;
        });
        
        // Build label-to-fieldname mapping for config resolution
        const labelToFieldname = {};
        columns.forEach(col => {
            const cleanLabel = (col.label || col.fieldname).toLowerCase().replace(/[^a-z0-9]+/g, '_');
            labelToFieldname[cleanLabel] = col.fieldname;
        });
        
        const config = reportConfig[reportName] || {};
        
        // Auto-map group_by fields if they don't match report field names
        if (config.group_by) {
            config.group_by = config.group_by.map(field => {
                // If field exists in report, use it
                if (columns.find(col => col.fieldname === field)) {
                    return field;
                }
                // Try to find by label match
                const cleanField = field.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                if (labelToFieldname[cleanField]) {
                    console.log(`📋 Auto-mapping groupby: ${field} → ${labelToFieldname[cleanField]}`);
                    return labelToFieldname[cleanField];
                }
                return field;
            });
        }
        
        const imageFields = config.image_fields || ['item_description', 'custom_description_cleaned', 'description'];
        
        // Optimize image URL fixing using regex instead of DOM manipulation
        rows.forEach(row => {
            imageFields.forEach(field => {
                if (row[field] && typeof row[field] === 'string') {
                    let html = row[field];
                    
                    // Fix image src attributes using regex (much faster)
                    html = html.replace(/src=["']([^"']+)["']/g, (match, url) => {
                        return `src="${fixImageUrl(url)}"`;
                    });
                    
                    // Fix anchor href attributes using regex
                    html = html.replace(/href=["']([^"']+)["']/g, (match, url) => {
                        return `href="${fixImageUrl(url)}"`;
                    });
                    
                    row[field] = html;
                }
            });
        });
        
        // Get ordered columns if field order is configured
        let orderedColumns = columns;
        if (config.field_order) {
            orderedColumns = sortColumnsByOrder(columns, config.field_order);
        }
        
        // Sort rows if configured
        const sortedRows = sortRows(rows, columns, config);
        
        // Group data using the groupby configuration
        const grouped = groupData(sortedRows, columns, config.group_by || ['status'], config.group_sort);
        
        currentReportData = {
            grouped,
            columns: orderedColumns,
            reportName
        };
        
        renderGroupedCards(grouped, orderedColumns, reportName);
    } catch (err) {
        console.error("Error loading report:", err);
        alert("Error loading report: " + err.message);
    }
}








function sortColumnsByOrder(columns, fieldOrder) {
    const ordered = [];
    const remaining = [...columns];
    
    fieldOrder.forEach(fieldname => {
        const idx = remaining.findIndex(c => c.fieldname === fieldname);
        if (idx >= 0) {
            ordered.push(remaining[idx]);
            remaining.splice(idx, 1);
        }
    });
    
    return [...ordered, ...remaining];
}

function sortRows(rows, columns, config) {
    if (!config.sort_by) return rows;
    
    const sortField = config.sort_by;
    const sortOrder = config.sort_order || 'asc';
    
    return [...rows].sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        const comparison = valA < valB ? -1 : 1;
        return sortOrder === 'asc' ? comparison : -comparison;
    });
}

function groupData(rows, columns, groupFields, groupSort = {}) {
    const grouped = {};
    
    rows.forEach(row => {
        const level1 = row[groupFields[0]] || 'Unknown';
        const level2 = groupFields[1] ? (row[groupFields[1]] || 'Unknown') : 'All';
        
        if (!grouped[level1]) {
            grouped[level1] = {};
        }
        if (!grouped[level1][level2]) {
            grouped[level1][level2] = [];
        }
        grouped[level1][level2].push(row);
    });
    
    const sortedGrouped = {};
    
    const level1Keys = Object.keys(grouped);
    if (groupSort[groupFields[0]]) {
        const customOrder = groupSort[groupFields[0]];
        level1Keys.sort((a, b) => {
            const indexA = customOrder.indexOf(a);
            const indexB = customOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    } else {
        level1Keys.sort();
    }
    
    level1Keys.forEach(key1 => {
        sortedGrouped[key1] = {};
        
        const level2Keys = Object.keys(grouped[key1]);
        if (groupFields[1] && groupSort[groupFields[1]]) {
            const customOrder = groupSort[groupFields[1]];
            level2Keys.sort((a, b) => {
                const indexA = customOrder.indexOf(a);
                const indexB = customOrder.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        } else {
            level2Keys.sort();
        }
        
        level2Keys.forEach(key2 => {
            sortedGrouped[key1][key2] = grouped[key1][key2];
        });
    });
    
    return sortedGrouped;
}

function renderGroupedCards(grouped, columns, reportName) {
    const reportArea = document.getElementById("reportArea");
    reportArea.innerHTML = "";
    
    const config = reportConfig[reportName] || {};
    const collapsed = config.collapsed !== false;
    
    Object.keys(grouped).forEach(level1 => {
        const level1Div = document.createElement("div");
        level1Div.className = "mb-4";
        
        const level1Count = Object.values(grouped[level1]).reduce((sum, arr) => sum + arr.length, 0);
        
        const level1Header = document.createElement("div");
        level1Header.className = "operation-header p-3 text-white rounded mb-2";
        level1Header.style.cursor = "pointer";
        level1Header.innerHTML = `
            <h5 class="mb-0">
                <span class="toggle-icon">${collapsed ? '▶' : '▼'}</span> ${level1} 
                <span class="badge bg-light text-dark ms-2">${level1Count}</span>
            </h5>
        `;
        
        const level1Content = document.createElement("div");
        level1Content.className = "level1-content";
        level1Content.style.display = collapsed ? "none" : "block";
        
        Object.keys(grouped[level1]).forEach(level2 => {
            const level2Div = document.createElement("div");
            level2Div.className = "mb-3 ms-md-3";
            
            const level2Header = document.createElement("div");
            level2Header.className = "workstation-header p-2 text-white rounded mb-2";
            level2Header.style.cursor = "pointer";
            level2Header.innerHTML = `
                <h6 class="mb-0">
                    <span class="toggle-icon">${collapsed ? '▶' : '▼'}</span> ${level2} 
                    <span class="badge bg-light text-dark ms-2">${grouped[level1][level2].length}</span>
                </h6>
            `;
            
            const level2Content = document.createElement("div");
            level2Content.className = "level2-content";
            level2Content.style.display = collapsed ? "none" : "block";
            
            const cardsContainer = document.createElement("div");
            cardsContainer.className = "d-flex flex-wrap gap-3 mt-2";
            
            grouped[level1][level2].forEach(row => {
                const card = createCard(row, columns, reportName, config);
                card.className = card.className + " card-grid-item";
                cardsContainer.appendChild(card);
            });
            
            level2Content.appendChild(cardsContainer);
            level2Div.appendChild(level2Header);
            level2Div.appendChild(level2Content);
            
            level2Header.addEventListener("click", () => {
                level2Content.style.display = level2Content.style.display === "none" ? "block" : "none";
                const icon = level2Header.querySelector(".toggle-icon");
                icon.textContent = level2Content.style.display === "none" ? "▶" : "▼";
            });
            
            level1Content.appendChild(level2Div);
        });
        
        level1Div.appendChild(level1Header);
        level1Div.appendChild(level1Content);
        
        level1Header.addEventListener("click", () => {
            level1Content.style.display = level1Content.style.display === "none" ? "block" : "none";
            const icon = level1Header.querySelector(".toggle-icon");
            icon.textContent = level1Content.style.display === "none" ? "▶" : "▼";
        });
        
        
        // Apply current collapse state to newly rendered groups
const level2ContentsArray = Array.from(level1Content.querySelectorAll('.level2-content'));
applyCurrentCollapseState(level1Content, level2ContentsArray);

reportArea.appendChild(level1Div);

        
        
        
        
        reportArea.appendChild(level1Div);
    });
}




















function createCard(row, columns, reportName, config) {
    const card = document.createElement("div");
    card.className = "card card-report h-100";
    
    const userPerms = config.user_permissions?.[userEmail];
    const hiddenFields = userPerms?.hidden_fields || [];
    const titleField = config.title_field || "work_order_id";
    const cardFields = config.card_fields || ["customer", "production_item", "quantity_to_manufacture", "completed_qty", "workstation"];
    const imageFields = config.image_fields || [];
    
    const name = row[titleField] || row.name || row["work_order_id"] || row["item_code"] || "Record";
    
    const statusFields = ["status", "operation_status", "work_order_status"];
    let status;
    for (const sf of statusFields) {
        if (row[sf]) {
            status = row[sf];
            break;
        }
    }
    
    const imgUrl = extractImageFromRow(row, columns, imageFields);
    if (imgUrl) {
        const img = document.createElement("img");
        img.className = "card-img-top";
        img.src = imgUrl;
        img.alt = name;
        img.style.height = "180px";
        img.style.objectFit = "cover";
        img.onerror = function() {
            console.error("Failed to load image:", imgUrl);
            this.style.display = "none";
        };
        card.appendChild(img);
    }
    
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    
    if (status) {
        const badge = document.createElement("span");
        badge.className = "badge bg-secondary mb-2";
        badge.style.fontSize = "0.7rem";
        badge.style.padding = "0.25rem 0.5rem";
        badge.textContent = status;
        cardBody.appendChild(badge);
    }
    
    const title = document.createElement("h6");
    title.className = "card-title mb-2";
    title.textContent = name;
    cardBody.appendChild(title);
    
    let count = 0;
    cardFields.forEach(fieldKey => {
        if (count >= 5) return;
        if (hiddenFields.includes(fieldKey)) return;
        if (row[fieldKey] !== null && row[fieldKey] !== undefined && row[fieldKey] !== "") {
            const col = columns.find(c => c.fieldname === fieldKey);
            const label = col ? (fieldLabels[fieldKey] || col.label || fieldKey) : fieldKey;
            
            const p = document.createElement("p");
            p.className = "mb-1 small";
            
            let value = row[fieldKey];
            if (typeof value === "string" && value.length > 40) {
                value = value.substring(0, 40) + "...";
            }
            
            p.innerHTML = `<strong>${label}:</strong> ${value}`;
            cardBody.appendChild(p);
            count++;
        }
    });
    
    // Create buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "d-flex gap-2 mt-2";
    
    // View Details button (always present)
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-sm btn-outline-primary flex-grow-1";
    detailsBtn.textContent = "View Details";
    detailsBtn.addEventListener("click", () => {
        showDetailModal(row, columns, reportName, config);
    });
    buttonsContainer.appendChild(detailsBtn);
    
    // Add Time Logs button if configured
    if (config.show_time_logs_button && row['job_card']) {
        const timeLogsPerms = config.time_logs_permissions?.[userEmail] || {};
        
        if (timeLogsPerms.can_view) {
            const timeLogsBtn = document.createElement("button");
            timeLogsBtn.className = "btn btn-sm btn-outline-info flex-grow-1";
            timeLogsBtn.innerHTML = '<i class="bi bi-clock-history"></i> Time Logs';
timeLogsBtn.addEventListener("click", () => {
    // Extract plain text from HTML link if it exists
    let jobCardName = row['job_card'];
    
    // If it's an HTML string, extract the text content
    if (typeof jobCardName === 'string' && jobCardName.includes('<a')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = jobCardName;
        jobCardName = tempDiv.textContent || tempDiv.innerText || jobCardName;
    }
    
    showTimeLogsModal(jobCardName, reportName, config);
});

            buttonsContainer.appendChild(timeLogsBtn);
        }
    }
    
    cardBody.appendChild(buttonsContainer);
    card.appendChild(cardBody);
    
    return card;
}






async function showDetailModal(row, columns, reportName, config) {
    const modal = new bootstrap.Modal(document.getElementById("detailModal"));
    
    const titleField = config.title_field || 'work_order_id';
    let docName = row[titleField] || row.name || row.work_order_id || row.id;
    
    const nameCol = columns.find(c => c.fieldname === 'name' || c.fieldname === titleField);
    if (nameCol && nameCol.fieldname !== titleField) {
        docName = row[nameCol.fieldname] || docName;
    }
    
    document.getElementById("modalTitle").textContent = row[titleField] || docName || "Details";
    
    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = "";
    
    const userPerms = config.user_permissions?.[userEmail] || {};
    const editableFields = userPerms.editable_fields || [];
    const hiddenFields = userPerms.hidden_fields || [];
    const canEdit = currentUser.can_edit;
    
    for (const col of columns) {
        const reportFieldname = col.fieldname;  // Field name as shown in report
        const actualFieldname = window.reportFieldMapping?.[reportFieldname] || reportFieldname;  // Real database field
        const value = row[reportFieldname];  // Get value using report's field name
        
        if (hiddenFields.includes(reportFieldname)) continue;
        
        const isEditable = canEdit && editableFields.includes(reportFieldname) && reportFieldname !== 'work_order_id';
        const hasValue = value !== null && value !== undefined && value !== '';
        
        if (hasValue || isEditable) {
            const fieldDiv = document.createElement("div");
            fieldDiv.className = "mb-3 pb-2 border-bottom";
            
            const label = fieldLabels[reportFieldname] || col.label || reportFieldname;
            
            const labelDiv = document.createElement("div");
            labelDiv.className = "fw-bold text-muted small mb-1";
            labelDiv.textContent = label;
            
            const valueDiv = document.createElement("div");
            valueDiv.className = "mt-1";
            
            if (isEditable) {
                // Editable field - use actual database field name
                
                if (col.fieldtype === 'Link' && col.options) {
                    const select = document.createElement("select");
                    select.className = "form-select form-select-sm";
                    select.dataset.fieldname = actualFieldname;  // Use real database field name
                    select.dataset.docname = docName;
                    select.dataset.doctype = config.doctype || 'Work Order';
                    
                    const options = await getLinkOptions(col.options);
                    
                    const emptyOption = document.createElement("option");
                    emptyOption.value = "";
                    emptyOption.textContent = "-- Select --";
                    select.appendChild(emptyOption);
                    
                    options.forEach(opt => {
                        const option = document.createElement("option");
                        option.value = opt;
                        option.textContent = opt;
                        if (opt === value) option.selected = true;
                        select.appendChild(option);
                    });
                    
                    const saveBtn = createSaveButton(select, reportName, modal);
                    valueDiv.appendChild(select);
                    valueDiv.appendChild(saveBtn);
                    
                } else if (col.fieldtype === 'Select' && col.options) {
                    const select = document.createElement("select");
                    select.className = "form-select form-select-sm";
                    select.dataset.fieldname = actualFieldname;  // Use real database field name
                    select.dataset.docname = docName;
                    select.dataset.doctype = config.doctype || 'Work Order';
                    
                    const options = col.options.split('\n');
                    
                    const emptyOption = document.createElement("option");
                    emptyOption.value = "";
                    emptyOption.textContent = "-- Select --";
                    select.appendChild(emptyOption);
                    
                    options.forEach(opt => {
                        const option = document.createElement("option");
                        option.value = opt;
                        option.textContent = opt;
                        if (opt === value) option.selected = true;
                        select.appendChild(option);
                    });
                    
                    const saveBtn = createSaveButton(select, reportName, modal);
                    valueDiv.appendChild(select);
                    valueDiv.appendChild(saveBtn);
                    
                } 
                
                
                
               else if (col.fieldtype === "Text" || col.fieldtype === "Small Text" || 
         col.fieldtype === "Long Text" || col.fieldtype === "Text Editor") {
    
    // Create container for display and edit modes
    const richTextContainer = document.createElement("div");
    richTextContainer.className = "richtext-container";
    
    // Create display mode (read-only view)
    const displayDiv = document.createElement("div");
    displayDiv.className = "richtext-display";
    displayDiv.style.padding = "0.5rem";
    displayDiv.style.border = "1px solid #dee2e6";
    displayDiv.style.borderRadius = "0.25rem";
    displayDiv.style.backgroundColor = "#f8f9fa";
    displayDiv.style.minHeight = "50px";
    displayDiv.style.overflowY = "auto";
    
    // Extract and set display HTML
    let htmlValue = value || "<p class='text-muted'>No content</p>";
    let originalHtmlValue = htmlValue; // Store original for saving
    
    if (typeof htmlValue === 'string' && htmlValue.includes('ql-editor')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlValue;
        const qlEditor = tempDiv.querySelector('.ql-editor');
        htmlValue = qlEditor ? qlEditor.innerHTML : htmlValue;
        originalHtmlValue = htmlValue;
    }
    
    displayDiv.innerHTML = htmlValue;
    
    // Fix image URLs in display (for viewing)
    displayDiv.querySelectorAll('img').forEach(img => {
        const originalSrc = img.getAttribute('src');
        const fixedUrl = fixImageUrl(originalSrc);
        img.setAttribute('src', fixedUrl);
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
    });
    
    // Create edit mode (contenteditable)
    const editorContainer = document.createElement("div");
    editorContainer.className = "richtext-editor-container";
    editorContainer.style.display = "none"; // Hidden by default
    
    // Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "richtext-toolbar mb-2";
    toolbar.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-secondary" id="insertImageBtn">
            📷 Insert Image
        </button>
        <input type="file" accept="image/*" style="display: none;" id="imageUploadInput" />
    `;
    
    // Editable div
    const editableDiv = document.createElement("div");
    editableDiv.className = "form-control form-control-sm editable-richtext";
    editableDiv.contentEditable = "true";
    editableDiv.style.minHeight = "150px";
    editableDiv.style.maxHeight = "400px";
    editableDiv.style.overflowY = "auto";
    editableDiv.style.whiteSpace = "pre-wrap";
    editableDiv.innerHTML = originalHtmlValue;
    
    editableDiv.dataset.fieldname = actualFieldname;
    editableDiv.dataset.docname = docName;
    editableDiv.dataset.doctype = config.doctype || "Work Order";
    
    // Assemble editor
    editorContainer.appendChild(toolbar);
    editorContainer.appendChild(editableDiv);
    
    // Add image upload functionality
    const insertImageBtn = toolbar.querySelector('#insertImageBtn');
    const imageUploadInput = toolbar.querySelector('#imageUploadInput');
    
    insertImageBtn.onclick = (e) => {
        e.preventDefault();
        imageUploadInput.click();
    };
    
    imageUploadInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            editableDiv.focus();
            
            const img = document.createElement('img');
            img.src = base64Image;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '10px 0';
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                editableDiv.appendChild(img);
            }
        };
        
        reader.readAsDataURL(file);
        event.target.value = '';
    });
    
    // Create Edit/Cancel/Save buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "mt-2";
    
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-primary";
    editBtn.textContent = "✏️ Edit";
    editBtn.onclick = () => {
        // Set editor with original HTML
        editableDiv.innerHTML = originalHtmlValue;
        
        // FIX: Now also fix image URLs in edit mode so they're visible
        editableDiv.querySelectorAll('img').forEach(img => {
            const originalSrc = img.getAttribute('src');
            // Store the original URL in a data attribute
            img.dataset.originalSrc = originalSrc;
            // Fix the URL for display
            const fixedUrl = fixImageUrl(originalSrc);
            img.setAttribute('src', fixedUrl);
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        });
        
        displayDiv.style.display = "none";
        editorContainer.style.display = "block";
        editBtn.style.display = "none";
        cancelBtn.style.display = "inline-block";
        saveBtn.style.display = "inline-block";
    };
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-sm btn-secondary me-2";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.display = "none";
    cancelBtn.onclick = () => {
        displayDiv.style.display = "block";
        editorContainer.style.display = "none";
        editBtn.style.display = "inline-block";
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
    };
    
    const saveBtn = createSaveButton(editableDiv, reportName, modal);
    saveBtn.style.display = "none";
    
    buttonContainer.appendChild(editBtn);
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(saveBtn);
    
    // Assemble everything
    richTextContainer.appendChild(displayDiv);
    richTextContainer.appendChild(editorContainer);
    
    valueDiv.appendChild(richTextContainer);
    valueDiv.appendChild(buttonContainer);
}




                
                
                
                
                
                
                
                else {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.className = "form-control form-control-sm";
                    input.value = value || '';
                    input.placeholder = `Enter ${label}...`;
                    input.dataset.fieldname = actualFieldname;  // Use real database field name
                    input.dataset.docname = docName;
                    input.dataset.doctype = config.doctype || 'Work Order';
                    
                    const saveBtn = createSaveButton(input, reportName, modal);
                    valueDiv.appendChild(input);
                    valueDiv.appendChild(saveBtn);
                }
                
            } else if (hasValue) {
                // Non-editable field with value - display only
                if (typeof value === 'string' && (value.includes('<') || value.includes('href'))) {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = value;
                    
                    tempDiv.querySelectorAll('img').forEach(img => {
                        const originalSrc = img.getAttribute('src');
                        const fixedUrl = fixImageUrl(originalSrc);
                        
                        img.setAttribute('src', fixedUrl);
                        img.style.cursor = 'pointer';
                        img.style.maxWidth = '100%';
                        
                        const imageUrl = fixedUrl;
                        
                        img.onclick = function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(imageUrl, '_blank', 'noopener,noreferrer');
                        };
                        
                        img.onerror = function() {
                            console.error("Failed to load image:", imageUrl);
                            this.style.border = '1px solid #ddd';
                            this.style.padding = '5px';
                            this.style.backgroundColor = '#f8f9fa';
                            this.alt = 'Image not available';
                        };
                    });
                    
                    tempDiv.querySelectorAll('a').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            link.href = fixImageUrl(href);
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.onclick = function(e) {
                                e.stopPropagation();
                            };
                        }
                    });
                    
                    valueDiv.appendChild(tempDiv);
                    
                } else if (col.fieldtype === 'Link' && col.options) {
                    const link = document.createElement("a");
                    const doctypeSlug = col.options.toLowerCase().replace(/\s+/g, '-');
                    link.href = `https://acmestones.erpnext.com/app/${doctypeSlug}/${encodeURIComponent(value)}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'link-field';
                    link.textContent = value;
                    valueDiv.appendChild(link);
                } else {
                    valueDiv.textContent = value;
                }
            }
            
            fieldDiv.appendChild(labelDiv);
            fieldDiv.appendChild(valueDiv);
            modalBody.appendChild(fieldDiv);
        }
    }
    
    modal.show();
}




function createSaveButton(inputElement, reportName, modal) {
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-sm btn-success mt-1";
    saveBtn.textContent = "Save";
    
    saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        
        const doctype = inputElement.dataset.doctype;
        const docname = inputElement.dataset.docname;
        const fieldname = inputElement.dataset.fieldname;
        
        let value;
        if (inputElement.classList.contains('editable-richtext')) {
            // FIX: Clone the content and restore original image URLs before saving
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = inputElement.innerHTML;
            
            // Restore original URLs from data-original-src
            tempDiv.querySelectorAll('img').forEach(img => {
                const originalSrc = img.dataset.originalSrc;
                if (originalSrc) {
                    img.setAttribute('src', originalSrc);
                    img.removeAttribute('data-original-src');
                }
            });
            
            value = tempDiv.innerHTML;
        } else {
            value = inputElement.value || '';
        }
        
        if (typeof value === 'string' && !value.includes('<') && !value.includes('>')) {
            value = value.trim();
        }
        
        if (!value || value.trim() === '') {
            alert("Please enter a value before saving.");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
            return;
        }
        
        if (inputElement.classList.contains('editable-richtext')) {
            if (!value.includes('ql-editor')) {
                value = `<div class="ql-editor read-mode">${value}</div>`;
            }
        }
        
        console.log("Saving field:", {doctype, docname, fieldname});
        
        try {
            const result = await updateField(doctype, docname, fieldname, value);
            console.log("Update result:", result);
            
            if (result.error || result.exc) {
                throw new Error(result.error || result.exc || "Update failed");
            }
            
            saveBtn.textContent = "✓ Saved";
            saveBtn.classList.remove("btn-success");
            saveBtn.classList.add("btn-secondary");
            
            setTimeout(() => {
                loadReport(reportName);
                modal.hide();
            }, 1500);
        } catch (err) {
            console.error("Save error:", err);
            alert("Error saving: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
        }
    };
    
    return saveBtn;
}


























// Store user data to prevent loss during configuration
let tempUserData = {};

function preserveUserData() {
    tempUserData = {};
    
    console.log("=== PRESERVE USER DATA DEBUG ===");
    
    // Get all user cards
    const cards = document.querySelectorAll('#usersList .card:not(.border-success)');
    console.log("Found cards:", cards.length);
    
    cards.forEach((cardEl, cardIndex) => {
        const cardBody = cardEl.querySelector('.card-body');
        if (!cardBody) {
            console.log(`Card ${cardIndex}: No card body found`);
            return;
        }
        
        const emailEl = cardBody.querySelector('h6');
        if (!emailEl) {
            console.log(`Card ${cardIndex}: No h6 found`);
            return;
        }
        
        // Get email
        const email = emailEl.textContent.trim().split(/\s+/)[0];
        console.log(`Card ${cardIndex}: Email = ${email}`);
        
        // Find idx
        const idxElement = cardBody.querySelector('[data-idx]');
        if (!idxElement) {
            console.log(`Card ${cardIndex}: No data-idx element found`);
            return;
        }
        
        const idx = idxElement.dataset.idx;
        console.log(`Card ${cardIndex}: data-idx = ${idx}`);
        
        // Get elements
        const roleSelect = cardBody.querySelector(`.user-role[data-idx="${idx}"]`);
        const editCheck = cardBody.querySelector(`.user-edit[data-idx="${idx}"]`);
        
        console.log(`Card ${cardIndex}: roleSelect found:`, !!roleSelect);
        console.log(`Card ${cardIndex}: editCheck found:`, !!editCheck);
        
        // Get ALL report checkboxes (checked and unchecked)
        const allReportChecks = cardBody.querySelectorAll(`.user-report-check[data-idx="${idx}"]`);
        const checkedReportChecks = cardBody.querySelectorAll(`.user-report-check[data-idx="${idx}"]:checked`);
        
        console.log(`Card ${cardIndex}: Total report checkboxes:`, allReportChecks.length);
        console.log(`Card ${cardIndex}: Checked report checkboxes:`, checkedReportChecks.length);
        
        // Log each checkbox
        allReportChecks.forEach((cb, i) => {
            console.log(`  Checkbox ${i}: value="${cb.value}", checked=${cb.checked}, id="${cb.id}"`);
        });
        
        if (email && roleSelect) {
            tempUserData[email] = {
                role: roleSelect.value,
                can_edit: editCheck ? editCheck.checked : false,
                allowed_reports: Array.from(checkedReportChecks).map(cb => cb.value)
            };
            
            console.log(`Card ${cardIndex}: Saved data for ${email}:`, tempUserData[email]);
        }
    });
    
    console.log("=== FINAL PRESERVED DATA ===");
    console.log(JSON.stringify(tempUserData, null, 2));
}








































async function openAdminSettings() {


   
    const modal = new bootstrap.Modal(document.getElementById("adminModal"));
    
    const userData = await getUsers();
    renderUsersList(userData.users);
    
    // PRESERVE DATA IMMEDIATELY after rendering the list
    setTimeout(() => {
        preserveUserData();
        console.log("Initial data preserved:", tempUserData);
    }, 100);
    
    document.getElementById("fetchReportsBtn").onclick = async () => {
        const btn = document.getElementById("fetchReportsBtn");
        btn.disabled = true;
        btn.textContent = "Fetching Reports...";
        
        try {
            const reportsData = await getAllReports();
            
            if (reportsData.data && Array.isArray(reportsData.data)) {
                allReports = reportsData.data.map(r => r.name);
            } else {
                allReports = [];
            }
            
            renderReportsListAdmin(allReports);
            btn.textContent = "✓ Reports Fetched (" + allReports.length + ")";
            btn.classList.add("btn-success");
            btn.classList.remove("btn-primary");
            
            renderUsersList(userData.users);
            
            // Re-preserve after re-rendering
            setTimeout(() => {
                preserveUserData();
                console.log("Data re-preserved after fetch:", tempUserData);
            }, 100);
        } catch (err) {
            console.error("Error fetching reports:", err);
            alert("Error fetching reports: " + err.message);
            btn.disabled = false;
            btn.textContent = "Fetch All Reports from ERPNext";
        }
    };
    
    document.getElementById("saveSettingsBtn").onclick = async () => {
        try {
            // Re-preserve right before save to capture any checkbox changes
            preserveUserData();
            console.log("Final preserved data before save:", tempUserData);
            
            await saveUserSettings();
            await saveReportConfig(reportConfig);
            alert("Settings saved successfully!");
            modal.hide();
            location.reload();
        } catch (err) {
            alert("Error saving settings: " + err.message);
        }
    };
    
    modal.show();
}


function renderUsersList(users) {
    const div = document.getElementById("usersList");
    div.innerHTML = "";
    
    const infoDiv = document.createElement("div");
    infoDiv.className = "alert alert-info mb-3";
    infoDiv.innerHTML = `
        <strong>📌 How to configure:</strong>
        <ol class="mb-0 mt-2">
            <li>Go to "Report Management" tab and click "Fetch All Reports" to see all available reports</li>
            <li>In "User Management", check reports to assign them to users</li>
            <li>Click "Configure Report" to set field permissions for each user</li>
        </ol>
    `;
    div.appendChild(infoDiv);
    
    users.forEach((user, idx) => {
        const userCard = document.createElement("div");
        userCard.className = "card mb-3";
        
        // Use allReports if available, otherwise use the union of all users' assigned reports
        let availableReports = allReports.length > 0 ? allReports : [];
        
        if (availableReports.length === 0) {
            // Collect all reports from all users
            const allAssignedReports = new Set();
            users.forEach(u => {
                if (u.allowed_reports) {
                    u.allowed_reports.forEach(r => allAssignedReports.add(r));
                }
            });
            availableReports = Array.from(allAssignedReports).sort();
        }
        
        let reportsHtml = '';
        if (availableReports.length > 0) {
            reportsHtml = availableReports.map(r => `
                <div class="form-check">
                    <input class="form-check-input user-report-check" 
                           type="checkbox" 
                           value="${r}" 
                           data-idx="${idx}"
                           id="report_${idx}_${r.replace(/\s+/g, '_')}"
                           ${user.allowed_reports.includes(r) ? 'checked' : ''}>
                    <label class="form-check-label" for="report_${idx}_${r.replace(/\s+/g, '_')}">
                        ${r}
                    </label>
                </div>
            `).join('');
        } else {
            reportsHtml = `
                <div class="alert alert-warning small mb-0">
                    <strong>⚠️ No reports available.</strong><br>
                    Go to "Report Management" tab to fetch reports from ERPNext, or the user has no reports assigned yet.
                </div>
            `;
        }
        
        userCard.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h6 class="mb-0">${user.email}</h6>
                    <div>
                        <button class="btn btn-sm btn-info me-2 config-user-reports" data-email="${user.email}">
                            ⚙️ Configure Reports
                        </button>
                        <button class="btn btn-sm btn-danger remove-user" data-idx="${idx}" data-email="${user.email}">
                            🗑️ Remove
                        </button>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6 mb-2">
                        <label class="form-label small fw-bold">Role:</label>
                        <select class="form-select form-select-sm user-role" data-idx="${idx}">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>👤 User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                        </select>
                    </div>
                    <div class="col-md-6 mb-2">
                        <label class="form-label small fw-bold">Permissions:</label>
                        <div class="form-check">
                            <input type="checkbox" 
                                   class="form-check-input user-edit" 
                                   data-idx="${idx}" 
                                   id="edit_${idx}"
                                   ${user.can_edit ? 'checked' : ''}>
                            <label class="form-check-label" for="edit_${idx}">
                                ✏️ Can Edit Records
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="mb-2">
                    <label class="form-label small fw-bold">
                        📊 Allowed Reports 
                        <span class="badge bg-primary" id="count_${idx}">${user.allowed_reports.length}</span>
                    </label>
                    <div class="border rounded p-2" style="max-height: 200px; overflow-y: auto;">
                        ${reportsHtml}
                    </div>
                </div>
            </div>
        `;
        div.appendChild(userCard);
        
        userCard.querySelectorAll('.user-report-check').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const count = userCard.querySelectorAll('.user-report-check:checked').length;
                document.getElementById(`count_${idx}`).textContent = count;
            });
        });
        
        userCard.querySelector('.config-user-reports').addEventListener('click', () => {
            openReportConfigModal(user.email);
        });
    });
    
    div.querySelectorAll('.remove-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.target.dataset.email;
            if (confirm(`Remove user: ${email}?`)) {
                e.target.closest('.card').remove();
            }
        });
    });
    
    // ... rest of add user button code stays the same
}


function renderReportsListAdmin(reports) {
    const div = document.getElementById("reportsList");
    
    if (!reports || reports.length === 0) {
        div.innerHTML = "<p class='text-muted'>No reports found.</p>";
        return;
    }
    
    div.innerHTML = `
        <h6>Available Reports (${reports.length}):</h6>
        <div class="alert alert-info small">
            Configure each report's permissions, grouping, and field visibility.
        </div>
        <div class="list-group" style="max-height: 400px; overflow-y: auto;">
            ${reports.map(r => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    ${r}
                    <button class="btn btn-sm btn-outline-primary config-report-btn" data-report="${r}">
                        ⚙️ Configure
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    div.querySelectorAll('.config-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openGlobalReportConfigModal(btn.dataset.report);
        });
    });
}















async function openReportConfigModal(userEmail) {
    const configModalHtml = `
        <div class="modal fade" id="reportConfigModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Configure Reports for ${userEmail}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="reportConfigTabs"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" id="saveReportConfigBtn">Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('reportConfigModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', configModalHtml);
    
    const configModal = new bootstrap.Modal(document.getElementById('reportConfigModal'));
    
    const users = await getUsers();
    const user = users.users.find(u => u.email === userEmail);
    
    if (!user || !user.allowed_reports || user.allowed_reports.length === 0) {
        document.getElementById('reportConfigTabs').innerHTML = '<p class="text-muted">No reports assigned to this user</p>';
        configModal.show();
        return;
    }
    
    let tabsHtml = '<ul class="nav nav-tabs mb-3">';
    user.allowed_reports.forEach((report, idx) => {
        tabsHtml += `
            <li class="nav-item">
                <a class="nav-link ${idx === 0 ? 'active' : ''}" data-bs-toggle="tab" href="#tab_${idx}">
                    ${report}
                </a>
            </li>
        `;
    });
    tabsHtml += '</ul><div class="tab-content">';
    
    for (let idx = 0; idx < user.allowed_reports.length; idx++) {
        const reportName = user.allowed_reports[idx];
        const config = reportConfig[reportName] || {};
        const userPerms = config.user_permissions?.[userEmail] || { editable_fields: [], hidden_fields: [] };
        
        let columns = currentReportColumns;
        if (currentReportData && currentReportData.reportName === reportName) {
            columns = currentReportData.columns;
        }
        
        tabsHtml += `
            <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="tab_${idx}">
                <h6>Field Permissions for ${reportName}</h6>
                
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="small fw-bold mt-3">Editable Fields:</h6>
                        <div class="border rounded p-2" style="max-height: 300px; overflow-y: auto;">
                            ${columns.map(col => `
                                <div class="form-check">
                                    <input class="form-check-input editable-field-check" 
                                           type="checkbox" 
                                           value="${col.fieldname}" 
                                           data-report="${reportName}"
                                           data-user="${userEmail}"
                                           id="edit_${idx}_${col.fieldname}"
                                           ${userPerms.editable_fields?.includes(col.fieldname) ? 'checked' : ''}>
                                    <label class="form-check-label" for="edit_${idx}_${col.fieldname}">
                                        ${col.label || col.fieldname}
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <h6 class="small fw-bold mt-3">Hidden Fields:</h6>
                        <div class="border rounded p-2" style="max-height: 300px; overflow-y: auto;">
                            ${columns.map(col => `
                                <div class="form-check">
                                    <input class="form-check-input hidden-field-check" 
                                           type="checkbox" 
                                           value="${col.fieldname}" 
                                           data-report="${reportName}"
                                           data-user="${userEmail}"
                                           id="hide_${idx}_${col.fieldname}"
                                           ${userPerms.hidden_fields?.includes(col.fieldname) ? 'checked' : ''}>
                                    <label class="form-check-label" for="hide_${idx}_${col.fieldname}">
                                        ${col.label || col.fieldname}
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    tabsHtml += '</div>';
    document.getElementById('reportConfigTabs').innerHTML = tabsHtml;
    
    document.getElementById('saveReportConfigBtn').onclick = () => {
        user.allowed_reports.forEach(reportName => {
            if (!reportConfig[reportName]) {
                reportConfig[reportName] = {};
            }
            if (!reportConfig[reportName].user_permissions) {
                reportConfig[reportName].user_permissions = {};
            }
            
            const editableChecks = document.querySelectorAll(`.editable-field-check[data-report="${reportName}"][data-user="${userEmail}"]:checked`);
            const hiddenChecks = document.querySelectorAll(`.hidden-field-check[data-report="${reportName}"][data-user="${userEmail}"]:checked`);
            
            reportConfig[reportName].user_permissions[userEmail] = {
                editable_fields: Array.from(editableChecks).map(cb => cb.value),
                hidden_fields: Array.from(hiddenChecks).map(cb => cb.value)
            };
        });
        
        alert("Configuration saved! Click 'Save Changes' in main settings to persist.");
        configModal.hide();
    };
    
    configModal.show();
}









async function openGlobalReportConfigModal(reportName) {
    const configModalHtml = `
        <div class="modal fade" id="globalReportConfigModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Configure: ${reportName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div id="globalConfigContent"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" id="saveGlobalConfigBtn">Save Configuration</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('globalReportConfigModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', configModalHtml);
    
    const configModal = new bootstrap.Modal(document.getElementById('globalReportConfigModal'));
    
    const config = reportConfig[reportName] || {};
    
    const reportData = await getReport(reportName);
    const columns = reportData.message.columns;
    const rows = reportData.message.result;
    
    const group1Field = config.group_by?.[0];
    const group2Field = config.group_by?.[1];
    
    let group1Values = [];
    let group2Values = [];
    
    if (group1Field) {
        group1Values = [...new Set(rows.map(r => r[group1Field]).filter(v => v))];
        if (config.group_sort?.[group1Field]) {
            const sortOrder = config.group_sort[group1Field];
            group1Values.sort((a, b) => {
                const indexA = sortOrder.indexOf(a);
                const indexB = sortOrder.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        } else {
            group1Values.sort();
        }
    }
    
    if (group2Field) {
        group2Values = [...new Set(rows.map(r => r[group2Field]).filter(v => v))];
        if (config.group_sort?.[group2Field]) {
            const sortOrder = config.group_sort[group2Field];
            group2Values.sort((a, b) => {
                const indexA = sortOrder.indexOf(a);
                const indexB = sortOrder.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        } else {
            group2Values.sort();
        }
    }
    
    // Get list of users for permissions table
    const users = await getUsers();
    
    const contentHtml = `
        <div class="row">
            <div class="col-md-6">
                <h6>Basic Settings</h6>
                
                <label class="small fw-bold">DocType</label>
                <input type="text" class="form-control form-control-sm mb-2" id="config_doctype" 
                       value="${config.doctype || ''}" placeholder="e.g., Work Order">
                
                <label class="small fw-bold">Title Field (for cards)</label>
                <select class="form-select form-select-sm mb-2" id="config_title_field">
                    ${columns.map(c => `
                        <option value="${c.fieldname}" ${config.title_field === c.fieldname ? 'selected' : ''}>
                            ${c.label || c.fieldname}
                        </option>
                    `).join('')}
                </select>
                
                <label class="small fw-bold">Card Fields (select up to 5)</label>
                <div class="border rounded p-2 mb-3" style="max-height: 200px; overflow-y: auto;">
                    ${columns.map(c => `
                        <div class="form-check">
                            <input class="form-check-input card-field-check" type="checkbox" 
                                   value="${c.fieldname}" id="card_${c.fieldname}"
                                   ${config.card_fields?.includes(c.fieldname) ? 'checked' : ''}>
                            <label class="form-check-label small" for="card_${c.fieldname}">
                                ${c.label || c.fieldname}
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <label class="small fw-bold">Image Fields (description fields)</label>
                <div class="border rounded p-2 mb-3" style="max-height: 150px; overflow-y: auto;">
                    ${columns.filter(c => c.fieldname.toLowerCase().includes('description')).map(c => `
                        <div class="form-check">
                            <input class="form-check-input image-field-check" type="checkbox" 
                                   value="${c.fieldname}" id="img_${c.fieldname}"
                                   ${config.image_fields?.includes(c.fieldname) ? 'checked' : ''}>
                            <label class="form-check-label small" for="img_${c.fieldname}">
                                ${c.label || c.fieldname}
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <h6 class="mt-3">Grouping & Sorting</h6>
                
                <label class="small fw-bold">Primary Grouping Field</label>
                <select class="form-select form-select-sm mb-2" id="config_group1">
                    <option value="">-- None --</option>
                    ${columns.map(c => `
                        <option value="${c.fieldname}" ${config.group_by?.[0] === c.fieldname ? 'selected' : ''}>
                            ${c.label || c.fieldname}
                        </option>
                    `).join('')}
                </select>
                
                <label class="small fw-bold">Secondary Grouping Field</label>
                <select class="form-select form-select-sm mb-2" id="config_group2">
                    <option value="">-- None --</option>
                    ${columns.map(c => `
                        <option value="${c.fieldname}" ${config.group_by?.[1] === c.fieldname ? 'selected' : ''}>
                            ${c.label || c.fieldname}
                        </option>
                    `).join('')}
                </select>
                
                <label class="small fw-bold">Sort Records By</label>
                <select class="form-select form-select-sm mb-2" id="config_sortby">
                    <option value="">-- None --</option>
                    ${columns.map(c => `
                        <option value="${c.fieldname}" ${config.sort_by === c.fieldname ? 'selected' : ''}>
                            ${c.label || c.fieldname}
                        </option>
                    `).join('')}
                </select>
                
                <select class="form-select form-select-sm mb-2" id="config_sortorder">
                    <option value="asc" ${config.sort_order === 'asc' ? 'selected' : ''}>Ascending</option>
                    <option value="desc" ${config.sort_order === 'desc' ? 'selected' : ''}>Descending</option>
                </select>
                
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="config_collapsed" 
                           ${config.collapsed !== false ? 'checked' : ''}>
                    <label class="form-check-label" for="config_collapsed">
                        Start with groups collapsed
                    </label>
                </div>
                
                <hr>
                
                <h6 class="mt-3">Time Logs Settings</h6>
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="configShowTimeLogs" 
                        ${config.show_time_logs_button ? 'checked' : ''}>
                    <label class="form-check-label" for="configShowTimeLogs">
                        Show Time Logs Button
                    </label>
                </div>
                
                <div id="timeLogsPermissionsSection" style="display: ${config.show_time_logs_button ? 'block' : 'none'}">
                    <label class="small fw-bold">User Permissions for Time Logs</label>
                    <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                        <table class="table table-sm table-bordered">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th style="min-width: 150px;">User</th>
                                    <th class="text-center" style="width: 60px;">View</th>
                                    <th class="text-center" style="width: 60px;">Add</th>
                                    <th class="text-center" style="width: 60px;">Edit</th>
                                    <th class="text-center" style="width: 60px;">Delete</th>
                                    <th class="text-center" style="width: 80px;">Edit WS</th>
                                </tr>
                            </thead>
                            <tbody id="timeLogsPermissionsTable">
                                ${users.users.map(user => {
                                    const perms = config.time_logs_permissions?.[user.email] || {
                                        can_view: false,
                                        can_add: false,
                                        can_edit: false,
                                        can_delete: false
                                    };
                                    
                                    return `
                                        <tr>
                                            <td class="small">${user.email}</td>
                                            <td class="text-center">
                                                <input type="checkbox" class="form-check-input time-log-perm" 
                                                    data-user="${user.email}" data-perm="can_view" 
                                                    ${perms.can_view ? 'checked' : ''}>
                                            </td>
                                            <td class="text-center">
                                                <input type="checkbox" class="form-check-input time-log-perm" 
                                                    data-user="${user.email}" data-perm="can_add" 
                                                    ${perms.can_add ? 'checked' : ''}>
                                            </td>
                                            <td class="text-center">
                                                <input type="checkbox" class="form-check-input time-log-perm" 
                                                    data-user="${user.email}" data-perm="can_edit" 
                                                    ${perms.can_edit ? 'checked' : ''}>
                                            </td>
                                            <td class="text-center">
                                                <input type="checkbox" class="form-check-input time-log-perm" 
                                                    data-user="${user.email}" data-perm="can_delete" 
                                                    ${perms.can_delete ? 'checked' : ''}>
                                            </td>
                                            <td class="text-center">
                                                <input type="checkbox" class="form-check-input time-log-perm" 
                                                    data-user="${user.email}" data-perm="can_edit_workstation" 
                                                    ${perms.can_edit_workstation ? 'checked' : ''}>
                                            </td>

                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <h6>Group Sort Order</h6>
                <p class="small text-muted">Drag to reorder groups</p>
                
                ${group1Values.length > 0 ? `
                    <label class="small fw-bold">Primary Groups (${group1Field})</label>
                    <ul class="list-group mb-3" id="group1SortList" style="max-height: 200px; overflow-y: auto;">
                        ${group1Values.map(val => `
                            <li class="list-group-item draggable-group" draggable="true" data-value="${val}">
                                <span class="drag-handle">☰</span> ${val}
                            </li>
                        `).join('')}
                    </ul>
                ` : '<p class="small text-muted mb-3">Select primary grouping field first</p>'}
                
                ${group2Values.length > 0 ? `
                    <label class="small fw-bold">Secondary Groups (${group2Field})</label>
                    <ul class="list-group mb-3" id="group2SortList" style="max-height: 200px; overflow-y: auto;">
                        ${group2Values.map(val => `
                            <li class="list-group-item draggable-group" draggable="true" data-value="${val}">
                                <span class="drag-handle">☰</span> ${val}
                            </li>
                        `).join('')}
                    </ul>
                ` : ''}
                
                <hr>
                
                <h6>Field Display Order</h6>
                <p class="small text-muted">Drag to reorder fields in detail modal</p>
                <ul class="list-group" id="fieldOrderList" style="max-height: 300px; overflow-y: auto;">
                    ${columns.map(col => {
                        return `
                            <li class="list-group-item draggable-field" draggable="true" data-fieldname="${col.fieldname}">
                                <span class="drag-handle">☰</span> ${col.label || col.fieldname}
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;
    
    document.getElementById('globalConfigContent').innerHTML = contentHtml;
    
    setupDragDrop('fieldOrderList');
    setupDragDrop('group1SortList');
    setupDragDrop('group2SortList');
    
    // Add event listener for show time logs checkbox
    document.getElementById('configShowTimeLogs').addEventListener('change', (e) => {
        document.getElementById('timeLogsPermissionsSection').style.display = 
            e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('saveGlobalConfigBtn').onclick = () => {
        if (!reportConfig[reportName]) {
            reportConfig[reportName] = {};
        }
        
        const group1 = document.getElementById('config_group1').value;
        const group2 = document.getElementById('config_group2').value;
        
        reportConfig[reportName].doctype = document.getElementById('config_doctype').value;
        reportConfig[reportName].title_field = document.getElementById('config_title_field').value;
        
        const cardFieldChecks = document.querySelectorAll('.card-field-check:checked');
        reportConfig[reportName].card_fields = Array.from(cardFieldChecks).map(cb => cb.value);
        
        const imageFieldChecks = document.querySelectorAll('.image-field-check:checked');
        reportConfig[reportName].image_fields = Array.from(imageFieldChecks).map(cb => cb.value);
        
        reportConfig[reportName].group_by = [group1, group2].filter(g => g);
        reportConfig[reportName].sort_by = document.getElementById('config_sortby').value;
        reportConfig[reportName].sort_order = document.getElementById('config_sortorder').value;
        reportConfig[reportName].collapsed = document.getElementById('config_collapsed').checked;
        
        const fieldOrder = [...document.querySelectorAll('#fieldOrderList .draggable-field')]
            .map(li => li.dataset.fieldname);
        reportConfig[reportName].field_order = fieldOrder;
        
        reportConfig[reportName].group_sort = {};
        
        const group1List = document.getElementById('group1SortList');
        if (group1List && group1) {
            const group1Order = [...group1List.querySelectorAll('.draggable-group')]
                .map(li => li.dataset.value);
            reportConfig[reportName].group_sort[group1] = group1Order;
        }
        
        const group2List = document.getElementById('group2SortList');
        if (group2List && group2) {
            const group2Order = [...group2List.querySelectorAll('.draggable-group')]
                .map(li => li.dataset.value);
            reportConfig[reportName].group_sort[group2] = group2Order;
        }
        
        // Save Time Logs configuration
        reportConfig[reportName].show_time_logs_button = 
            document.getElementById('configShowTimeLogs').checked;
        
        if (reportConfig[reportName].show_time_logs_button) {
            const permissions = {};
            document.querySelectorAll('.time-log-perm').forEach(checkbox => {
                const user = checkbox.dataset.user;
                const perm = checkbox.dataset.perm;
                
                if (!permissions[user]) {
                    permissions[user] = {
                        can_view: false,
                        can_add: false,
                        can_edit: false,
                        can_delete: false,
                        can_edit_workstation: false
                    };
                }
                
                permissions[user][perm] = checkbox.checked;
            });
            
            reportConfig[reportName].time_logs_permissions = permissions;
        } else {
            // Remove time logs permissions if feature is disabled
            delete reportConfig[reportName].time_logs_permissions;
        }
        
        alert("Configuration saved! Click 'Save Changes' in main settings to persist.");
        configModal.hide();
    };
    
    // Blur any focused element to prevent aria-hidden focus conflict
if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
}

// Show modal after a small delay to ensure focus is cleared
setTimeout(() => {
    configModal.show();
}, 50);
}













function setupDragDrop(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    
    let draggedItem = null;
    
    list.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('draggable-field') || e.target.classList.contains('draggable-group')) {
            draggedItem = e.target;
            e.target.style.opacity = '0.5';
        }
    });
    
    list.addEventListener('dragend', (e) => {
        e.target.style.opacity = '';
    });
    
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    list.addEventListener('drop', (e) => {
        e.preventDefault();
        if ((e.target.classList.contains('draggable-field') || e.target.classList.contains('draggable-group')) && draggedItem) {
            const allItems = [...list.querySelectorAll('.draggable-field, .draggable-group')];
            const draggedIdx = allItems.indexOf(draggedItem);
            const targetIdx = allItems.indexOf(e.target);
            
            if (draggedIdx < targetIdx) {
                e.target.after(draggedItem);
            } else {
                e.target.before(draggedItem);
            }
        }
    });
}

async function saveUserSettings() {
    const users = await getUsers(); 
    const updatedUsers = [];
    
    // Collect all user cards currently visible
    const userCards = document.querySelectorAll('#usersList .card:not(.border-success)'); // exclude new unsaved cards if needed
    userCards.forEach(cardEl => {
        const cardBody = cardEl.querySelector('.card-body');
        if (!cardBody) return;
        const emailEl = cardBody.querySelector('h6'); // or input for new users
        if (!emailEl) return;
        const email = emailEl.textContent.trim();

        const idxElement = cardBody.querySelector('[data-idx]');
        const idx = idxElement ? idxElement.dataset.idx : null;

        const roleSelect = cardBody.querySelector(`.user-role[data-idx="${idx}"]`);
        const editCheck = cardBody.querySelector(`.user-edit[data-idx="${idx}"]`);
        const reportChecks = cardBody.querySelectorAll(`.user-report-check[data-idx="${idx}"]:checked`);
        const allowedReports = Array.from(reportChecks).map(cb => cb.value);

        updatedUsers.push({
            email,
            role: roleSelect ? roleSelect.value : "user",
            can_edit: editCheck ? editCheck.checked : false,
            allowed_reports: allowedReports
        });
    });

    // Also add new user cards (border-success class)
    const newUserCards = document.querySelectorAll('#usersList .card.border-success');
newUserCards.forEach(cardEl => {
    const cardBody = cardEl.querySelector('.card-body');
    if (!cardBody) return;

    const emailInput = cardBody.querySelector('.new-user-email');
    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) {
        alert("Please provide a valid email for all new users before saving.");
        emailInput.focus();
        throw new Error("User email is required");
    }

    const roleSelect = cardBody.querySelector('.user-role');
    const editCheck = cardBody.querySelector('.user-edit');
    const reportChecks = cardBody.querySelectorAll('.user-report-check:checked');
    const allowedReports = Array.from(reportChecks).map(cb => cb.value);

    updatedUsers.push({
        email,
        role: roleSelect ? roleSelect.value : "user",
        can_edit: editCheck ? editCheck.checked : false,
        allowed_reports: allowedReports
    });
});


    if (updatedUsers.length === 0) {
        alert("No users to save!");
        return;
    }

    console.log("Final users to save:", updatedUsers);

    const res = await fetch(`${API_BASE}?action=save_users`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            admin_email: userEmail,
            data: updatedUsers
        })
    });
    if (!res.ok) throw new Error("Failed to save users");

    const result = await res.json();
    return result;
}






















// === Search Functionality ===
let searchTimeout = null;
let allCardsData = [];

// Initialize search after DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            if (query.length > 0) {
                clearSearchBtn.style.display = 'block';
                searchTimeout = setTimeout(() => {
                    performSearch(query);
                }, 300); // Debounce for 300ms
            } else {
                clearSearchBtn.style.display = 'none';
                clearSearch();
            }
        });
        
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                clearSearch();
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
});

function performSearch(query) {
    if (!currentReportData) return;
    
    query = query.toLowerCase();
    let matchCount = 0;
    let totalCards = 0;
    
    // Get all cards
    const allCards = document.querySelectorAll('.card-report');
    
    allCards.forEach(card => {
        totalCards++;
        const cardText = card.textContent.toLowerCase();
        const cardHTML = card.innerHTML.toLowerCase();
        
        // Check if query matches any text in the card
        if (cardText.includes(query) || cardHTML.includes(query)) {
            card.classList.remove('card-hidden');
            matchCount++;
            
            // Highlight the search term
            highlightSearchTerm(card, query);
        } else {
            card.classList.add('card-hidden');
        }
    });
    
    // Update groups visibility
    updateGroupVisibility();
    
    // Update search count
    updateSearchCount(matchCount, totalCards);
    
    // Show "no results" message if needed
    if (matchCount === 0) {
        showNoResultsMessage(query);
    } else {
        removeNoResultsMessage();
    }
}

function highlightSearchTerm(card, query) {
    // Remove existing highlights
    const highlighted = card.querySelectorAll('.search-highlight');
    highlighted.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });
    
    // Add new highlights to card body text (not images or buttons)
    const cardBody = card.querySelector('.card-body');
    if (!cardBody) return;
    
    const textNodes = getTextNodes(cardBody);
    
    textNodes.forEach(node => {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        const index = lowerText.indexOf(query);
        
        if (index !== -1) {
            const span = document.createElement('span');
            span.className = 'search-highlight';
            
            const before = text.substring(0, index);
            const match = text.substring(index, index + query.length);
            const after = text.substring(index + query.length);
            
            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));
            
            span.textContent = match;
            fragment.appendChild(span);
            
            if (after) fragment.appendChild(document.createTextNode(after));
            
            node.parentNode.replaceChild(fragment, node);
        }
    });
}

function getTextNodes(element) {
    const textNodes = [];
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            // Skip buttons and script/style tags
            if (node.parentElement.tagName === 'BUTTON' || 
                node.parentElement.tagName === 'SCRIPT' || 
                node.parentElement.tagName === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
            }
            return node.textContent.trim().length > 0 ? 
                   NodeFilter.FILTER_ACCEPT : 
                   NodeFilter.FILTER_REJECT;
        }
    });
    
    let node;
    while (node = walk.nextNode()) {
        textNodes.push(node);
    }
    
    return textNodes;
}

function updateGroupVisibility() {
    // Hide empty groups and show groups with visible cards
    document.querySelectorAll('.level1-content').forEach(level1 => {
        level1.querySelectorAll('.level2-content').forEach(level2 => {
            const visibleCards = level2.querySelectorAll('.card-report:not(.card-hidden)');
            const level2Div = level2.closest('.mb-3');
            
            if (visibleCards.length === 0) {
                level2Div.style.display = 'none';
            } else {
                level2Div.style.display = 'block';
                level2.style.display = 'block';
                
                // Update count badge
                const badge = level2Div.querySelector('.workstation-header .badge');
                if (badge) {
                    badge.textContent = visibleCards.length;
                }
            }
        });
        
        // Check if level1 has any visible level2 groups
        const visibleLevel2 = level1.querySelectorAll('.mb-3:not([style*="display: none"])');
        const level1Div = level1.closest('.mb-4');
        
        if (visibleLevel2.length === 0) {
            level1Div.style.display = 'none';
        } else {
            level1Div.style.display = 'block';
            level1.style.display = 'block';
            
            // Update level1 count
            const visibleCardsInLevel1 = level1.querySelectorAll('.card-report:not(.card-hidden)');
            const badge = level1Div.querySelector('.operation-header .badge');
            if (badge) {
                badge.textContent = visibleCardsInLevel1.length;
            }
        }
    });
}

function updateSearchCount(matchCount, totalCards) {
    const countElement = document.getElementById('searchCount');
    const resultCountElement = document.getElementById('searchResultCount');
    
    if (countElement && resultCountElement) {
        countElement.textContent = matchCount;
        resultCountElement.style.display = 'flex';
    }
}

function showNoResultsMessage(query) {
    removeNoResultsMessage();
    
    const reportArea = document.getElementById('reportArea');
    const noResultsDiv = document.createElement('div');
    noResultsDiv.id = 'noResultsMessage';
    noResultsDiv.className = 'no-results-message';
    noResultsDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <h5>No results found</h5>
        <p class="text-muted">No records match "<strong>${query}</strong>"</p>
        <p class="small">Try a different search term or clear the search to see all records.</p>
    `;
    
    reportArea.insertBefore(noResultsDiv, reportArea.firstChild);
}

function removeNoResultsMessage() {
    const existing = document.getElementById('noResultsMessage');
    if (existing) {
        existing.remove();
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const resultCountElement = document.getElementById('searchResultCount');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.style.display = 'none';
    }
    
    if (resultCountElement) {
        resultCountElement.style.display = 'none';
    }
    
    // Show all cards
    document.querySelectorAll('.card-report').forEach(card => {
        card.classList.remove('card-hidden');
        
        // Remove highlights
        const highlighted = card.querySelectorAll('.search-highlight');
        highlighted.forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });
    });
    
    // Restore original group visibility and counts
    updateGroupVisibility();
    
    // Restore original counts if we have the data
    if (currentReportData && currentReportData.grouped) {
        const grouped = currentReportData.grouped;
        
        Object.keys(grouped).forEach(level1 => {
            const level1Count = Object.values(grouped[level1]).reduce((sum, arr) => sum + arr.length, 0);
            const level1Div = Array.from(document.querySelectorAll('.operation-header')).find(
                el => el.textContent.includes(level1)
            );
            if (level1Div) {
                const badge = level1Div.querySelector('.badge');
                if (badge) badge.textContent = level1Count;
            }
            
            Object.keys(grouped[level1]).forEach(level2 => {
                const level2Count = grouped[level1][level2].length;
                const level2Div = Array.from(document.querySelectorAll('.workstation-header')).find(
                    el => el.textContent.includes(level2)
                );
                if (level2Div) {
                    const badge = level2Div.querySelector('.badge');
                    if (badge) badge.textContent = level2Count;
                }
            });
        });
    }
    
    removeNoResultsMessage();
}















// === Collapse/Expand All Functionality ===
let allGroupsCollapsed = false;

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleAllGroupsBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleAllGroups);
    }
});

function toggleAllGroups() {
    const toggleBtn = document.getElementById('toggleAllGroupsBtn');
    const collapseIcon = document.getElementById('collapseIcon');
    const expandIcon = document.getElementById('expandIcon');
    const toggleText = document.getElementById('toggleAllText');
    
    // Toggle state
    allGroupsCollapsed = !allGroupsCollapsed;
    
    // Get all level 1 and level 2 content divs
    const level1Contents = document.querySelectorAll('.level1-content');
    const level2Contents = document.querySelectorAll('.level2-content');
    
    if (allGroupsCollapsed) {
        // Collapse all
        level1Contents.forEach(content => {
            content.style.display = 'none';
            const icon = content.previousElementSibling?.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▶';
        });
        
        level2Contents.forEach(content => {
            content.style.display = 'none';
            const icon = content.previousElementSibling?.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▶';
        });
        
        // Update button
        collapseIcon.style.display = 'none';
        expandIcon.style.display = 'inline';
        if (toggleText) toggleText.textContent = 'Expand All';
        toggleBtn.title = 'Expand All';
        
    } else {
        // Expand all
        level1Contents.forEach(content => {
            content.style.display = 'block';
            const icon = content.previousElementSibling?.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▼';
        });
        
        level2Contents.forEach(content => {
            content.style.display = 'block';
            const icon = content.previousElementSibling?.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▼';
        });
        
        // Update button
        collapseIcon.style.display = 'inline';
        expandIcon.style.display = 'none';
        if (toggleText) toggleText.textContent = 'Collapse All';
        toggleBtn.title = 'Collapse All';
    }
}

// Update the renderGroupedCards function to respect the toggle state
// Add this at the end of the existing renderGroupedCards function
// Just before: reportArea.appendChild(level1Div);

// Add this code to make new groups respect the current collapse state:
function applyCurrentCollapseState(level1Content, level2Contents) {
    if (allGroupsCollapsed) {
        level1Content.style.display = 'none';
        const icon = level1Content.previousElementSibling?.querySelector('.toggle-icon');
        if (icon) icon.textContent = '▶';
        
        level2Contents.forEach(content => {
            content.style.display = 'none';
            const icon = content.previousElementSibling?.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▶';
        });
    }
}












// API Functions for Job Card Time Logs
async function getTimeLogs(jobCard) {
    const res = await fetch(`${API_BASE}?action=get_time_logs&job_card=${encodeURIComponent(jobCard)}`);
    if (!res.ok) throw new Error("Failed to fetch time logs");
    return res.json();
}

async function addTimeLog(jobCard, data) {
    const res = await fetch(`${API_BASE}?action=add_time_log`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...data, job_card: jobCard})
    });
    if (!res.ok) throw new Error("Failed to add time log");
    return res.json();
}

async function updateTimeLog(jobCard, logIndex, data) {
    const res = await fetch(`${API_BASE}?action=update_time_log`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...data, job_card: jobCard, log_index: logIndex})
    });
    if (!res.ok) throw new Error("Failed to update time log");
    return res.json();
}

async function deleteTimeLog(jobCard, logIndex) {
    const res = await fetch(`${API_BASE}?action=delete_time_log&job_card=${encodeURIComponent(jobCard)}&log_index=${logIndex}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error("Failed to delete time log");
    return res.json();
}


// Get Employee list
async function getEmployees() {
    const res = await fetch(`${API_BASE}?action=get_employees`);
    if (!res.ok) throw new Error("Failed to fetch employees");
    return res.json();
}

// Get Workstation list
async function getWorkstations() {
    const res = await fetch(`${API_BASE}?action=get_workstations`);
    if (!res.ok) throw new Error("Failed to fetch workstations");
    return res.json();
}

// New API function to update Job Card workstation
async function updateJobCardWorkstation(jobCard, workstation) {
    const res = await fetch(`${API_BASE}?action=update_job_card_workstation`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            job_card: jobCard,
            workstation: workstation
        })
    });
    if (!res.ok) throw new Error("Failed to update workstation");
    return res.json();
}












// Time Logs Modal Function
async function showTimeLogsModal(jobCard, reportName, config) {
    const timeLogsPerms = config.time_logs_permissions?.[userEmail] || {};
    
    // Create modal if it doesn't exist
    let modalEl = document.getElementById('timeLogsModal');
    if (!modalEl) {
        const modalHtml = `
            <div class="modal fade" id="timeLogsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="timeLogsModalTitle">Time Logs</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="timeLogsBody">
                            <div class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalEl = document.getElementById('timeLogsModal');
    }
    
    const modal = new bootstrap.Modal(modalEl);
    
    // Fix the title to show just the job card name without HTML
    document.getElementById('timeLogsModalTitle').textContent = `Time Logs - ${jobCard}`;

    // Add proper cleanup on modal close
    modalEl.addEventListener('hidden.bs.modal', function () {
    // Remove backdrop manually if it's stuck
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    }, { once: true });


    
    modal.show();
    
    try {
        console.log('Fetching time logs for:', jobCard); // DEBUG
        const response = await getTimeLogs(jobCard);
        console.log('API Response:', response); // DEBUG
        
        const timeLogs = response.data || [];
        const jobCardInfo = response.job_card_info || {};
        
        console.log('Calling renderTimeLogs with:', {timeLogs, jobCardInfo, timeLogsPerms}); // DEBUG
        
        renderTimeLogs(timeLogs, jobCard, jobCardInfo, timeLogsPerms, reportName, config);
    } catch (err) {
        console.error("Error loading time logs:", err);
        document.getElementById('timeLogsBody').innerHTML = 
            `<div class="alert alert-danger">Error loading time logs: ${err.message}</div>`;
    }
}


function renderTimeLogs(timeLogs, jobCard, jobCardInfo, permissions, reportName, config) {
    const bodyEl = document.getElementById('timeLogsBody');
    
    let html = '';
    
    // Show Job Card Info with editable workstation
    html += `
        <div class="alert alert-info mb-3">
            <div class="row align-items-center">
                <div class="col-md-3">
                    <strong>Required Qty:</strong> ${jobCardInfo.for_quantity || 0}
                </div>
                <div class="col-md-3">
                    <strong>Completed Qty:</strong> ${jobCardInfo.total_completed_qty || 0}
                </div>
                <div class="col-md-3">
                    <strong>Time Required:</strong> ${jobCardInfo.time_required || 0} mins
                </div>
                <div class="col-md-3">
                    <strong>Workstation:</strong>
                    ${permissions.can_edit_workstation ? `
                        <select class="form-select form-select-sm" id="jobCardWorkstation" style="display: inline-block; width: auto;">
                            <option value="">-- Select --</option>
                        </select>
                        <button class="btn btn-sm btn-success" id="saveWorkstationBtn" style="padding: 2px 8px;">
                            <i class="bi bi-check"></i>
                        </button>
                    ` : `
                        <span>${jobCardInfo.workstation || '-'}</span>
                    `}
                </div>
            </div>
        </div>
    `;

    
    
    // Add button if user has permission
    if (permissions.can_add) {
        html += `
            <div class="mb-3">
                <button class="btn btn-primary btn-sm" id="addTimeLogBtn">
                    <i class="bi bi-plus-circle"></i> Add Time Log
                </button>
            </div>
        `;
    }
    
    if (timeLogs.length === 0) {
        html += '<div class="alert alert-info">No time logs found for this job card.</div>';
        html += `
            <div class="table-responsive">
                <table class="table table-sm table-hover table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>Employee</th>
                            <th>From Time</th>
                            <th>To Time</th>
                            <th>Time (mins)</th>
                            <th>Completed Qty</th>
                            ${permissions.can_edit || permissions.can_delete ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="${permissions.can_edit || permissions.can_delete ? 6 : 5}" class="text-center text-muted">
                                No entries
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    } else {
html += `
    <div class="table-responsive">
        <table class="table table-sm table-hover table-bordered">
            <thead class="table-light">
                <tr>
                    <th>Employee</th>
                    <th>From Time</th>
                    <th>To Time</th>
                    <th>Time (mins)</th>
                    <th>Completed Qty</th>
                    <th>Job Detail</th>
                    <th>Job Image</th>
                    ${permissions.can_edit || permissions.can_delete ? '<th>Actions</th>' : ''}
                </tr>
            </thead>
            <tbody>
`;

timeLogs.forEach((log, index) => {
    const fromTime = log.from_time ? new Date(log.from_time).toLocaleString() : '-';
    const toTime = log.to_time ? new Date(log.to_time).toLocaleString() : '-';
    const timeInMins = log.time_in_mins || 0;
    const completedQty = log.completed_qty || 0;
    const employee = log.employee || '-';
    const jobDetail = log.custom_job_detail || '-';
    const jobImage = log.custom_job_image_view || log.custom_job_image;

        html += `
            <tr data-log-index="${index}">
                <td>${employee}</td>
                <td>${fromTime}</td>
                <td>${toTime}</td>
                <td>${timeInMins}</td>
                <td>${completedQty}</td>
                <td>${jobDetail}</td>
                <td>
                    ${jobImage ? `<img src="${fixImageUrl(jobImage)}" style="max-width: 100px; max-height: 60px; cursor: pointer;" 
                        onclick="window.open('${fixImageUrl(jobImage)}', '_blank')">` : '-'}
                </td>

    `;
    
    if (permissions.can_edit || permissions.can_delete) {
        html += '<td>';
        if (permissions.can_edit) {
            html += `<button class="btn btn-sm btn-outline-primary me-1 edit-time-log" data-log-index="${index}" data-log='${JSON.stringify(log).replace(/'/g, "&apos;")}'>
                <i class="bi bi-pencil"></i>
            </button>`;
        }
        if (permissions.can_delete) {
            html += `<button class="btn btn-sm btn-outline-danger delete-time-log" data-log-index="${index}">
                <i class="bi bi-trash"></i>
            </button>`;
        }
        html += '</td>';
    }
    
    html += '</tr>';
});

        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    bodyEl.innerHTML = html;
    
    // Attach event listeners

    if (permissions.can_edit_workstation) {
        loadWorkstationDropdown(jobCardInfo.workstation, jobCard);
    }

    
    if (permissions.can_add) {
        document.getElementById('addTimeLogBtn')?.addEventListener('click', () => {
            showTimeLogForm(null, jobCard, jobCardInfo, reportName, config);
        });
    }
    
    if (permissions.can_edit) {
        bodyEl.querySelectorAll('.edit-time-log').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const logIndex = parseInt(e.currentTarget.dataset.logIndex);
                const logData = JSON.parse(e.currentTarget.dataset.log);
                showTimeLogForm({...logData, logIndex}, jobCard, jobCardInfo, reportName, config);
            });
        });
    }
    
    if (permissions.can_delete) {
        bodyEl.querySelectorAll('.delete-time-log').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const logIndex = parseInt(e.currentTarget.dataset.logIndex);
                if (confirm('Are you sure you want to delete this time log?')) {
                    try {
                        await deleteTimeLog(jobCard, logIndex);
                        alert('Time log deleted successfully');
                        showTimeLogsModal(jobCard, reportName, config);
                    } catch (err) {
                        alert('Error deleting time log: ' + err.message);
                    }
                }
            });
        });
    }
}




async function showTimeLogForm(existingLog, jobCard, jobCardInfo, reportName, config) {
    const isEdit = !!existingLog;
    const bodyEl = document.getElementById('timeLogsBody');
    const timeLogsPerms = config.time_logs_permissions?.[userEmail] || {};
    
    // Fetch employees and workstations
    let employees = [];
    let workstations = [];
    
    try {
        const empData = await getEmployees();
        employees = empData.data || [];
        
        const wsData = await getWorkstations();
        workstations = wsData.data || [];
    } catch (err) {
        console.error('Error loading dropdowns:', err);
    }
    
    const formHtml = `
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0">${isEdit ? 'Edit' : 'Add'} Time Log</h6>
            </div>
            <div class="card-body">
                <div class="alert alert-info mb-3">
                    <div class="row">
                        <div class="col-md-4">
                            <strong>Required Qty:</strong> ${jobCardInfo.for_quantity || 0}
                        </div>
                        <div class="col-md-4">
                            <strong>Completed Qty:</strong> ${jobCardInfo.total_completed_qty || 0}
                        </div>
                        <div class="col-md-4">
                            <strong>Time Required:</strong> ${jobCardInfo.time_required || 0} mins
                        </div>
                    </div>
                </div>
                <form id="timeLogForm">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Employee</label>
                            <select class="form-select" name="employee">
                                <option value="">-- Select Employee --</option>
                                ${employees.map(emp => `
                                    <option value="${emp.name}" ${existingLog?.employee === emp.name ? 'selected' : ''}>
                                        ${emp.employee_name || emp.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Workstation ${timeLogsPerms.can_edit_workstation ? '' : '(Read-only)'}</label>
                            <select class="form-select" name="workstation" ${timeLogsPerms.can_edit_workstation ? '' : 'disabled'}>
                                <option value="">-- Select Workstation --</option>
                                ${workstations.map(ws => `
                                    <option value="${ws.name}" ${(existingLog?.workstation || jobCardInfo.workstation) === ws.name ? 'selected' : ''}>
                                        ${ws.name}
                                    </option>
                                `).join('')}
                            </select>
                            ${!timeLogsPerms.can_edit_workstation ? '<small class="text-muted">You don\'t have permission to edit workstation</small>' : ''}
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">From Time *</label>
                            <input type="datetime-local" class="form-control" name="from_time" id="fromTime"
                                value="${existingLog?.from_time ? new Date(existingLog.from_time).toISOString().slice(0, 16) : ''}" required>
                        </div>
                        
                        <div class="col-md-6 mb-3">
                            <label class="form-label">To Time</label>
                            <input type="datetime-local" class="form-control" name="to_time" id="toTime"
                                value="${existingLog?.to_time ? new Date(existingLog.to_time).toISOString().slice(0, 16) : ''}">
                            <small class="text-muted">Leave empty if work is ongoing</small>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Time (in minutes) *</label>
                            <input type="number" step="1" class="form-control" name="time_in_mins" id="timeInMins"
                                value="${existingLog?.time_in_mins || ''}" required>
                            <small class="text-muted">Auto-calculated from From/To times</small>
                        </div>
                        
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Completed Qty</label>
                            <input type="number" step="0.01" class="form-control" name="completed_qty" 
                                value="${existingLog?.completed_qty || 0}">
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Job Detail</label>
                        <textarea class="form-control" name="custom_job_detail" rows="3" 
                            placeholder="Enter job details...">${existingLog?.custom_job_detail || ''}</textarea>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Job Image</label>
                        <input type="file" class="form-control" id="jobImageFile" accept="image/*">
                        <small class="text-muted">Upload an image for this time log entry</small>
                        ${existingLog?.custom_job_image_view ? `
                            <div class="mt-2">
                                <img src="${fixImageUrl(existingLog.custom_job_image_view)}" 
                                    style="max-width: 200px; max-height: 150px; cursor: pointer;"
                                    onclick="window.open('${fixImageUrl(existingLog.custom_job_image_view)}', '_blank')">
                            </div>
                        ` : ''}

                    </div>
                    
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-success">
                            <i class="bi bi-check-circle"></i> ${isEdit ? 'Update' : 'Save'}
                        </button>
                        <button type="button" class="btn btn-secondary" id="cancelTimeLogForm">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    bodyEl.innerHTML = formHtml;
    
    // Auto-calculate time in minutes
    const fromTimeInput = document.getElementById('fromTime');
    const toTimeInput = document.getElementById('toTime');
    const timeInMinsInput = document.getElementById('timeInMins');
    
    function calculateMinutes() {
        const fromTime = fromTimeInput.value;
        const toTime = toTimeInput.value;
        
        if (fromTime && toTime) {
            const from = new Date(fromTime);
            const to = new Date(toTime);
            const diffMs = to - from;
            const diffMins = Math.round(diffMs / 60000);
            
            if (diffMins >= 0) {
                timeInMinsInput.value = diffMins;
            }
        }
    }
    
    fromTimeInput.addEventListener('change', calculateMinutes);
    toTimeInput.addEventListener('change', calculateMinutes);
    
    document.getElementById('timeLogForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            from_time: formData.get('from_time'),
            to_time: formData.get('to_time') || null,
            time_in_mins: parseInt(formData.get('time_in_mins')),
            completed_qty: parseFloat(formData.get('completed_qty')) || 0,
            employee: formData.get('employee') || null,
            custom_job_detail: formData.get('custom_job_detail') || null
        };
        
        // Handle workstation if user has permission
        if (timeLogsPerms.can_edit_workstation) {
            data.workstation = formData.get('workstation') || null;
        }
        
        // Handle image upload
        const imageFile = document.getElementById('jobImageFile').files[0];
        if (imageFile) {
            try {
                // Upload via our proxy instead of directly to ERPNext
                const uploadFormData = new FormData();
                uploadFormData.append('file', imageFile);
                uploadFormData.append('job_card', jobCard);
                
                const uploadRes = await fetch(`${API_BASE}?action=upload_time_log_image`, {
                    method: 'POST',
                    body: uploadFormData
                });
                
                const uploadData = await uploadRes.json();
                if (uploadData.file_url) {
                    data.custom_job_image = uploadData.file_url;
                } else {
                    throw new Error(uploadData.error || 'Upload failed');
                }
            } catch (err) {
                console.error('Error uploading image:', err);
                alert('Failed to upload image: ' + err.message);
                return; // Don't save time log if image upload fails
            }
        }

        
        try {
            if (isEdit) {
                await updateTimeLog(jobCard, existingLog.logIndex, data);
                alert('Time log updated successfully');
            } else {
                await addTimeLog(jobCard, data);
                alert('Time log added successfully');
            }
            showTimeLogsModal(jobCard, reportName, config);
        } catch (err) {
            alert('Error saving time log: ' + err.message);
        }
    });
    
    document.getElementById('cancelTimeLogForm').addEventListener('click', () => {
        showTimeLogsModal(jobCard, reportName, config);
    });
}







// New function to load and handle workstation
async function loadWorkstationDropdown(currentWorkstation, jobCard) {
    try {
        const wsData = await getWorkstations();
        const workstations = wsData.data || [];
        
        const dropdown = document.getElementById('jobCardWorkstation');
        workstations.forEach(ws => {
            const option = document.createElement('option');
            option.value = ws.name;
            option.textContent = ws.name;
            if (ws.name === currentWorkstation) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });
        
            // Save workstation button handler
            document.getElementById('saveWorkstationBtn').addEventListener('click', async () => {
                const newWorkstation = dropdown.value;
                const saveBtn = document.getElementById('saveWorkstationBtn');
                
                // Disable button and show loading
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                
                try {
                    await updateJobCardWorkstation(jobCard, newWorkstation);
                    alert('Workstation updated successfully in both Job Card and Work Order!\n\nPlease refresh the report to see the updated grouping.');
                    
                    // Optionally auto-refresh the report
                    if (confirm('Would you like to refresh the report now?')) {
                        location.reload();
                    }
                } catch (err) {
                    alert('Failed to update workstation: ' + err.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="bi bi-check"></i>';
                }
            });

    } catch (err) {
        console.error('Error loading workstations:', err);
    }
}
