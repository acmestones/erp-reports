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
    spaceAfterHeader: 5,                    // NEW: Space between header and product label
    
    // MAIN IMAGE SETTINGS
    mainImageMaxWidth: 60,
    mainImageMaxHeight: 60,
    
    // THUMBNAIL SETTINGS
    thumbnailMaxWidth: 16,
    thumbnailMaxHeight: 16,
    thumbnailHorizontalSpacing: 18,
    thumbnailVerticalSpacing: 2,
    
    // SPACING SETTINGS (in mm)
    spaceAfterProductLabel: 3,              // Space after product name/label
    spaceAfterSKU: 7,                       // Space after SKU, before main image
    spaceAfterMainImage: 8,                 // Space after main image
    spaceBeforeImageAttrLabel: 10,          // Space BEFORE image attribute label
    spaceAfterImageAttrLabel: 4,            // Space AFTER image attribute label, before thumbnails
    spaceAfterThumbnailRow: 2,              // Space after last thumbnail row of attribute
    spaceBeforeNextProduct: 5,              // Space before next product (if any)
    spaceBetweenColumns: 8,                 // Horizontal space between left and right columns
    spaceBetweenTextAttrLabelAndValue: 5,   // Space between text attribute label and value
    spaceBetweenTextAttributes: 5,          // Space after text attribute value (before next attribute)
    
    // FONT SETTINGS
    productLabelFontSize: 16,
    skuFontSize: 9,
    imageAttrLabelFontSize: 9,
    textAttrLabelFontSize: 10,
    textAttrValueFontSize: 9,
    
    // COLUMN LAYOUT
    leftColumnWidthMM: 70,                  // Width for image attributes column
    
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
        btn.innerHTML = '⚙️ PDF Layout';
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
      <div class="modal fade" id="pdfLayoutModal" tabindex="-1" aria-labelledby="pdfLayoutModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="pdfLayoutModalLabel">PDF Layout Configuration</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
              <div class="config-section">
                <h6 class="mb-3"><strong>Page Settings</strong></h6>
                
                <div class="config-input-group mb-3">
                  <label for="pageMargin">Page Margin (mm):</label>
                  <input type="number" id="pageMargin" class="form-control" min="5" max="50" step="1" value="${config.pageMargin}">
                  <small class="text-muted">Distance from page edge</small>
                </div>

                <div class="config-input-group mb-3">
                  <label for="headerHeight">Header Height (mm):</label>
                  <input type="number" id="headerHeight" class="form-control" min="5" max="100" step="1" value="${config.headerHeight}">
                  <small class="text-muted">Height of the page header area</small>
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceAfterHeader">Space After Header (mm):</label>
                  <input type="number" id="spaceAfterHeader" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterHeader}">
                  <small class="text-muted">Vertical space between page header and product label</small>
                </div>

                <div class="config-input-group mb-3">
                  <label for="pageFooterMargin">Page Footer Margin (mm):</label>
                  <input type="number" id="pageFooterMargin" class="form-control" min="5" max="50" step="1" value="${config.pageFooterMargin}">
                  <small class="text-muted">Bottom margin for footer content</small>
                </div>
              </div>

              <hr>

              <div class="config-section">
                <h6 class="mb-3"><strong>Image Settings</strong></h6>
                
                <div class="config-input-group mb-3">
                  <label for="mainImageMaxWidth">Main Image Max Width (mm):</label>
                  <input type="number" id="mainImageMaxWidth" class="form-control" min="20" max="200" step="1" value="${config.mainImageMaxWidth}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="mainImageMaxHeight">Main Image Max Height (mm):</label>
                  <input type="number" id="mainImageMaxHeight" class="form-control" min="20" max="200" step="1" value="${config.mainImageMaxHeight}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="thumbnailMaxWidth">Thumbnail Max Width (mm):</label>
                  <input type="number" id="thumbnailMaxWidth" class="form-control" min="5" max="50" step="0.5" value="${config.thumbnailMaxWidth}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="thumbnailMaxHeight">Thumbnail Max Height (mm):</label>
                  <input type="number" id="thumbnailMaxHeight" class="form-control" min="5" max="50" step="0.5" value="${config.thumbnailMaxHeight}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="thumbnailHorizontalSpacing">Thumbnail Horizontal Spacing (mm):</label>
                  <input type="number" id="thumbnailHorizontalSpacing" class="form-control" min="2" max="30" step="0.5" value="${config.thumbnailHorizontalSpacing}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="thumbnailVerticalSpacing">Thumbnail Vertical Spacing (mm):</label>
                  <input type="number" id="thumbnailVerticalSpacing" class="form-control" min="0" max="20" step="0.5" value="${config.thumbnailVerticalSpacing}">
                </div>
              </div>

              <hr>

              <div class="config-section">
                <h6 class="mb-3"><strong>Spacing Settings (mm)</strong></h6>
                
                <div class="config-input-group mb-3">
                  <label for="spaceAfterProductLabel">Space After Product Label:</label>
                  <input type="number" id="spaceAfterProductLabel" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterProductLabel}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceAfterSKU">Space After SKU:</label>
                  <input type="number" id="spaceAfterSKU" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterSKU}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceAfterMainImage">Space After Main Image:</label>
                  <input type="number" id="spaceAfterMainImage" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterMainImage}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceBeforeImageAttrLabel">Space Before Image Attr Label:</label>
                  <input type="number" id="spaceBeforeImageAttrLabel" class="form-control" min="0" max="50" step="0.5" value="${config.spaceBeforeImageAttrLabel}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceAfterImageAttrLabel">Space After Image Attr Label:</label>
                  <input type="number" id="spaceAfterImageAttrLabel" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterImageAttrLabel}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceAfterThumbnailRow">Space After Thumbnail Row:</label>
                  <input type="number" id="spaceAfterThumbnailRow" class="form-control" min="0" max="50" step="0.5" value="${config.spaceAfterThumbnailRow}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceBeforeNextProduct">Space Before Next Product:</label>
                  <input type="number" id="spaceBeforeNextProduct" class="form-control" min="0" max="50" step="0.5" value="${config.spaceBeforeNextProduct}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceBetweenColumns">Space Between Columns:</label>
                  <input type="number" id="spaceBetweenColumns" class="form-control" min="2" max="50" step="0.5" value="${config.spaceBetweenColumns}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceBetweenTextAttrLabelAndValue">Space Between Text Attr Label and Value:</label>
                  <input type="number" id="spaceBetweenTextAttrLabelAndValue" class="form-control" min="0" max="50" step="0.5" value="${config.spaceBetweenTextAttrLabelAndValue}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="spaceBetweenTextAttributes">Space Between Text Attributes:</label>
                  <input type="number" id="spaceBetweenTextAttributes" class="form-control" min="0" max="50" step="0.5" value="${config.spaceBetweenTextAttributes}">
                </div>
              </div>

              <hr>

              <div class="config-section">
                <h6 class="mb-3"><strong>Font Settings</strong></h6>
                
                <div class="config-input-group mb-3">
                  <label for="productLabelFontSize">Product Label Font Size (pt):</label>
                  <input type="number" id="productLabelFontSize" class="form-control" min="8" max="32" step="1" value="${config.productLabelFontSize}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="skuFontSize">SKU Font Size (pt):</label>
                  <input type="number" id="skuFontSize" class="form-control" min="6" max="24" step="1" value="${config.skuFontSize}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="imageAttrLabelFontSize">Image Attr Label Font Size (pt):</label>
                  <input type="number" id="imageAttrLabelFontSize" class="form-control" min="6" max="24" step="1" value="${config.imageAttrLabelFontSize}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="textAttrLabelFontSize">Text Attr Label Font Size (pt):</label>
                  <input type="number" id="textAttrLabelFontSize" class="form-control" min="6" max="24" step="1" value="${config.textAttrLabelFontSize}">
                </div>

                <div class="config-input-group mb-3">
                  <label for="textAttrValueFontSize">Text Attr Value Font Size (pt):</label>
                  <input type="number" id="textAttrValueFontSize" class="form-control" min="6" max="24" step="1" value="${config.textAttrValueFontSize}">
                </div>
              </div>

              <hr>

              <div class="config-section">
                <h6 class="mb-3"><strong>Column Layout</strong></h6>
                
                <div class="config-input-group mb-3">
                  <label for="leftColumnWidthMM">Left Column Width (mm):</label>
                  <input type="number" id="leftColumnWidthMM" class="form-control" min="30" max="150" step="1" value="${config.leftColumnWidthMM}">
                  <small class="text-muted">Width for image attributes column</small>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="resetLayoutBtn">Reset to Defaults</button>
              <button type="button" class="btn btn-primary" id="saveLayoutBtn">Save Configuration</button>
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupLayoutModal();
  }

  function setupLayoutModal() {
    // Input change listeners
    document.getElementById('pageMargin').addEventListener('change', function() {
      config.pageMargin = parseFloat(this.value) || 15;
      saveConfig();
    });

    document.getElementById('headerHeight').addEventListener('change', function() {
      config.headerHeight = parseFloat(this.value) || 20;
      saveConfig();
    });

    document.getElementById('spaceAfterHeader').addEventListener('change', function() {
      config.spaceAfterHeader = parseFloat(this.value) || 5;
      saveConfig();
      console.log('Updated spaceAfterHeader to:', config.spaceAfterHeader);
    });

    document.getElementById('pageFooterMargin').addEventListener('change', function() {
      config.pageFooterMargin = parseFloat(this.value) || 30;
      saveConfig();
    });

    document.getElementById('mainImageMaxWidth').addEventListener('change', function() {
      config.mainImageMaxWidth = parseFloat(this.value) || 60;
      saveConfig();
    });

    document.getElementById('mainImageMaxHeight').addEventListener('change', function() {
      config.mainImageMaxHeight = parseFloat(this.value) || 60;
      saveConfig();
    });

    document.getElementById('thumbnailMaxWidth').addEventListener('change', function() {
      config.thumbnailMaxWidth = parseFloat(this.value) || 16;
      saveConfig();
    });

    document.getElementById('thumbnailMaxHeight').addEventListener('change', function() {
      config.thumbnailMaxHeight = parseFloat(this.value) || 16;
      saveConfig();
    });

    document.getElementById('thumbnailHorizontalSpacing').addEventListener('change', function() {
      config.thumbnailHorizontalSpacing = parseFloat(this.value) || 18;
      saveConfig();
    });

    document.getElementById('thumbnailVerticalSpacing').addEventListener('change', function() {
      config.thumbnailVerticalSpacing = parseFloat(this.value) || 2;
      saveConfig();
    });

    document.getElementById('spaceAfterProductLabel').addEventListener('change', function() {
      config.spaceAfterProductLabel = parseFloat(this.value) || 3;
      saveConfig();
    });

    document.getElementById('spaceAfterSKU').addEventListener('change', function() {
      config.spaceAfterSKU = parseFloat(this.value) || 7;
      saveConfig();
    });

    document.getElementById('spaceAfterMainImage').addEventListener('change', function() {
      config.spaceAfterMainImage = parseFloat(this.value) || 8;
      saveConfig();
    });

    document.getElementById('spaceBeforeImageAttrLabel').addEventListener('change', function() {
      config.spaceBeforeImageAttrLabel = parseFloat(this.value) || 10;
      saveConfig();
    });

    document.getElementById('spaceAfterImageAttrLabel').addEventListener('change', function() {
      config.spaceAfterImageAttrLabel = parseFloat(this.value) || 4;
      saveConfig();
    });

    document.getElementById('spaceAfterThumbnailRow').addEventListener('change', function() {
      config.spaceAfterThumbnailRow = parseFloat(this.value) || 2;
      saveConfig();
    });

    document.getElementById('spaceBeforeNextProduct').addEventListener('change', function() {
      config.spaceBeforeNextProduct = parseFloat(this.value) || 5;
      saveConfig();
    });

    document.getElementById('spaceBetweenColumns').addEventListener('change', function() {
      config.spaceBetweenColumns = parseFloat(this.value) || 8;
      saveConfig();
    });

    document.getElementById('spaceBetweenTextAttrLabelAndValue').addEventListener('change', function() {
      config.spaceBetweenTextAttrLabelAndValue = parseFloat(this.value) || 5;
      saveConfig();
    });

    document.getElementById('spaceBetweenTextAttributes').addEventListener('change', function() {
      config.spaceBetweenTextAttributes = parseFloat(this.value) || 5;
      saveConfig();
    });

    document.getElementById('productLabelFontSize').addEventListener('change', function() {
      config.productLabelFontSize = parseFloat(this.value) || 16;
      saveConfig();
    });

    document.getElementById('skuFontSize').addEventListener('change', function() {
      config.skuFontSize = parseFloat(this.value) || 9;
      saveConfig();
    });

    document.getElementById('imageAttrLabelFontSize').addEventListener('change', function() {
      config.imageAttrLabelFontSize = parseFloat(this.value) || 9;
      saveConfig();
    });

    document.getElementById('textAttrLabelFontSize').addEventListener('change', function() {
      config.textAttrLabelFontSize = parseFloat(this.value) || 10;
      saveConfig();
    });

    document.getElementById('textAttrValueFontSize').addEventListener('change', function() {
      config.textAttrValueFontSize = parseFloat(this.value) || 9;
      saveConfig();
    });

    document.getElementById('leftColumnWidthMM').addEventListener('change', function() {
      config.leftColumnWidthMM = parseFloat(this.value) || 70;
      saveConfig();
    });

    // Button listeners
    document.getElementById('saveLayoutBtn').addEventListener('click', function() {
      saveConfig();
      alert('✓ Layout configuration saved successfully!');
      const modal = bootstrap.Modal.getInstance(document.getElementById('pdfLayoutModal'));
      if (modal) modal.hide();
    });

    document.getElementById('resetLayoutBtn').addEventListener('click', function() {
      if (confirm('Are you sure you want to reset all layout settings to defaults?')) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        localStorage.removeItem('pdfLayoutConfig');
        location.reload(); // Reload to refresh all inputs
      }
    });
  }

  function showLayoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('pdfLayoutModal'));
    modal.show();
  }

  function saveConfig() {
    localStorage.setItem('pdfLayoutConfig', JSON.stringify(config));
    console.log('Layout config saved:', config);
  }

  function getConfig() {
    return config;
  }

  // Public API
  return {
    init: init,
    getConfig: getConfig,
    saveConfig: saveConfig
  };

})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PDFLayoutConfig.init);
} else {
  PDFLayoutConfig.init();
}
