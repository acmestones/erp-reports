const API_BASE = "/erp_proxy.php";
const ERP_BASE = window.ERP_BASE || 'https://acmestones.erpnext.com';
const ATTACHMENTS_REPORT_FIELD = 'attachments';



let userEmail = localStorage.getItem("userEmail");
let currentUser = null;
let currentColumns = 5;
let allReports = [];
let fieldLabels = {};
let currentReportData = null;
let reportConfig = {};
let linkFieldOptions = {};
let currentReportColumns = [];
let CURRENT_MODAL_CONTEXT = null;


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

        // ✅ ADD THIS LINE - Normalize can_edit to canedit
        currentUser.canedit = currentUser.can_edit;
        
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
                // Render report selector buttons for the user
                const div = document.getElementById('reportSelector');
                div.innerHTML = '';
                
                currentUser.allowed_reports.forEach((reportName) => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-outline-primary btn-sm me-2 mb-2';
                    btn.textContent = reportName;
                    btn.dataset.report = reportName;
                    btn.addEventListener('click', function() {
                        document.querySelectorAll('#reportSelector button').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        loadReport(reportName);
                    });
                    div.appendChild(btn);
                });
                
                // Auto-load first report
                if (currentUser.allowed_reports.length > 0) {
                    div.firstChild.classList.add('active');
                    loadReport(currentUser.allowed_reports[0]);
                }
            } else {
                document.getElementById('reportArea').innerHTML = '<p class="text-center text-muted">No reports assigned to you. Please contact admin.</p>';
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



function getGroups(report, level) {
  if (!report || !report.group_by) return [];
  
  const groups = Array.isArray(report.group_by) ? report.group_by : report.group_by.split(',').map(g => g.trim());
  
  if (level === 'primary') {
    // Get primary grouping field name
    const primaryField = groups.length > 0 ? groups[0] : null;
    if (!primaryField) return [];
    
    // Get actual values from group_sort if available
    if (report.group_sort && report.group_sort[primaryField]) {
      return Array.isArray(report.group_sort[primaryField]) 
        ? report.group_sort[primaryField] 
        : [];
    }
    return [];
  } else if (level === 'secondary') {
    // Get secondary grouping field name
    const secondaryField = groups.length > 1 ? groups[1] : null;
    if (!secondaryField) return [];
    
    // Get actual values from group_sort if available
    if (report.group_sort && report.group_sort[secondaryField]) {
      return Array.isArray(report.group_sort[secondaryField]) 
        ? report.group_sort[secondaryField] 
        : [];
    }
    return [];
  }
  return [];
}






async function saveReportConfig(config) {
    const res = await fetch(`${API_BASE}?action=save_report_config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({config}) // Must be the FULL config
    });
    return res.json();
}




async function saveCardPriority(reportName, primaryGroup, secondaryGroup, cardOrder) {
    const res = await fetch(`${API_BASE}?action=save_card_priority`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            report_name: reportName,
            primary_group: primaryGroup,
            secondary_group: secondaryGroup,
            card_order: cardOrder
        })
    });
    return res.json();
}




// ========== FORCE SCROLL RESET HELPER ==========
function forceResetScroll() {
    console.log('🔧 Force resetting scroll...');
    
    // Remove Bootstrap modal classes
    document.body.classList.remove('modal-open');
    
    // Reset all body styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.paddingRight = '';
    document.body.style.touchAction = '';
    
    // Reset html element too
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    
    // Remove all modal backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => {
        console.log('Removing backdrop:', backdrop);
        backdrop.remove();
    });
    
    // Force redraw
    document.body.offsetHeight; // Trigger reflow
    
    console.log('✅ Scroll reset complete');
}
// ========== END HELPER ==========









function initializeSortable(container, reportName, primaryGroup, secondaryGroup) {
    // Only enable for admins
    if (!currentUser || currentUser.role !== 'admin') {
        return;
    }
    
    // ========== CRITICAL: DISABLE ON MOBILE ==========
    // Check if mobile - if yes, skip desktop drag entirely
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        console.log('Mobile detected - using modal reorder instead of desktop drag');
        return; // Exit early - no desktop drag on mobile
    }
    // ========== END MOBILE CHECK ==========

    // Desktop-only drag and drop
    new Sortable(container, {
        animation: 150,
        delay: 500,
        delayOnTouchOnly: true,
        handle: '.drag-handle',
        
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        
        onChoose: function(evt) {
            console.log('Card selected');
            evt.item.classList.add('is-dragging');
        },
        
        onStart: function(evt) {
            console.log('Drag started');
        },
        
        onEnd: async function(evt) {
            evt.item.classList.remove('is-dragging');
            
            // Get the new order of cards
            const cards = Array.from(container.querySelectorAll('.card-report'));
            const cardOrder = cards.map(card => card.dataset.docname).filter(name => name);
            
            console.log('=== DRAG DROP DEBUG ===');
            console.log('Report Name:', reportName);
            console.log('Primary Group:', primaryGroup);
            console.log('Secondary Group:', secondaryGroup);
            console.log('New card order:', cardOrder);
            console.log('Card count:', cardOrder.length);
            
            // Save to backend
            try {
                const result = await saveCardPriority(
                    reportName, 
                    primaryGroup, 
                    secondaryGroup, 
                    cardOrder
                );
                
                console.log('Save result:', result);
                
                if (result.success) {
                    console.log('✅ Card priority saved successfully');
                    if (!reportConfig[reportName]) {
                        reportConfig[reportName] = {};
                    }
                    if (!reportConfig[reportName].card_priority) {
                        reportConfig[reportName].card_priority = {};
                    }
                    if (!reportConfig[reportName].card_priority[primaryGroup]) {
                        reportConfig[reportName].card_priority[primaryGroup] = {};
                    }
                    reportConfig[reportName].card_priority[primaryGroup][secondaryGroup] = cardOrder;
                    console.log('Updated local reportConfig');
                } else {
                    console.error('❌ Failed to save card priority:', result.error);
                    alert('Failed to save card order. Please try again.');
                }
            } catch (error) {
                console.error('❌ Error saving card priority:', error);
                alert('Error saving card order. Please try again.');
            }
        },
        
        onUnchoose: function(evt) {
            console.log('Drag cancelled');
            evt.item.classList.remove('is-dragging');
        }
    });
    
    // Add visual indicator that cards are draggable
    const cards = container.querySelectorAll('.card-report');
    cards.forEach(card => {
        card.classList.add('sortable-enabled');
    });
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







/**
 * Rewrite all image src and anchor href URLs inside rich HTML
 * so private ERPNext files are routed via erp_proxy.php
 */
function sanitizeRichHtml(html) {
    if (!html || typeof html !== 'string') return html;

    // Fix IMG src only
    html = html.replace(/<img([^>]+)src=["']([^"']+)["']/gi, (m, a, u) => {
        return `<img${a}src="${fixImageUrl(u)}"`;
    });

    // Fix FILE links only (skip images)
    html = html.replace(/<a([^>]*)href=["']([^"']+)["']([^>]*)>/gi,
        (m, pre, href, post) => {
            if (href.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
                return m; // image link → untouched
            }
            return `<a${pre}href="${fixFileUrl(href)}"${post}>`;
        }
    );

    return html;
}





function prepareRichTextEditor(editor) {
    editor.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (!src) return;

        // If image is coming from proxy, extract original ERP URL
        if (src.includes('action=proxyimage')) {
            const params = new URLSearchParams(src.split('?')[1]);
            const original = params.get('fileurl');
            if (original) {
                const decoded = decodeURIComponent(original);
                img.dataset.originalSrc = decoded;
                img.src = fixImageUrl(decoded); // keep proxy for display
            }
        }
        // If already a normal ERP file
        else if (
            src.includes('/files/') ||
            src.includes('/private/files/')
        ) {
            img.dataset.originalSrc = src;
            img.src = fixImageUrl(src);
        }
    });
}










function normalizeFileLinks(container) {
    container.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Skip images
        if (href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
        
        const fixedUrl = fixFileUrl(href);
        link.setAttribute('href', fixedUrl);
        
        // ✅ FIX: Set target for /app/ links instead of using click handler
        if (fixedUrl.includes('/app/')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            // For file downloads, force navigation
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = fixedUrl;
            });
        }
    });
}








function normalizeAttachmentLayout(container) {
    container.querySelectorAll('img').forEach(img => {
        img.style.display = 'inline-block';
        img.style.margin = '6px';
        img.style.maxWidth = '120px';
    });
}




function autoFixImages(container) {
    if (!container) return;

    container.querySelectorAll('img').forEach(img => {
        let src = img.getAttribute('src');
        if (!src || src.startsWith('data:image')) return;

        // Absolute ERP URL
        if (src.startsWith('/')) {
            src = 'https://acmestones.erpnext.com' + src;
        }

        // Strip ?fid
        try {
            const u = new URL(src);
            src = u.origin + u.pathname;
        } catch {
            src = src.split('?')[0];
        }

        if (src.includes('/private/files/')) {
            img.src = `/erp_proxy.php?action=proxyimage&fileurl=${encodeURIComponent(src)}`;
        } else if (src.includes('/files/')) {
            img.src = src;
        }

        img.style.cursor = 'pointer';
        img.onclick = e => {
            e.preventDefault();
            window.open(img.src, '_blank', 'noopener');
        };
    });
}





function constrainRichTextImages(container) {
    if (!container) return;

    container.querySelectorAll(
        '.editable-richtext img, .ql-editor img'
    ).forEach(img => {

        // Visual constraints
        img.style.maxHeight = '300px';
        img.style.width = 'auto';
        img.style.maxWidth = '100%';
        img.style.cursor = 'pointer';

        // Open full image on click
        if (!img.dataset.bound) {
            img.addEventListener('click', e => {
                e.stopPropagation();
                window.open(img.src, '_blank', 'noopener');
            });
            img.dataset.bound = '1';
        }
    });
}






// Enhanced fixImageUrl function


function fixImageUrl(url) {
    if (!url) return null;
    url = url.trim();
    
    console.log('Fixing URL:', url); // Debug log
    
    // Already absolute URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
        // Check if it's a private file (anywhere in the URL)
        if (url.includes('/private/files/')) {
            console.log('Private file detected, proxying');
            // Extract just the path part
            let fileUrl = url;
            // If it's on staging domain, replace with ERP domain
            if (url.includes('stagingreports.acmestones.com')) {
                fileUrl = url.replace('stagingreports.acmestones.com', 'acmestones.erpnext.com');
            }
            return `${API_BASE}?action=proxyimage&fileurl=${encodeURIComponent(fileUrl)}`;
        }
        return url;
    }
    
    // Protocol-relative URL
    if (url.startsWith("//")) {
        return "https:" + url;
    }
    
    // Handle private files by proxying through PHP
    if (url.includes('/private/files/')) {
        const fullUrl = `https://acmestones.erpnext.com${url}`;
        console.log('Proxying private file:', fullUrl);
        return `${API_BASE}?action=proxyimage&fileurl=${encodeURIComponent(fullUrl)}`;
    }
    
    // Root-relative URL (including public /files/)
    if (url.startsWith("/")) {
        return `https://acmestones.erpnext.com${url}`;
    }
    
    // Relative URL
    return `https://acmestones.erpnext.com/${url}`;
}










//Fix file url
// Fix file url
function fixFileUrl(url) {
    if (!url) return url;
    
    // ✅ FIX: Handle ERPNext app links
    if (url.startsWith('/app/')) {
        return ERP_BASE + url;
    }
    
    if (url.startsWith('/private/files/') || url.startsWith('/files/')) {
        return `erp_proxy.php?action=proxyfile&fileurl=${encodeURIComponent(ERP_BASE + url)}`;
    }
    
    if (url.includes('/private/files/') || url.includes('/files/')) {
        return `erp_proxy.php?action=proxyfile&fileurl=${encodeURIComponent(url)}`;
    }
    
    return url;
}











function injectAttachmentControls(
    container,
    row,
    columns,
    reportName,
    config,
    docName
) {
    /* ===============================
       HARD GUARD — ATTACHMENTS ONLY
    =============================== */

    if (container.dataset.reportField !== ATTACHMENTS_REPORT_FIELD) {
        return;
    }

    const canEdit = currentUser?.can_edit === true;

    /* ===============================
       UPLOAD BUTTON (ALWAYS VISIBLE)
    =============================== */

    if (canEdit && !container.querySelector('.upload-attachment-btn')) {
        const uploadBtn = document.createElement('button');
        uploadBtn.className =
            'btn btn-sm btn-outline-primary mb-2 upload-attachment-btn';
        uploadBtn.textContent = '➕ Upload Attachment';

        uploadBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';

            input.onchange = async () => {
                if (!input.files.length) return;

                const fd = new FormData();
                fd.append('file', input.files[0]);
                fd.append('doctype', config.doctype);
                fd.append('docname', docName);
                fd.append('is_private', 1);

                await fetch('/erp_proxy.php?action=upload_attachment', {
                    method: 'POST',
                    body: fd
                });

                // 🔁 Refresh attachments only
                loadAttachments(
                    container,
                    docName,
                    config,
                    row,
                    columns,
                    reportName
                );
            };

            input.click();
        };

        container.prepend(uploadBtn);
    }

    /* ===============================
       REMOVE BUTTONS (FILES + IMAGES)
    =============================== */

    if (!canEdit) return;

    const attachmentLinks = Array.from(container.querySelectorAll('a')).filter(
        a =>
            a.href &&
            (a.href.includes('/files/') ||
             a.href.includes('/private/files/'))
    );

    attachmentLinks.forEach(link => {
        if (link.dataset.hasRemoveBtn) return;
        link.dataset.hasRemoveBtn = '1';

        const href = link.getAttribute('href');
        const fileName = decodeURIComponent(
            href.split('/').pop().split('?')[0]
        );

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger ms-2';
        removeBtn.textContent = '❌';

        removeBtn.onclick = async e => {
            e.preventDefault();
            e.stopPropagation();

            if (!confirm(`Remove "${fileName}"?`)) return;

            await fetch(
                `/erp_proxy.php?action=delete_attachment` +
                `&file_name=${encodeURIComponent(fileName)}` +
                `&doctype=${encodeURIComponent(config.doctype)}` +
                `&docname=${encodeURIComponent(docName)}`
            );

            // 🔁 Refresh attachments only
            loadAttachments(
                container,
                docName,
                config,
                row,
                columns,
                reportName
            );
        };

        link.after(removeBtn);
    });
}








async function loadAttachments(container, docName, config, row, columns, reportName) {
    const doctype = config?.doctype;
    if (!doctype) {
        container.innerHTML = `<div class="text-danger">Missing doctype</div>`;
        return;
    }

    const url = `erp_proxy.php?action=list_attachments&doctype=${encodeURIComponent(doctype)}&docname=${encodeURIComponent(docName)}`;
    
    console.log('📎 Fetching attachments:', url);
    
    let res;
    try {
        res = await fetch(url);
    } catch (e) {
        console.error('Network error loading attachments:', e);
        container.innerHTML = `<div class="text-muted">No attachments</div>`;
        return;
    }

    if (!res.ok) {
        console.error('Failed to load attachments:', res.status);
        container.innerHTML = `<div class="text-muted">Error loading attachments (${res.status})</div>`;
        return;
    }

    const text = await res.text();
    console.log('📎 Raw response:', text);
    
    if (!text) {
        container.innerHTML = `<div class="text-muted">No attachments</div>`;
        return;
    }

    let files;
    try {
        files = JSON.parse(text);
    } catch (e) {
        console.error('Invalid JSON from list_attachments:', text);
        container.innerHTML = `<div class="text-danger">Invalid response format</div>`;
        return;
    }

    // 🔥 CRITICAL DEBUG - Check structure
    console.log('📎 Parsed files array:', files);
    console.log('📎 Number of files:', files?.length);
    if (files && files.length > 0) {
        console.log('📎 First file structure:', files[0]);
        console.log('📎 All property names:', Object.keys(files[0]));
    }
    
    container.innerHTML = '';

    // UPLOAD BUTTON
    if (currentUser?.canedit) {
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-sm btn-outline-primary mb-2';
        uploadBtn.textContent = '📎 Upload Attachment';
        container.appendChild(uploadBtn);
        
        uploadBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = async () => {
                if (!input.files.length) return;
                
                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';
                
                const fd = new FormData();
                fd.append('file', input.files[0]);
                fd.append('doctype', doctype);
                fd.append('docname', docName);
                fd.append('is_private', 1);
                
                try {
                    const res = await fetch(`erp_proxy.php?action=upload_attachment`, { method: 'POST', body: fd });
                    const text = await res.text();
                    console.log('📤 Upload response:', text);
                    
                    if (!res.ok) {
                        throw new Error('Upload failed: ' + text);
                    }
                    
                    loadAttachments(container, docName, config, row, columns, reportName);
                } catch (err) {
                    console.error('Upload error:', err);
                    alert('Upload failed: ' + err.message);
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = '📎 Upload Attachment';
                }
            };
            input.click();
        };
    }

    
// FILE LIST
if (!files || !files.length) {
    container.insertAdjacentHTML('beforeend', `<div class="text-muted">No attachments</div>`);
    return;
}

// ✅ NEW: Separate images and files
const images = [];
const nonImages = [];

files.forEach(file => {
    const fileUrl = file.file_url || file.fileurl || file.url;
    const fileName = file.file_name || file.filename || file.name;
    
    if (!fileUrl) return;
    
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
    
    if (isImage) {
        images.push({ fileUrl, fileName });
    } else {
        nonImages.push({ fileUrl, fileName });
    }
});

// ✅ RENDER IMAGES IN GRID
if (images.length > 0) {
    const imagesGrid = document.createElement('div');
    imagesGrid.style.display = 'grid';
    imagesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    imagesGrid.style.gap = '10px';
    imagesGrid.style.marginBottom = '15px';
    
    images.forEach(({ fileUrl, fileName }) => {
        const encodedUrl = encodeURIComponent(fileUrl);
        const proxyUrl = `erp_proxy.php?action=proxyimage&fileurl=${encodedUrl}`;
        
        const imageWrapper = document.createElement('div');
        imageWrapper.style.position = 'relative';
        imageWrapper.style.display = 'flex';
        imageWrapper.style.flexDirection = 'column';
        imageWrapper.style.alignItems = 'center';
        
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.target = '_blank';
        
        const img = document.createElement('img');
        img.src = proxyUrl;
        img.style.width = '100%';
        img.style.height = '120px';
        img.style.objectFit = 'cover';
        img.style.border = '1px solid #ddd';
        img.style.cursor = 'pointer';
        img.style.borderRadius = '4px';
        
        img.onerror = function() {
            this.style.display = 'none';
            const errorText = document.createElement('span');
            errorText.textContent = '❌ ' + fileName;
            errorText.className = 'text-danger small';
            imageWrapper.appendChild(errorText);
        };
        
        link.appendChild(img);
        imageWrapper.appendChild(link);
        
        // Image filename below
        const fileNameLabel = document.createElement('div');
        fileNameLabel.className = 'text-muted small text-center mt-1';
        fileNameLabel.style.fontSize = '0.75rem';
        fileNameLabel.style.wordBreak = 'break-word';
        fileNameLabel.textContent = fileName;
        imageWrapper.appendChild(fileNameLabel);
        
        // Remove button for images
        if (currentUser?.canedit) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '🗑️';
            removeBtn.className = 'btn btn-sm btn-outline-danger mt-1';
            removeBtn.style.width = '100%';
            removeBtn.title = 'Delete';
            removeBtn.onclick = async () => {
                if (!confirm(`Delete ${fileName}?`)) return;
                
                removeBtn.disabled = true;
                try {
                    const deleteUrl = `erp_proxy.php?action=delete_attachment&file_name=${encodeURIComponent(fileName)}&doctype=${encodeURIComponent(doctype)}&docname=${encodeURIComponent(docName)}`;
                    const res = await fetch(deleteUrl);
                    const text = await res.text();
                    
                    if (!res.ok) {
                        throw new Error('Delete failed: ' + text);
                    }
                    
                    loadAttachments(container, docName, config, row, columns, reportName);
                } catch (err) {
                    console.error('Delete error:', err);
                    alert('Delete failed: ' + err.message);
                    removeBtn.disabled = false;
                }
            };
            imageWrapper.appendChild(removeBtn);
        }
        
        imagesGrid.appendChild(imageWrapper);
    });
    
    container.appendChild(imagesGrid);
}

// ✅ RENDER NON-IMAGES AS LIST
if (nonImages.length > 0) {
    const filesList = document.createElement('div');
    filesList.style.marginTop = '10px';
    
    nonImages.forEach(({ fileUrl, fileName }) => {
        const encodedUrl = encodeURIComponent(fileUrl);
        
        const rowDiv = document.createElement('div');
        rowDiv.style.display = 'flex';
        rowDiv.style.alignItems = 'center';
        rowDiv.style.gap = '10px';
        rowDiv.style.marginBottom = '8px';
        rowDiv.style.padding = '8px';
        rowDiv.style.border = '1px solid #e0e0e0';
        rowDiv.style.borderRadius = '4px';
        rowDiv.style.backgroundColor = '#f9f9f9';
        
        const link = document.createElement('a');
        link.href = `erp_proxy.php?action=proxyfile&fileurl=${encodedUrl}`;
        link.textContent = '📄 ' + fileName;
        link.target = '_blank';
        link.className = 'text-decoration-none flex-grow-1';
        link.style.color = '#0d6efd';
        rowDiv.appendChild(link);
        
        // Remove button for files
        if (currentUser?.canedit) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '🗑️';
            removeBtn.className = 'btn btn-sm btn-outline-danger';
            removeBtn.title = 'Delete';
            removeBtn.onclick = async () => {
                if (!confirm(`Delete ${fileName}?`)) return;
                
                removeBtn.disabled = true;
                try {
                    const deleteUrl = `erp_proxy.php?action=delete_attachment&file_name=${encodeURIComponent(fileName)}&doctype=${encodeURIComponent(doctype)}&docname=${encodeURIComponent(docName)}`;
                    const res = await fetch(deleteUrl);
                    const text = await res.text();
                    
                    if (!res.ok) {
                        throw new Error('Delete failed: ' + text);
                    }
                    
                    loadAttachments(container, docName, config, row, columns, reportName);
                } catch (err) {
                    console.error('Delete error:', err);
                    alert('Delete failed: ' + err.message);
                    removeBtn.disabled = false;
                }
            };
            rowDiv.appendChild(removeBtn);
        }
        
        filesList.appendChild(rowDiv);
    });
    
    container.appendChild(filesList);
}

}
















async function renderReportsListAdmin(reports) {
    const div = document.getElementById('reportsList');
    
    // Get all reports assigned to users
    const users = await getUsers();
    const assignedReports = new Set();
    
    users.users.forEach(u => {
        if (u.allowed_reports) {
            u.allowed_reports.forEach(r => assignedReports.add(r));
        }
    });
    
    // Merge fetched reports with assigned reports
    const allReportsSet = new Set([...reports, ...Array.from(assignedReports)]);
    const allReports = Array.from(allReportsSet).sort();
    
    if (allReports.length === 0) {
        div.innerHTML = '<p class="text-muted">No reports found. Click "Fetch All Reports" to load from ERPNext.</p>';
        return;
    }
    
    // Separate into assigned vs fetched
    const assignedOnly = Array.from(assignedReports).filter(r => !reports.includes(r)).sort();
    
    let html = `<h6>Available Reports (${allReports.length})</h6>`;
    
    if (assignedOnly.length > 0) {
        html += `<div class="alert alert-success small mb-3">
            <strong>✓ ${assignedOnly.length} reports</strong> already assigned to users (showing below)
        </div>`;
    }
    
    html += `<div class="alert alert-info small">Configure each report's permissions, grouping, and field visibility.</div>
        <div class="list-group" style="max-height: 400px; overflow-y: auto;">
            ${allReports.map(r => {
                const isAssigned = assignedReports.has(r);
                const badge = isAssigned ? '<span class="badge bg-success ms-2">Assigned</span>' : '';
                return `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${r}${badge}</span>
                        <button class="btn btn-sm btn-outline-primary config-report-btn" data-report="${r}">Configure</button>
                    </div>
                `;
            }).join('')}
        </div>`;
    
    div.innerHTML = html;
    
    div.querySelectorAll('.config-report-btn').forEach(btn => {
        btn.addEventListener('click', () => openGlobalReportConfigModal(btn.dataset.report));
    });
}







async function getOperationOptions() {
  try {
    const response = await fetch(`${API_BASE}?action=get_operation_options`);
    const data = await response.json();
    return data.success ? data.options : [];
  } catch (error) {
    console.error('Error fetching operation options:', error);
    return [];
  }
}

async function getWorkstationOptions() {
  try {
    const response = await fetch(`${API_BASE}?action=get_workstation_options`);
    const data = await response.json();
    return data.success ? data.options : [];
  } catch (error) {
    console.error('Error fetching workstation options:', error);
    return [];
  }
}


async function getPlantOptions() {
  try {
    const response = await fetch(`${API_BASE}?action=get_plant_options`);
    const data = await response.json();
    return data.success ? data.options : [];
  } catch (error) {
    console.error('Error fetching plant options:', error);
    return [];
  }
}












// Build a mapping of report field names to actual database field names
// Cache for DocType metadata
let doctypeFieldsCache = {};

async function fetchDoctypeFields(doctype) {
    if (doctypeFieldsCache[doctype]) {
        console.log(`📦 Using cached fields for ${doctype}`);
        return doctypeFieldsCache[doctype];
    }
    
    try {
        const res = await fetch(`${API_BASE}?action=get_doctype_meta&doctype=${encodeURIComponent(doctype)}`);
        const data = await res.json();
        if (data.success) {
            doctypeFieldsCache[doctype] = data.fields;
            console.log(`✅ Fetched ${data.fields.length} fields for ${doctype}`);
            return data.fields;
        }
    } catch (err) {
        console.error('Error fetching DocType fields:', err);
    }
    return [];
}

async function buildFieldMapping(columns, reportName) {
    const mapping = {};
    const config = reportConfig[reportName] || {};
            const doctype = config.doctype;
        if (!doctype) {
            console.error(`❌ DocType is REQUIRED for report "${reportName}". Configure it in Report Management → Configure.`);
            alert(`Please configure DocType for report "${reportName}" in Admin Settings → Report Management → Configure`);
            throw new Error('Missing DocType configuration');
        }

    
    console.log(`🔍 Building field mapping for report: ${reportName}, DocType: ${doctype}`);
    
    // Fetch actual ERP fields
    const erpFields = await fetchDoctypeFields(doctype);
    
    // Get manual mappings from config
    const manualMappings = config.field_mappings || {};
    
    // Track unmapped fields
    const unmappedFields = [];
    
    for (const col of columns) {
        const reportFieldname = col.fieldname;
        
        // Priority 1: Manual mapping from config
        if (manualMappings[reportFieldname]) {
            const erpField = erpFields.find(f => f.fieldname === manualMappings[reportFieldname]);
            mapping[reportFieldname] = {
                erpField: manualMappings[reportFieldname],
                isEditable: erpField ? (!erpField.read_only || erpField.allow_on_submit) : false,
                isComputed: false,
                fieldtype: erpField?.fieldtype,
                options: erpField?.options,
                label: erpField?.label || manualMappings[reportFieldname]
            };
            console.log(`✅ Manual: ${reportFieldname} → ${manualMappings[reportFieldname]}`);
            continue;
        }
        
        // Priority 2: Exact fieldname match
        const exactMatch = erpFields.find(f => f.fieldname === reportFieldname);
        if (exactMatch) {
            mapping[reportFieldname] = {
                erpField: exactMatch.fieldname,
                isEditable: !exactMatch.read_only || exactMatch.allow_on_submit,
                isComputed: false,
                fieldtype: exactMatch.fieldtype,
                options: exactMatch.options,
                label: exactMatch.label
            };
            console.log(`✅ Exact: ${reportFieldname}`);
            continue;
        }
        
        // Priority 3: Try with custom_ prefix
        const customFieldname = reportFieldname.startsWith('custom_') ? reportFieldname : 'custom_' + reportFieldname;
        const customMatch = erpFields.find(f => f.fieldname === customFieldname);
        if (customMatch) {
            mapping[reportFieldname] = {
                erpField: customMatch.fieldname,
                isEditable: !customMatch.read_only || customMatch.allow_on_submit,
                isComputed: false,
                fieldtype: customMatch.fieldtype,
                options: customMatch.options,
                label: customMatch.label
            };
            console.log(`✅ Custom: ${reportFieldname} → ${customFieldname}`);
            continue;
        }
        
        // Priority 4: Label matching (fuzzy)
        const normalizeLabel = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const reportLabel = normalizeLabel(col.label || reportFieldname);
        
        const labelMatch = erpFields.find(f => {
            const erpLabel = normalizeLabel(f.label || '');
            return erpLabel && erpLabel === reportLabel;
        });
        
        if (labelMatch) {
            mapping[reportFieldname] = {
                erpField: labelMatch.fieldname,
                isEditable: !labelMatch.read_only || labelMatch.allow_on_submit,
                isComputed: false,
                fieldtype: labelMatch.fieldtype,
                options: labelMatch.options,
                label: labelMatch.label
            };
            console.log(`✅ Label: ${reportFieldname} → ${labelMatch.fieldname} (via label: "${col.label}")`);
            continue;
        }
        
        // No match found - mark as computed/unmapped
        mapping[reportFieldname] = {
            erpField: null,
            isEditable: false,
            isComputed: true,
            label: col.label || reportFieldname
        };
        unmappedFields.push({
            reportField: reportFieldname,
            label: col.label || reportFieldname
        });
        console.log(`⚠️ Unmapped: ${reportFieldname} (${col.label})`);
    }
    
    // Store unmapped fields in config for manual mapping UI
    if (unmappedFields.length > 0) {
        if (!reportConfig[reportName]) {
            reportConfig[reportName] = {};
        }
        reportConfig[reportName].unmapped_fields = unmappedFields;
        console.log(`⚠️ ${unmappedFields.length} fields need manual mapping`);
    }
    
    return mapping;
}














async function cleanupCardPriority(reportName) {
    if (!currentReportData || !currentReportData.grouped) {
        console.log('No report data to clean');
        return;
    }
    
    const config = reportConfig[reportName] || {};
    if (!config.card_priority) return;
    
    let cleaned = false;
    
    // For each primary group
    Object.keys(config.card_priority).forEach(primaryGroup => {
        // For each secondary group
        Object.keys(config.card_priority[primaryGroup]).forEach(secondaryGroup => {
            const savedOrder = config.card_priority[primaryGroup][secondaryGroup];
            
            // Get current cards in this subgroup
            const currentCards = currentReportData.grouped[primaryGroup]?.[secondaryGroup] || [];
            const currentCardIds = currentCards.map(card => card.name);
            
            // Filter out cards that no longer exist
            const cleanedOrder = savedOrder.filter(id => currentCardIds.includes(id));
            
            // If anything was removed, update
            if (cleanedOrder.length !== savedOrder.length) {
                config.card_priority[primaryGroup][secondaryGroup] = cleanedOrder;
                cleaned = true;
                console.log(`Cleaned ${savedOrder.length - cleanedOrder.length} stale cards from ${primaryGroup} > ${secondaryGroup}`);
            }
        });
    });
    
    // Save if anything was cleaned
    if (cleaned) {
        await saveReportConfig(config);
        console.log('✅ Cleanup complete and saved');
    }
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
        const fieldMapping = await buildFieldMapping(columns, reportName);
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
        
                // Use configured image fields or auto-detect description fields
        const imageFields = config.image_fields || 
            columns.filter(c => 
                c.fieldname.toLowerCase().includes('description') || 
                c.fieldname.toLowerCase().includes('image')
            ).map(c => c.fieldname);

        
        // Optimize image URL fixing using regex instead of DOM manipulation
        rows.forEach(row => {
            imageFields.forEach(field => {
                if (row[field] && typeof row[field] === 'string') {
                    let html = row[field];
                    
                    // Fix image src attributes using regex (much faster)
                    html = html.replace(/src=["']([^"']+)["']/g, (match, url) => {
                        return `src="${fixImageUrl(url)}"`;
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
            // Use configured grouping or show flat list
    const groupByFields = config.group_by || [];
    const grouped = groupByFields.length > 0 
        ? groupData(sortedRows, columns, groupByFields, config.group_sort)
        : { 'All Records': { 'All': sortedRows } };

        
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
    
    // Get hidden groups for current user
    const userEmail = localStorage.getItem("userEmail");
    const userPerms = config.user_permissions?.[userEmail] || {};
    const hiddenPrimaryGroups = userPerms.hiddenprimarygroups || [];
    const hiddenSecondaryGroups = userPerms.hiddensecondarygroups || [];
    
    Object.keys(grouped).forEach(level1 => {
        // Skip this primary group if it's hidden for the user
        if (hiddenPrimaryGroups.includes(level1)) {
            console.log('Hiding primary group:', level1);
            return;
        }
        
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
            // Skip this secondary group if it's hidden for the user
            if (hiddenSecondaryGroups.includes(level2)) {
                console.log('Hiding secondary group:', level2);
                return;
            }
            
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
            
            // ========== COMPLETE FIXED VERSION ==========
            // Apply saved card priority if it exists
            const cardPriority = config.card_priority?.[level1]?.[level2];
            let cardsToRender = grouped[level1][level2];
            
            const titleField = config.title_field || "work_order_id";
            
            // Helper function to get card ID from row (same logic as createCard)
                const getCardId = (row) => {
                    return row[titleField] || row.name || '';
                };

            
            if (cardPriority && Array.isArray(cardPriority)) {
                cardsToRender = [...cardsToRender].sort((a, b) => {
                    const idA = getCardId(a);
                    const idB = getCardId(b);
                    
                    const indexA = cardPriority.indexOf(idA);
                    const indexB = cardPriority.indexOf(idB);
                    
                    // Both cards are in the priority list - use priority order
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    
                    // Only A is in priority list - A comes first
                    if (indexA !== -1) return -1;
                    
                    // Only B is in priority list - B comes first
                    if (indexB !== -1) return 1;
                    
                    // Neither is in priority list - NEW CARDS
                    // Sort new cards by the configured sort_by field (sales_order_id)
                    if (config.sort_by) {
                        const sortField = config.sort_by;
                        const valA = a[sortField];
                        const valB = b[sortField];
                        
                        if (valA === valB) return 0;
                        if (valA === null || valA === undefined) return 1;
                        if (valB === null || valB === undefined) return -1;
                        
                        const comparison = valA < valB ? -1 : 1;
                        return config.sort_order === 'desc' ? -comparison : comparison;
                    }
                    
                    return 0;
                });
            }
            // ========== END FIX ==========

                const fragment = document.createDocumentFragment(); // ✅ Batch DOM operations
                cardsToRender.forEach(row => {
                    const card = createCard(row, columns, reportName, config);
                    card.className = card.className + ' card-grid-item';
                    fragment.appendChild(card); // ✅ No reflow
                });
                cardsContainer.appendChild(fragment); // ✅ One reflow only
                            
            // Initialize drag-and-drop for this subgroup (admin only)
            if (currentUser && currentUser.role === 'admin') {
                initializeSortable(cardsContainer, reportName, level1, level2);
            }
            
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
    });
}
























function createCard(row, columns, reportName, config) {
    const card = document.createElement("div");
    card.className = "card card-report h-100";

    // ========== SMART DOCNAME DETECTION ==========
    // Priority order:
    // 1. Use title_field from config (the displayed title)
    // 2. Fall back to row.name (ERPNext document name)
    // 3. Try common ID fields
    // 4. Use first available field
    
        const titleField = config.title_field || 'name';
        const docName = row[titleField] || row.name || '';
        card.dataset.docname = docName;
        
        if (!docName) {
            console.warn('No docname found. Configure title_field in report settings.', row);
        }


    
    // console.log('Card docname set to:', card.dataset.docname, 'from field:', titleField);
    // ========== END SMART DETECTION ==========
    
    const userPerms = config.user_permissions?.[userEmail];
    const hiddenFields = userPerms?.hidden_fields || [];
    const cardFields = config.card_fields || [];

        if (cardFields.length === 0) {
            console.warn(`No card_fields configured for report. Configure in Report Management.`);
        }

    const imageFields = config.image_fields || [];
    
    const name = row[titleField] || row.name || docName || "Record";

    
            // Auto-detect status fields from available columns
            const statusFieldCandidates = columns
                .filter(c => c.fieldname.toLowerCase().includes('status'))
                .map(c => c.fieldname);
            
            // Merge with common status fields (priority order)
            const statusFields = [
                'status',              // Most common
                'work_order_status',
                'operation_status',
                'sales_order_status',
                ...statusFieldCandidates
            ];
            
            // Remove duplicates and find first available status value
            const uniqueStatusFields = [...new Set(statusFields)];
            let status;
            for (const sf of uniqueStatusFields) {
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


        // ========== ADD DRAG HANDLE FOR MOBILE ==========
        if (currentUser && currentUser.role === 'admin') {
            const dragHandle = document.createElement("div");
            dragHandle.className = "drag-handle";
            dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
            
            // Check if mobile
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                dragHandle.title = "Tap to reorder";
                dragHandle.style.cursor = "pointer";
                
                // Store data for mobile reorder
                dragHandle.dataset.reportName = reportName;
                dragHandle.dataset.primaryGroup = config.group_by?.[0] ? row[config.group_by[0]] : 'All';
                dragHandle.dataset.secondaryGroup = config.group_by?.[1] ? row[config.group_by[1]] : 'All';
                
                // Open mobile reorder modal on tap
                dragHandle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openMobileReorderModal(
                        dragHandle.dataset.reportName,
                        dragHandle.dataset.primaryGroup,
                        dragHandle.dataset.secondaryGroup
                    );
                });
            } else {
                dragHandle.title = "Hold and drag to reorder";
            }
            
            cardBody.appendChild(dragHandle);
        }
        // ========== END DRAG HANDLE ==========


    
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
    buttonsContainer.className = "d-flex flex-column gap-2 mt-2";
    
    // View Details button (always present)
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-sm btn-outline-primary";
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
            timeLogsBtn.className = "btn btn-sm btn-outline-info";
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
    
    // Add Operation Planning button if configured
    if (config.show_operation_planning_button !== false) {
        const opPerms = config.operation_planning_permissions?.[userEmail] || {};
        
        if (opPerms.can_view) {
            const opPlanningBtn = document.createElement("button");
            opPlanningBtn.className = "btn btn-sm btn-outline-success";
            opPlanningBtn.innerHTML = '<i class="bi bi-diagram-3"></i> Operation Planning';
            opPlanningBtn.addEventListener("click", () => {
                console.log('Row data:', row);
                console.log('Work Order ID:', row.work_order_id || row.name);
                openOperationPlanningModal(row, config, reportName);
            });
            buttonsContainer.appendChild(opPlanningBtn);
        }
    }
    
    cardBody.appendChild(buttonsContainer);
    card.appendChild(cardBody);
    
    return card;
}








async function showDetailModal(row, columns, reportName, config) {
    console.log('🔥 showDetailModal START', row, columns, config);
    console.log('📊 Columns length:', columns?.length, columns);

    const modalEl = document.getElementById('detailModal');
    const modal = new bootstrap.Modal(modalEl);

    /* =============================
       RESOLVE DOCTYPE & DOCNAME
    ============================== */

    const doctype = config?.doctype;
    if (!doctype) {
        console.error('❌ Missing doctype in report config');
        return;
    }
    console.log('📄 Doctype:', doctype);

    CURRENT_MODAL_CONTEXT = {
        row,
        columns,
        reportName,
        config
    };

    const titleField = config.titlefield || config.title_field || 'name';
    let docName = row[titleField] || row.name || row.id;

    const nameCol = columns.find(
        c => c.fieldname === 'name' || c.fieldname === titleField
    );
    if (nameCol && row[nameCol.fieldname]) {
        docName = row[nameCol.fieldname];
    }

    document.getElementById('modalTitle').textContent = `${docName} Details`;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = '';

    /* =============================
       ERP BASE (SINGLE SOURCE)
    ============================== */

    const ERP_BASE =
        config?.erp_base ||
        window.ERP_BASE ||
        'https://acmestones.erpnext.com';

    /* =============================
       USER PERMISSIONS
    ============================== */

    const userPerms =
        config.user_permissions?.[userEmail] ||
        config.userpermissions?.[userEmail] ||
        {};

    const editableFields = userPerms.editable_fields || userPerms.editablefields || [];
    const hiddenFields = userPerms.hidden_fields || userPerms.hiddenfields || [];
    const canEdit = !!currentUser?.can_edit || !!currentUser?.canedit;

    /* =============================
       FIELD RENDER LOOP
    ============================== */

    for (const col of columns) {
        console.log('➡️ Rendering field:', col.fieldname, col.fieldtype);

        const reportFieldname = col.fieldname;

        if (hiddenFields.includes(reportFieldname)) continue;

        const actualFieldname =
            window.reportFieldMapping?.[reportFieldname]?.erpField ||
            reportFieldname;

        const value = row[reportFieldname];
        const hasValue = value !== null && value !== undefined && value !== '';

        const isEditable =
            canEdit &&
            editableFields.includes(reportFieldname) &&
            reportFieldname !== titleField;

        // Skip only if truly empty AND not attachments
        if (!hasValue && !isEditable && reportFieldname !== ATTACHMENTS_REPORT_FIELD) {
            continue;
        }

        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'mb-3 pb-2 border-bottom';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'fw-bold text-muted small mb-1';
        labelDiv.textContent =
            fieldLabels?.[reportFieldname] || col.label || reportFieldname;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'mt-1';
        valueDiv.dataset.reportField = reportFieldname;

        /* =============================
           EDITABLE FIELDS
        ============================== */

        if (isEditable) {
            const isRichText = ['Text', 'Small Text', 'Long Text', 'Text Editor', 'HTML', 'HTML Editor'].includes(col.fieldtype);

            if (isRichText) {
                // ----- DISPLAY MODE -----
                const displayDiv = document.createElement('div');
                displayDiv.className = 'editable-richtext';
                displayDiv.style.background = '#f8f9fa';
                displayDiv.style.padding = '10px';
                displayDiv.style.border = '1px solid #dee2e6';
                displayDiv.style.borderRadius = '4px';
                displayDiv.style.minHeight = '60px';


                const htmlValue = value || `<p class="text-muted">No content</p>`;
                displayDiv.innerHTML = sanitizeRichHtml(htmlValue);
                normalizeFileLinks(displayDiv);
                autoFixImages(displayDiv);

                // ----- EDIT MODE -----
                const editorWrapper = document.createElement('div');
                editorWrapper.style.display = 'none';

                const toolbar = document.createElement('div');
                toolbar.className = 'mb-2 d-flex gap-2 align-items-center';

                const insertImgBtn = document.createElement('button');
                insertImgBtn.type = 'button';
                insertImgBtn.className = 'btn btn-sm btn-outline-secondary';
                insertImgBtn.innerHTML = '🖼️ Insert Image';

                const uploadStatus = document.createElement('span');
                uploadStatus.className = 'text-muted small';
                uploadStatus.id = 'uploadStatus_' + reportFieldname;

                const imgInput = document.createElement('input');
                imgInput.type = 'file';
                imgInput.accept = 'image/*';
                imgInput.style.display = 'none';

                toolbar.append(insertImgBtn, imgInput, uploadStatus);

                const editor = document.createElement('div');
                editor.contentEditable = true;
                editor.className = 'editable-richtext';
                editor.style.minHeight = '150px';
                editor.style.maxHeight = '400px';
                editor.style.overflowY = 'auto';
                editor.style.border = '1px solid #ced4da';
                editor.style.padding = '10px';
                editor.style.background = '#fff';
                editor.innerHTML = htmlValue;

                prepareRichTextEditor(editor);
                editor.dataset.fieldname = actualFieldname;
                editor.dataset.docname = docName;
                editor.dataset.doctype = doctype;

                insertImgBtn.onclick = () => imgInput.click();

                // IMPROVED IMAGE UPLOAD WITH AUTO-SAVE
                    imgInput.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('doctype', doctype);
                        fd.append('docname', docName);
                        fd.append('is_private', 1);
                        
                        try {
                            const res = await fetch(`erp_proxy.php?action=upload_attachment`, { method: 'POST', body: fd });
                            const text = await res.text();
                            console.log('📤 Upload response:', text);
                            
                            if (!text) {
                                throw new Error('Empty response from server');
                            }
                            
                            const data = JSON.parse(text);
                            
                            // ✅ ERPNext returns: { message: { file_url: "...", file_name: "..." } }
                            if (!data.message || !data.message.file_url) {
                                throw new Error('No file URL in response: ' + JSON.stringify(data));
                            }
                            
                            const img = document.createElement('img');
                            img.src = fixImageUrl(data.message.file_url);  // ✅ CORRECT: data.message.file_url
                            img.dataset.originalSrc = data.message.file_url;  // ✅ ORIGINAL ERP URL
                            img.style.maxWidth = '100%';
                            editor.appendChild(img);
                            imgInput.value = '';
                            
                        } catch (err) {
                            console.error('Image upload error:', err);
                            alert('Failed to upload image: ' + err.message);
                        }
                    };


                editorWrapper.append(toolbar, editor);

                // ----- ACTION BUTTONS -----
                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-sm btn-primary me-2';
                editBtn.textContent = 'Edit';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn btn-sm btn-secondary me-2';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.style.display = 'none';

                const saveBtn = createSaveButton(editor, reportName, modal);
                saveBtn.style.display = 'none';

                editBtn.onclick = () => {
                    editorWrapper.style.display = 'block';
                    displayDiv.style.display = 'none';
                    editBtn.style.display = 'none';
                    cancelBtn.style.display = 'inline-block';
                    saveBtn.style.display = 'inline-block';
                };

                cancelBtn.onclick = () => {
                    editorWrapper.style.display = 'none';
                    displayDiv.style.display = 'block';
                    editBtn.style.display = 'inline-block';
                    cancelBtn.style.display = 'none';
                    saveBtn.style.display = 'none';
                    // Reset editor content
                    editor.innerHTML = htmlValue;
                };

                valueDiv.append(displayDiv, editorWrapper, editBtn, cancelBtn, saveBtn);
            } else {
                /* ----- SIMPLE INPUT ----- */
                const input = document.createElement('input');
                input.className = 'form-control form-control-sm';
                input.value = value || '';

                input.dataset.fieldname = actualFieldname;
                input.dataset.docname = docName;
                input.dataset.doctype = doctype;

                const saveBtn = createSaveButton(input, reportName, modal);
                valueDiv.append(input, saveBtn);
            }
        }
        /* =============================
           READ-ONLY FIELDS
        ============================== */
        else if (hasValue || reportFieldname === ATTACHMENTS_REPORT_FIELD) {

            // 📎 ATTACHMENTS (HARDCODED BY DESIGN)
            if (reportFieldname === ATTACHMENTS_REPORT_FIELD) {
                valueDiv.innerHTML = '<div class="text-muted small">Loading attachments…</div>';
                loadAttachments(valueDiv, docName, config, row, columns, reportName);
            }
            // 📝 Rich text (notes, descriptions, job card etc.)
            else if (typeof value === 'string' && value.includes('<')) {
                valueDiv.innerHTML = sanitizeRichHtml(value);
                normalizeFileLinks(valueDiv);
                normalizeAttachmentLayout(valueDiv);
                autoFixImages(valueDiv);
                constrainRichTextImages(valueDiv);
            }
            // 🔗 Link field
            else if (col.fieldtype === 'Link' && col.options) {
                const link = document.createElement('a');
                link.href = `${ERP_BASE}/app/${col.options.toLowerCase().replace(/\s+/g, '-')}/${encodeURIComponent(value)}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = value;
                valueDiv.appendChild(link);
            }
            // 📄 Plain text
            else {
                valueDiv.textContent = value;
            }
        }

        // ✅ Append field to modal
        fieldDiv.append(labelDiv, valueDiv);
        modalBody.appendChild(fieldDiv);
    }

    modal.show();

    modalEl.addEventListener('shown.bs.modal', () => {
        autoFixImages(modalEl);
        constrainRichTextImages(modalEl);
    }, { once: true });
}
















function createSaveButton(input, reportName, modal) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-success';
    saveBtn.textContent = '💾 Save';
    
    saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        try {
            const doctype = input.dataset.doctype;
            const docName = input.dataset.docname;
            const fieldname = input.dataset.fieldname;
            
            let valueToSave;
            
            // Handle rich text editor (contentEditable div)
            if (input.contentEditable === 'true') {
                // Get all images and restore original ERPNext URLs before saving
                const images = input.querySelectorAll('img');
                images.forEach(img => {
                    if (img.dataset.originalSrc) {
                        img.src = img.dataset.originalSrc;
                    }
                });
                
                valueToSave = input.innerHTML;
            } 
            // Handle regular input
            else {
                valueToSave = input.value;
            }
            
            console.log('💾 Saving field:', fieldname, 'Value length:', valueToSave?.length);
            
            // Save to database
            const response = await updateField(doctype, docName, fieldname, valueToSave);
            console.log('✅ Save response:', response);
            
            // ✅ UPDATE UI WITHOUT MODAL REFRESH
            
            // 1. Update the modal context data
            if (CURRENT_MODAL_CONTEXT && CURRENT_MODAL_CONTEXT.row) {
                // Find the report fieldname from the actual fieldname
                const reportFieldname = Object.keys(window.reportFieldMapping || {}).find(
                    key => window.reportFieldMapping[key].erpField === fieldname
                ) || fieldname;
                
                CURRENT_MODAL_CONTEXT.row[reportFieldname] = valueToSave;
            }
            
            // 2. If it's a rich text field, update the display div
            if (input.contentEditable === 'true') {
                // Find the parent structure
                const editorWrapper = input.parentElement; // The div containing toolbar + editor
                const fieldContainer = editorWrapper.parentElement; // The valueDiv
                const displayDiv = fieldContainer.querySelector('.editable-richtext[style*="background"]'); // The display div
                
                // Find buttons
                const editBtn = fieldContainer.querySelector('button.btn-primary');
                const cancelBtn = fieldContainer.querySelector('button.btn-secondary');
                
                // Update display div with new content
                if (displayDiv) {
                    displayDiv.innerHTML = sanitizeRichHtml(valueToSave);
                    normalizeFileLinks(displayDiv);
                    autoFixImages(displayDiv);
                    constrainRichTextImages(displayDiv);
                }
                
                // Switch back to display mode
                editorWrapper.style.display = 'none';
                if (displayDiv) displayDiv.style.display = 'block';
                if (editBtn) {
                    editBtn.style.display = 'inline-block';
                    editBtn.textContent = 'Edit';
                }
                if (cancelBtn) cancelBtn.style.display = 'none';
                saveBtn.style.display = 'none';
            } else {
                // For simple input fields, just disable them
                input.disabled = true;
            }
            
            // 3. Show success feedback
            saveBtn.className = 'btn btn-sm btn-success';
            saveBtn.innerHTML = '✅ Saved';
            saveBtn.disabled = false;
            
            // Reset button after 2 seconds
            setTimeout(() => {
                saveBtn.textContent = '💾 Save';
                saveBtn.className = 'btn btn-sm btn-success';
            }, 2000);
            
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('Failed to save: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save';
            saveBtn.className = 'btn btn-sm btn-danger';
            
            setTimeout(() => {
                saveBtn.className = 'btn btn-sm btn-success';
            }, 2000);
        }
    };
    
    return saveBtn;
}








// Helper function to make a field editable
function makeFieldEditable(fieldDiv, reportFieldname, currentValue, modal) {
    const valueDiv = fieldDiv.querySelector('.mt-1');
    const col = CURRENT_MODAL_CONTEXT.columns.find(c => c.fieldname === reportFieldname);
    
    // Clear current content
    valueDiv.innerHTML = '';
    
    // Determine if it's a rich text field
    const isRichText = ['Text', 'Small Text', 'Long Text', 'Text Editor', 'HTML', 'HTML Editor'].includes(col?.fieldtype);
    
    if (isRichText) {
        // Create Quill editor
        const editorContainer = document.createElement('div');
        editorContainer.style.border = '1px solid #ccc';
        editorContainer.style.minHeight = '200px';
        editorContainer.style.backgroundColor = '#fff';
        valueDiv.appendChild(editorContainer);
        
        const quill = new Quill(editorContainer, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
        
        // Set content
        const editor = editorContainer.querySelector('.ql-editor');
        editor.innerHTML = currentValue || '';
        
        // Fix image URLs for display
        prepareRichTextEditor(editor);
        constrainRichTextImages(editorContainer);
        
        const saveBtn = createSaveButton(editorContainer, reportFieldname, modal);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.onclick = () => {
            // Restore read mode without saving
            valueDiv.innerHTML = '';
            if (currentValue && currentValue.includes('<')) {
                valueDiv.innerHTML = sanitizeRichHtml(currentValue);
                normalizeFileLinks(valueDiv);
                autoFixImages(valueDiv);
            } else {
                valueDiv.textContent = currentValue || '(empty)';
            }
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
            editBtn.innerHTML = '✏️ Edit';
            editBtn.onclick = () => makeFieldEditable(fieldDiv, reportFieldname, currentValue, modal);
            valueDiv.appendChild(editBtn);
        };
        
        valueDiv.appendChild(saveBtn);
        valueDiv.appendChild(cancelBtn);
        
    } else {
        // Regular textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'form-control';
        textarea.rows = 3;
        textarea.value = currentValue || '';
        valueDiv.appendChild(textarea);
        
        const saveBtn = createSaveButton(textarea, reportFieldname, modal);
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.onclick = () => {
            valueDiv.innerHTML = '';
            valueDiv.textContent = currentValue || '(empty)';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
            editBtn.innerHTML = '✏️ Edit';
            editBtn.onclick = () => makeFieldEditable(fieldDiv, reportFieldname, currentValue, modal);
            valueDiv.appendChild(editBtn);
        };
        
        valueDiv.appendChild(saveBtn);
        valueDiv.appendChild(cancelBtn);
    }
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




               // Auto-populate Report Management with assigned reports
                (async () => {
                    const users = await getUsers();
                    const assignedReports = new Set();
                    
                    users.users.forEach(u => {
                        if (u.allowed_reports) {
                            u.allowed_reports.forEach(r => assignedReports.add(r));
                        }
                    });
                    
                    // Merge with any already-fetched reports
                    const allReportsSet = new Set([...allReports, ...Array.from(assignedReports)]);
                    const initialReports = Array.from(allReportsSet).sort();
                    
                    if (initialReports.length > 0) {
                        await renderReportsListAdmin(initialReports);
                    }
                })();
    


    
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
    
    initFieldMappingsTab();
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
    
    let tabsHtml = '<ul class="nav nav-tabs mb-3" id="reportConfigTabList">';
    user.allowed_reports.forEach((report, idx) => {
        tabsHtml += `
            <li class="nav-item">
                <a class="nav-link ${idx === 0 ? 'active' : ''}" data-bs-toggle="tab" href="#tab_${idx}" role="tab">
                    ${report}
                </a>
            </li>
        `;
    });
    tabsHtml += '</ul><div class="tab-content">';
    
    for (let idx = 0; idx < user.allowed_reports.length; idx++) {
        const reportName = user.allowed_reports[idx];
        const config = reportConfig[reportName] || {};
        const userPerms = config.user_permissions?.[userEmail] || { editable_fields: [], hidden_fields: [], hiddenprimarygroups: [], hiddensecondarygroups: [] };
        
        let columns = currentReportColumns;
        if (currentReportData && currentReportData.reportName === reportName) {
            columns = currentReportData.columns;
        }
        
        tabsHtml += `
            <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="tab_${idx}" role="tabpanel">
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
        
                <!-- Group Visibility Controls -->
                <div style="margin-top: 20px;">
                  <h6>Hide Primary Groups:</h6>
                  <div id="primaryGroupsContainer_${idx}" class="border rounded p-2" style="max-height: 150px; overflow-y: auto;">
                      <!-- Filled dynamically -->
                  </div>
                  
                  <h6 class="mt-3">Hide Secondary Groups:</h6>
                  <div id="secondaryGroupsContainer_${idx}" class="border rounded p-2" style="max-height: 150px; overflow-y: auto;">
                      <!-- Filled dynamically -->
                  </div>
                </div>
                <!-- End Group Visibility Controls -->
            </div>
        `;

    }
    
    tabsHtml += '</div>';
    document.getElementById('reportConfigTabs').innerHTML = tabsHtml;
    
    // Populate group visibility checkboxes for all reports
    if (user.allowed_reports.length > 0) {
        renderGroupVisibilityCheckboxesForAllReports(userEmail, user.allowed_reports);
    }
    
    // Add event listener for tab change to update group visibility
    const tabLinks = document.querySelectorAll('#reportConfigTabList .nav-link');
    tabLinks.forEach((tabLink, idx) => {
        tabLink.addEventListener('shown.bs.tab', () => {
            renderGroupVisibilityCheckboxesForReport(userEmail, user.allowed_reports[idx], idx);
        });
    });
    
    document.getElementById('saveReportConfigBtn').onclick = () => {
        user.allowed_reports.forEach((reportName, idx) => {
            if (!reportConfig[reportName]) {
                reportConfig[reportName] = {};
            }
            if (!reportConfig[reportName].user_permissions) {
                reportConfig[reportName].user_permissions = {};
            }
            
            const editableChecks = document.querySelectorAll(`.editable-field-check[data-report="${reportName}"][data-user="${userEmail}"]:checked`);
            const hiddenChecks = document.querySelectorAll(`.hidden-field-check[data-report="${reportName}"][data-user="${userEmail}"]:checked`);
            
            // Save hidden groups
            const hiddenPrimary = Array.from(document.querySelectorAll(`#primaryGroupsContainer_${idx} input[type=checkbox]:checked`))
                                     .map(cb => cb.value);
            const hiddenSecondary = Array.from(document.querySelectorAll(`#secondaryGroupsContainer_${idx} input[type=checkbox]:checked`))
                                     .map(cb => cb.value);

            reportConfig[reportName].user_permissions[userEmail] = {
                editable_fields: Array.from(editableChecks).map(cb => cb.value),
                hidden_fields: Array.from(hiddenChecks).map(cb => cb.value),
                hiddenprimarygroups: hiddenPrimary,
                hiddensecondarygroups: hiddenSecondary
            };
        });
        
        alert("Configuration saved! Click 'Save Changes' in main settings to persist.");
        configModal.hide();
    };
    
    configModal.show();
}










// Helper function to render group visibility checkboxes for all reports in the modal
function renderGroupVisibilityCheckboxesForAllReports(userEmail, allowedReports) {
    allowedReports.forEach((reportName, idx) => {
        renderGroupVisibilityCheckboxesForReport(userEmail, reportName, idx);
    });
}

// Helper function to render group visibility checkboxes for a single report tab
function renderGroupVisibilityCheckboxesForReport(userEmail, reportName, tabIdx) {
    const config = reportConfig[reportName] || {};
    const userPerms = config.user_permissions?.[userEmail] || { hiddenprimarygroups: [], hiddensecondarygroups: [] };
    
    // Assuming you have functions or data to get primary and secondary groups for a report
    const primaryGroups = getGroups(config, 'primary');  // returns array of primary group names
    const secondaryGroups = getGroups(config, 'secondary');  // returns array of secondary group names
    
    const primaryContainer = document.getElementById(`primaryGroupsContainer_${tabIdx}`);
    const secondaryContainer = document.getElementById(`secondaryGroupsContainer_${tabIdx}`);
    
    if (!primaryContainer || !secondaryContainer) return;
    
    primaryContainer.innerHTML = '';
    secondaryContainer.innerHTML = '';
    
    primaryGroups.forEach(group => {
        const checked = userPerms.hiddenprimarygroups?.includes(group) ? 'checked' : '';
        primaryContainer.innerHTML += `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${group}" id="primary_${tabIdx}_${group}" ${checked}>
                <label class="form-check-label" for="primary_${tabIdx}_${group}">${group}</label>
            </div>
        `;
    });
    
    secondaryGroups.forEach(group => {
        const checked = userPerms.hiddensecondarygroups?.includes(group) ? 'checked' : '';
        secondaryContainer.innerHTML += `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${group}" id="secondary_${tabIdx}_${group}" ${checked}>
                <label class="form-check-label" for="secondary_${tabIdx}_${group}">${group}</label>
            </div>
        `;
    });
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
    <!-- MANDATORY FIELDS SECTION -->
    <div class="alert alert-warning mb-3">
        <strong>⚠️ Required Fields:</strong> DocType, Title Field, and Primary Grouping Field are mandatory to run the report.
    </div>

    <!-- BASIC SETTINGS -->
    <div class="card mb-3">
        <div class="card-header bg-primary text-white">
            <h6 class="mb-0">Basic Settings</h6>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label fw-bold">DocType <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="configdoctype" value="${config.doctype || ''}" placeholder="e.g., Work Order" required>
                    <small class="text-muted">ERPNext DocType name</small>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label fw-bold">Title Field (for cards) <span class="text-danger">*</span></label>
                    <select class="form-select" id="configtitlefield" required>
                        ${columns.map(c => `<option value="${c.fieldname}" ${config.titlefield === c.fieldname ? 'selected' : ''}>${c.label || c.fieldname}</option>`).join('')}
                    </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label fw-bold">Primary Grouping Field <span class="text-danger">*</span></label>
                    <select class="form-select" id="configgroup1" required>
                        <option value="">-- None --</option>
                        ${columns.map(c => `<option value="${c.fieldname}" ${config.groupby?.[0] === c.fieldname ? 'selected' : ''}>${c.label || c.fieldname}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label fw-bold">Secondary Grouping Field</label>
                    <select class="form-select" id="configgroup2">
                        <option value="">-- None --</option>
                        ${columns.map(c => `<option value="${c.fieldname}" ${config.groupby?.[1] === c.fieldname ? 'selected' : ''}>${c.label || c.fieldname}</option>`).join('')}
                    </select>
                </div>
                <div class="col-md-3 mb-3">
                    <label class="form-label fw-bold">Sort Records By</label>
                    <select class="form-select" id="configsortby">
                        <option value="">-- None --</option>
                        ${columns.map(c => `<option value="${c.fieldname}" ${config.sortby === c.fieldname ? 'selected' : ''}>${c.label || c.fieldname}</option>`).join('')}
                    </select>
                </div>
                <div class="col-md-3 mb-3">
                    <label class="form-label fw-bold">Sort Order</label>
                    <select class="form-select" id="configsortorder">
                        <option value="asc" ${config.sortorder === 'asc' ? 'selected' : ''}>Ascending</option>
                        <option value="desc" ${config.sortorder === 'desc' ? 'selected' : ''}>Descending</option>
                    </select>
                </div>
            </div>
            
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="configcollapsed" ${config.collapsed !== false ? 'checked' : ''}>
                <label class="form-check-label" for="configcollapsed">
                    Start with groups collapsed
                </label>
            </div>
        </div>
    </div>

    <!-- CARD FIELDS -->
    <div class="card mb-3">
        <div class="card-header bg-info text-white">
            <h6 class="mb-0">Card Display Fields (select up to 5)</h6>
        </div>
        <div class="card-body">
            <div class="row">
                ${columns.map(c => `
                    <div class="col-md-3 col-sm-4 col-6 mb-2">
                        <div class="form-check">
                            <input class="form-check-input card-field-check" type="checkbox" value="${c.fieldname}" id="card-${c.fieldname}" ${config.cardfields?.includes(c.fieldname) ? 'checked' : ''}>
                            <label class="form-check-label small" for="card-${c.fieldname}">
                                ${c.label || c.fieldname}
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- IMAGE FIELDS -->
    <div class="card mb-3">
        <div class="card-header bg-secondary text-white">
            <h6 class="mb-0">Image Fields (description fields)</h6>
        </div>
        <div class="card-body">
            <div class="row">
                ${columns.filter(c => c.fieldname.toLowerCase().includes('description')).map(c => `
                    <div class="col-md-3 col-sm-4 col-6 mb-2">
                        <div class="form-check">
                            <input class="form-check-input image-field-check" type="checkbox" value="${c.fieldname}" id="img-${c.fieldname}" ${config.imagefields?.includes(c.fieldname) ? 'checked' : ''}>
                            <label class="form-check-label small" for="img-${c.fieldname}">
                                ${c.label || c.fieldname}
                            </label>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- FIELD SORTING ORDER -->
    <div class="card mb-3">
        <div class="card-header bg-success text-white">
            <h6 class="mb-0">Field Display Order (drag to reorder)</h6>
        </div>
        <div class="card-body" style="max-height: 400px; overflow-y: auto;">
            <div class="row">
                <div class="col-12">
                    <ul class="list-group" id="fieldOrderList">
                        ${columns.map(col => `
                            <li class="list-group-item draggable-field d-flex align-items-center" draggable="true" data-fieldname="${col.fieldname}">
                                <span class="drag-handle me-2">☰</span>
                                <span>${col.label || col.fieldname}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <!-- GROUP SORTING -->
    ${group1Field ? `
    <div class="card mb-3">
        <div class="card-header bg-warning">
            <h6 class="mb-0">Primary Group Sort Order (drag to reorder)</h6>
        </div>
        <div class="card-body">
            <ul class="list-group" id="group1SortList">
                ${group1Values.map(v => `
                    <li class="list-group-item draggable-group d-flex align-items-center" draggable="true" data-value="${v}">
                        <span class="drag-handle me-2">☰</span>
                        <span>${v}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>
    ` : ''}

    ${group2Field ? `
    <div class="card mb-3">
        <div class="card-header bg-warning">
            <h6 class="mb-0">Secondary Group Sort Order (drag to reorder)</h6>
        </div>
        <div class="card-body">
            <ul class="list-group" id="group2SortList">
                ${group2Values.map(v => `
                    <li class="list-group-item draggable-group d-flex align-items-center" draggable="true" data-value="${v}">
                        <span class="drag-handle me-2">☰</span>
                        <span>${v}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>
    ` : ''}

    <!-- TIME LOGS SETTINGS -->
    <div class="card mb-3">
        <div class="card-header bg-primary text-white">
            <h6 class="mb-0">Time Logs Settings</h6>
        </div>
        <div class="card-body">
            <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="configShowTimeLogs" ${config.showtimelogsbutton ? 'checked' : ''}>
                <label class="form-check-label fw-bold" for="configShowTimeLogs">
                    Show Time Logs Button
                </label>
            </div>
            
            <div id="timeLogsPermissionsSection" style="display: ${config.showtimelogsbutton ? 'block' : 'none'}">
                <label class="form-label fw-bold">User Permissions for Time Logs</label>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th style="min-width: 180px;">User</th>
                                <th class="text-center" style="width: 80px;">View</th>
                                <th class="text-center" style="width: 80px;">Add</th>
                                <th class="text-center" style="width: 80px;">Edit</th>
                                <th class="text-center" style="width: 80px;">Delete</th>
                                <th class="text-center" style="width: 120px;">Edit WS</th>
                                <th class="text-center" style="width: 120px;">Edit Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.users.map(user => {
                                const perms = config.timelogspermissions?.[user.email] || { canview: false, canadd: false, canedit: false, candelete: false, caneditworkstation: false, canedittimerequired: false };
                                return `
                                    <tr>
                                        <td>${user.email}</td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="canview" ${perms.canview ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="canadd" ${perms.canadd ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="canedit" ${perms.canedit ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="candelete" ${perms.candelete ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="caneditworkstation" ${perms.caneditworkstation ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="time-log-perm" data-user="${user.email}" data-perm="canedittimerequired" ${perms.canedittimerequired ? 'checked' : ''}></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- OPERATION PLANNING SETTINGS -->
    <div class="card mb-3">
        <div class="card-header bg-success text-white">
            <h6 class="mb-0">Operation Planning Settings</h6>
        </div>
        <div class="card-body">
            <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="configShowOperationPlanning" ${config.showoperationplanningbutton !== false ? 'checked' : ''}>
                <label class="form-check-label fw-bold" for="configShowOperationPlanning">
                    Show Operation Planning Button
                </label>
            </div>
            
            <div id="operationPlanningPermissionsSection" style="display: ${config.showoperationplanningbutton !== false ? 'block' : 'none'}">
                <label class="form-label fw-bold">User Permissions for Operation Planning</label>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th style="min-width: 180px;">User</th>
                                <th class="text-center" style="width: 100px;">View</th>
                                <th class="text-center" style="width: 100px;">Add</th>
                                <th class="text-center" style="width: 100px;">Edit</th>
                                <th class="text-center" style="width: 100px;">Delete</th>
                                <th class="text-center" style="width: 100px;">Reorder</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.users.map(user => {
                                const perms = config.operationplanningpermissions?.[user.email] || { canview: false, canadd: false, canedit: false, candelete: false, canreorder: false };
                                return `
                                    <tr>
                                        <td>${user.email}</td>
                                        <td class="text-center"><input type="checkbox" class="op-planning-perm" data-user="${user.email}" data-perm="canview" ${perms.canview ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="op-planning-perm" data-user="${user.email}" data-perm="canadd" ${perms.canadd ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="op-planning-perm" data-user="${user.email}" data-perm="canedit" ${perms.canedit ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="op-planning-perm" data-user="${user.email}" data-perm="candelete" ${perms.candelete ? 'checked' : ''}></td>
                                        <td class="text-center"><input type="checkbox" class="op-planning-perm" data-user="${user.email}" data-perm="canreorder" ${perms.canreorder ? 'checked' : ''}></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
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
    
    // Add event listener for show operation planning checkbox
    document.getElementById('configShowOperationPlanning').addEventListener('change', (e) => {
        document.getElementById('operationPlanningPermissionsSection').style.display = 
            e.target.checked ? 'block' : 'none';
    });



    
document.getElementById('saveGlobalConfigBtn').onclick = () => {
    // Validate mandatory fields
    const doctype = document.getElementById('configdoctype')?.value.trim();
    const titlefield = document.getElementById('configtitlefield')?.value;
    const group1 = document.getElementById('configgroup1')?.value;
    
    if (!doctype) {
        alert('⚠️ DocType is required!');
        document.getElementById('configdoctype').focus();
        return;
    }
    
    if (!titlefield) {
        alert('⚠️ Title Field is required!');
        document.getElementById('configtitlefield').focus();
        return;
    }
    
    if (!group1) {
        alert('⚠️ Primary Grouping Field is required!');
        document.getElementById('configgroup1').focus();
        return;
    }
    
    // Initialize config if needed
    if (!reportConfig[reportName]) reportConfig[reportName] = {};
    
    // Save basic settings
    const group2 = document.getElementById('configgroup2')?.value || '';
    reportConfig[reportName].doctype = doctype;
    reportConfig[reportName].titlefield = titlefield;
    
    // Save card fields
    const cardFieldChecks = document.querySelectorAll('.card-field-check:checked');
    reportConfig[reportName].cardfields = Array.from(cardFieldChecks).map(cb => cb.value);
    
    // Save image fields
    const imageFieldChecks = document.querySelectorAll('.image-field-check:checked');
    reportConfig[reportName].imagefields = Array.from(imageFieldChecks).map(cb => cb.value);
    
    // Save grouping
    reportConfig[reportName].groupby = [group1, group2].filter(g => g);
    
    // Save sorting
    reportConfig[reportName].sortby = document.getElementById('configsortby')?.value || '';
    reportConfig[reportName].sortorder = document.getElementById('configsortorder')?.value || 'asc';
    reportConfig[reportName].collapsed = document.getElementById('configcollapsed')?.checked || false;
    
    // Save field order
    const fieldOrder = [...document.querySelectorAll('#fieldOrderList .draggable-field')].map(li => li.dataset.fieldname);
    reportConfig[reportName].fieldorder = fieldOrder;
    
    // Save group sorting
    reportConfig[reportName].groupsort = {};
    const group1List = document.getElementById('group1SortList');
    if (group1List && group1) {
        const group1Order = [...group1List.querySelectorAll('.draggable-group')].map(li => li.dataset.value);
        reportConfig[reportName].groupsort[group1] = group1Order;
    }
    const group2List = document.getElementById('group2SortList');
    if (group2List && group2) {
        const group2Order = [...group2List.querySelectorAll('.draggable-group')].map(li => li.dataset.value);
        reportConfig[reportName].groupsort[group2] = group2Order;
    }
    
    // Save Time Logs configuration
    reportConfig[reportName].showtimelogsbutton = document.getElementById('configShowTimeLogs')?.checked || false;
    if (reportConfig[reportName].showtimelogsbutton) {
        const permissions = {};
        document.querySelectorAll('.time-log-perm').forEach(checkbox => {
            const user = checkbox.dataset.user;
            const perm = checkbox.dataset.perm;
            if (!permissions[user]) {
                permissions[user] = { canview: false, canadd: false, canedit: false, candelete: false, caneditworkstation: false, canedittimerequired: false };
            }
            permissions[user][perm] = checkbox.checked;
        });
        reportConfig[reportName].timelogspermissions = permissions;
    } else {
        delete reportConfig[reportName].timelogspermissions;
    }
    
    // Save Operation Planning configuration
    reportConfig[reportName].showoperationplanningbutton = document.getElementById('configShowOperationPlanning')?.checked !== false;
    if (reportConfig[reportName].showoperationplanningbutton) {
        const opPlanningPermissions = {};
        document.querySelectorAll('.op-planning-perm').forEach(checkbox => {
            const user = checkbox.dataset.user;
            const perm = checkbox.dataset.perm;
            if (!opPlanningPermissions[user]) {
                opPlanningPermissions[user] = { canview: false, canadd: false, canedit: false, candelete: false, canreorder: false };
            }
            opPlanningPermissions[user][perm] = checkbox.checked;
        });
        reportConfig[reportName].operationplanningpermissions = opPlanningPermissions;
    } else {
        delete reportConfig[reportName].operationplanningpermissions;
    }
    
    alert('✅ Configuration saved! Click "Save Changes" in main settings to persist.');
    configModal.hide();
    
    // Blur any focused element to prevent aria-hidden focus conflict
    if (document.activeElement) document.activeElement.blur();
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


// Update Job Card Time Required
async function updateJobCardTimeRequired(jobCard, timeRequired) {
    const res = await fetch(`${API_BASE}?action=update_time_required`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            job_card: jobCard,
            time_required: timeRequired
        })
    });
    if (!res.ok) throw new Error("Failed to update time required");
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


function renderTimeLogs(timeLogs, jobCard, jobCardInfo, timeLogsPerms, reportName, config) {
    const permissions = timeLogsPerms || {};

    
    const bodyEl = document.getElementById('timeLogsBody');
    
    let html = '';
    
    // Show Job Card Info with editable workstation
        html += `
            <div class="alert alert-info mb-3">
                <div class="row align-items-center mb-2">
                    <div class="col-md-3">
                        <strong>Required Qty:</strong> ${jobCardInfo.for_quantity || 0}
                    </div>
                    <div class="col-md-3">
                        <strong>Completed Qty:</strong> ${jobCardInfo.total_completed_qty || 0}
                    </div>
                    <div class="col-md-3">
                            <strong>Time Required (mins):</strong>
                            ${permissions.can_edit_time_required ? `

                            <input type="number" class="form-control form-control-sm" id="jobCardTimeRequired" 
                                value="${jobCardInfo.time_required || 0}" style="display: inline-block; width: 80px;">
                            <button class="btn btn-sm btn-success" id="saveTimeRequiredBtn" style="padding: 2px 8px;">
                                <i class="bi bi-check"></i>
                            </button>
                        ` : `
                            <span>${jobCardInfo.time_required || 0}</span>
                        `}
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


console.log('🎯 About to call loadWorkstationDropdown, permissions check:', {
    permissions,
    caneditworkstation: permissions?.caneditworkstation,
    canedittimerequired: permissions?.canedittimerequired,
    conditionPasses: permissions && (permissions.can_edit_workstation || permissions.can_edit_time_required)
});


    
           
            // Load workstation and time required handlers if user has permission
                if (permissions && (permissions.can_edit_workstation || permissions.can_edit_time_required)) {
                    loadWorkstationDropdown(jobCardInfo.workstation, jobCard, jobCardInfo, permissions);
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

async function loadWorkstationDropdown(currentWorkstation, jobCard, jobCardInfo, permissions) {
    
    
    
        console.log('🔧 loadWorkstationDropdown called with:', {
        currentWorkstation,
        jobCard,
        jobCardInfo,
        permissions,
        dropdownExists: !!document.getElementById('jobCardWorkstation'),
        buttonExists: !!document.getElementById('saveWorkstationBtn')
    });
    
    
    
    try {
        // Handle WORKSTATION dropdown
        const dropdown = document.getElementById('jobCardWorkstation');
        if (dropdown && permissions && permissions.can_edit_workstation) {
            const wsData = await getWorkstations();
            const workstations = wsData.data || [];
            
            // Clear and populate dropdown
            dropdown.innerHTML = '<option value="">-- Select --</option>';
            workstations.forEach(ws => {
                const option = document.createElement('option');
                option.value = ws.name;
                option.textContent = ws.name;
                if (ws.name === currentWorkstation) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
            
            // Attach workstation save handler
            const saveBtn = document.getElementById('saveWorkstationBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const newWorkstation = dropdown.value;
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                    
                    try {
                        await updateJobCardWorkstation(jobCard, newWorkstation);
                        alert('Workstation updated successfully!');
                        if (confirm('Refresh report?')) location.reload();
                    } catch (err) {
                        alert('Failed: ' + err.message);
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = '<i class="bi bi-check"></i>';
                    }
                });
            }
        }
        
        // Handle TIME REQUIRED field (separate from workstation)
        const timeReqBtn = document.getElementById('saveTimeRequiredBtn');
        if (timeReqBtn && permissions && permissions.can_edit_time_required) {
            timeReqBtn.addEventListener('click', async () => {
                const newTimeRequired = document.getElementById('jobCardTimeRequired').value;
                timeReqBtn.disabled = true;
                timeReqBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                
                try {
                    await updateJobCardTimeRequired(jobCard, parseFloat(newTimeRequired));
                    alert('Time required updated successfully!');
                } catch (err) {
                    alert('Failed: ' + err.message);
                } finally {
                    timeReqBtn.disabled = false;
                    timeReqBtn.innerHTML = '<i class="bi bi-check"></i>';
                }
            });
        }
    } catch (err) {
        console.error('Error in loadWorkstationDropdown:', err);
    }
}


















function renderGroupVisibilityControls(reportName, userEmail) {
  const report = reportConfig[reportName];
  if (!report) return;

  const userPerms = report.userpermissions?.[userEmail] || {};

  const primaryGroups = getGroups(report, 'primary');
  const secondaryGroups = getGroups(report, 'secondary');

  const primaryContainer = document.getElementById('primaryGroupsList');
  const secondaryContainer = document.getElementById('secondaryGroupsList');

  primaryContainer.innerHTML = '';
  secondaryContainer.innerHTML = '';

  primaryGroups.forEach(group => {
    const checked = userPerms.hiddenprimarygroups?.includes(group) ? 'checked' : '';
    primaryContainer.innerHTML += `<div><input type="checkbox" class="hide-primary-group" value="${group}" ${checked}> ${group}</div>`;
  });

  secondaryGroups.forEach(group => {
    const checked = userPerms.hiddensecondarygroups?.includes(group) ? 'checked' : '';
    secondaryContainer.innerHTML += `<div><input type="checkbox" class="hide-secondary-group" value="${group}" ${checked}> ${group}</div>`;
  });
}








function saveGroupVisibilitySettings(reportName, userEmail) {
  const report = reportConfig[reportName];
  if (!report) return;

  const primaryCheckboxes = document.querySelectorAll('#primaryGroupsList input.hide-primary-group:checked');
  const secondaryCheckboxes = document.querySelectorAll('#secondaryGroupsList input.hide-secondary-group:checked');

  const hiddenprimarygroups = Array.from(primaryCheckboxes).map(cb => cb.value);
  const hiddensecondarygroups = Array.from(secondaryCheckboxes).map(cb => cb.value);

  if (!report.userpermissions) report.userpermissions = {};
  if (!report.userpermissions[userEmail]) report.userpermissions[userEmail] = {};

  report.userpermissions[userEmail].hiddenprimarygroups = hiddenprimarygroups;
  report.userpermissions[userEmail].hiddensecondarygroups = hiddensecondarygroups;
}






function renderGroupVisibilityCheckboxesForAllReports(userEmail, allowedReports) {
  allowedReports.forEach((reportName, idx) => {
    renderGroupVisibilityCheckboxesForReport(userEmail, reportName, idx);
  });
}




function renderGroupVisibilityCheckboxesForReport(userEmail, reportName, tabIdx) {
  const config = reportConfig[reportName] || {};
  const userPerms = config.user_permissions?.[userEmail] || { hiddenprimarygroups: [], hiddensecondarygroups: [] };

  const primaryGroups = getGroups(config, 'primary');
  const secondaryGroups = getGroups(config, 'secondary');

  const primaryContainer = document.getElementById(`primaryGroupsContainer_${tabIdx}`);
  const secondaryContainer = document.getElementById(`secondaryGroupsContainer_${tabIdx}`);

  if (!primaryContainer || !secondaryContainer) {
    console.error('Group containers not found for tab', tabIdx);
    return;
  }

  primaryContainer.innerHTML = '';
  secondaryContainer.innerHTML = '';

  // Handle primary groups
  if (primaryGroups.length === 0) {
    primaryContainer.innerHTML = '<p class="text-muted small mb-0">No primary groups configured for this report</p>';
  } else {
    primaryGroups.forEach(group => {
      const checked = userPerms.hiddenprimarygroups?.includes(group) ? 'checked' : '';
      primaryContainer.innerHTML += `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${group}" id="primary_${tabIdx}_${group}" ${checked}>
          <label class="form-check-label" for="primary_${tabIdx}_${group}">${group}</label>
        </div>
      `;
    });
  }

  // Handle secondary groups
  if (secondaryGroups.length === 0) {
    secondaryContainer.innerHTML = '<p class="text-muted small mb-0">No secondary groups configured for this report</p>';
  } else {
    secondaryGroups.forEach(group => {
      const checked = userPerms.hiddensecondarygroups?.includes(group) ? 'checked' : '';
      secondaryContainer.innerHTML += `
        <div class="form-check">
          <input class="form-check-input" type="checkbox" value="${group}" id="secondary_${tabIdx}_${group}" ${checked}>
          <label class="form-check-label" for="secondary_${tabIdx}_${group}">${group}</label>
        </div>
      `;
    });
  }
}











async function openOperationPlanningModal(row, config, reportName) {
  const workOrderId = row.work_order_id || row.name;
  
  if (!workOrderId) {
    alert('No Work Order ID found for this record');
    return;
  }
  
  console.log('Opening Operation Planning for:', workOrderId);
  
  const userEmail = localStorage.getItem("userEmail");
  const opPerms = config.operation_planning_permissions?.[userEmail] || {};
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal fade" id="operationPlanningModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Operation Planning - ${workOrderId}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="operationPlanningContent">
              <div class="text-center">
                <div class="spinner-border" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            ${opPerms.can_add ? '<button type="button" class="btn btn-primary" id="addOperationBtn"><i class="bi bi-plus"></i> Add Operation</button>' : ''}
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('operationPlanningModal');
  if (existingModal) existingModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = new bootstrap.Modal(document.getElementById('operationPlanningModal'));
  modal.show();
  
  // Load operations data
  try {
    const operations = await fetchWorkOrderOperations(workOrderId);
    console.log('Fetched operations:', operations);
    renderOperationsTable(operations, opPerms, workOrderId);
    
    // Setup add operation button
    if (opPerms.can_add) {
      const addBtn = document.getElementById('addOperationBtn');
      if (addBtn) {
        addBtn.onclick = () => {
          addNewOperation(workOrderId, opPerms);
        };
      }
    }
  } catch (error) {
    console.error('Error in openOperationPlanningModal:', error);
    document.getElementById('operationPlanningContent').innerHTML = 
      `<div class="alert alert-danger">
        <strong>Error loading operations:</strong><br>
        ${error.message}<br>
        <small>Check browser console for more details</small>
      </div>`;
  }
}








async function fetchWorkOrderOperations(workOrderId) {
  console.log('=== Fetch Work Order Operations ===');
  console.log('Work Order ID:', workOrderId);
  
  const url = `${API_BASE}?action=get_work_order_operations&work_order=${encodeURIComponent(workOrderId)}`;
  console.log('Full URL:', url);
  
  try {
    const response = await fetch(url);
    console.log('Response received, status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Raw response text:', text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e);
      console.error('Response was:', text);
      throw new Error('Invalid JSON response from server');
    }
    
    console.log('Parsed response data:', data);
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch operations');
    }
    
    console.log('Operations:', data.operations);
    return data.operations || [];
    
  } catch (error) {
    console.error('=== Fetch Error ===');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}







function renderOperationsTable(operations, permissions, workOrderId) {
  const content = document.getElementById('operationPlanningContent');
  
  if (!operations || operations.length === 0) {
    content.innerHTML = '<p class="text-muted">No operations found for this work order.</p>';
    return;
  }
  
  let tableHtml = `
    <div class="table-responsive">
      <table class="table table-bordered table-hover" id="operationsTable">
        <thead class="table-light">
          <tr>
            ${permissions.can_reorder ? '<th width="50">Order</th>' : ''}
            <th>Operation</th>
            <th>Workstation</th>
            <th>Time (mins)</th>
            <th>Plant</th>
            <th>Qty to Manufacture</th>
            <th>Completed Qty</th>
            ${permissions.can_edit || permissions.can_delete ? '<th width="150">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody id="operationsTableBody">
  `;
  
  operations.forEach((op, index) => {
    const forQty = op.for_quantity || 0;
    const completedQty = op.total_completed_qty || 0;
    const isCompleted = completedQty >= forQty && forQty > 0;
    const rowClass = isCompleted ? 'table-success' : '';
    
    tableHtml += `
      <tr data-operation-id="${op.name}" data-idx="${op.idx}" class="${rowClass}">
        ${permissions.can_reorder ? `<td class="text-center"><i class="bi bi-grip-vertical drag-handle" style="cursor: move;"></i></td>` : ''}
        <td>${op.operation || ''}</td>
        <td>${op.workstation || ''}</td>
        <td>${op.time_in_mins || ''}</td>
        <td>${op.custom_plant || ''}</td>
        <td class="text-center"><strong>${forQty}</strong></td>
        <td class="text-center"><strong>${completedQty}</strong></td>
        ${permissions.can_edit || permissions.can_delete ? `
          <td>
            ${permissions.can_edit ? `<button class="btn btn-sm btn-warning me-1" onclick="editOperation('${op.name}', '${workOrderId}')"><i class="bi bi-pencil"></i> Edit</button>` : ''}
            ${permissions.can_delete ? `<button class="btn btn-sm btn-danger" onclick="deleteOperation('${op.name}', '${workOrderId}')"><i class="bi bi-trash"></i> Delete</button>` : ''}
          </td>
        ` : ''}
      </tr>
    `;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  content.innerHTML = tableHtml;
  
  // Enable drag and drop reordering if permission exists
  if (permissions.can_reorder) {
    enableOperationReordering(workOrderId);
  }
}











async function saveNewOperation(workOrderId) {
  const operation = document.getElementById('newOpOperation').value;
  const workstation = document.getElementById('newOpWorkstation').value;
  const time = document.getElementById('newOpTime').value;
  const plant = document.getElementById('newOpPlant').value;
  
  if (!operation) {
    alert('Operation name is required');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}?action=add_work_order_operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order: workOrderId,
        operation: operation,
        workstation: workstation,
        time_in_mins: time,
        custom_plant: plant
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('Operation added successfully!');
      // Remove the form
      document.getElementById('newOperationForm')?.remove();
      // Reload operations
      const operations = await fetchWorkOrderOperations(workOrderId);
      const userEmail = localStorage.getItem("userEmail");
      const config = reportConfig[currentReportData.reportName] || {};
      const opPerms = config.operation_planning_permissions?.[userEmail] || {};
      renderOperationsTable(operations, opPerms, workOrderId);
    } else {
      console.error('Add operation failed:', data);
      alert('Error: ' + (data.message || 'Failed to add operation'));
    }
  } catch (error) {
    console.error('Add operation error:', error);
    alert('Error adding operation: ' + error.message);
  }
}

function cancelNewOperation() {
  document.getElementById('newOperationForm')?.remove();
}
















async function addNewOperation(workOrderId, permissions) {
  // Fetch options
  const operationOptions = await getOperationOptions();
  const workstationOptions = await getWorkstationOptions();
  const plantOptions = await getPlantOptions();
  
  console.log('Plant options fetched:', plantOptions);
  
  // Create operation dropdown
  let operationSelect = `<select class="form-select" id="newOpOperation" required>
    <option value="">-- Select Operation --</option>`;
  operationOptions.forEach(opt => {
    operationSelect += `<option value="${opt}">${opt}</option>`;
  });
  operationSelect += `</select>`;
  
  // Create workstation dropdown
  let workstationSelect = `<select class="form-select" id="newOpWorkstation">
    <option value="">-- Select Workstation --</option>`;
  workstationOptions.forEach(opt => {
    workstationSelect += `<option value="${opt}">${opt}</option>`;
  });
  workstationSelect += `</select>`;
  
  // Create plant floor dropdown
  let plantInput;
  if (plantOptions.length > 0) {
    plantInput = `<select class="form-select" id="newOpPlant">
      <option value="">-- Select Plant Floor --</option>`;
    plantOptions.forEach(opt => {
      plantInput += `<option value="${opt}">${opt}</option>`;
    });
    plantInput += `</select>`;
  } else {
    // Fallback to text input if no options found
    plantInput = `<input type="text" class="form-control" id="newOpPlant" placeholder="Enter plant floor">`;
  }
  
  // Create inline form in modal
  const form = `
    <div class="card p-3 mb-3" id="newOperationForm">
      <h6>Add New Operation</h6>
      <div class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Operation <span class="text-danger">*</span></label>
          ${operationSelect}
        </div>
        <div class="col-md-3">
          <label class="form-label">Workstation</label>
          ${workstationSelect}
        </div>
        <div class="col-md-2">
          <label class="form-label">Time (mins)</label>
          <input type="number" class="form-control" id="newOpTime" placeholder="0">
        </div>
        <div class="col-md-2">
          <label class="form-label">Plant Floor</label>
          ${plantInput}
        </div>
        <div class="col-md-2 d-flex align-items-end">
          <button class="btn btn-success me-2" id="saveNewOpBtn">Save</button>
          <button class="btn btn-secondary" id="cancelNewOpBtn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  const content = document.getElementById('operationPlanningContent');
  content.insertAdjacentHTML('afterbegin', form);
  
  // Attach event listeners
  document.getElementById('saveNewOpBtn').addEventListener('click', async () => {
    await saveNewOperation(workOrderId);
  });
  
  document.getElementById('cancelNewOpBtn').addEventListener('click', () => {
    cancelNewOperation();
  });
}












function cancelNewOperation() {
  document.getElementById('newOperationForm')?.remove();
}










async function editOperation(operationName, workOrderId) {
  console.log('Editing operation:', operationName, 'for WO:', workOrderId);
  
  // Find the operation row
  const row = document.querySelector(`tr[data-operation-id="${operationName}"]`);
  if (!row) {
    alert('Operation row not found');
    return;
  }
  
  const cells = row.querySelectorAll('td');
  
  // Determine cell indices based on whether reorder column exists
  const hasReorderCol = cells[0].querySelector('.drag-handle') !== null;
  const offset = hasReorderCol ? 1 : 0;
  
  const currentOperation = cells[offset].textContent.trim();
  const currentWorkstation = cells[offset + 1].textContent.trim();
  const currentTime = cells[offset + 2].textContent.trim();
  const currentPlant = cells[offset + 3].textContent.trim();
  // Skip qty columns - they are readonly (offset + 4 and offset + 5)
  
  // Fetch options
  const operationOptions = await getOperationOptions();
  const workstationOptions = await getWorkstationOptions();
  const plantOptions = await getPlantOptions();
  
  // Create operation dropdown
  let operationSelect = `<select class="form-select form-select-sm" id="edit_operation">`;
  operationOptions.forEach(opt => {
    const selected = opt === currentOperation ? 'selected' : '';
    operationSelect += `<option value="${opt}" ${selected}>${opt}</option>`;
  });
  operationSelect += `</select>`;
  
  // Create workstation dropdown
  let workstationSelect = `<select class="form-select form-select-sm" id="edit_workstation">`;
  workstationOptions.forEach(opt => {
    const selected = opt === currentWorkstation ? 'selected' : '';
    workstationSelect += `<option value="${opt}" ${selected}>${opt}</option>`;
  });
  workstationSelect += `</select>`;
  
  // Create plant floor dropdown
  let plantInput;
  if (plantOptions.length > 0) {
    plantInput = `<select class="form-select form-select-sm" id="edit_plant">
      <option value="">-- Select Plant Floor --</option>`;
    plantOptions.forEach(opt => {
      const selected = opt === currentPlant ? 'selected' : '';
      plantInput += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    plantInput += `</select>`;
  } else {
    plantInput = `<input type="text" class="form-control form-control-sm" id="edit_plant" value="${currentPlant}" placeholder="Enter plant floor">`;
  }
  
  // Replace editable cells with inputs
  cells[offset].innerHTML = operationSelect;
  cells[offset + 1].innerHTML = workstationSelect;
  cells[offset + 2].innerHTML = `<input type="number" class="form-control form-control-sm" id="edit_time" value="${currentTime}">`;
  cells[offset + 3].innerHTML = plantInput;
  // Leave qty columns unchanged (offset + 4 and offset + 5)
  
  // Replace action buttons
  cells[offset + 6].innerHTML = `
    <button class="btn btn-sm btn-success me-1" onclick="saveEditOperation('${operationName}', '${workOrderId}')">
      <i class="bi bi-check"></i> Save
    </button>
    <button class="btn btn-sm btn-secondary" onclick="cancelEditOperation('${workOrderId}')">
      <i class="bi bi-x"></i> Cancel
    </button>
  `;
}










async function saveEditOperation(operationName, workOrderId) {
  const operation = document.getElementById('edit_operation').value;
  const workstation = document.getElementById('edit_workstation').value;
  const time = document.getElementById('edit_time').value;
  const plant = document.getElementById('edit_plant').value;
  
  if (!operation) {
    alert('Operation name is required');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}?action=update_work_order_operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order: workOrderId,
        operation_name: operationName,
        operation: operation,
        workstation: workstation,
        time_in_mins: time,
        custom_plant: plant
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('Operation updated successfully!');
      // Reload operations
      const operations = await fetchWorkOrderOperations(workOrderId);
      const userEmail = localStorage.getItem("userEmail");
      const config = reportConfig[currentReportData.reportName] || {};
      const opPerms = config.operation_planning_permissions?.[userEmail] || {};
      renderOperationsTable(operations, opPerms, workOrderId);
    } else {
      console.error('Update failed:', data);
      alert('Error: ' + (data.message || 'Failed to update operation') + 
            (data.response ? '\nDetails: ' + JSON.stringify(data.response) : ''));
    }

  } catch (error) {
    alert('Error updating operation: ' + error.message);
  }
}









async function cancelEditOperation(workOrderId) {
  // Reload the table to cancel editing
  const operations = await fetchWorkOrderOperations(workOrderId);
  const userEmail = localStorage.getItem("userEmail");
  const config = reportConfig[currentReportData.reportName] || {};
  const opPerms = config.operation_planning_permissions?.[userEmail] || {};
  renderOperationsTable(operations, opPerms, workOrderId);
}












async function deleteOperation(operationName, workOrderId) {
  if (!confirm('Are you sure you want to delete this operation? This will also delete the linked job card.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}?action=delete_work_order_operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order: workOrderId,
        operation_name: operationName
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(data.message || 'Operation deleted successfully!');
      // Reload operations
      const operations = await fetchWorkOrderOperations(workOrderId);
      const userEmail = localStorage.getItem("userEmail");
      const config = reportConfig[currentReportData.reportName] || {};
      const opPerms = config.operation_planning_permissions?.[userEmail] || {};
      renderOperationsTable(operations, opPerms, workOrderId);
    } else {
      console.error('Delete failed:', data);
      alert('Error: ' + (data.message || 'Failed to delete operation'));
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Error deleting operation: ' + error.message);
  }
}









function enableOperationReordering(workOrderId) {
  const tbody = document.getElementById('operationsTableBody');
  
  let draggedRow = null;
  
  tbody.querySelectorAll('tr').forEach(row => {
    row.setAttribute('draggable', true);
    
    row.addEventListener('dragstart', (e) => {
      draggedRow = row;
      row.style.opacity = '0.5';
    });
    
    row.addEventListener('dragend', (e) => {
      row.style.opacity = '';
    });
    
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (draggedRow !== row) {
        const allRows = Array.from(tbody.querySelectorAll('tr'));
        const draggedIndex = allRows.indexOf(draggedRow);
        const targetIndex = allRows.indexOf(row);
        
        if (draggedIndex < targetIndex) {
          row.after(draggedRow);
        } else {
          row.before(draggedRow);
        }
        
        // Save new order to backend
        await saveOperationOrder(workOrderId);
      }
    });
  });
}




async function saveOperationOrder(workOrderId) {
  const tbody = document.getElementById('operationsTableBody');
  const rows = tbody.querySelectorAll('tr');
  const newOrder = Array.from(rows).map((row, index) => ({
    name: row.dataset.operationId,
    idx: index + 1
  }));
  
  try {
    const response = await fetch(`${API_BASE}?action=reorder_work_order_operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_order: workOrderId,
        operations_order: newOrder
      })
    });
    
        const data = await response.json();
        if (!data.success) {
          console.error('Reorder failed:', data);
          alert('Error saving order: ' + (data.message || 'Unknown error') + 
                (data.response ? '\nDetails: ' + JSON.stringify(data.response) : ''));
        }

  } catch (error) {
    alert('Error saving operation order: ' + error.message);
  }
}








// ==================== FIELD MAPPING UI FUNCTIONS ====================

function initFieldMappingsTab() {
    const reportSelect = document.getElementById('mappingReportSelect');
    if (!reportSelect) return;
    
    // Populate report dropdown
    reportSelect.innerHTML = '<option value="">-- Select Report --</option>';
    
    if (currentUser && currentUser.allowed_reports) {
        currentUser.allowed_reports.forEach(reportName => {
            const option = document.createElement('option');
            option.value = reportName;
            option.textContent = reportName;
            reportSelect.appendChild(option);
        });
    }
    
    // Handle report selection
    reportSelect.addEventListener('change', async (e) => {
        const reportName = e.target.value;
        if (!reportName) {
            document.getElementById('fieldMappingContainer').style.display = 'none';
            return;
        }
        
        await loadFieldMappingsForReport(reportName);
    });
    
    // Handle doctype change
    document.getElementById('changeDoctypeBtn')?.addEventListener('click', () => {
        const reportName = reportSelect.value;
        if (!reportName) return;
        
        const newDoctype = prompt('Enter DocType name:', reportConfig[reportName]?.doctype || 'Work Order');
        if (newDoctype) {
            if (!reportConfig[reportName]) {
                reportConfig[reportName] = {};
            }
            reportConfig[reportName].doctype = newDoctype;
            
            // Clear cache and reload
            delete doctypeFieldsCache[newDoctype];
            loadFieldMappingsForReport(reportName);
        }
    });
}






async function loadFieldMappingsForReport(reportName) {
    const container = document.getElementById('fieldMappingContainer');
    const mappingsList = document.getElementById('fieldMappingsList');
    const doctypeInput = document.getElementById('mappingDoctype');
    
    container.style.display = 'block';
    mappingsList.innerHTML = '<p class="text-center"><span class="spinner-border spinner-border-sm"></span> Loading...</p>';
    
    const config = reportConfig[reportName] || {};
    const doctype = config.doctype || 'Work Order';
    doctypeInput.value = doctype;
    
    console.log('🔄 Loading field mappings for:', reportName, 'DocType:', doctype);
    
    // Fetch ERP fields
    const erpFields = await fetchDoctypeFields(doctype);
    
    console.log('📦 Fetched ERP fields:', erpFields.length, 'fields');
    
    if (erpFields.length === 0) {
        mappingsList.innerHTML = `
            <div class="alert alert-danger">
                ❌ Failed to load fields from DocType "${doctype}". 
                Please check:
                <ul>
                    <li>DocType name is correct</li>
                    <li>API connection is working</li>
                    <li>Browser console for errors (F12)</li>
                </ul>
            </div>`;
        return;
    }
    
    // Get unmapped fields from current mapping
    const unmappedFields = config.unmapped_fields || [];
    const manualMappings = config.field_mappings || {};
    
    // Get all report columns if available
    let allReportFields = [];
    if (currentReportData && currentReportData.reportName === reportName) {
        allReportFields = currentReportData.columns.map(col => ({
            reportField: col.fieldname,
            label: col.label || col.fieldname
        }));
        console.log('✅ Using report columns:', allReportFields.length);
    } else {
        // Use unmapped fields only
        allReportFields = unmappedFields;
        console.log('⚠️ Report not loaded, using unmapped fields only:', allReportFields.length);
    }
    
    if (allReportFields.length === 0) {
        mappingsList.innerHTML = '<div class="alert alert-warning">📊 Please load the report first by clicking on it in the main view, then return here to configure mappings.</div>';
        return;
    }
    
    // Render mapping UI
    let html = '<div class="table-responsive"><table class="table table-sm table-bordered table-hover">';
    html += '<thead class="table-light"><tr><th>Report Field</th><th>Label</th><th>Maps To (ERP Field)</th><th>Status</th></tr></thead><tbody>';
    
    allReportFields.forEach(field => {
        const reportField = field.reportField;
        const label = field.label;
        const currentMapping = manualMappings[reportField];
        const fieldInfo = window.reportFieldMapping?.[reportField];
        
        let statusBadge = '';
        if (fieldInfo && fieldInfo.erpField) {
            statusBadge = '<span class="badge bg-success">✓ Mapped</span>';
        } else if (currentMapping) {
            statusBadge = '<span class="badge bg-info">Manual</span>';
        } else {
            statusBadge = '<span class="badge bg-warning">Unmapped</span>';
        }
        
        // Build options for this dropdown
        let optionsHtml = '<option value="">-- No Mapping --</option>';
        erpFields.forEach(f => {
            const selected = (currentMapping === f.fieldname || fieldInfo?.erpField === f.fieldname) ? 'selected' : '';
            const readOnlyMarker = f.read_only && !f.allow_on_submit ? '🔒' : '';
            optionsHtml += `<option value="${f.fieldname}" ${selected}>${readOnlyMarker} ${f.label || f.fieldname} (${f.fieldname})</option>`;
        });
        
        html += `<tr>
            <td><code class="text-danger">${reportField}</code></td>
            <td><strong>${label}</strong></td>
            <td>
                <select class="form-select form-select-sm field-mapping-select" data-report-field="${reportField}">
                    ${optionsHtml}
                </select>
            </td>
            <td>${statusBadge}</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    html += `
        <div class="d-flex justify-content-between align-items-center mt-3">
            <small class="text-muted">🔒 = Read-only field</small>
            <button class="btn btn-primary" id="saveMappingsBtn">💾 Save Mappings</button>
        </div>`;
    
    mappingsList.innerHTML = html;
    
    // Attach save handler
    document.getElementById('saveMappingsBtn').addEventListener('click', () => {
        saveMappingsForReport(reportName);
    });
}






async function saveMappingsForReport(reportName) {
    const selects = document.querySelectorAll('.field-mapping-select');
    const mappings = {};
    
    selects.forEach(select => {
        const reportField = select.dataset.reportField;
        const erpField = select.value;
        if (erpField) {
            mappings[reportField] = erpField;
        }
    });
    
    // Save to config
    if (!reportConfig[reportName]) {
        reportConfig[reportName] = {};
    }
    reportConfig[reportName].field_mappings = mappings;
    
    console.log('💾 Saving field mappings:', mappings);
    
    try {
        await saveReportConfig(reportConfig);
        alert('✅ Field mappings saved! Reloading report...');
        
        // Reload the report to apply new mappings
        await loadReport(reportName);
        
        // Refresh the mapping UI
        await loadFieldMappingsForReport(reportName);
        
    } catch (err) {
        alert('❌ Error saving: ' + err.message);
    }
}














// ========== MOBILE REORDER MODAL FUNCTIONS ==========

let currentMobileReorder = null;
let mobileSortableInstance = null; // Track the sortable instance

function openMobileReorderModal(reportName, primaryGroup, secondaryGroup) {
    console.log('Opening mobile reorder for:', reportName, primaryGroup, secondaryGroup);
    
    // Store current context
    currentMobileReorder = {
        reportName,
        primaryGroup,
        secondaryGroup
    };
    
    // Get cards in this group
    const config = reportConfig[reportName] || {};
    const grouped = currentReportData.grouped;
    
    if (!grouped || !grouped[primaryGroup] || !grouped[primaryGroup][secondaryGroup]) {
        alert('No cards found in this group');
        return;
    }
    
    let cards = grouped[primaryGroup][secondaryGroup];
    
    // Apply existing sort order if it exists
    const cardPriority = config.card_priority?.[primaryGroup]?.[secondaryGroup];
    if (cardPriority && Array.isArray(cardPriority)) {
        const titleField = config.title_field || "work_order_id";
        
        const getCardId = (row) => {
            const possibleIds = [
                row.name,
                row[titleField],
                row.work_order_id,
                row.sales_order_id,
                row.job_card,
                row.item_code,
                row.customer
            ];
            return possibleIds.find(id => id && id !== '') || '';
        };
        
        cards = [...cards].sort((a, b) => {
            const idA = getCardId(a);
            const idB = getCardId(b);
            
            const indexA = cardPriority.indexOf(idA);
            const indexB = cardPriority.indexOf(idB);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
        });
    }
    
    // Destroy previous Sortable instance
    if (mobileSortableInstance) {
        console.log('Destroying previous Sortable instance');
        mobileSortableInstance.destroy();
        mobileSortableInstance = null;
    }
    
    // Populate modal
    const listContainer = document.getElementById('mobileReorderList');
    listContainer.innerHTML = '';
    
    const titleField = config.title_field || "work_order_id";
    const cardFields = config.card_fields || [];
    
    cards.forEach(row => {
        const item = document.createElement('div');
        item.className = 'reorder-item';
        
        // Get card ID
        const possibleIds = [
            row.name,
            row[titleField],
            row.work_order_id,
            row.sales_order_id,
            row.job_card,
            row.item_code,
            row.customer
        ];
        const cardId = possibleIds.find(id => id && id !== '') || '';
        item.dataset.cardId = cardId;
        
        // Get title
        const title = row[titleField] || row.name || 'Card';
        
        // Get subtitle (first available card field)
        let subtitle = '';
        for (const field of cardFields) {
            if (row[field]) {
                subtitle = String(row[field]).substring(0, 50);
                break;
            }
        }
        
        item.innerHTML = `
            <div class="reorder-item-handle">☰</div>
            <div class="reorder-item-content">
                <div class="reorder-item-title">${title}</div>
                ${subtitle ? `<div class="reorder-item-subtitle">${subtitle}</div>` : ''}
            </div>
        `;
        
        listContainer.appendChild(item);
    });
    
    // Create NEW Sortable instance and store it
    mobileSortableInstance = new Sortable(listContainer, {
        animation: 150,
        delay: 200,
        delayOnTouchOnly: true,
        
        // Better mobile scroll settings
        scroll: true,
        forceAutoScrollFallback: true,
        scrollSensitivity: 60,
        scrollSpeed: 15,
        bubbleScroll: true,
        
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.reorder-item-handle',
        
        swapThreshold: 0.65,
        
        onStart: function() {
            if (navigator.vibrate) navigator.vibrate(10);
        },
        
        onEnd: function() {
            if (navigator.vibrate) navigator.vibrate(10);
        }
    });
    
    // Get or create modal properly
    const modalElement = document.getElementById('mobileReorderModal');
    let modal = bootstrap.Modal.getInstance(modalElement);
    
    // If modal instance exists, dispose it first
    if (modal) {
        modal.dispose();
    }
    
    // Create fresh modal instance
    modal = new bootstrap.Modal(modalElement);
    
    // Show modal
    modal.show();
    
    // Reset and clone save button
    const saveBtn = document.getElementById('saveMobileReorder');
    const newSaveBtn = saveBtn.cloneNode(true);
    
    // Reset button state
    newSaveBtn.disabled = false;
    newSaveBtn.textContent = 'Save Order';
    newSaveBtn.className = 'btn btn-primary'; // Reset to original classes
    
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    // Add the save handler
    newSaveBtn.addEventListener('click', async function() {
        console.log('💾 Save button clicked!');
        
        if (!currentMobileReorder) {
            console.error('No currentMobileReorder data');
            return;
        }
        
        const listContainer = document.getElementById('mobileReorderList');
        const items = Array.from(listContainer.querySelectorAll('.reorder-item'));
        const newOrder = items.map(item => item.dataset.cardId).filter(id => id);
        
        console.log('Saving mobile reorder:', newOrder);
        
        // Disable button while saving
        newSaveBtn.disabled = true;
        newSaveBtn.textContent = 'Saving...';
        
        try {
            const result = await saveCardPriority(
                currentMobileReorder.reportName,
                currentMobileReorder.primaryGroup,
                currentMobileReorder.secondaryGroup,
                newOrder
            );
            
            console.log('Save result:', result);
            
            if (result.success) {
                // Update local config
                if (!reportConfig[currentMobileReorder.reportName]) {
                    reportConfig[currentMobileReorder.reportName] = {};
                }
                if (!reportConfig[currentMobileReorder.reportName].card_priority) {
                    reportConfig[currentMobileReorder.reportName].card_priority = {};
                }
                if (!reportConfig[currentMobileReorder.reportName].card_priority[currentMobileReorder.primaryGroup]) {
                    reportConfig[currentMobileReorder.reportName].card_priority[currentMobileReorder.primaryGroup] = {};
                }
                reportConfig[currentMobileReorder.reportName].card_priority[currentMobileReorder.primaryGroup][currentMobileReorder.secondaryGroup] = newOrder;
                
                // Reset button
                newSaveBtn.textContent = '✅ Saved!';
                newSaveBtn.classList.remove('btn-primary');
                newSaveBtn.classList.add('btn-success');
                
                // Success feedback
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                
                // ========== COMPLETE CLEANUP AND RELOAD ==========
                // 1. Destroy Sortable first
                if (mobileSortableInstance) {
                    mobileSortableInstance.destroy();
                    mobileSortableInstance = null;
                }
                
                // 2. Hide and dispose modal
                modal.hide();
                
                // 3. Wait for modal to close, then do full cleanup
                setTimeout(async () => {
                    modal.dispose();
                    
                    // 4. Force reset all scrolling
                    forceResetScroll();
                    
                    // 5. Reload the report
                    console.log('Reloading report...');
                    await loadReport(currentMobileReorder.reportName);
                    console.log('✅ Report reloaded - new order applied');
                    
                    // 6. Final scroll check after a short delay
                    setTimeout(() => {
                        forceResetScroll();
                        console.log('✅ Final scroll check complete');
                    }, 100);
                    
                }, 400);
                // ========== END CLEANUP ==========
                
            } else {
                alert('❌ Failed to save order: ' + (result.error || 'Unknown error'));
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'Save Order';
            }
        } catch (error) {
            console.error('Error saving mobile reorder:', error);
            alert('❌ Error saving order: ' + error.message);
            newSaveBtn.disabled = false;
            newSaveBtn.textContent = 'Save Order';
        }
    });
    
    // Clean up when modal is closed with X or Cancel
    modalElement.addEventListener('hidden.bs.modal', function cleanup() {
        console.log('Modal closed - cleaning up');
        if (mobileSortableInstance) {
            mobileSortableInstance.destroy();
            mobileSortableInstance = null;
        }
        // Force scroll reset
        forceResetScroll();
        // Remove this listener to prevent memory leaks
        modalElement.removeEventListener('hidden.bs.modal', cleanup);
    });
}

// ========== END MOBILE REORDER MODAL FUNCTIONS ==========
