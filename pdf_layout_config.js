'use strict';

/**
 * PDF Layout Configuration Module
 * 
 * Centralized control for all PDF layout spacing and sizing.
 * Users can adjust via UI without touching code.
 * All settings are saved to localStorage automatically.
 */
const PDFLayoutConfig = (function() {
    
    // DEFAULT LAYOUT CONFIGURATION
    const DEFAULT_CONFIG = {
        // PAGE SETTINGS
        pageMargin: 15,
        pageFooterMargin: 30,
        headerHeight: 20,
        spaceAfterHeader: 5, // Space between header and first product label
        
        // MAIN IMAGE SETTINGS
        mainImageMaxWidth: 60,
        mainImageMaxHeight: 60,
        
        // THUMBNAIL SETTINGS
        thumbnailMaxWidth: 16,
        thumbnailMaxHeight: 16,
        thumbnailHorizontalSpacing: 18,
        thumbnailVerticalSpacing: 2,
        
        // SPACING SETTINGS (in mm)
        spaceAfterProductLabel: 3,           // Space after product name/label
        spaceAfterSKU: 7,                    // Space after SKU, before main image
        spaceAfterMainImage: 8,              // Space after main image
        spaceBeforeImageAttrLabel: 10,       // Space BEFORE image attribute label
        spaceAfterImageAttrLabel: 4,         // Space AFTER image attribute label, before thumbnails
        spaceAfterThumbnailRow: 2,           // Space after last thumbnail row of attribute
        spaceBeforeNextProduct: 5,           // Space before next product (if any)
        spaceBetweenColumns: 8,              // Horizontal space between left and right columns
        spaceBetweenTextAttrLabelAndValue: 5, // Space between text attribute label and value
        spaceBetweenTextAttributes: 5,       // Space after text attribute value (before next attribute)
        
        // FONT SETTINGS
        productLabelFontSize: 16,
        skuFontSize: 9,
        imageAttrLabelFontSize: 9,
        textAttrLabelFontSize: 10,
        textAttrValueFontSize: 9,
        
        // COLUMN LAYOUT
        leftColumnWidthMM: 70,               // Width for image attributes column
        
        // ORIENTATION
        defaultOrientation: 'portrait'
    };
    
    // Load config from localStorage or use defaults
    let config = JSON.parse(localStorage.getItem('pdfLayoutConfig')) || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    let layoutModal = null;
    
    function init() {
        console.log('PDFLayoutConfig initialized');
        createLayoutModal();
        setupLayoutButton();
    }
    
    function setupLayoutButton() {
        // Check if button exists, if not, create one
        let btn = document.getElementById('pdfLayoutBtn');
        if (!btn) {
            const exportBtn = document.getElementById('exportPdfBtn');
            if (exportBtn && exportBtn.parentNode) {
                btn = document.createElement('button');
                btn.id = 'pdfLayoutBtn';
                btn.className = 'btn btn-secondary me-2';
                btn.innerHTML = '<i class="bi bi-sliders"></i> PDF Layout';
                btn.style.display = 'none';
                exportBtn.parentNode.insertBefore(btn, exportBtn);
            }
        }
        
        if (btn) {
            btn.addEventListener('click', showLayoutModal);
        }
    }
    
    function createLayoutModal() {
        if (document.getElementById('pdfLayoutModal')) {
            return; // Already exists
        }
        
        const modalHTML = `
            <div class="modal fade" id="pdfLayoutModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">PDF Layout Configuration</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <!-- LEFT COLUMN: SPACING SETTINGS -->
                                <div class="col-md-6">
                                    <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-arrows-expand"></i> <strong>Spacing (mm)</strong></h6>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space after Product Label</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceAfterProductLabel" min="0" max="20" step="1">
                                        <small class="text-muted">Gap between product name and SKU</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space after SKU</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceAfterSKU" min="0" max="20" step="1">
                                        <small class="text-muted">Gap between SKU and main image</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space after Main Image</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceAfterMainImage" min="0" max="20" step="1">
                                        <small class="text-muted">Gap after main product image</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space before Image Attr Label</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceBeforeImageAttrLabel" min="0" max="30" step="1">
                                        <small class="text-muted">Gap before "Application Images:" label</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space after Image Attr Label</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceAfterImageAttrLabel" min="0" max="15" step="1">
                                        <small class="text-muted">Gap between label and thumbnails</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space between Thumbnail Rows</label>
                                        <input type="number" class="form-control layout-input" data-key="thumbnailVerticalSpacing" min="0" max="10" step="1">
                                        <small class="text-muted">Vertical gap between thumbnail rows</small>
                                    </div>
                                </div>
                                
                                <!-- RIGHT COLUMN: SIZE SETTINGS -->
                                <div class="col-md-6">
                                    <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-aspect-ratio"></i> <strong>Sizes & Spacing</strong></h6>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Thumbnail Width (mm)</label>
                                        <input type="number" class="form-control layout-input" data-key="thumbnailMaxWidth" min="5" max="40" step="1">
                                        <small class="text-muted">Width of thumbnail images</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Thumbnail Height (mm)</label>
                                        <input type="number" class="form-control layout-input" data-key="thumbnailMaxHeight" min="5" max="40" step="1">
                                        <small class="text-muted">Height of thumbnail images</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space between Thumbnails (H)</label>
                                        <input type="number" class="form-control layout-input" data-key="thumbnailHorizontalSpacing" min="5" max="30" step="1">
                                        <small class="text-muted">Horizontal gap between thumbnails</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Main Image Width (mm)</label>
                                        <input type="number" class="form-control layout-input" data-key="mainImageMaxWidth" min="30" max="100" step="5">
                                        <small class="text-muted">Max width of main product image</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Main Image Height (mm)</label>
                                        <input type="number" class="form-control layout-input" data-key="mainImageMaxHeight" min="30" max="100" step="5">
                                        <small class="text-muted">Max height of main product image</small>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Space between Columns (H)</label>
                                        <input type="number" class="form-control layout-input" data-key="spaceBetweenColumns" min="2" max="20" step="1">
                                        <small class="text-muted">Gap between image and text columns</small>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="row mt-4">
                                <div class="col-12">
                                    <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-type"></i> <strong>Font Sizes (pt)</strong></h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label class="form-label">Product Label Font Size</label>
                                                <input type="number" class="form-control layout-input" data-key="productLabelFontSize" min="10" max="32" step="1">
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Image Attr Label Font Size</label>
                                                <input type="number" class="form-control layout-input" data-key="imageAttrLabelFontSize" min="8" max="16" step="1">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="mb-3">
                                                <label class="form-label">Text Attr Label Font Size</label>
                                                <input type="number" class="form-control layout-input" data-key="textAttrLabelFontSize" min="8" max="16" step="1">
                                            </div>
                                            <div class="mb-3">
                                                <label class="form-label">Text Attr Value Font Size</label>
                                                <input type="number" class="form-control layout-input" data-key="textAttrValueFontSize" min="8" max="14" step="1">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" id="resetLayoutBtn">Reset to Defaults</button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="applyLayoutBtn">Apply Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div);
        
        layoutModal = new bootstrap.Modal(document.getElementById('pdfLayoutModal'));
        setupLayoutEventListeners();
    }
    
    function setupLayoutEventListeners() {
        // Populate inputs with current config
        document.querySelectorAll('.layout-input').forEach(input => {
            const key = input.dataset.key;
            if (config[key] !== undefined) {
                input.value = config[key];
            }
        });
        
        // Apply changes button
        const applyBtn = document.getElementById('applyLayoutBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyLayoutChanges);
        }
        
        // Reset button
        const resetBtn = document.getElementById('resetLayoutBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetLayoutToDefaults);
        }
        
        // Real-time update as user types
        document.querySelectorAll('.layout-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                const value = parseFloat(e.target.value);
                config[key] = value;
                saveConfig();
            });
        });
    }
    
    function showLayoutModal() {
        // Refresh input values before showing
        document.querySelectorAll('.layout-input').forEach(input => {
            const key = input.dataset.key;
            if (config[key] !== undefined) {
                input.value = config[key];
            }
        });
        layoutModal.show();
    }
    
    function applyLayoutChanges() {
        document.querySelectorAll('.layout-input').forEach(input => {
            const key = input.dataset.key;
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                config[key] = value;
            }
        });
        
        saveConfig();
        
        // Show success message
        alert('Layout settings saved! They will apply to the next PDF export.');
        layoutModal.hide();
    }
    
    function resetLayoutToDefaults() {
        if (confirm('Reset all layout settings to defaults?')) {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveConfig();
            setupLayoutEventListeners(); // Refresh inputs
            alert('Layout settings reset to defaults!');
        }
    }
    
    function saveConfig() {
        localStorage.setItem('pdfLayoutConfig', JSON.stringify(config));
        console.log('Layout config saved:', config);
    }
    
    // PUBLIC API - These are used by pdf_export.js
    return {
        init: init,
        
        // Get a specific config value
        get: function(key) {
            return config[key] !== undefined ? config[key] : DEFAULT_CONFIG[key];
        },
        
        // Get entire config object
        getAll: function() {
            return JSON.parse(JSON.stringify(config)); // Return deep copy
        },
        
        // Reset to defaults
        resetDefaults: function() {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveConfig();
        },
        
        // Set a value (for programmatic use)
        set: function(key, value) {
            if (DEFAULT_CONFIG[key] !== undefined) {
                config[key] = value;
                saveConfig();
            }
        },
        
        // Get default config
        getDefaults: function() {
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    PDFLayoutConfig.init();
});
