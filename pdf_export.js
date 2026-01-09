'use strict';

// PDF Export Module - Enhanced Version with Layout Config Integration
const PDFExportModule = (function() {

    const COMPANY_INFO = {
        name: 'Acme Stones',
        website: 'www.acmestones.com',
        email: 'acmestones@gmail.com'
    };

    // Load saved selections from localStorage
    let selectedAttributes = JSON.parse(localStorage.getItem('pdfExportAttributes')) || ['sku', 'label'];
    let attributeOrder = JSON.parse(localStorage.getItem('pdfAttributeOrder')) || [];
    let selectedImageAttributes = JSON.parse(localStorage.getItem('pdfImageAttributes')) || [];
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
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Export Filtered Products to PDF</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <!-- LEFT COLUMN: AVAILABLE ATTRIBUTES -->
                                <div class="col-md-6">
                                    <label class="form-label"><strong>Available Attributes:</strong></label>
                                    <div id="availableAttributes" class="border p-3" style="max-height: 400px; overflow-y: auto; background-color: #f9f9f9;">
                                    </div>
                                </div>

                                <!-- RIGHT COLUMN: SELECTED ATTRIBUTES (WITH ORDER) -->
                                <div class="col-md-6">
                                    <label class="form-label"><strong>Selected for PDF (Ordered):</strong></label>
                                    <div id="selectedAttributesList" class="border p-3" style="max-height: 400px; overflow-y: auto; background-color: #fff; min-height: 300px;">
                                        <small class="text-muted">Click available attributes to add them here.</small>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-3 mb-3">
                                <label class="form-label"><strong>Page Orientation:</strong></label>
                                <select id="pdfOrientation" class="form-select">
                                    <option value="portrait">Portrait</option>
                                    <option value="landscape">Landscape</option>
                                </select>
                            </div>

                            <div class="alert alert-info small">
                                <strong>Note:</strong> Click attributes to add/remove them. Drag to reorder in the right panel.
                                <br><strong>Tip:</strong> Click the "PDF Layout" button to customize spacing and sizes!
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
        populateAttributeSelection(allAttrs);
        exportModal.show();
    }

    function discoverAttributesFromAllProducts() {
        const textAttrs = new Set();
        const imgAttrs = new Set();
        const productsToScan = window.allProducts || [];

        if (!productsToScan || productsToScan.length === 0) {
            return { text: ['sku', 'label'], images: [] };
        }

        productsToScan.forEach(product => {
            if (product.attributes && typeof product.attributes === 'object') {
                Object.keys(product.attributes).forEach(key => {
                    if (key !== 'thumbnail' && key !== 'categories') {
                        const value = product.attributes[key];
                        const isImageArray = Array.isArray(value) && value.length > 0 && 
                                           value[0] && (value[0].url || value[0].thumbnail);

                        if (isImageArray) {
                            imgAttrs.add(key);
                        } else {
                            textAttrs.add(key);
                        }
                    }
                });
            }
        });

        return {
            text: Array.from(textAttrs).sort(),
            images: Array.from(imgAttrs).sort()
        };
    }

    function populateAttributeSelection(allAttrs) {
        const availableContainer = document.getElementById('availableAttributes');
        const selectedContainer = document.getElementById('selectedAttributesList');

        if (!availableContainer || !selectedContainer) return;

        availableContainer.innerHTML = '';

        // TEXT ATTRIBUTES
        const allTextAttrs = allAttrs.text;

        if (allTextAttrs.length > 0) {
            const textSection = document.createElement('div');
            textSection.className = 'mb-3';

            const textTitle = document.createElement('small');
            textTitle.className = 'fw-bold text-secondary d-block mb-2';
            textTitle.textContent = 'TEXT ATTRIBUTES';
            textSection.appendChild(textTitle);

            allTextAttrs.forEach(attr => {
                const div = document.createElement('div');
                div.className = 'form-check mb-2';
                div.innerHTML = `
                    <input class="form-check-input available-attr-checkbox" type="checkbox" 
                           value="${attr}" data-type="text" id="availAttr_${attr}">
                    <label class="form-check-label cursor-pointer" for="availAttr_${attr}">
                        ${formatAttrLabel(attr)}
                    </label>
                `;
                textSection.appendChild(div);
            });

            availableContainer.appendChild(textSection);
        }

        // IMAGE ATTRIBUTES
        const allImageAttrs = allAttrs.images;

        if (allImageAttrs.length > 0) {
            const imgSection = document.createElement('div');
            imgSection.className = 'mb-3';

            const imgTitle = document.createElement('small');
            imgTitle.className = 'fw-bold text-secondary d-block mb-2';
            imgTitle.textContent = 'IMAGE ATTRIBUTES';
            imgSection.appendChild(imgTitle);

            allImageAttrs.forEach(attr => {
                const div = document.createElement('div');
                div.className = 'form-check mb-2';
                div.innerHTML = `
                    <input class="form-check-input available-attr-checkbox" type="checkbox" 
                           value="${attr}" data-type="image" id="availAttr_${attr}">
                    <label class="form-check-label cursor-pointer" for="availAttr_${attr}">
                        <i class="bi bi-images"></i> ${formatAttrLabel(attr)}
                    </label>
                `;
                imgSection.appendChild(div);
            });

            availableContainer.appendChild(imgSection);
        }

        updateSelectedAttributesList();

        document.querySelectorAll('.available-attr-checkbox').forEach(cb => {
            cb.addEventListener('change', handleAttributeSelection);
        });
    }

    function handleAttributeSelection(event) {
        const attr = event.target.value;
        const type = event.target.dataset.type;
        const isChecked = event.target.checked;

        if (isChecked) {
            if (!attributeOrder.includes(attr)) {
                attributeOrder.push(attr);
            }
            if (type === 'image' && !selectedImageAttributes.includes(attr)) {
                selectedImageAttributes.push(attr);
            }
        } else {
            attributeOrder = attributeOrder.filter(a => a !== attr);
            selectedImageAttributes = selectedImageAttributes.filter(a => a !== attr);
        }

        localStorage.setItem('pdfAttributeOrder', JSON.stringify(attributeOrder));
        localStorage.setItem('pdfImageAttributes', JSON.stringify(selectedImageAttributes));

        updateSelectedAttributesList();
    }

    function updateSelectedAttributesList() {
        const selectedContainer = document.getElementById('selectedAttributesList');
        if (!selectedContainer) return;

        selectedContainer.innerHTML = '';

        if (attributeOrder.length === 0) {
            selectedContainer.innerHTML = '<small class="text-muted">Click attributes on the left to add them here.</small>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'list-group';
        list.id = 'selectedAttrList';
        list.style.listStyle = 'none';
        list.style.padding = '0';

        attributeOrder.forEach((attr, index) => {
            const isImage = selectedImageAttributes.includes(attr);
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.draggable = true;
            li.dataset.attr = attr;
            li.dataset.index = index;

            const label = formatAttrLabel(attr);
            const badge = isImage ? '<span class="badge bg-info ms-2"><i class="bi bi-images"></i> Image</span>' : '';

            li.innerHTML = `
                <span><i class="bi bi-grip-vertical text-muted"></i> ${label} ${badge}</span>
                <button class="btn btn-sm btn-outline-danger remove-attr-btn" data-attr="${attr}" type="button">
                    <i class="bi bi-x"></i>
                </button>
            `;

            list.appendChild(li);
        });

        selectedContainer.appendChild(list);
        setupDragAndDrop();

        document.querySelectorAll('.remove-attr-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const attr = e.currentTarget.dataset.attr;
                attributeOrder = attributeOrder.filter(a => a !== attr);
                selectedImageAttributes = selectedImageAttributes.filter(a => a !== attr);

                const checkbox = document.querySelector(`#availAttr_${attr}`);
                if (checkbox) checkbox.checked = false;

                localStorage.setItem('pdfAttributeOrder', JSON.stringify(attributeOrder));
                localStorage.setItem('pdfImageAttributes', JSON.stringify(selectedImageAttributes));

                updateSelectedAttributesList();
            });
        });
    }

    function setupDragAndDrop() {
        const items = document.querySelectorAll('#selectedAttrList li');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.innerHTML);
                item.classList.add('opacity-50');
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (item !== e.target.closest('li')) {
                    item.style.borderTop = '2px solid #0d6efd';
                }
            });

            item.addEventListener('dragleave', (e) => {
                item.style.borderTop = '';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.style.borderTop = '';

                const draggedItem = document.querySelector('#selectedAttrList li.opacity-50');
                if (draggedItem && draggedItem !== item) {
                    const draggedAttr = draggedItem.dataset.attr;
                    const targetAttr = item.dataset.attr;

                    const draggedIndex = attributeOrder.indexOf(draggedAttr);
                    const targetIndex = attributeOrder.indexOf(targetAttr);

                    if (draggedIndex > -1 && targetIndex > -1) {
                        [attributeOrder[draggedIndex], attributeOrder[targetIndex]] = 
                        [attributeOrder[targetIndex], attributeOrder[draggedIndex]];

                        localStorage.setItem('pdfAttributeOrder', JSON.stringify(attributeOrder));
                        updateSelectedAttributesList();
                    }
                }
            });
        });
    }

    function formatAttrLabel(attr) {
        return attr.charAt(0).toUpperCase() + attr.slice(1).replace(/_/g, ' ');
    }

    function handleGeneratePdf() {
        if (!attributeOrder || attributeOrder.length === 0) {
            alert('Please select at least one attribute');
            return;
        }

        const productsToExport = window.filteredProducts || [];

        if (!productsToExport || productsToExport.length === 0) {
            alert('No products to export. Apply filters first or wait for products to load.');
            return;
        }

        const orientation = document.getElementById('pdfOrientation').value;

        exportModal.hide();
        showProgressModal(productsToExport.length);

        setTimeout(() => {
            generatePdfWithProgress(productsToExport, attributeOrder, selectedImageAttributes, orientation);
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
                                <button type="button" class="btn-close" id="closeProgressBtn" data-bs-dismiss="modal" style="display:none;"></button>
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

        const progressBar = document.getElementById('pdfProgressBar');
        const progressText = document.getElementById('pdfProgressText');
        const closeBtn = document.getElementById('closeProgressBtn');

        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
        }
        if (progressText) {
            progressText.textContent = 'Preparing export...';
        }
        if (closeBtn) {
            closeBtn.style.display = 'none';
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
            const closeBtn = document.getElementById('closeProgressBtn');
            if (closeBtn) {
                closeBtn.style.display = 'block';
            }

            const progressText = document.getElementById('pdfProgressText');
            if (progressText) {
                progressText.textContent = 'PDF Generated Successfully!';
            }
        }
    }

    // Generate PDF with progress updates
    function generatePdfWithProgress(products, attributes, imageAttributes, orientation) {
        let jsPDF;

        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
            jsPDF = window.jspdf.jsPDF;
        } else if (typeof window.jsPDF !== 'undefined') {
            jsPDF = window.jsPDF;
        } else {
            if (progressModal) progressModal.hide();
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
        const margin = PDFLayoutConfig.get('pageMargin'); // LAYOUT CONFIG
        const contentWidth = pageWidth - (2 * margin);

        let yPosition = margin;

        addPdfHeader(pdf, pageWidth, pageHeight, margin);
        yPosition += 25;

        let currentIndex = 0;
        const batchSize = 1;

        function processBatch() {
            const endIndex = Math.min(currentIndex + batchSize, products.length);

            for (let i = currentIndex; i < endIndex; i++) {
                const product = products[i];

                if (i > 0) {
                    pdf.addPage();
                    yPosition = margin;
                    addPdfHeader(pdf, pageWidth, pageHeight, margin);
                    yPosition += 25;
                }

                yPosition = drawProductInPdf(
                    pdf, product, attributes, imageAttributes, 
                    margin, yPosition, contentWidth, pageWidth, pageHeight
                );

                updateProgress(i + 1, products.length);
            }

            currentIndex = endIndex;

            if (currentIndex < products.length) {
                setTimeout(processBatch, 50);
            } else {
                addPdfFooter(pdf, pageWidth, pageHeight);
                const filename = `products-export-${new Date().toISOString().slice(0, 10)}.pdf`;
                pdf.save(filename);
                hideProgressModal();
            }
        }

        processBatch();
    }

    function addPdfHeader(pdf, pageWidth, pageHeight, margin) {
        const headerHeight = PDFLayoutConfig.get('headerHeight'); // LAYOUT CONFIG

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

    function calculateProportionalDimensions(pdf, imageUrl, maxWidth, maxHeight) {
        try {
            const imgProps = pdf.getImageProperties(imageUrl);
            const imgWidth = imgProps.width;
            const imgHeight = imgProps.height;

            let finalWidth = maxWidth;
            let finalHeight = (imgHeight / imgWidth) * maxWidth;

            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = (imgWidth / imgHeight) * maxHeight;
            }

            return { width: finalWidth, height: finalHeight };
        } catch (e) {
            console.error('Error calculating image dimensions:', e);
            return { width: maxWidth, height: maxWidth };
        }
    }

    function drawProductInPdf(pdf, product, attributes, imageAttributes, margin, yPos, contentWidth, pageWidth, pageHeight) {
        let currentY = yPos;
        const footerMargin = PDFLayoutConfig.get('pageFooterMargin'); // LAYOUT CONFIG
        const maxPageY = pageHeight - footerMargin;

        // ========== PRODUCT TITLE (LABEL) ==========
        pdf.setFontSize(PDFLayoutConfig.get('productLabelFontSize')); // LAYOUT CONFIG
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 0);

        const productLabel = product.label || 'Product';
        const splitLabel = pdf.splitTextToSize(productLabel, contentWidth);
        pdf.text(splitLabel, margin, currentY);
        currentY += (splitLabel.length * 6) + PDFLayoutConfig.get('spaceAfterProductLabel'); // LAYOUT CONFIG

        // ========== PRODUCT SKU ==========
        pdf.setFontSize(PDFLayoutConfig.get('skuFontSize')); // LAYOUT CONFIG
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`SKU: ${product.sku || 'N/A'}`, margin, currentY);
        currentY += PDFLayoutConfig.get('spaceAfterSKU'); // LAYOUT CONFIG

        // ========== MAIN IMAGE ==========
        const mainImageUrl = getThumbnailUrl(product);
        const maxImageWidth = PDFLayoutConfig.get('mainImageMaxWidth'); // LAYOUT CONFIG
        const maxImageHeight = PDFLayoutConfig.get('mainImageMaxHeight'); // LAYOUT CONFIG

        const imageX = margin;
        let imageSectionY = currentY;

        if (mainImageUrl) {
            try {
                const dims = calculateProportionalDimensions(pdf, mainImageUrl, maxImageWidth, maxImageHeight);
                pdf.addImage(mainImageUrl, 'JPEG', imageX, imageSectionY, dims.width, dims.height);
                pdf.link(imageX, imageSectionY, dims.width, dims.height, { url: mainImageUrl });
                imageSectionY += dims.height + PDFLayoutConfig.get('spaceAfterMainImage'); // LAYOUT CONFIG
            } catch (e) {
                console.error('Error adding main image:', e);
                pdf.setDrawColor(200);
                pdf.rect(imageX, imageSectionY, maxImageWidth, maxImageHeight);
                pdf.setFontSize(8);
                pdf.setTextColor(150);
                pdf.text('No Image', imageX + 15, imageSectionY + 28);
                pdf.setTextColor(0);
                imageSectionY += maxImageHeight + PDFLayoutConfig.get('spaceAfterMainImage'); // LAYOUT CONFIG
            }
        } else {
            pdf.setDrawColor(200);
            pdf.rect(imageX, imageSectionY, maxImageWidth, maxImageHeight);
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text('No Image', imageX + 15, imageSectionY + 28);
            pdf.setTextColor(0);
            imageSectionY += maxImageHeight + PDFLayoutConfig.get('spaceAfterMainImage'); // LAYOUT CONFIG
        }

        // ========== IMAGE ATTRIBUTES (Left Column) ==========
        let leftColMaxY = imageSectionY;

        imageAttributes.forEach((imgAttrName) => {
            if (imageSectionY + 20 > maxPageY) {
                pdf.addPage();
                imageSectionY = margin + 25;
                addPdfHeader(pdf, pageWidth, pageHeight, margin);
                imageSectionY += 15;
            }

            const imageArrays = getImageArrayForAttribute(product, imgAttrName);
            if (!imageArrays || imageArrays.length === 0) return;

            // Attribute name heading
            pdf.setFontSize(PDFLayoutConfig.get('imageAttrLabelFontSize')); // LAYOUT CONFIG
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(0, 0, 0);
            imageSectionY += PDFLayoutConfig.get('spaceBeforeImageAttrLabel'); // LAYOUT CONFIG
            const attrLabel = formatAttrLabel(imgAttrName);
            pdf.text(attrLabel + ':', imageX, imageSectionY);
            imageSectionY += PDFLayoutConfig.get('spaceAfterImageAttrLabel'); // LAYOUT CONFIG

            // Draw thumbnails
            const thumbMaxWidth = PDFLayoutConfig.get('thumbnailMaxWidth'); // LAYOUT CONFIG
            const thumbMaxHeight = PDFLayoutConfig.get('thumbnailMaxHeight'); // LAYOUT CONFIG
            const thumbSpacing = PDFLayoutConfig.get('thumbnailHorizontalSpacing'); // LAYOUT CONFIG
            let thumbX = imageX;
            let thumbRowY = imageSectionY;
            let maxThumbHeightInRow = 0;

            imageArrays.forEach((img) => {
                if (thumbX + thumbMaxWidth > imageX + 70) {
                    thumbX = imageX;
                    thumbRowY += maxThumbHeightInRow + PDFLayoutConfig.get('thumbnailVerticalSpacing'); // LAYOUT CONFIG
                    maxThumbHeightInRow = 0;
                }

                try {
                    const imgUrl = img.url || img.thumbnail;
                    const thumbDims = calculateProportionalDimensions(pdf, imgUrl, thumbMaxWidth, thumbMaxHeight);

                    pdf.addImage(imgUrl, 'JPEG', thumbX, thumbRowY, thumbDims.width, thumbDims.height);
                    pdf.link(thumbX, thumbRowY, thumbDims.width, thumbDims.height, { url: imgUrl });

                    maxThumbHeightInRow = Math.max(maxThumbHeightInRow, thumbDims.height);
                } catch (e) {
                    pdf.setDrawColor(200);
                    pdf.rect(thumbX, thumbRowY, thumbMaxWidth, thumbMaxHeight);
                    maxThumbHeightInRow = Math.max(maxThumbHeightInRow, thumbMaxHeight);
                }

                thumbX += thumbSpacing;
            });

            imageSectionY = thumbRowY + maxThumbHeightInRow + PDFLayoutConfig.get('spaceAfterThumbnailRow'); // LAYOUT CONFIG
            leftColMaxY = imageSectionY;
        });

        // ========== RIGHT COLUMN: TEXT ATTRIBUTES ==========
        const rightColX = margin + maxImageWidth + PDFLayoutConfig.get('spaceBetweenColumns'); // LAYOUT CONFIG
        const rightColWidth = contentWidth - maxImageWidth - PDFLayoutConfig.get('spaceBetweenColumns'); // LAYOUT CONFIG
        let rightColY = currentY;

        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);

        const textAttributes = attributes.filter(attr => {
            return !imageAttributes.includes(attr) && attr !== 'sku' && attr !== 'label';
        });

        textAttributes.forEach(attr => {
            const value = getAttributeValue(product, attr);

            if (value && rightColY + 15 < maxPageY) {
                const label = formatAttrLabel(attr);
                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);

                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(PDFLayoutConfig.get('textAttrLabelFontSize')); // LAYOUT CONFIG
                pdf.text(`${label}:`, rightColX, rightColY);
                rightColY += PDFLayoutConfig.get('spaceBetweenTextAttrLabelAndValue'); // LAYOUT CONFIG

                pdf.setFont(undefined, 'normal');
                pdf.setFontSize(PDFLayoutConfig.get('textAttrValueFontSize')); // LAYOUT CONFIG

                const splitText = pdf.splitTextToSize(displayValue, rightColWidth);
                pdf.text(splitText, rightColX, rightColY);

                rightColY += (splitText.length * 5) + PDFLayoutConfig.get('spaceBetweenTextAttributes'); // LAYOUT CONFIG
            }
        });

        currentY = Math.max(leftColMaxY, rightColY) + PDFLayoutConfig.get('spaceBeforeNextProduct'); // LAYOUT CONFIG

        return currentY;
    }

    function getImageArrayForAttribute(product, attrName) {
        if (!product.attributes || !product.attributes[attrName]) {
            return [];
        }

        const value = product.attributes[attrName];

        if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
            return value;
        }

        return [];
    }

    function getAttributeValue(product, attrName) {
        if (attrName === 'sku') return product.sku;
        if (attrName === 'label') return product.label;

        if (product.attributes && product.attributes[attrName]) {
            const value = product.attributes[attrName];

            if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].url || value[0].thumbnail)) {
                return null;
            }

            return value;
        }

        return null;
    }

    function getThumbnailUrl(product) {
        if (product.thumbnail && product.thumbnail.url) {
            return product.thumbnail.url;
        }

        if (product.thumbnail && typeof product.thumbnail === 'string') {
            return product.thumbnail;
        }

        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0].url || product.images[0].thumbnail || product.images[0];
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
