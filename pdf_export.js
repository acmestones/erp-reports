'use strict';

/**
 * PDF Export Module - Completely separate from main script
 */
const PDFExportModule = (function() {
    
    // Company details (edit these)
    const COMPANY_INFO = {
        name: 'Your Company Name', // EDIT THIS
        website: 'www.yourwebsite.com', // EDIT THIS
        email: 'info@yourwebsite.com' // EDIT THIS
    };
    
    // State
    let selectedAttributes = ['sku', 'label']; // Default selections
    let attributeOrder = []; // FIX #6: Track custom order
    let exportModal = null;
    
    /**
     * Initialize module
     */
    function init() {
        console.log('PDFExportModule initialized');
        createExportModal();
        setupEventListeners();
        setupExportButton();
    }
    
    /**
     * Setup export button
     */
    function setupExportButton() {
        const btn = document.getElementById('exportPdfBtn');
        if (btn) {
            btn.addEventListener('click', showExportModal);
        }
    }
    
    /**
     * Create the export configuration modal
     */
    function createExportModal() {
        const modalHTML = `
            <div class="modal fade" id="exportPdfModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Export Filtered Products to PDF</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label"><strong>Select Attributes to Include</strong></label>
                                <div class="text-muted small mb-2">✋ Drag to reorder how attributes appear in PDF</div>
                                <div id="attributeCheckboxes" class="border p-3" style="max-height: 300px; overflow-y: auto;">
                                    <!-- Checkboxes will be inserted here -->
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label"><strong>Page Orientation</strong></label>
                                <select id="pdfOrientation" class="form-select">
                                    <option value="portrait">Portrait</option>
                                    <option value="landscape">Landscape</option>
                                </select>
                            </div>
                            
                            <div class="alert alert-info small">
                                <strong>Note:</strong> Each product takes 1 page. Large catalogs may take time to generate.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="generatePdfBtn">Generate PDF</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div);
        
        exportModal = new bootstrap.Modal(document.getElementById('exportPdfModal'));
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const generateBtn = document.getElementById('generatePdfBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', handleGeneratePdf);
        }
    }
    
    /**
     * Show export modal
     */
    function showExportModal() {
        // Get available attributes from ALL products (not just filtered)
        const allAttrs = discoverAttributesFromAllProducts();
        console.log('Discovered attributes:', allAttrs);
        
        populateAttributeCheckboxes(allAttrs);
        exportModal.show();
    }
    
    /**
     * FIX #5: Discover attributes from ALL products, excluding image attributes
     */
    function discoverAttributesFromAllProducts() {
        const attrs = new Set();
        const productsToScan = window.allProducts;
        
        console.log('Scanning', productsToScan?.length || 0, 'products for attributes...');
        
        if (!productsToScan || productsToScan.length === 0) {
            console.warn('No products available to discover attributes');
            return ['sku', 'label'];
        }
        
        productsToScan.forEach(product => {
            // Add basic attributes
            attrs.add('sku');
            attrs.add('label');
            
            // Add custom attributes from all products
            if (product.attributes && typeof product.attributes === 'object') {
                Object.keys(product.attributes).forEach(key => {
                    // Skip non-attribute keys
                    if (key === 'thumbnail' || key === 'assets' || key === 'categories') {
                        return;
                    }
                    
                    // FIX #5: Skip image attributes (arrays with url/thumbnail)
                    const value = product.attributes[key];
                    if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                        console.log(`Skipping image attribute: ${key}`);
                        return; // This is an image attribute, skip it
                    }
                    
                    attrs.add(key);
                });
            }
        });
        
        console.log('Total unique attributes discovered (excluding images):', attrs.size);
        return Array.from(attrs).sort();
    }
    
    /**
     * FIX #6: Populate checkboxes with drag-and-drop reordering
     */
    function populateAttributeCheckboxes(attributes) {
        const container = document.getElementById('attributeCheckboxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Initialize order if empty or add new attributes
        if (attributeOrder.length === 0) {
            attributeOrder = [...attributes];
        } else {
            // Add any new attributes that weren't in the previous order
            attributes.forEach(attr => {
                if (!attributeOrder.includes(attr)) {
                    attributeOrder.push(attr);
                }
            });
        }
        
        attributeOrder.forEach((attr, index) => {
            const isChecked = selectedAttributes.includes(attr);
            const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
            
            const div = document.createElement('div');
            div.className = 'form-check p-2 mb-1 bg-light rounded';
            div.draggable = true;
            div.dataset.attr = attr;
            div.dataset.index = index;
            div.style.cursor = 'move';
            div.style.transition = 'background-color 0.2s';
            
            div.innerHTML = `
                <span class="me-2" style="cursor:move; user-select: none;">☰</span>
                <input class="form-check-input export-attr-checkbox" type="checkbox" value="${attr}" id="exportAttr_${attr}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="exportAttr_${attr}" style="cursor: pointer;">${label}</label>
            `;
            
            // FIX #6: Drag events
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragenter', handleDragEnter);
            div.addEventListener('dragleave', handleDragLeave);
            
            container.appendChild(div);
        });
        
        // Add listeners to checkboxes
        document.querySelectorAll('.export-attr-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedAttributes);
        });
    }
    
    // FIX #6: Drag-and-drop handlers
    let draggedElement = null;
    
    function handleDragStart(e) {
        draggedElement = this;
        this.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
    }
    
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }
    
    function handleDragEnter(e) {
        if (this !== draggedElement) {
            this.style.backgroundColor = '#d1ecf1';
        }
    }
    
    function handleDragLeave(e) {
        this.style.backgroundColor = '';
    }
    
    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        this.style.backgroundColor = '';
        
        if (draggedElement !== this) {
            const allItems = Array.from(this.parentNode.children);
            const draggedIndex = allItems.indexOf(draggedElement);
            const targetIndex = allItems.indexOf(this);
            
            if (draggedIndex < targetIndex) {
                this.parentNode.insertBefore(draggedElement, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedElement, this);
            }
            
            // Update order array
            updateAttributeOrder();
        }
        
        return false;
    }
    
    function handleDragEnd(e) {
        this.style.opacity = '1';
        // Remove all backgrounds
        document.querySelectorAll('#attributeCheckboxes .form-check').forEach(el => {
            el.style.backgroundColor = '';
        });
    }
    
    function updateAttributeOrder() {
        const container = document.getElementById('attributeCheckboxes');
        attributeOrder = Array.from(container.children).map(div => div.dataset.attr);
        console.log('New attribute order:', attributeOrder);
    }
    
    /**
     * Update selected attributes
     */
    function updateSelectedAttributes() {
        selectedAttributes = Array.from(
            document.querySelectorAll('.export-attr-checkbox:checked')
        ).map(cb => cb.value);
        console.log('Selected attributes:', selectedAttributes);
    }
    
    /**
     * Generate PDF
     */
    function handleGeneratePdf() {
        updateSelectedAttributes();
        
        if (!selectedAttributes || selectedAttributes.length === 0) {
            alert('Please select at least one attribute');
            return;
        }
        
        const productsToExport = window.filteredProducts;
        
        if (!productsToExport || productsToExport.length === 0) {
            alert('No products to export. Apply filters first or wait for products to load.');
            return;
        }
        
        const orientation = document.getElementById('pdfOrientation').value;
        
        console.log(`Generating PDF with ${productsToExport.length} products...`);
        console.log('Attribute order:', attributeOrder);
        console.log('Selected attributes:', selectedAttributes);
        
        // Use jsPDF
        generatePdfWithJsPdf(productsToExport, selectedAttributes, orientation);
    }
    
    /**
     * Generate PDF using jsPDF library
     * FIXES #1, #2, #3, #4: Spacing, thumbnail size, compression, clickable links
     */
    function generatePdfWithJsPdf(products, attributes, orientation) {
        if (typeof window.jsPDF === 'undefined') {
            alert('jsPDF library not loaded. Please ensure jsPDF is included in your HTML.');
            console.error('jsPDF not available at window.jsPDF');
            return;
        }
        
       const jsPDF = window.jsPDF;
        const pageFormat = orientation === 'landscape' ? ['a4', 'l'] : ['a4', 'p'];
        const pdf = new jsPDF(...pageFormat);
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        
        let currentPage = 1;
        let yPosition = margin;
        
        // Add header on first page
        addPdfHeader(pdf, pageWidth, pageHeight, margin);
        yPosition = 30; // Space after header
        
        // Process each product
        products.forEach((product, index) => {
            // Get all image attributes for this product
            const productImageAttrs = getProductImageAttributes(product, attributes);
            
            const requiredHeight = getProductHeightRequired(product, attributes, contentWidth, productImageAttrs);
            
            // Check if we need new page
            if (yPosition + requiredHeight > pageHeight - margin - 30) {
                pdf.addPage(...pageFormat);
                currentPage++;
                yPosition = margin;
                addPdfHeader(pdf, pageWidth, pageHeight, margin);
                yPosition = 30;
            }
            
            // Draw product
            yPosition = drawProductInPdf(pdf, product, attributes, margin, yPosition, contentWidth, productImageAttrs);
            yPosition += 15; // Space between products
        });
        
        // Add footer on all pages
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            addPdfFooter(pdf, pageWidth, pageHeight, i, totalPages);
        }
        
        // Save PDF
        const filename = `products-export-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
        
        console.log('PDF generated successfully:', filename);
        alert(`PDF generated successfully!\n\nFilename: ${filename}\nProducts: ${products.length}\nPages: ${totalPages}`);
        
        // Close modal
        exportModal.hide();
    }
    
    /**
     * FIX #5: Get image attributes that are selected for this product
     */
    function getProductImageAttributes(product, selectedAttrs) {
        const imageAttrs = [];
        
        if (!product.attributes) return imageAttrs;
        
        // Check each selected attribute
        selectedAttrs.forEach(attr => {
            const value = product.attributes[attr];
            // Check if it's an image array
            if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                imageAttrs.push({
                    name: attr,
                    images: value
                });
            }
        });
        
        return imageAttrs;
    }
    
    /**
     * Add company header to PDF page
     */
    function addPdfHeader(pdf, pageWidth, pageHeight, margin) {
        const headerHeight = 22;
        
        // Background
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');
        
        // Company name
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(COMPANY_INFO.name, margin, 12);
        
        // Website
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${COMPANY_INFO.website} | ${COMPANY_INFO.email}`, margin, 18);
        
        // Reset colors
        pdf.setTextColor(0, 0, 0);
    }
    
    /**
     * Add company footer to PDF page
     */
    function addPdfFooter(pdf, pageWidth, pageHeight, pageNum, totalPages) {
        const footerHeight = 10;
        const footerY = pageHeight - footerHeight;
        
        // Background
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, footerY, pageWidth, footerHeight, 'F');
        
        // Footer text
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        
        pdf.text(COMPANY_INFO.website, 15, footerY + 6);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 35, footerY + 6);
        
        // Reset
        pdf.setTextColor(0, 0, 0);
    }
    
    /**
     * Draw single product in PDF
     * FIXES #1, #2, #3, #4
     */
    function drawProductInPdf(pdf, product, attributes, margin, yPos, contentWidth, imageAttrs) {
        const mainImageSize = 60; // Main product image
        const imageX = margin;
        const imageY = yPos;
        const textX = imageX + mainImageSize + 10;
        const textWidth = contentWidth - mainImageSize - 10;
        
        let currentY = yPos;
        
        // Draw main product image with FIX #3: compression
        const thumbnailUrl = getThumbnailUrl(product);
        if (thumbnailUrl) {
            try {
                // FIX #3: Use JPEG with MEDIUM compression (reduces file size)
                pdf.addImage(thumbnailUrl, 'JPEG', imageX, imageY, mainImageSize, mainImageSize, undefined, 'MEDIUM');
            } catch (e) {
                console.error('Failed to add image:', e);
                drawImagePlaceholder(pdf, imageX, imageY, mainImageSize, mainImageSize);
            }
        } else {
            drawImagePlaceholder(pdf, imageX, imageY, mainImageSize, mainImageSize);
        }
        
        // Draw text attributes (using the custom order from FIX #6)
        currentY = imageY;
        pdf.setFontSize(10);
        
        // Use attributeOrder to maintain custom order, but only include selected attributes
        const orderedAttrs = attributeOrder.filter(attr => attributes.includes(attr));
        
        orderedAttrs.forEach(attr => {
            // Skip image attributes here - they'll be drawn separately below
            const value = product.attributes ? product.attributes[attr] : null;
            if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                return; // Skip image attributes in text section
            }
            
            const attrValue = getAttributeValue(product, attr);
            
            if (attrValue) {
                const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
                const displayValue = Array.isArray(attrValue) ? attrValue.join(', ') : String(attrValue);
                
                // Truncate long values
                const maxChars = 60;
                const truncated = displayValue.length > maxChars 
                    ? displayValue.substring(0, maxChars) + '...' 
                    : displayValue;
                
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.text(`${label}:`, textX, currentY);
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(8);
                
                // Word wrap for long values
                const splitText = pdf.splitTextToSize(truncated, textWidth - 45);
                pdf.text(splitText, textX + 42, currentY);
                
                currentY += (splitText.length * 4) + 2;
            }
        });
        
        // Ensure we're below the main image
        currentY = Math.max(imageY + mainImageSize + 5, currentY);
        
        // FIX #1, #2, #4: Draw image attributes if selected
        if (imageAttrs.length > 0) {
            currentY += 5; // FIX #1: Extra spacing before image attributes
            
            imageAttrs.forEach(imgAttr => {
                // FIX #1: Add spacing above each image attribute section
                currentY += 3;
                
                // Draw attribute name
                const attrLabel = imgAttr.name.charAt(0).toUpperCase() + imgAttr.name.slice(1).replace(/_/g, ' ');
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.text(`${attrLabel}:`, margin, currentY);
                currentY += 5;
                
                // FIX #2: Draw thumbnails at 50x50 (increased from smaller size)
                const thumbSize = 50; // FIX #2: Increased thumbnail size
                const thumbGap = 5;
                const thumbsPerRow = Math.floor(contentWidth / (thumbSize + thumbGap));
                let thumbX = margin;
                let thumbY = currentY;
                let thumbCount = 0;
                
                imgAttr.images.forEach(img => {
                    const imgUrl = img.thumbnail || img.url;
                    if (imgUrl) {
                        try {
                            // FIX #3: Compress thumbnail images
                            pdf.addImage(imgUrl, 'JPEG', thumbX, thumbY, thumbSize, thumbSize, undefined, 'MEDIUM');
                            
                            // FIX #4: Add clickable link to full resolution image
                            if (img.url) {
                                pdf.link(thumbX, thumbY, thumbSize, thumbSize, { url: img.url });
                            }
                        } catch (e) {
                            console.error('Failed to add thumbnail:', e);
                            drawImagePlaceholder(pdf, thumbX, thumbY, thumbSize, thumbSize);
                        }
                        
                        thumbCount++;
                        thumbX += thumbSize + thumbGap;
                        
                        // Move to next row if needed
                        if (thumbCount % thumbsPerRow === 0) {
                            thumbX = margin;
                            thumbY += thumbSize + thumbGap;
                        }
                    }
                });
                
                // Update currentY to after the last row of thumbnails
                currentY = thumbY + (thumbCount % thumbsPerRow !== 0 ? thumbSize + thumbGap : 0);
                currentY += 5; // FIX #1: Spacing after image section
            });
        }
        
        // Draw divider line
        pdf.setDrawColor(200);
        pdf.line(margin, currentY, margin + contentWidth, currentY);
        
        return currentY + 2;
    }
    
    /**
     * Draw placeholder for missing images
     */
    function drawImagePlaceholder(pdf, x, y, width, height) {
        pdf.setDrawColor(200);
        pdf.setFillColor(245, 245, 245);
        pdf.rect(x, y, width, height, 'FD');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('No Image', x + (width / 2), y + (height / 2), { align: 'center' });
        pdf.setTextColor(0, 0, 0);
    }
    
    /**
     * Calculate required height for product
     */
    function getProductHeightRequired(product, attributes, contentWidth, imageAttrs) {
        let height = 70; // Base height for main image + text attributes
        
        // Add height for image attributes
        imageAttrs.forEach(imgAttr => {
            const thumbSize = 50;
            const thumbGap = 5;
            const thumbsPerRow = Math.floor(contentWidth / (thumbSize + thumbGap));
            const rows = Math.ceil(imgAttr.images.length / thumbsPerRow);
            height += 15 + (rows * (thumbSize + thumbGap)); // Label + thumbnails
        });
        
        return height;
    }
    
    /**
     * Get attribute value from product
     */
    function getAttributeValue(product, attrName) {
        if (attrName === 'sku') return product.sku;
        if (attrName === 'label') return product.label;
        if (product.attributes && product.attributes[attrName]) {
            const value = product.attributes[attrName];
            // Return simple values, not image arrays
            if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                return null; // Skip image arrays
            }
            return value;
        }
        return null;
    }
    
    /**
     * Get thumbnail URL for main product image
     */
    function getThumbnailUrl(product) {
        if (product.thumbnail && product.thumbnail.url) return product.thumbnail.url;
        if (product.thumbnail && product.thumbnail.thumbnail) return product.thumbnail.thumbnail;
        if (Array.isArray(product.assets) && product.assets.length > 0) {
            return product.assets[0].url || product.assets[0].thumbnail;
        }
        if (product.attributes && Array.isArray(product.attributes.images) && product.attributes.images.length > 0) {
            return product.attributes.images[0].url || product.attributes.images[0].thumbnail;
        }
        return null;
    }
    
    // Public API
    return {
        init: init,
        setCompanyInfo: function(name, website, email) {
            COMPANY_INFO.name = name;
            COMPANY_INFO.website = website;
            COMPANY_INFO.email = email;
        }
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    PDFExportModule.init();
});
