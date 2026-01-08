'use strict';

// PDF Export Module
const PDFExportModule = (function() {
    
    const COMPANY_INFO = {
        name: 'Acme Stonemart',
        website: 'www.acmestones.com',
        email: 'info@acmestones.com'
    };
    
    // Load saved selections from localStorage
    let selectedAttributes = JSON.parse(localStorage.getItem('pdfExportAttributes')) || ['sku', 'label'];
    let exportModal = null;
    let progressModal = null;
    
    function init() {
        console.log('PDFExportModule initialized');
        createExportModal();
        setupEventListeners();
        setupExportButton();
    }
    
    function setupExportButton() {
        const btn = document.getElementById('exportPdfBtn');
        if (btn) {
            btn.addEventListener('click', showExportModal);
        }
    }
    
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
                                <label class="form-label"><strong>Select Attributes to Include:</strong></label>
                                <div id="attributeCheckboxes" class="border p-3" style="max-height: 300px; overflow-y: auto;">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label"><strong>Page Orientation:</strong></label>
                                <select id="pdfOrientation" class="form-select">
                                    <option value="portrait">Portrait</option>
                                    <option value="landscape">Landscape</option>
                                </select>
                            </div>
                            <div class="alert alert-info small">
                                <strong>Note:</strong> Your attribute selection will be saved for next time.
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
        
        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div);
        
        exportModal = new bootstrap.Modal(document.getElementById('exportPdfModal'));
    }
    
    function setupEventListeners() {
        const generateBtn = document.getElementById('generatePdfBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', handleGeneratePdf);
        }
    }
    
    function showExportModal() {
        const allAttrs = discoverAttributesFromAllProducts();
        populateAttributeCheckboxes(allAttrs);
        exportModal.show();
    }
    
    function discoverAttributesFromAllProducts() {
        const attrs = new Set();
        const productsToScan = window.allProducts || [];
        
        if (!productsToScan || productsToScan.length === 0) {
            return ['sku', 'label'];
        }
        
        productsToScan.forEach(product => {
            attrs.add('sku');
            attrs.add('label');
            
            if (product.attributes && typeof product.attributes === 'object') {
                Object.keys(product.attributes).forEach(key => {
                    // Exclude image attributes from main attribute list
                    if (key !== 'thumbnail' && key !== 'images' && key !== 'assets' && key !== 'categories') {
                        const value = product.attributes[key];
                        // Check if it's an image array
                        const isImageArray = Array.isArray(value) && value.length > 0 && 
                                           value[0] && (value[0].url || value[0].thumbnail);
                        if (!isImageArray) {
                            attrs.add(key);
                        }
                    }
                });
            }
        });
        
        return Array.from(attrs).sort();
    }
    
    function populateAttributeCheckboxes(attributes) {
        const container = document.getElementById('attributeCheckboxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        attributes.forEach(attr => {
            const isChecked = selectedAttributes.includes(attr);
            const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
            
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input export-attr-checkbox" type="checkbox" 
                       value="${attr}" id="exportAttr_${attr}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="exportAttr_${attr}">
                    ${label}
                </label>
            `;
            container.appendChild(div);
        });
        
        document.querySelectorAll('.export-attr-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedAttributes);
        });
    }
    
    function updateSelectedAttributes() {
        selectedAttributes = Array.from(
            document.querySelectorAll('.export-attr-checkbox:checked')
        ).map(cb => cb.value);
        
        // Save to localStorage for next time
        localStorage.setItem('pdfExportAttributes', JSON.stringify(selectedAttributes));
    }
    
    function handleGeneratePdf() {
        updateSelectedAttributes();
        
        if (!selectedAttributes || selectedAttributes.length === 0) {
            alert('Please select at least one attribute');
            return;
        }
        
        const productsToExport = window.filteredProducts || [];
        
        if (!productsToExport || productsToExport.length === 0) {
            alert('No products to export. Apply filters first or wait for products to load.');
            return;
        }
        
        const orientation = document.getElementById('pdfOrientation').value;
        
        // Hide export modal
        exportModal.hide();
        
        // Show progress modal
        showProgressModal(productsToExport.length);
        
        // Generate PDF with progress updates (slight delay to show modal)
        setTimeout(() => {
            generatePdfWithProgress(productsToExport, selectedAttributes, orientation);
        }, 100);
    }
    
    // Progress Modal Functions
    function showProgressModal(totalProducts) {
        if (!document.getElementById('pdfProgressModal')) {
            const modalHTML = `
                <div class="modal fade" id="pdfProgressModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Generating PDF...</h5>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <div class="progress" style="height: 30px;">
                                        <div id="pdfProgressBar" class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                                             role="progressbar" style="width: 0%">0%</div>
                                    </div>
                                </div>
                                <div class="text-center">
                                    <p id="pdfProgressText" class="mb-0">Preparing export...</p>
                                    <small class="text-muted">Please wait, this may take a minute...</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const div = document.createElement('div');
            div.innerHTML = modalHTML;
            document.body.appendChild(div);
        }
        
        // Reset progress
        const progressBar = document.getElementById('pdfProgressBar');
        const progressText = document.getElementById('pdfProgressText');
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }
        if (progressText) {
            progressText.textContent = 'Preparing export...';
        }
        
        progressModal = new bootstrap.Modal(document.getElementById('pdfProgressModal'));
        progressModal.show();
    }
    
    function updateProgress(current, total) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = document.getElementById('pdfProgressBar');
        const progressText = document.getElementById('pdfProgressText');
        
        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.textContent = percentage + '%';
        }
        
        if (progressText) {
            progressText.textContent = `Processing product ${current} of ${total}...`;
        }
    }
    
    function hideProgressModal() {
        if (progressModal) {
            progressModal.hide();
        }
    }
    
    // Generate PDF with progress updates
    function generatePdfWithProgress(products, attributes, orientation) {
        let jsPDF;
        
        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else if (typeof window.jsPDF !== 'undefined') {
            jsPDF = window.jsPDF;
        } else {
            hideProgressModal();
            alert('jsPDF library not loaded. Please refresh the page and try again.');
            return;
        }
        
        const pdf = new jsPDF({
            orientation: orientation === 'landscape' ? 'l' : 'p',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        
        let yPosition = margin;
        
        addPdfHeader(pdf, pageWidth, pageHeight, margin);
        yPosition += 25;
        
        let currentIndex = 0;
        const batchSize = 5; // Process 5 products at a time for smoother progress
        
        function processBatch() {
            const endIndex = Math.min(currentIndex + batchSize, products.length);
            
            for (let i = currentIndex; i < endIndex; i++) {
                const product = products[i];
                
                // Calculate required height for this product (1 product per page)
                const requiredHeight = 150; // Increased for better spacing
                
                if (yPosition + requiredHeight > pageHeight - margin - 30 || i > 0) {
                    // New page for each product (except first)
                    if (i > 0) {
                        pdf.addPage();
                        yPosition = margin;
                        addPdfHeader(pdf, pageWidth, pageHeight, margin);
                        yPosition += 25;
                    }
                }
                
                yPosition = drawProductInPdf(pdf, product, attributes, margin, yPosition, contentWidth);
                
                updateProgress(i + 1, products.length);
            }
            
            currentIndex = endIndex;
            
            if (currentIndex < products.length) {
                // Process next batch after a short delay (allows UI to update)
                setTimeout(processBatch, 50);
            } else {
                // All products processed
                addPdfFooter(pdf, pageWidth, pageHeight);
                
                const filename = `products-export-${new Date().toISOString().slice(0, 10)}.pdf`;
                pdf.save(filename);
                
                hideProgressModal();
                alert(`PDF generated successfully!\n\nFilename: ${filename}\n\nProducts exported: ${products.length}`);
            }
        }
        
        // Start processing
        processBatch();
    }
    
    function addPdfHeader(pdf, pageWidth, pageHeight, margin) {
        const headerHeight = 20;
        
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');
        
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(COMPANY_INFO.name, margin, 12);
        
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${COMPANY_INFO.website} | ${COMPANY_INFO.email}`, margin, 17);
        
        pdf.setTextColor(0, 0, 0);
    }
    
    function addPdfFooter(pdf, pageWidth, pageHeight) {
        const totalPages = pdf.internal.pages.length - 1;
        
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            const footerY = pageHeight - 10;
            
            pdf.setFillColor(240, 240, 240);
            pdf.rect(0, footerY, pageWidth, 10, 'F');
            
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(100, 100, 100);
            
            pdf.text(COMPANY_INFO.website, 15, footerY + 5);
            pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 35, footerY + 5);
        }
    }
    
    function drawProductInPdf(pdf, product, attributes, margin, yPos, contentWidth) {
        let currentY = yPos;
        
        // Main product image - maintain aspect ratio with max dimension of 400px equivalent
        const mainImageUrl = getThumbnailUrl(product);
        const mainImageMaxSize = 80; // 80mm ≈ 300px at 96dpi
        
        if (mainImageUrl) {
            try {
                // Create a temporary image to get dimensions
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                
                // For now, use square format (we'd need to load image to get true dimensions)
                // In practice, most product images are close to square
                const imageWidth = mainImageMaxSize;
                const imageHeight = mainImageMaxSize;
                
                pdf.addImage(mainImageUrl, 'JPEG', margin, currentY, imageWidth, imageHeight);
                currentY += imageHeight + 10;
            } catch (e) {
                console.error('Error adding main image:', e);
                // Draw placeholder
                pdf.setDrawColor(200);
                pdf.rect(margin, currentY, mainImageMaxSize, mainImageMaxSize);
                pdf.setFontSize(8);
                pdf.text('No Image', margin + 30, currentY + 40);
                currentY += mainImageMaxSize + 10;
            }
        } else {
            // Placeholder
            pdf.setDrawColor(200);
            pdf.rect(margin, currentY, mainImageMaxSize, mainImageMaxSize);
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text('No Image Available', margin + 20, currentY + 40);
            pdf.setTextColor(0);
            currentY += mainImageMaxSize + 10;
        }
        
        // Collect and display image attributes under main image
        const imageAttributes = getImageAttributes(product);
        if (imageAttributes.length > 0) {
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'bold');
            pdf.text('Additional Images:', margin, currentY);
            currentY += 7;
            
            const thumbSize = 15; // Small thumbnail size
            const thumbSpacing = 18;
            let thumbX = margin;
            
            imageAttributes.forEach((imgAttr, index) => {
                if (imgAttr.images && imgAttr.images.length > 0) {
                    // Draw up to 4 thumbnails per attribute
                    imgAttr.images.slice(0, 4).forEach((img, imgIndex) => {
                        if (thumbX + thumbSize > margin + contentWidth) {
                            // New row
                            thumbX = margin;
                            currentY += thumbSpacing;
                        }
                        
                        try {
                            pdf.addImage(img.thumbnail || img.url, 'JPEG', thumbX, currentY, thumbSize, thumbSize);
                            
                            // Add link annotation (makes it clickable in PDF)
                            pdf.link(thumbX, currentY, thumbSize, thumbSize, { url: img.url });
                        } catch (e) {
                            pdf.setDrawColor(200);
                            pdf.rect(thumbX, currentY, thumbSize, thumbSize);
                        }
                        
                        thumbX += thumbSpacing;
                    });
                    
                    if (imgAttr.images.length > 4) {
                        pdf.setFontSize(7);
                        pdf.text(`+${imgAttr.images.length - 4} more`, thumbX, currentY + 7);
                    }
                }
            });
            
            currentY += thumbSpacing + 5;
        }
        
        // Draw text attributes
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        
        attributes.forEach(attr => {
            const value = getAttributeValue(product, attr);
            
            if (value) {
                const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                
                // Word wrap for long values
                const maxWidth = contentWidth - 50;
                
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.text(`${label}:`, margin, currentY);
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(8);
                
                const splitText = pdf.splitTextToSize(displayValue, maxWidth);
                pdf.text(splitText, margin + 45, currentY);
                
                currentY += (splitText.length * 4) + 2;
            }
        });
        
        return currentY;
    }
    
    function getImageAttributes(product) {
        const imageAttrs = [];
        
        if (product.attributes && typeof product.attributes === 'object') {
            Object.keys(product.attributes).forEach(key => {
                const value = product.attributes[key];
                
                // Check if it's an array of image objects
                if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                    imageAttrs.push({
                        name: key,
                        images: value
                    });
                }
            });
        }
        
        return imageAttrs;
    }
    
    function getAttributeValue(product, attrName) {
        if (attrName === 'sku') return product.sku;
        if (attrName === 'label') return product.label;
        
        if (product.attributes && product.attributes[attrName]) {
            const value = product.attributes[attrName];
            
            // Skip image arrays
            if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                return null;
            }
            
            return value;
        }
        
        return null;
    }
    
    function getThumbnailUrl(product) {
        // Try to get the best quality thumbnail
        if (product.thumbnail && product.thumbnail.url) {
            return product.thumbnail.url;
        }
        
        if (product.thumbnail && product.thumbnail.thumbnail) {
            return product.thumbnail.thumbnail;
        }
        
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0].url || product.images[0].thumbnail;
        }
        
        if (product.attributes) {
            if (product.attributes.images && Array.isArray(product.attributes.images) && product.attributes.images.length > 0) {
                return product.attributes.images[0].url || product.attributes.images[0].thumbnail;
            }
        }
        
        return null;
    }
    
    return {
        init: init,
        setCompanyInfo: function(name, website, email) {
            COMPANY_INFO.name = name;
            COMPANY_INFO.website = website;
            COMPANY_INFO.email = email;
        }
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    PDFExportModule.init();
});
