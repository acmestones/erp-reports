'use strict';

// PDF Export Module - Completely separate from main script
const PDFExportModule = (function() {
    
    // Company details (edit these)
    const COMPANY_INFO = {
        name: 'Your Company Name',        // ← EDIT THIS
        website: 'www.yourwebsite.com',   // ← EDIT THIS
        email: 'info@yourwebsite.com'     // ← EDIT THIS
    };
    
    // State
    let selectedAttributes = ['sku', 'label']; // Default selections
    let exportModal = null;
    
    // Initialize module
    function init() {
        console.log('PDFExportModule initialized');
        createExportModal();
        setupEventListeners();
        setupExportButton();
    }
    
    // Setup export button
    function setupExportButton() {
        const btn = document.getElementById('exportPdfBtn');
        if (btn) {
            btn.addEventListener('click', showExportModal);
        }
    }
    
    // Create the export configuration modal
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
                                    <!-- Checkboxes will be inserted here -->
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
                                <strong>Note:</strong> Each product takes ~1 page. Large catalogs may take time to generate.
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
    
    // Setup event listeners
    function setupEventListeners() {
        const generateBtn = document.getElementById('generatePdfBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', handleGeneratePdf);
        }
    }
    
    // Show export modal
    function showExportModal() {
        console.log('showExportModal called');
        console.log('window.allProducts:', window.allProducts ? window.allProducts.length + ' products' : 'NOT FOUND');
        console.log('window.filteredProducts:', window.filteredProducts ? window.filteredProducts.length + ' products' : 'NOT FOUND');
        
        // Get available attributes from ALL products (not just filtered)
        const allAttrs = discoverAttributesFromAllProducts();
        console.log('Discovered attributes:', allAttrs);
        
        populateAttributeCheckboxes(allAttrs);
        exportModal.show();
    }
    
    // Discover attributes from ALL products in the system
    function discoverAttributesFromAllProducts() {
        const attrs = new Set();
        
        // Use window.allProducts which contains ALL products loaded from Plytix
        const productsToScan = window.allProducts || [];
        
        console.log('Scanning ' + productsToScan.length + ' products for attributes...');
        
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
                    if (key !== 'thumbnail' && key !== 'images' && key !== 'assets' && key !== 'categories') {
                        attrs.add(key);
                    }
                });
            }
        });
        
        console.log('Total unique attributes discovered:', attrs.size);
        return Array.from(attrs).sort();
    }
    
    // Populate checkboxes in modal
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
        
        // Add listeners to checkboxes
        document.querySelectorAll('.export-attr-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedAttributes);
        });
    }
    
    // Update selected attributes
    function updateSelectedAttributes() {
        selectedAttributes = Array.from(
            document.querySelectorAll('.export-attr-checkbox:checked')
        ).map(cb => cb.value);
        console.log('Selected attributes:', selectedAttributes);
    }
    
    // Generate PDF
    function handleGeneratePdf() {
        updateSelectedAttributes();
        
        if (!selectedAttributes || selectedAttributes.length === 0) {
            alert('Please select at least one attribute');
            return;
        }
        
        // Use window.filteredProducts which is the current filter result
        const productsToExport = window.filteredProducts || [];
        
        console.log('Filtered products available:', productsToExport.length);
        
        if (!productsToExport || productsToExport.length === 0) {
            alert('No products to export. Apply filters first or wait for products to load.');
            return;
        }
        
        const orientation = document.getElementById('pdfOrientation').value;
        
        console.log(`Generating PDF with ${productsToExport.length} products...`);
        
        // Use jsPDF
        generatePdfWithJsPdf(productsToExport, selectedAttributes, orientation);
    }
    
    // Generate PDF using jsPDF library
    function generatePdfWithJsPdf(products, attributes, orientation) {
        if (typeof window.jsPDF === 'undefined') {
            alert('jsPDF library not loaded. Please ensure jsPDF is included in your HTML.');
            console.error('jsPDF not available at window.jsPDF');
            return;
        }
        
        const { jsPDF } = window;
        const pageFormat = orientation === 'landscape' ? ['A4', 'l'] : ['A4', 'p'];
        const pdf = new jsPDF(...pageFormat);
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        
        let currentPage = 1;
        let yPosition = margin;
        
        // Add header on first page
        addPdfHeader(pdf, pageWidth, pageHeight, margin);
        yPosition += 25; // Space after header
        
        // Process each product
        products.forEach((product, index) => {
            const requiredHeight = getProductHeightRequired(product, attributes, contentWidth);
            
            // Check if we need new page
            if (yPosition + requiredHeight > pageHeight - margin - 30) {
                pdf.addPage(...pageFormat);
                currentPage++;
                yPosition = margin;
                addPdfHeader(pdf, pageWidth, pageHeight, margin);
                yPosition += 25;
            }
            
            // Draw product
            yPosition = drawProductInPdf(pdf, product, attributes, margin, yPosition, contentWidth);
            yPosition += 10; // Space between products
        });
        
        // Add footer on all pages
        addPdfFooter(pdf, pageWidth, pageHeight);
        
        // Save PDF
        const filename = `products-export-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
        
        console.log(`PDF generated successfully: ${filename}`);
        alert(`PDF generated successfully!\n\nFilename: ${filename}\n\nProducts exported: ${products.length}`);
        
        // Close modal
        exportModal.hide();
    }
    
    // Add company header to PDF page
    function addPdfHeader(pdf, pageWidth, pageHeight, margin) {
        const headerHeight = 20;
        
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
        pdf.text(`${COMPANY_INFO.website} | ${COMPANY_INFO.email}`, margin, 17);
        
        // Reset colors
        pdf.setTextColor(0, 0, 0);
    }
    
    // Add company footer to PDF page
    function addPdfFooter(pdf, pageWidth, pageHeight) {
        const footerHeight = 10;
        const footerY = pageHeight - footerHeight;
        
        // Background
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, footerY, pageWidth, footerHeight, 'F');
        
        // Footer text
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        
        const pageNum = pdf.internal.getNumberOfPages();
        
        pdf.text(COMPANY_INFO.website, 15, footerY + 5);
        pdf.text(`Page ${pageNum}`, pageWidth - 25, footerY + 5);
    }
    
    // Draw single product in PDF
    function drawProductInPdf(pdf, product, attributes, margin, yPos, contentWidth) {
        const imageSize = 60; // 60x60 in PDF (scales from 400x400)
        const imageX = margin;
        const imageY = yPos;
        const textX = imageX + imageSize + 10;
        const textWidth = contentWidth - imageSize - 10;
        
        let currentY = yPos;
        
        // Draw image
        const thumbnailUrl = getThumbnailUrl(product);
        if (thumbnailUrl) {
            try {
                pdf.addImage(thumbnailUrl, 'JPEG', imageX, imageY, imageSize, imageSize);
            } catch (e) {
                // If image fails, draw placeholder
                pdf.setDrawColor(200);
                pdf.rect(imageX, imageY, imageSize, imageSize);
                pdf.setFontSize(8);
                pdf.text('No Image', imageX + 5, imageY + 30);
            }
        } else {
            // Draw placeholder
            pdf.setDrawColor(200);
            pdf.rect(imageX, imageY, imageSize, imageSize);
            pdf.setFontSize(8);
            pdf.text('No Image', imageX + 5, imageY + 30);
        }
        
        // Draw attribute text
        currentY = imageY;
        pdf.setFontSize(10);
        
        attributes.forEach(attr => {
            const value = getAttributeValue(product, attr);
            
            if (value) {
                const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                
                // Truncate long values
                const maxChars = 50;
                const truncated = displayValue.length > maxChars 
                    ? displayValue.substring(0, maxChars) + '...' 
                    : displayValue;
                
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.text(`${label}:`, textX, currentY);
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(8);
                
                // Word wrap for long values
                const splitText = pdf.splitTextToSize(truncated, textWidth - 10);
                pdf.text(splitText, textX + 40, currentY);
                
                currentY += (splitText.length * 4) + 2;
            }
        });
        
        // Draw divider line
        const maxY = Math.max(imageY + imageSize, currentY);
        pdf.setDrawColor(200);
        pdf.line(margin, maxY + 5, margin + contentWidth, maxY + 5);
        
        return maxY + 5;
    }
    
    // Calculate required height for product
    function getProductHeightRequired(product, attributes, contentWidth) {
        return 60 + (attributes.length * 8);
    }
    
    // Get attribute value from product
    function getAttributeValue(product, attrName) {
        if (attrName === 'sku') return product.sku;
        if (attrName === 'label') return product.label;
        
        if (product.attributes && product.attributes[attrName]) {
            return product.attributes[attrName];
        }
        
        return null;
    }
    
    // Get thumbnail URL
    function getThumbnailUrl(product) {
        if (product.thumbnail && product.thumbnail.url) {
            return product.thumbnail.url;
        }
        
        if (product.thumbnail && product.thumbnail.thumbnail) {
            return product.thumbnail.thumbnail;
        }
        
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0].url || product.images[0].thumbnail;
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
