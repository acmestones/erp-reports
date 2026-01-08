'use strict';

// PDF Export Module
const PDFExportModule = (function() {
    
    const COMPANY_INFO = {
        name: 'Acme Stonemart',
        website: 'www.acmestones.com',
        email: 'info@acmestones.com'
    };
    
    let selectedAttributes = ['sku', 'label'];
    let exportModal = null;
    
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
                    if (key !== 'thumbnail' && key !== 'images' && key !== 'assets' && key !== 'categories') {
                        attrs.add(key);
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
        generatePdfWithJsPdf(productsToExport, selectedAttributes, orientation);
    }
    
    function generatePdfWithJsPdf(products, attributes, orientation) {
        // THE FIX: Check for jsPDF correctly
        let jsPDF;
        
        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
            // UMD build (lowercase)
            jsPDF = window.jspdf.jsPDF;
        } else if (typeof window.jsPDF !== 'undefined') {
            // Global build
            jsPDF = window.jsPDF;
        } else {
            alert('jsPDF library not loaded. Please refresh the page and try again.');
            console.error('jsPDF not available. Checked window.jspdf.jsPDF and window.jsPDF');
            console.log('Available on window:', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));
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
        
        products.forEach((product, index) => {
            const requiredHeight = 70;
            
            if (yPosition + requiredHeight > pageHeight - margin - 30) {
                pdf.addPage();
                yPosition = margin;
                addPdfHeader(pdf, pageWidth, pageHeight, margin);
                yPosition += 25;
            }
            
            yPosition = drawProductInPdf(pdf, product, attributes, margin, yPosition, contentWidth);
            yPosition += 10;
        });
        
        addPdfFooter(pdf, pageWidth, pageHeight);
        
        const filename = `products-export-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
        
        alert(`PDF generated successfully!\n\nFilename: ${filename}\n\nProducts exported: ${products.length}`);
        exportModal.hide();
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
        const imageSize = 60;
        const imageX = margin;
        const imageY = yPos;
        const textX = imageX + imageSize + 10;
        
        let currentY = yPos;
        
        const thumbnailUrl = getThumbnailUrl(product);
        if (thumbnailUrl) {
            try {
                pdf.addImage(thumbnailUrl, 'JPEG', imageX, imageY, imageSize, imageSize);
            } catch (e) {
                pdf.setDrawColor(200);
                pdf.rect(imageX, imageY, imageSize, imageSize);
                pdf.setFontSize(8);
                pdf.text('No Image', imageX + 5, imageY + 30);
            }
        } else {
            pdf.setDrawColor(200);
            pdf.rect(imageX, imageY, imageSize, imageSize);
            pdf.setFontSize(8);
            pdf.text('No Image', imageX + 5, imageY + 30);
        }
        
        currentY = imageY + 5;
        
        attributes.forEach(attr => {
            const value = getAttributeValue(product, attr);
            
            if (value) {
                const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                const truncated = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;
                
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.text(`${label}:`, textX, currentY);
                
                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(8);
                pdf.text(truncated, textX + 40, currentY);
                
                currentY += 5;
            }
        });
        
        const maxY = Math.max(imageY + imageSize, currentY);
        pdf.setDrawColor(200);
        pdf.line(margin, maxY + 5, margin + contentWidth, maxY + 5);
        
        return maxY + 5;
    }
    
    function getAttributeValue(product, attrName) {
        if (attrName === 'sku') return product.sku;
        if (attrName === 'label') return product.label;
        
        if (product.attributes && product.attributes[attrName]) {
            return product.attributes[attrName];
        }
        
        return null;
    }
    
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
