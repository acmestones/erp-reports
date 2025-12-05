(function() {
  "use strict";
  
  // Per-user filter defaults storage
  const USER_FILTER_KEY_PREFIX = 'acmeCatalogFilters_';
  let DEFAULT_FILTERS = null;


  const USERS_WITH_PRICE_ACCESS = [
    "marblehouse@gmail.com",
    "designacmestones@gmail.com",
    "satishguptajaipur@gmail.com"
  ];

  let allProducts = [];
  let filteredProducts = [];
  let currentUser = "";
  let displayedCount = 0;
  const INITIAL_LOAD = 40;
  const BATCH_SIZE = 20;







function getUserFilterKey() {
    return USER_FILTER_KEY_PREFIX + (currentUser || 'guest');
}

function loadUserFilterDefaults() {
    try {
        const raw = localStorage.getItem(getUserFilterKey());
        if (!raw) {
            console.log('No saved user filters, using system defaults');
            return null;
        }
        const obj = JSON.parse(raw);
        console.log('Loaded user-saved filters from localStorage:', obj);
        return obj;
    } catch (e) {
        console.error('Failed to parse user filter defaults:', e);
        return null;
    }
}

function saveUserFilterDefaults(filters) {
    try {
        localStorage.setItem(getUserFilterKey(), JSON.stringify(filters));
        console.log('Saved user filter defaults to localStorage:', filters);
        alert('✓ Your filter defaults have been saved!');
    } catch (e) {
        console.error('Failed to save user filter defaults:', e);
        alert('Failed to save filter defaults');
    }
}

function getSystemDefaultFilters() {
    return {
        search: '',
        categories: [],
        families: [],
        status: 'all',
        variant: 'all',
        sort: 'sku-asc'
    };
}

function loadDefaultFilters() {
    const userDefaults = loadUserFilterDefaults();
    DEFAULT_FILTERS = userDefaults || getSystemDefaultFilters();
    console.log('Effective DEFAULT_FILTERS:', DEFAULT_FILTERS);
}




 



function init() {
    console.time("Total Load Time");
    
    // Check for force refresh BEFORE cleaning URL
    const urlParams = new URLSearchParams(window.location.search);
    const shouldForceRefresh = urlParams.has('forcerefresh');
    
    // Store it globally so loadProducts can access it
    window.isForceRefresh = shouldForceRefresh;
    
    // Clean up URL after reading the parameter
    if (shouldForceRefresh) {
        urlParams.delete('forcerefresh');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }
    
    let userObj;
    const userData = localStorage.getItem("user") || "{}";
    try {
        userObj = JSON.parse(userData);
        if (typeof userObj === 'string') {
            currentUser = userObj;
        } else {
            currentUser = userObj.email || "";
        }
    } catch (e) {
        currentUser = userData;
    }
    
    const badge = document.getElementById("loggedUserBadge");
    if (badge) badge.textContent = "Signed in as " + currentUser;

     // ADD THIS LINE - Initialize Admin Module
    AdminModule.init(currentUser);
    loadDefaultFilters();
  
    loadProducts();


    // Wire up Save and Reset buttons
    setTimeout(function() {
        const saveBtn = document.getElementById('saveMyDefaultsBtn');
        const resetBtn = document.getElementById('resetFiltersBtn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', saveCurrentFiltersAsDefaults);
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', resetFiltersToDefault);
        }
    }, 0);

  
}






  
function loadProducts() {
    const status = document.getElementById("catalogStatus");
    const grid = document.getElementById("productGrid");
    
    if (!status || !grid) {
        console.error('catalogStatus or productGrid not found in DOM');
        return;
    }

    status.innerHTML = '<span class="text-primary">⏳ Loading...</span>';
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    const startTime = Date.now();
    
    let progressTimer = null;
    if (window.isForceRefresh) {
        progressTimer = startProgressTimer("catalogStatus", "Checking 1022 products for updates");
    }
    
    const fetchUrl = window.isForceRefresh
        ? "fetch_plytix_data.php?action=get_status&forcerefresh=1"
        : "fetch_plytix_data.php?action=get_status";
    
    fetch(fetchUrl)
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(statusData) {
            if (progressTimer) {
                clearInterval(progressTimer);
                progressTimer = null;
            }
            
            if (!statusData.success) throw new Error('Failed to get status');
            
            const checkTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (window.isForceRefresh) {
                console.log(`API check completed in ${checkTime}s`);
                status.innerHTML = `<span class="text-success">✓ Check complete: ${statusData.cached} cached, ${statusData.needUpdate} need update (${checkTime}s)</span>`;
            }
            
            console.log("Status:", statusData.cached, "cached,", statusData.needUpdate, "need update");
            
            const totalProducts = statusData.total;
            const cachedIds = statusData.cachedIds;
            const needUpdateIds = statusData.needUpdateIds;
            
            if (statusData.hasConsolidated && statusData.quickLoad) {
                loadCachedProducts(cachedIds, needUpdateIds, totalProducts, startTime);
            } else if (cachedIds.length > 0) {
                loadCachedProducts(cachedIds, needUpdateIds, totalProducts, startTime);
            } else if (needUpdateIds.length > 0) {
                fetchUpdatedProducts(needUpdateIds, totalProducts, startTime);
            }
        })
        .catch(function(err) {
            if (progressTimer) {
                clearInterval(progressTimer);
            }
            console.error("Failed to load products:", err);
            status.innerHTML = '<span class="text-danger">Error loading products</span>';
            grid.innerHTML = '';
        });
}







  
function loadCachedProducts(cachedIds, needUpdateIds, totalProducts, startTime) {
    const status = document.getElementById("catalogStatus");
    
    // Force batch loading (skip consolidated for now)
    console.log(`Loading ${cachedIds.length} products in batches`);
    
    const batchSize = 250;
    const batches = [];
    for (let i = 0; i < cachedIds.length; i += batchSize) {
        batches.push(cachedIds.slice(i, i + batchSize));
    }
    console.log(`Split into ${batches.length} batches`);

    let loadedCount = 0;

    function loadNextBatch(index) {
        if (index >= batches.length) {
            const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`Loaded ${allProducts.length} cached products in ${loadTime}s`);
            console.timeEnd("Total Load Time");
            
            setupFilters();
            populateCategoryFilter();
            populateFamilyFilter();
            applyFilters();

            if (needUpdateIds.length > 0) {
                status.innerHTML = `<span class="text-success">✓ Loaded ${allProducts.length} products (${loadTime}s)</span>`;
                fetchUpdatedProducts(needUpdateIds, totalProducts, startTime);
            } else {
                status.innerHTML = `<span class="text-success">✓ Loaded ${allProducts.length} products (${loadTime}s)</span>`;
            }
            return;
        }

        const batch = batches[index];
        console.log(`Loading batch ${index + 1}/${batches.length} (${batch.length} products)`);
        
        fetch("fetch_plytix_data.php?action=load_cached", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: batch })
        })
        .then(function(res) { 
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json(); 
        })
        .then(function(data) {
            if (data.success && data.products) {
                allProducts = allProducts.concat(data.products);
                window.allProducts = allProducts;  // ADD THIS LINE
                loadedCount += data.products.length;
                const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
                status.innerHTML = `<span class="text-primary">⏳ Loaded ${loadedCount}/${cachedIds.length} (${currentTime}s)</span>`;

                if (index === 0) {
                    setupFilters();
                    populateCategoryFilter();
                    populateFamilyFilter();
                    applyFilters();
                }

                loadNextBatch(index + 1);
            }
        })
        .catch(function(err) {
            console.error("Batch load error:", err);
            loadNextBatch(index + 1);
        });
    }

    loadNextBatch(0);
}








  




  
  function fetchUpdatedProducts(productIds, totalProducts, startTime) {
    const status = document.getElementById("catalogStatus");
    
    if (productIds.length === 0) return;
    
    console.log("Fetching " + productIds.length + " updated products...");
    
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < productIds.length; i += batchSize) {
      batches.push(productIds.slice(i, i + batchSize));
    }
    
    let fetchedCount = 0;
    let needsFilterSetup = allProducts.length === 0;
    
    function fetchNextBatch(index) {
      if (index >= batches.length) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        status.innerHTML = '<span class="text-success">✓ All ' + totalProducts + ' products loaded (' + totalTime + 's)</span>';
        console.log("All products updated!");
        return;
      }
      
      const batch = batches[index];
      
      fetch('fetch_plytix_data.php?action=fetch_products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: batch })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.products) {
          fetchedCount += data.products.length;
          
          data.products.forEach(function(newProduct) {
            const existingIndex = allProducts.findIndex(function(p) {
              return p.id === newProduct.id;
            });
            
            if (existingIndex >= 0) {
              allProducts[existingIndex] = newProduct;
            } else {
              allProducts.push(newProduct);
            }
          });

          window.allProducts = allProducts;  // ADD THIS LINE

          
          if (needsFilterSetup && allProducts.length >= INITIAL_LOAD) {
            needsFilterSetup = false;
            setupFilters();
            populateCategoryFilter();
            populateFamilyFilter();
          }
          
          applyFilters();
          
          const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
          status.innerHTML = '<span class="text-primary">⏳ Updated ' + fetchedCount + ' / ' + productIds.length + ' (' + currentTime + 's)</span>';
          
          console.log("Batch " + (index + 1) + "/" + batches.length + " fetched (" + fetchedCount + " total)");
          
          fetchNextBatch(index + 1);
        }
      })
      .catch(function(err) {
        console.error("Batch fetch error:", err);
        fetchNextBatch(index + 1);
      });
    }
    
    fetchNextBatch(0);
  }




  
function setupFilters() {
    // Apply DEFAULT_FILTERS to controls
    if (DEFAULT_FILTERS) {
        const searchBox = document.getElementById('searchBox');
        const statusFilter = document.getElementById('statusFilter');
        const variantFilter = document.getElementById('variantFilter');
        const sortFilter = document.getElementById('sortFilter');

        if (searchBox) searchBox.value = DEFAULT_FILTERS.search || '';
        if (statusFilter) statusFilter.value = DEFAULT_FILTERS.status || 'all';
        if (variantFilter) variantFilter.value = DEFAULT_FILTERS.variant || 'all';
        if (sortFilter) sortFilter.value = DEFAULT_FILTERS.sort || 'sku-asc';
    }

    document.getElementById('searchBox').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('variantFilter').addEventListener('change', applyFilters);
    document.getElementById('sortFilter').addEventListener('change', applyFilters);
}






  

  function populateCategoryFilter() {
    const categorySet = new Set();
    allProducts.forEach(function(p) {
      const cats = p.categories || [];
      cats.forEach(function(c) {
        if (c && c.name) categorySet.add(c.name);
      });
    });
    
    const ul = document.getElementById("categoryFilter");
    ul.innerHTML = "";
    
    if (categorySet.size === 0) {
      ul.innerHTML = '<li class="dropdown-item text-muted">No categories</li>';
      return;
    }
    
    const sortedCats = Array.from(categorySet).sort();
    sortedCats.forEach(function(cat) {
      const li = document.createElement("li");
      li.innerHTML = '<label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="' + 
        cat + '">' + cat + '</label>';
      ul.appendChild(li);
    });
    
    ul.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
      cb.addEventListener("change", applyFilters);
    });


    // Apply default category selections
    if (DEFAULT_FILTERS && DEFAULT_FILTERS.categories && DEFAULT_FILTERS.categories.length > 0) {
        document.querySelectorAll('#categoryFilter input[type="checkbox"]').forEach(function (cb) {
            cb.checked = DEFAULT_FILTERS.categories.indexOf(cb.value) !== -1;
        });
    }


    
  }



  
function populateFamilyFilter() {
    const familySet = new Set();

    // Collect all distinct product_family_id values
    allProducts.forEach(product => {
        if (product.product_family_id) {
            familySet.add(product.product_family_id);
        }
    });

    const ul = document.getElementById('familyFilter');
    if (!ul) return;

    ul.innerHTML = '<li class="dropdown-item text-muted">Loading families...</li>';

    if (familySet.size === 0) {
        ul.innerHTML = '<li class="dropdown-item text-muted">No Product Families found</li>';
        return;
    }

    // Fetch family names from Plytix
    fetch('fetch_plytix_data.php?action=get_families')
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to load families');
            }

            const FAMILY_NAME_MAP = data.families;

            const families = Array.from(familySet).map(id => ({
                id,
                name: FAMILY_NAME_MAP[id] || id   // show ID if name not found
            }));

            families.sort((a, b) => a.name.localeCompare(b.name));

            ul.innerHTML = '';

            families.forEach(fam => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <label class="dropdown-item">
                        <input
                            type="checkbox"
                            class="form-check-input me-2"
                            value="${fam.id}"
                            data-family-name="${fam.name}">
                        ${fam.name}
                    </label>
                `;
                ul.appendChild(li);
            });

            // Hook up filter
            ul.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', applyFilters);
            });
        })
        .catch(err => {
            console.error('Failed to load product families:', err);
            ul.innerHTML = '<li class="dropdown-item text-danger">Error loading families</li>';
        });


    // Apply default family selections
    if (DEFAULT_FILTERS && DEFAULT_FILTERS.families && DEFAULT_FILTERS.families.length > 0) {
        document.querySelectorAll('#familyFilter input[type="checkbox"]').forEach(function (cb) {
            cb.checked = DEFAULT_FILTERS.families.indexOf(cb.value) !== -1;
        });
    }



  
}






  
// FIXED: Complete applyFilters function - NO 'p' references
function applyFilters() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const variantFilter = document.getElementById('variantFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;

    // Selected categories
    const selectedCategories = Array.from(
        document.querySelectorAll('#categoryFilter input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    // Selected product families (IDs)
    const selectedFamilies = Array.from(
        document.querySelectorAll('#familyFilter input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    filteredProducts = allProducts.filter(product => {
        // Search filter
        const sku = (product.sku || '').toLowerCase();
        const label = (getAttributeValue(product, 'label') || '').toLowerCase();
        const matchesSearch =
            !searchTerm || sku.includes(searchTerm) || label.includes(searchTerm);
        if (!matchesSearch) return false;

        // Status filter
        const enableDisableField = product.enable_disable_product;
        const attrEnableDisable = product.attributes?.enable_disable_product;
        const isEnabled =
            enableDisableField === true ||
            enableDisableField === 'TRUE' ||
            attrEnableDisable === true ||
            attrEnableDisable === 'TRUE';

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'enabled' && isEnabled) ||
            (statusFilter === 'disabled' && !isEnabled);
        if (!matchesStatus) return false;

        // Variant filter
        const numVariations = product.num_variations || product.numvariations || 0;
        const parentId = product.parent_id || product.parentid;
        const isParent = numVariations > 0;
        const isVariant = !isParent && !!parentId;
        const isSingle = !isParent && !parentId;

        const matchesVariant =
            variantFilter === 'all' ||
            (variantFilter === 'parents' && isParent) ||
            (variantFilter === 'variants' && isVariant) ||
            (variantFilter === 'singles' && isSingle) ||
            (variantFilter === 'variants-and-singles' && (isVariant || isSingle));
        if (!matchesVariant) return false;

        // Category filter
        if (selectedCategories.length > 0) {
            const productCats = (product.categories || [])
                .map(c => c.name || '')
                .filter(Boolean);
            const hasCategory = selectedCategories.some(cat =>
                productCats.includes(cat)
            );
            if (!hasCategory) return false;
        }

        // Product family filter (using product_family_id)
        if (selectedFamilies.length > 0) {
            const productFamilyId = product.product_family_id || null;

            // If product has no family, it cannot match
            if (!productFamilyId) return false;

            const hasFamily = selectedFamilies.includes(productFamilyId);
            if (!hasFamily) return false;
        }

        return true;
    });

    // Sorting
    filteredProducts.sort((a, b) => {
        if (sortFilter === 'sku-asc') {
            return (a.sku || '').localeCompare(b.sku || '');
        }
        if (sortFilter === 'sku-desc') {
            return (b.sku || '').localeCompare(a.sku || '');
        }
        if (sortFilter === 'label-asc') {
            return (getAttributeValue(a, 'label') || '')
                .localeCompare(getAttributeValue(b, 'label') || '');
        }
        if (sortFilter === 'label-desc') {
            return (getAttributeValue(b, 'label') || '')
                .localeCompare(getAttributeValue(a, 'label') || '');
        }
        return 0;
    });

    renderProducts();
}






  
 function renderProducts() {
    const grid = document.getElementById("productGrid");
    const status = document.getElementById("catalogStatus");
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = "";
        if (allProducts.length === 0) {
            status.innerHTML = '<span class="text-muted">Loading products...</span>';
        } else {
            status.innerHTML = '<span class="text-muted">No products match your filters</span>';
        }
        return;
    }

    const currentStatus = status.innerHTML;
    // Only update status if it's not already showing load progress
    if (!currentStatus.includes("Loaded") && !currentStatus.includes("Loading") && !currentStatus.includes("Updated")) {
        status.innerHTML = `<span class="text-success">Showing ${filteredProducts.length} of ${allProducts.length} products</span>`;
    }
    
    displayedCount = 0;
    grid.innerHTML = "";
    
    // Start rendering immediately
    renderNextBatch();
}






  
 function renderNextBatch() {
    const grid = document.getElementById("productGrid");
    const batchSize = displayedCount === 0 ? INITIAL_LOAD : BATCH_SIZE;
    const endIndex = Math.min(displayedCount + batchSize, filteredProducts.length);
    
    const fragment = document.createDocumentFragment();
    for (let i = displayedCount; i < endIndex; i++) {
        fragment.appendChild(createProductCard(filteredProducts[i]));
    }
    
    grid.appendChild(fragment);
    displayedCount = endIndex;

    if (displayedCount < filteredProducts.length) {
        // Use requestIdleCallback if available for better performance
        if ('requestIdleCallback' in window) {
            requestIdleCallback(renderNextBatch);
        } else {
            requestAnimationFrame(renderNextBatch);
        }
    }
}





  
  function createProductCard(product) {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-3";
    
    const card = document.createElement("div");
    card.className = "card h-100 shadow-sm product-card";
    card.style.cursor = "pointer";
    
    const enableDisableField = product.enable_disable_product;
    const attrEnableDisable = product.attributes && product.attributes.enable_disable_product;
    
    const isEnabled = enableDisableField === true || 
                     enableDisableField === "TRUE" ||
                     attrEnableDisable === true ||
                     attrEnableDisable === "TRUE";
    
    if (!isEnabled) {
      card.style.opacity = "0.5";
      card.style.filter = "grayscale(40%)";
    }
    
    const imageUrl = getFirstImage(product);
    
    const img = document.createElement("img");
    img.className = "card-img-top";
    img.cssText = "height:250px;width:100%;object-fit:cover;object-position:center center;background-color:#f8f9fa";
    img.loading = "lazy";
    img.decoding = "async";

    
    let thumbUrl = imageUrl;
    if (product.thumbnail && product.thumbnail.thumbnail) {
      thumbUrl = product.thumbnail.thumbnail;
    } else if (Array.isArray(product.assets) && product.assets[0] && product.assets[0].thumbnail) {
      thumbUrl = product.assets[0].thumbnail;
    } else if (product.attributes && Array.isArray(product.attributes.images) && 
               product.attributes.images[0] && product.attributes.images[0].thumbnail) {
      thumbUrl = product.attributes.images[0].thumbnail;
    }
    
    img.src = thumbUrl;
    img.alt = getAttributeValue(product, "label") || product.sku;
    
    img.onerror = function() {
      this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='20' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E";
    };
    
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    
    const title = document.createElement("h6");
    title.className = "card-title mb-2";
    title.textContent = getAttributeValue(product, "label") || "Untitled";
    
    const sku = document.createElement("p");
    sku.className = "card-text text-muted small mb-0";
    sku.innerHTML = "<strong>SKU:</strong> " + (product.sku || "N/A");
    
    if (!isEnabled) {
      const badge = document.createElement("span");
      badge.className = "badge bg-secondary mt-2";
      badge.textContent = "DISABLED";
      cardBody.appendChild(badge);
    }
    
    cardBody.appendChild(title);
    cardBody.appendChild(sku);
    card.appendChild(img);
    card.appendChild(cardBody);
    
    card.onclick = function() { showProductDetail(product); };
    
    col.appendChild(card);
    return col;
  }

  function getFirstImage(product) {
    if (product.thumbnail && typeof product.thumbnail === 'object') {
      if (product.thumbnail.url) return product.thumbnail.url;
      if (product.thumbnail.thumbnail) return product.thumbnail.thumbnail;
    }
    
    if (Array.isArray(product.assets) && product.assets.length > 0) {
      const firstAsset = product.assets[0];
      if (firstAsset && firstAsset.url) return firstAsset.url;
    }
    
    if (product.attributes && Array.isArray(product.attributes.images) && product.attributes.images.length > 0) {
      const firstImg = product.attributes.images[0];
      if (firstImg && firstImg.url) return firstImg.url;
    }
    
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='20' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E";
  }

  function getAttributeValue(product, attributeLabel) {
    if (!product) return "";
    
    if (product[attributeLabel] != null && product[attributeLabel] !== "") {
      return formatSimpleValue(product[attributeLabel]);
    }
    
    if (product.attributes && product.attributes[attributeLabel] != null && product.attributes[attributeLabel] !== "") {
      return formatSimpleValue(product.attributes[attributeLabel]);
    }
    
    return "";
  }

  function formatSimpleValue(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
      return value.map(function(v) {
        if (typeof v === 'object' && v.name) return v.name;
        if (typeof v === 'object' && v.url) return v.url;
        return String(v);
      }).filter(Boolean).join(', ');
    }
    if (typeof value === 'object' && value.name) return value.name;
    if (typeof value === 'object' && value.url) return value.url;
    
    return String(value).trim();
  }

  function formatValueForDisplay(value) {
    if (value === null || value === undefined || value === "") {
      return '<span class="text-muted">-</span>';
    }
    
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="text-muted">-</span>';
      
      if (value[0] && typeof value[0] === 'object' && value[0].name) {
        return value.map(function(item) { return item.name; }).join(', ');
      }
      
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      if (value.user_email) return value.user_email;
      if (value.name) return value.name;
      return '<pre class="mb-0 small" style="max-height:100px;overflow:auto;">' + JSON.stringify(value, null, 2) + '</pre>';
    }
    
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return '<a href="' + value + '" target="_blank" class="text-break">' + value + '</a>';
    }
    
    if (typeof value === 'string' && value.includes('<') && value.includes('>')) {
      if (value.match(/<[a-z][\s\S]*>/i)) {
        return '<code class="text-break">' + value.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>';
      }
    }
    
    return '<span class="text-break">' + String(value) + '</span>';
  }




  
function showProductDetail(product) {
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    
    modalTitle.textContent = getAttributeValue(product, "label") || product.sku || "Product Details";
    modalBody.innerHTML = "";

    const leftCol = document.createElement("div");
    leftCol.className = "col-md-4";
    
    // Check if thumbnail is visible to user
    if (product.thumbnail && product.thumbnail.thumbnail && 
        (!AdminModule.isAttributeVisible || AdminModule.isAttributeVisible('thumbnail'))) {
      const thumbCard = document.createElement("div");
      thumbCard.className = "card mb-3";
      thumbCard.innerHTML = '<div class="card-header"><strong>Thumbnail</strong></div>';
      
      const thumbBody = document.createElement("div");
      thumbBody.className = "card-body p-2";
      
      const thumbImg = document.createElement("img");
      thumbImg.src = product.thumbnail.thumbnail;
      thumbImg.className = "img-fluid rounded";
      thumbImg.style.cursor = "pointer";
      thumbImg.loading = "lazy";
      thumbImg.onclick = function() { window.open(product.thumbnail.url, '_blank'); };
      
      thumbBody.appendChild(thumbImg);
      thumbCard.appendChild(thumbBody);
      leftCol.appendChild(thumbCard);
    }
    
    if (product.attributes && typeof product.attributes === 'object') {
      Object.keys(product.attributes).forEach(function(attrKey) {
        const attrValue = product.attributes[attrKey];
        
        // FIRST check if it's an image array (do this BEFORE permission check)
        // This way image attributes display under their attribute name, not under assets
        if (Array.isArray(attrValue) && attrValue.length > 0 && attrValue[0] && attrValue[0].url) {
          // NOW check if this attribute is visible to user
          if (AdminModule.isAttributeVisible && !AdminModule.isAttributeVisible(attrKey)) {
            return; // Skip if not visible
          }
          
          const imgCard = document.createElement("div");
          imgCard.className = "card mb-3";
          
          const fieldLabel = capitalizeWords(attrKey.replace(/_/g, ' '));
          imgCard.innerHTML = '<div class="card-header"><strong>' + fieldLabel + '</strong></div>';
          
          const imgBody = document.createElement("div");
          imgBody.className = "card-body p-2";
          
          attrValue.forEach(function(img) {
            if (img.thumbnail && img.url) {
              const imgElement = document.createElement("img");
              imgElement.src = img.thumbnail;
              imgElement.className = "img-fluid rounded mb-2";
              imgElement.style.cursor = "pointer";
              imgElement.loading = "lazy";
              imgElement.onclick = function() { window.open(img.url, '_blank'); };
              imgBody.appendChild(imgElement);
            }
          });
          
          imgCard.appendChild(imgBody);
          leftCol.appendChild(imgCard);
        }
      });
    }
    
    // Check if assets are visible to user
    if (Array.isArray(product.assets) && product.assets.length > 0 && 
        (!AdminModule.isAttributeVisible || AdminModule.isAttributeVisible('assets'))) {
      const alreadyShown = product.attributes && product.attributes.images && 
        Array.isArray(product.attributes.images) && product.attributes.images.length > 0;
      
      if (!alreadyShown) {
        const assetCard = document.createElement("div");
        assetCard.className = "card mb-3";
        assetCard.innerHTML = '<div class="card-header"><strong>Assets</strong></div>';
        
        const assetBody = document.createElement("div");
        assetBody.className = "card-body p-2";
        
        product.assets.forEach(function(asset) {
          if (asset.thumbnail && asset.url) {
            const assetImg = document.createElement("img");
            assetImg.src = asset.thumbnail;
            assetImg.className = "img-fluid rounded mb-2";
            assetImg.style.cursor = "pointer";
            assetImg.loading = "lazy";
            assetImg.onclick = function() { window.open(asset.url, '_blank'); };
            assetBody.appendChild(assetImg);
          }
        });
        
        assetCard.appendChild(assetBody);
        leftCol.appendChild(assetCard);
      }
    }

    const rightCol = document.createElement("div");
    rightCol.className = "col-md-8";
    
    const table = document.createElement("table");
    table.className = "table table-sm table-bordered";
    
    const tbody = document.createElement("tbody");
    
    const displayFields = [];
    
    Object.keys(product).forEach(function(key) {
      if (key === 'attributes' || key === 'thumbnail' || key === 'assets' || key === 'relationships') return;
      
      displayFields.push({
        label: capitalizeWords(key.replace(/_/g, ' ')),
        value: product[key],
        key: key
      });
    });
    
    if (product.attributes && typeof product.attributes === 'object') {
      Object.keys(product.attributes).forEach(function(attrKey) {
        const attrValue = product.attributes[attrKey];
        
        // Skip if it's an image array (already shown above)
        if (Array.isArray(attrValue) && attrValue.length > 0 && attrValue[0] && attrValue[0].url) {
          return;
        }
        
        displayFields.push({
          label: capitalizeWords(attrKey.replace(/_/g, ' ')),
          value: attrValue,
          key: attrKey
        });
      });
    }
    
    displayFields.sort(function(a, b) {
      return a.label.localeCompare(b.label);
    });
    
    displayFields.forEach(function(field) {
      // Check if user has permission to view this attribute (AdminModule check)
      if (AdminModule.isAttributeVisible && !AdminModule.isAttributeVisible(field.key)) {
        return; // Skip this field
      }
      
      // Legacy price access check (kept for backward compatibility)
      if (!USERS_WITH_PRICE_ACCESS.includes(currentUser)) {
        const keyLower = field.key.toLowerCase();
        if (keyLower.includes('price') || keyLower.includes('cost') || keyLower.includes('msrp')) {
          return;
        }
      }
      
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.style.width = "30%";
      th.textContent = field.label;
      
      const td = document.createElement("td");
      td.innerHTML = formatValueForDisplay(field.value);
      
      // If attribute is editable, show an indicator
      if (AdminModule.isAttributeEditable && AdminModule.isAttributeEditable(field.key)) {
        th.innerHTML = field.label + ' <span class="badge bg-warning text-dark ms-1" title="Editable">✏️</span>';
      }
      
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    rightCol.appendChild(table);
    
    const editLink = document.createElement("a");
    editLink.href = "https://pim.plytix.com/products/" + product.id + "/edit";
    editLink.target = "_blank";
    editLink.className = "btn btn-outline-primary w-100 mt-2";
    editLink.innerHTML = '✏️ Edit in Plytix';
    rightCol.appendChild(editLink);
    
    modalBody.appendChild(leftCol);
    modalBody.appendChild(rightCol);
    
    const modal = new bootstrap.Modal(document.getElementById("productModal"));
    modal.show();
}












  
  function capitalizeWords(str) {
    return str.replace(/\b\w/g, function(char) { return char.toUpperCase(); });
  }



// Make this function globally accessible
window.forceRefreshCache = function() {
    const btn = document.getElementById("refreshCacheBtn");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Refreshing...';
    }
    
    // Add forcerefresh parameter and reload
    const url = new URL(window.location);
    url.searchParams.set('forcerefresh', '1');
    window.location.href = url.toString();
};

function startProgressTimer(statusElementId, messagePrefix) {
    const statusEl = document.getElementById(statusElementId);
    const startTime = Date.now();
    
    const interval = setInterval(function() {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const estimated = 45; // Estimated total time
        const percent = Math.min(95, Math.floor((elapsed / estimated) * 100));
        
        statusEl.innerHTML = `<span class="text-warning">🔄 ${messagePrefix}... ${elapsed}s / ~${estimated}s <span class="badge bg-info">${percent}%</span></span>`;
    }, 500);
    
    return interval;
}








function saveCurrentFiltersAsDefaults() {
    const searchBox = document.getElementById('searchBox');
    const statusEl  = document.getElementById('statusFilter');
    const variantEl = document.getElementById('variantFilter');
    const sortEl    = document.getElementById('sortFilter');

    const filters = {
        search:  searchBox ? searchBox.value.trim() : '',
        status:  statusEl  ? statusEl.value        : 'all',
        variant: variantEl ? variantEl.value       : 'all',
        sort:    sortEl    ? sortEl.value          : 'sku-asc',
        categories: Array.prototype.map.call(
            document.querySelectorAll('#categoryFilter input[type="checkbox"]:checked'),
            function (cb) { return cb.value; }
        ),
        families: Array.prototype.map.call(
            document.querySelectorAll('#familyFilter input[type="checkbox"]:checked'),
            function (cb) { return cb.value; }
        )
    };

    DEFAULT_FILTERS = filters;
    saveUserFilterDefaults(filters);
}

function resetFiltersToDefault() {
    if (!DEFAULT_FILTERS) {
        alert('No saved defaults found');
        return;
    }

    const searchBox = document.getElementById('searchBox');
    const statusFilter = document.getElementById('statusFilter');
    const variantFilter = document.getElementById('variantFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (searchBox) searchBox.value = DEFAULT_FILTERS.search || '';
    if (statusFilter) statusFilter.value = DEFAULT_FILTERS.status || 'all';
    if (variantFilter) variantFilter.value = DEFAULT_FILTERS.variant || 'all';
    if (sortFilter) sortFilter.value = DEFAULT_FILTERS.sort || 'sku-asc';

    // Reset category checkboxes
    document.querySelectorAll('#categoryFilter input[type="checkbox"]').forEach(function (cb) {
        cb.checked = DEFAULT_FILTERS.categories.indexOf(cb.value) !== -1;
    });

    // Reset family checkboxes
    document.querySelectorAll('#familyFilter input[type="checkbox"]').forEach(function (cb) {
        cb.checked = DEFAULT_FILTERS.families.indexOf(cb.value) !== -1;
    });

    applyFilters();
    console.log('Filters reset to DEFAULT_FILTERS:', DEFAULT_FILTERS);
}




// Call init after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        init();
    });
} else {
    // DOM already loaded
    init();
}
})();







  


