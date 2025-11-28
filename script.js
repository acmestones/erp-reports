(function() {
  "use strict";

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

  init();

  function init() {
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

    loadProducts();
  }

  function loadProducts() {
    const status = document.getElementById("catalogStatus");
    const grid = document.getElementById("productGrid");
    
    status.innerHTML = '<span class="text-primary">⏳ Checking cache...</span>';
    grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Please wait...</p></div>';
    
    const forceRefresh = localStorage.getItem('forceRefresh') === 'true';
    localStorage.removeItem('forceRefresh');
    
    const startTime = Date.now();
    
    // STEP 1: Get status
    fetch('fetch_plytix_data.php?action=get_status' + (forceRefresh ? '&force_refresh=true' : ''))
      .then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function(statusData) {
        if (!statusData.success) {
          throw new Error("Failed to get status");
        }
        
        console.log("Status:", statusData.cached, "cached,", statusData.needUpdate, "need update");
        
        const totalProducts = statusData.total;
        const cachedIds = statusData.cachedIds || [];
        const needUpdateIds = statusData.needUpdateIds || [];
        
        // STEP 2: Load cached products with LAZY LOADING
        if (cachedIds.length > 0) {
          status.innerHTML = '<span class="text-primary">⚡ Loading cached products...</span>';
          
          // Split into smaller batches for progressive loading
          const batchSize = 200;
          const cachedBatches = [];
          for (let i = 0; i < cachedIds.length; i += batchSize) {
            cachedBatches.push(cachedIds.slice(i, i + batchSize));
          }
          
          let loadedBatches = 0;
          let firstBatchDisplayed = false;
          
          // Load batches one by one (not in parallel to avoid overwhelming)
          function loadNextBatch(index) {
            if (index >= cachedBatches.length) {
              const totalLoadTime = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log("All " + allProducts.length + " products loaded in " + totalLoadTime + "s");
              status.innerHTML = '<span class="text-success">✓ Loaded all ' + allProducts.length + ' products</span>';
              
              // Fetch updated products in background if needed
              if (needUpdateIds.length > 0) {
                fetchUpdatedProducts(needUpdateIds, totalProducts);
              }
              return;
            }
            
            const batch = cachedBatches[index];
            
            fetch('fetch_plytix_data.php?action=load_cached&ids=' + encodeURIComponent(JSON.stringify(batch)))
              .then(function(res) { return res.json(); })
              .then(function(data) {
                if (data.success && data.products) {
                  allProducts = allProducts.concat(data.products);
                  loadedBatches++;
                  
                  const currentLoadTime = ((Date.now() - startTime) / 1000).toFixed(1);
                  status.innerHTML = '<span class="text-primary">⚡ Loaded ' + allProducts.length + ' / ' + totalProducts + ' products (' + currentLoadTime + 's)</span>';
                  
                  // Show first batch immediately
                  if (!firstBatchDisplayed && allProducts.length >= INITIAL_LOAD) {
                    firstBatchDisplayed = true;
                    setupFilters();
                    populateCategoryFilter();
                    populateFamilyFilter();
                    applyFilters();
                    console.log("First " + allProducts.length + " products displayed in " + currentLoadTime + "s");
                  } else if (firstBatchDisplayed) {
                    // Update display progressively
                    applyFilters();
                  }
                }
                
                // Load next batch
                loadNextBatch(index + 1);
              })
              .catch(function(err) {
                console.error("Batch load error:", err);
                loadNextBatch(index + 1);
              });
          }
          
          loadNextBatch(0);
          
        } else {
          // No cache, fetch everything
          if (needUpdateIds.length > 0) {
            fetchUpdatedProducts(needUpdateIds, totalProducts);
          }
        }
      })
      .catch(function(err) {
        console.error("Failed to load products:", err);
        status.innerHTML = '<span class="text-danger">Failed to load products. Check console for details.</span>';
        grid.innerHTML = '<div class="col-12 text-center py-3"><p class="text-danger">Error: ' + err.message + '</p></div>';
      });
  }

  function fetchUpdatedProducts(productIds, totalProducts) {
    const status = document.getElementById("catalogStatus");
    
    console.log("Fetching " + productIds.length + " updated products...");
    
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < productIds.length; i += batchSize) {
      batches.push(productIds.slice(i, i + batchSize));
    }
    
    let fetchedCount = 0;
    
    function fetchNextBatch(index) {
      if (index >= batches.length) {
        status.innerHTML = '<span class="text-success">✓ All ' + totalProducts + ' products loaded</span>';
        console.log("All products updated!");
        return;
      }
      
      const batch = batches[index];
      
      status.innerHTML = '<span class="text-primary">⏳ Updating ' + fetchedCount + ' / ' + productIds.length + ' products...</span>';
      
      fetch('fetch_plytix_data.php?action=fetch_products&ids=' + encodeURIComponent(JSON.stringify(batch)))
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
            
            applyFilters();
            
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
    document.getElementById("searchBox").addEventListener("input", applyFilters);
    document.getElementById("statusFilter").addEventListener("change", applyFilters);
    document.getElementById("variantFilter").addEventListener("change", applyFilters);
    document.getElementById("sortFilter").addEventListener("change", applyFilters);
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
  }

  function populateFamilyFilter() {
    const familySet = new Set();
    allProducts.forEach(function(p) {
      // Check multiple possible locations for family info
      const familyId = p.product_family_id;
      const familyModelId = p.product_family_model_id;
      const familyAttr = p.attributes && p.attributes.product_family;
      
      if (familyId) {
        // Try to get family name from relationships or use ID
        familySet.add(familyId);
      }
      if (familyAttr) {
        familySet.add(familyAttr);
      }
    });
    
    const ul = document.getElementById("familyFilter");
    if (!ul) {
      console.log("Family filter element not found - you need to add it to HTML");
      return;
    }
    
    ul.innerHTML = "";
    
    if (familySet.size === 0) {
      ul.innerHTML = '<li class="dropdown-item text-muted">No families</li>';
      return;
    }
    
    const sortedFamilies = Array.from(familySet).sort();
    sortedFamilies.forEach(function(family) {
      const li = document.createElement("li");
      li.innerHTML = '<label class="dropdown-item"><input type="checkbox" class="form-check-input me-2" value="' + 
        family + '">' + family + '</label>';
      ul.appendChild(li);
    });
    
    ul.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
      cb.addEventListener("change", applyFilters);
    });
  }

  function applyFilters() {
    const searchTerm = document.getElementById("searchBox").value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;
    const variantFilter = document.getElementById("variantFilter").value;
    const sortFilter = document.getElementById("sortFilter").value;
    
    const selectedCategories = Array.from(
      document.querySelectorAll('#categoryFilter input[type="checkbox"]:checked')
    ).map(function(cb) { return cb.value; });

    const familyFilterEl = document.getElementById("familyFilter");
    const selectedFamilies = familyFilterEl ? Array.from(
      familyFilterEl.querySelectorAll('input[type="checkbox"]:checked')
    ).map(function(cb) { return cb.value; }) : [];

    filteredProducts = allProducts.filter(function(p) {
      const sku = (p.sku || "").toLowerCase();
      const label = getAttributeValue(p, "label").toLowerCase();
      const matchesSearch = !searchTerm || sku.includes(searchTerm) || label.includes(searchTerm);
      
      if (!matchesSearch) return false;
      
      // FIX: Use the correct field for enabled/disabled status
      // Field label in API: enable_disable_product
      // Field name shown in Plytix UI: "Product Enabled"
      const enableDisableField = p.enable_disable_product;
      const attrEnableDisable = p.attributes && p.attributes.enable_disable_product;
      
      // TRUE = enabled, FALSE = disabled
      const isEnabled = enableDisableField === true || 
                       enableDisableField === "TRUE" ||
                       attrEnableDisable === true ||
                       attrEnableDisable === "TRUE";
      
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "enabled" && isEnabled) ||
        (statusFilter === "disabled" && !isEnabled);

      if (!matchesStatus) return false;
      
      const numVariations = p.num_variations || 0;
      const parentId = p._parent_id || null;
      const isParent = numVariations > 0;
      const isVariant = !isParent && parentId;
      const isSingle = !isParent && !parentId;
      
      const matchesVariant = 
        variantFilter === "all" ||
        (variantFilter === "parents" && isParent) ||
        (variantFilter === "variants" && isVariant) ||
        (variantFilter === "singles" && isSingle) ||
        (variantFilter === "variants-and-singles" && (isVariant || isSingle));
      
      if (!matchesVariant) return false;
      
      if (selectedCategories.length > 0) {
        const productCats = (p.categories || []).map(function(c) { return c.name; });
        const hasCategory = selectedCategories.some(function(cat) {
          return productCats.includes(cat);
        });
        if (!hasCategory) return false;
      }
      
      if (selectedFamilies.length > 0) {
        const productFamily = p.product_family_id || (p.attributes && p.attributes.product_family) || null;
        if (!productFamily || !selectedFamilies.includes(String(productFamily))) {
          return false;
        }
      }
      
      return true;
    });

    // Sort
    filteredProducts.sort(function(a, b) {
      if (sortFilter === "sku-asc") return (a.sku || "").localeCompare(b.sku || "");
      if (sortFilter === "sku-desc") return (b.sku || "").localeCompare(a.sku || "");
      if (sortFilter === "label-asc") {
        return getAttributeValue(a, "label").localeCompare(getAttributeValue(b, "label"));
      }
      if (sortFilter === "label-desc") {
        return getAttributeValue(b, "label").localeCompare(getAttributeValue(a, "label"));
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
    if (!currentStatus.includes('Loaded') && !currentStatus.includes('Loading')) {
      status.innerHTML = '<span class="text-success">Showing ' + filteredProducts.length + ' of ' + allProducts.length + ' products</span>';
    }
    
    // LAZY RENDERING: Render in batches
    displayedCount = 0;
    grid.innerHTML = "";
    
    renderNextBatch();
  }

  function renderNextBatch() {
    const grid = document.getElementById("productGrid");
    const batchSize = displayedCount === 0 ? INITIAL_LOAD : BATCH_SIZE;
    const endIndex = Math.min(displayedCount + batchSize, filteredProducts.length);
    
    for (let i = displayedCount; i < endIndex; i++) {
      grid.appendChild(createProductCard(filteredProducts[i]));
    }
    
    displayedCount = endIndex;
    
    // If more products to show, render next batch after a short delay
    if (displayedCount < filteredProducts.length) {
      setTimeout(renderNextBatch, 50);
    }
  }

  function createProductCard(product) {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-3";
    
    const card = document.createElement("div");
    card.className = "card h-100 shadow-sm product-card";
    card.style.cursor = "pointer";
    
    // Check if product is disabled using CORRECT field
    const enableDisableField = product.enable_disable_product;
    const attrEnableDisable = product.attributes && product.attributes.enable_disable_product;
    
    const isEnabled = enableDisableField === true || 
                     enableDisableField === "TRUE" ||
                     attrEnableDisable === true ||
                     attrEnableDisable === "TRUE";
    
    // Apply dim effect if disabled
    if (!isEnabled) {
      card.style.opacity = "0.5";
      card.style.filter = "grayscale(40%)";
    }
    
    const imageUrl = getFirstImage(product);
    
    const img = document.createElement("img");
    img.className = "card-img-top";
    img.style.height = "250px";
    img.style.objectFit = "cover"; // This makes it zoom to fill
    img.style.objectPosition = "center"; // Center the zoomed image
    img.style.backgroundColor = "#f8f9fa";
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

  // Helper to get attribute value (uses label as key)
  function getAttributeValue(product, attributeLabel) {
    if (!product) return "";
    
    // Check root level first
    if (product[attributeLabel] != null && product[attributeLabel] !== "") {
      return formatSimpleValue(product[attributeLabel]);
    }
    
    // Check attributes object
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
    
    if (product.thumbnail && product.thumbnail.thumbnail) {
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
        
        if (Array.isArray(attrValue) && attrValue.length > 0 && attrValue[0] && attrValue[0].url) {
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
    
    if (Array.isArray(product.assets) && product.assets.length > 0) {
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
      if (key === 'attributes' || key === 'thumbnail' || key === 'assets') return;
      
      displayFields.push({
        label: capitalizeWords(key.replace(/_/g, ' ')),
        value: product[key],
        key: key
      });
    });
    
    if (product.attributes && typeof product.attributes === 'object') {
      Object.keys(product.attributes).forEach(function(attrKey) {
        const attrValue = product.attributes[attrKey];
        
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

})();
