/**
 * script.js — v13 FIXED - Proper Plytix data handling
 */

// --- CONFIGURATION ---
var USERS_WITH_PRICE_ACCESS = [
  "marblehouse@gmail.com",
  "designacmestones@gmail.com",
  "satishguptajaipur@gmail.com"
];
var PLYTIX_API_ENDPOINT = "fetch_plytix_data.php";
// --- END CONFIGURATION ---

var grid = document.getElementById("productGrid");
var searchBox = document.getElementById("searchBox");
var categoryFilter = document.getElementById("categoryFilter");
var statusFilter = document.getElementById("statusFilter");
var variantFilter = document.getElementById("variantFilter");
var sortFilter = document.getElementById("sortFilter");
var statusBar = document.getElementById("catalogStatus");
var loggedUserBadge = document.getElementById("loggedUserBadge");

var masterProducts = [];
var productsToRender = [];
var currentIndex = 0;
var BATCH_SIZE = 40;
var isLoadingMore = false;
var imageObserver = null;
var scrollObserver = null;
var canViewPrices = false;

/* --------------------- Helpers --------------------- */
function getValue(row, key) {
  if (!row || !key) return "";
  
  // Direct key match (case-insensitive)
  var foundKey = Object.keys(row).find(function(k) { 
    return k.toLowerCase() === key.toLowerCase(); 
  });
  if (foundKey && row[foundKey] != null && row[foundKey] !== "") {
    var val = row[foundKey];
    // Handle arrays (like images)
    if (Array.isArray(val)) {
      return val.map(function(v) {
        if (typeof v === 'object' && v.url) return v.url;
        return String(v);
      }).filter(Boolean).join(', ');
    }
    return String(val).trim();
  }

  // Check in attributes object (Plytix structure: attributes is an OBJECT, not array)
  if (row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes)) {
    var attrKey = Object.keys(row.attributes).find(function(k) {
      return k.toLowerCase() === key.toLowerCase();
    });
    if (attrKey && row.attributes[attrKey] != null && row.attributes[attrKey] !== "") {
      var attrVal = row.attributes[attrKey];
      // Handle arrays
      if (Array.isArray(attrVal)) {
        return attrVal.map(function(v) {
          if (typeof v === 'object' && v.url) return v.url;
          return String(v);
        }).filter(Boolean).join(', ');
      }
      return String(attrVal).trim();
    }
  }

  // ALSO check if attributes is an array (different API responses)
  if (Array.isArray(row.attributes)) {
    for (var i = 0; i < row.attributes.length; i++) {
      var attr = row.attributes[i];
      if (attr && attr.name && attr.name.toLowerCase() === key.toLowerCase()) {
        if (attr.value != null && attr.value !== "") {
          return String(attr.value).trim();
        }
      }
    }
  }

  return "";
}









function getFirstImage(product) {
  // Priority order for image fields
  var imageFields = [
    "thumbnail",
    "product_images", 
    "application_images",
    "production_images",
    "similar_images",
    "images",
    "assets",
    "main_image",
    "primary_image",
    "image"
  ];
  
  for (var i = 0; i < imageFields.length; i++) {
    var fieldValue = getValue(product, imageFields[i]);
    if (fieldValue && fieldValue !== "") {
      // Handle comma-separated URLs or single URL
      var urls = fieldValue.split(',').map(function(u) { return u.trim(); });
      for (var j = 0; j < urls.length; j++) {
        var url = urls[j];
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return url;
        }
      }
    }
  }
  
  // Return a data URI for gray box
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='20' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E";
}









function getPrice(product, priceType) {
  var priceStr = getValue(product, priceType);
  if (!priceStr) return 0;
  return parseFloat(String(priceStr).replace(/[^0-9.-]+/g, "")) || 0;
}

function escapeHtml(str) {
  str = String(str || "");
  return str.replace(/[&<>"']/g, function(s) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s];
  });
}

function optimizeImage(url, size) {
  if (!url || url.startsWith("data:")) return url;
  
  var params = "fit=cover&output=webp";
  if (size === 'thumb') params += "&w=50&h=50&q=50";
  else if (size === 'modal-thumb') params += "&w=150&h=150&q=75";
  else params += "&w=800&h=800&q=80";
  
  return "https://wsrv.nl/?url=" + encodeURIComponent(url) + "&" + params;
}

/* --------------------- Session & Permissions --------------------- */
function checkPermissions() {
  var currentUser = localStorage.getItem("user");
  canViewPrices = USERS_WITH_PRICE_ACCESS.includes(currentUser);
}

/* --------------------- Load products --------------------- */
function setStatus(text) {
  if (statusBar) statusBar.textContent = text;
}

function loadProducts() {
  console.log("=== LOADING PRODUCTS ===");
  
  checkPermissions();
  var user = (localStorage && localStorage.getItem("user")) || "unknown";
  if (loggedUserBadge) loggedUserBadge.textContent = "Signed in as " + user;
  setStatus("Loading…");

  if (canViewPrices) {
    sortFilter.innerHTML += '<option value="price-asc">Sort by Price (Low-High)</option>';
    sortFilter.innerHTML += '<option value="price-desc">Sort by Price (High-Low)</option>';
  }

  var forceRefresh = localStorage.getItem('forceRefresh') === 'true';
  if (forceRefresh) {
    localStorage.removeItem('forceRefresh');
  }
  
  var apiUrl = PLYTIX_API_ENDPOINT + "?t=" + Date.now();
  if (forceRefresh) {
    apiUrl += "&force_refresh=true";
  }

  fetch(apiUrl, { 
    cache: "no-store",
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  })
    .then(function(res) { 
      console.log("=== FETCH RESPONSE ===");
      console.log("Status:", res.status);
      if (!res.ok) throw new Error("HTTP " + res.status); 
      return res.json(); 
    })
    .then(function(data) {
      console.log("=== RAW DATA RECEIVED ===");
      console.log("Data type:", Array.isArray(data) ? "Array" : typeof data);
      console.log("Length:", Array.isArray(data) ? data.length : "N/A");
      
if (data.length > 0) {
        console.log("First product sample:", data[0]);
        console.log("First product keys:", Object.keys(data[0]));
        console.log("Attributes type:", typeof data[0].attributes);
        console.log("Attributes structure:", data[0].attributes);
        
        // Log specific field values for debugging
        console.log("Label via getValue:", getValue(data[0], "label"));
        console.log("SKU via getValue:", getValue(data[0], "sku"));
        console.log("Images via getValue:", getValue(data[0], "product_images"));
      }

      masterProducts = Array.isArray(data) ? data : [];
      
      // Remove duplicates based on product ID
      var uniqueProducts = [];
      var seenIds = {};
      for (var i = 0; i < masterProducts.length; i++) {
        var pid = masterProducts[i].id || masterProducts[i].sku;
        if (!seenIds[pid]) {
          seenIds[pid] = true;
          uniqueProducts.push(masterProducts[i]);
        }
      }
      masterProducts = uniqueProducts;
      
      console.log("Unique products after deduplication:", masterProducts.length);
      
      populateCategoryFilter();
      applyFilters();
      setStatus("Loaded " + masterProducts.length + " unique products");
    })
    .catch(function(err) {
      console.error("=== FETCH ERROR ===", err);
      if (grid) grid.innerHTML = '<div class="text-danger">❌ Failed to load data: ' + err.message + '</div>';
      setStatus("Failed to load data");
    });
}

/* --------------------- Category Checkbox Filter --------------------- */
function populateCategoryFilter() {
  if (!categoryFilter) return;
  categoryFilter.innerHTML = "";
  
  var actionsLi = document.createElement("li");
  actionsLi.className = "category-actions";
  actionsLi.innerHTML = '<button type="button" class="btn btn-link p-0" id="selectAllCats">Select All</button>' +
                        '<button type="button" class="btn btn-link p-0" id="deselectAllCats">Deselect All</button>';
  categoryFilter.appendChild(actionsLi);

  var set = new Set();
  masterProducts.forEach(function(p) {
    var catsString = getValue(p, "categories") || "Uncategorized";
    catsString.split(',').forEach(function(cat) {
      var trimmedCat = cat.trim();
      if (trimmedCat) set.add(trimmedCat);
    });
  });
  
  var cats = Array.from(set).sort();
  cats.forEach(function(c) {
    var li = document.createElement("li");
    li.innerHTML = '<label class="dropdown-item mb-0"><input type="checkbox" class="category-checkbox" value="' + escapeHtml(c) + '"> ' + escapeHtml(c) + '</label>';
    categoryFilter.appendChild(li);
  });

  document.getElementById("selectAllCats").addEventListener("click", function() {
    categoryFilter.querySelectorAll('.category-checkbox').forEach(function(cb) { cb.checked = true; });
    applyFilters();
  });
  document.getElementById("deselectAllCats").addEventListener("click", function() {
    categoryFilter.querySelectorAll('.category-checkbox').forEach(function(cb) { cb.checked = false; });
    applyFilters();
  });
}

/* --------------------- Card creation (DOM only) --------------------- */
function createProductCard(product) {
  var label = getValue(product, "label") || getValue(product, "name") || getValue(product, "product_name") || getValue(product, "sku") || "Unnamed";
  var sku = getValue(product, "sku") || getValue(product, "product_code") || "";
  var retailPrice = getPrice(product, "retail_price") || getPrice(product, "price");
  var isEnabled = getValue(product, "product_enabled").toUpperCase() !== 'FALSE';

  var mainImg = getFirstImage(product);
  var thumbSrc = optimizeImage(mainImg, 'thumb');
  var fullSrc = optimizeImage(mainImg, 'full');

  var col = document.createElement("div");
  col.className = "col-lg-3 col-md-4 col-sm-6 product-card";

  var card = document.createElement("div");
  card.className = "card shadow-sm h-100";
  if (!isEnabled) card.classList.add("disabled-product");
  card.style.cursor = "pointer";
  card.addEventListener("click", function() { showProductDetail(product); });

  var placeholder = document.createElement("div");
  placeholder.className = "image-placeholder";
  placeholder.innerHTML = '<img class="img-thumb" src="' + escapeHtml(thumbSrc) + '" alt="thumbnail"><img class="img-full" data-src="' + escapeHtml(fullSrc) + '" alt="product">';

  var body = document.createElement("div");
  body.className = "card-body";

  var h6 = document.createElement("h6");
  h6.className = "card-title";
  h6.textContent = label;

  var pSku = document.createElement("p");
  pSku.className = "text-muted small mb-1";
  pSku.textContent = "SKU: " + (sku || "-");

  body.appendChild(h6);
  body.appendChild(pSku);

  if (canViewPrices && retailPrice > 0) {
    var pPrice = document.createElement("p");
    pPrice.className = "small";
    pPrice.innerHTML = "<strong>₹" + retailPrice.toLocaleString('en-IN') + "</strong>";
    body.appendChild(pPrice);
  }

  card.appendChild(placeholder);
  card.appendChild(body);
  col.appendChild(card);
  return col;
}

/* --------------------- Render batches & lazy load --------------------- */
function renderNextBatch() {
  if (isLoadingMore) return;
  isLoadingMore = true;

  var slice = productsToRender.slice(currentIndex, currentIndex + BATCH_SIZE);
  currentIndex += slice.length;

  var frag = document.createDocumentFragment();
  slice.forEach(function(p) { frag.appendChild(createProductCard(p)); });
  if (grid) grid.appendChild(frag);

  if (imageObserver) imageObserver.disconnect();
  var lazyImages = document.querySelectorAll(".img-full:not(.loaded)");
  imageObserver = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var img = entry.target;
        var src = img.getAttribute("data-src");
        if (src) {
          img.src = src;
          img.onload = function() { img.classList.add("loaded"); };
          img.onerror = function() { 
            console.warn("Failed to load image:", src);
            // Use data URI for error state too
            img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f88'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='16' fill='%23fff'%3EImage Error%3C/text%3E%3C/svg%3E";
          };
        }
        obs.unobserve(img);
      }
    });
  }, { rootMargin: "200px" });

  lazyImages.forEach(function(img) { imageObserver.observe(img); });
  isLoadingMore = false;
}

function renderProducts(list) {
  productsToRender = list;
  grid.innerHTML = "";
  currentIndex = 0;
  isLoadingMore = false;

  if (scrollObserver) scrollObserver.disconnect();
  var sentinel = document.getElementById("scrollSentinel");
  if (sentinel) sentinel.parentNode.removeChild(sentinel);

  if (!productsToRender.length) {
    grid.innerHTML = '<div class="text-center text-muted">No products found.</div>';
    return;
  }

  renderNextBatch();

  if (currentIndex < productsToRender.length) {
    sentinel = document.createElement("div");
    sentinel.id = "scrollSentinel";
    sentinel.style.height = "50px";
    if (grid.parentElement) grid.parentElement.appendChild(sentinel);

    scrollObserver = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) renderNextBatch();
    });
    scrollObserver.observe(sentinel);
  }
}

/* --------------------- Filtering & Sorting --------------------- */
function applyFilters() {
  var term = searchBox.value.toLowerCase();
  var status = statusFilter.value;
  var variant = variantFilter.value;
  var selectedCats = Array.from(categoryFilter.querySelectorAll('input:checked')).map(function(cb) { return cb.value; });
  
  var filtered = masterProducts.filter(function(p) {
    var isVariant = !!getValue(p, "variant_of") || !!p._parent_id;
    var isParent = !!getValue(p, "variants") || (p.num_variations && p.num_variations > 0);
    
    if (variant === 'parents' && !isParent) return false;
    if (variant === 'variants' && !isVariant) return false;
    if (variant === 'singles' && (isParent || isVariant)) return false;
    if (variant === 'variants-and-singles' && isParent) return false;

    var isEnabled = getValue(p, "product_enabled").toUpperCase() !== 'FALSE';
    if (!((status === 'all') || (status === 'enabled' && isEnabled) || (status === 'disabled' && !isEnabled))) return false;

    var productCats = (getValue(p, "categories") || "Uncategorized").split(',').map(function(c) { return c.trim(); });
    if (selectedCats.length > 0 && !selectedCats.some(function(sc) { return productCats.includes(sc); })) return false;

    var label = getValue(p, "label").toLowerCase();
    var name = getValue(p, "name").toLowerCase();
    var sku = getValue(p, "sku").toLowerCase();
    if (term && !(label.includes(term) || name.includes(term) || sku.includes(term))) return false;

    return true;
  });

  var sortValue = sortFilter.value;
  filtered.sort(function(a, b) {
    switch (sortValue) {
      case "price-asc": return getPrice(a, "retail_price") - getPrice(b, "retail_price");
      case "price-desc": return getPrice(b, "retail_price") - getPrice(a, "retail_price");
      case "label-asc": return (getValue(a, "label") || getValue(a, "name")).localeCompare(getValue(b, "label") || getValue(b, "name"));
      case "label-desc": return (getValue(b, "label") || getValue(b, "name")).localeCompare(getValue(a, "label") || getValue(a, "name"));
      case "sku-desc": return getValue(b, "sku").localeCompare(getValue(a, "sku"), undefined, { numeric: true });
      default: return getValue(a, "sku").localeCompare(getValue(b, "sku"), undefined, { numeric: true });
    }
  });

  renderProducts(filtered);
  setStatus("Showing " + filtered.length + " matching products");
}

/* --------------------- Modal detail --------------------- */
function showProductDetail(product) {
  var modal = new bootstrap.Modal(document.getElementById("productModal"));
  var title = document.getElementById("modalTitle");
  var body = document.getElementById("modalBody");
  
  title.textContent = getValue(product, "label") || getValue(product, "name") || getValue(product, "sku") || "Product Details";
  body.innerHTML = "";

  var leftCol = document.createElement("div");
  leftCol.className = "col-md-6";

  // Show main image
  var mainImg = getFirstImage(product);
  if (mainImg) {
    var h6 = document.createElement("h6");
    h6.textContent = "Product Image";
    leftCol.appendChild(h6);
    
    var a = document.createElement("a");
    a.href = mainImg;
    a.target = "_blank";
    
    var im = document.createElement("img");
    im.src = optimizeImage(mainImg, 'modal-thumb');
    im.style.cssText = "max-width:300px; max-height:300px; object-fit:cover; margin:4px; border-radius:6px;";
    im.onerror = function() {
      this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='16' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
    };
    a.appendChild(im);
    leftCol.appendChild(a);
  }

  var rightCol = document.createElement("div");
  rightCol.className = "col-md-6";
  var table = document.createElement("table");
  table.className = "table table-sm table-bordered";

  // Show all direct properties
  Object.keys(product).forEach(function(k) {
    if (k === 'attributes' || k === 'thumbnail') return; // Skip these for now
    
    var isPriceField = k.toLowerCase().includes("price");
    if (isPriceField && !canViewPrices) return;

    var v = product[k];
    if (v == null || v === "") return;
    
    var tr = table.insertRow();
    tr.insertCell().textContent = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
    var td = tr.insertCell();
    td.textContent = String(v);
  });

// Show attributes from attributes object
  if (product.attributes && typeof product.attributes === 'object') {
    var attrKeys = Object.keys(product.attributes);
    attrKeys.forEach(function(attrName) {
      var isPriceField = attrName.toLowerCase().includes("price");
      if (isPriceField && !canViewPrices) return;
      
      var attrValue = product.attributes[attrName];
      if (attrValue == null || attrValue === "") return;
      
      var tr = table.insertRow();
      tr.insertCell().textContent = attrName.charAt(0).toUpperCase() + attrName.slice(1).replace(/_/g, " ");
      var td = tr.insertCell();
      
      // Handle arrays (like multiple images)
      if (Array.isArray(attrValue)) {
        var displayVal = attrValue.map(function(v) {
          if (typeof v === 'object' && v.url) return v.url;
          return String(v);
        }).join(', ');
        td.textContent = displayVal;
      } else if (typeof attrValue === 'object') {
        td.textContent = JSON.stringify(attrValue);
      } else {
        td.textContent = String(attrValue);
      }
    });
  }
  
  // ALSO handle if attributes is an array (fallback)
  if (Array.isArray(product.attributes)) {
    product.attributes.forEach(function(attr) {
      if (!attr || !attr.name) return;
      
      var isPriceField = attr.name.toLowerCase().includes("price");
      if (isPriceField && !canViewPrices) return;
      
      var tr = table.insertRow();
      tr.insertCell().textContent = attr.name;
      var td = tr.insertCell();
      
      if (attr.value != null && attr.value !== "") {
        td.textContent = String(attr.value);
      } else {
        td.textContent = "-";
      }
    });
  }

  rightCol.appendChild(table);

  // Create correct Plytix edit link
  var productId = product.id;
  var sku = getValue(product, "sku");
  
  if (productId) {
    var plytixBtn = document.createElement("a");
    plytixBtn.href = "https://pim.plytix.com/products/" + encodeURIComponent(productId);
    plytixBtn.target = "_blank";
    plytixBtn.rel = "noopener noreferrer";
    plytixBtn.className = "btn btn-outline-primary w-100 mt-3";
    plytixBtn.textContent = "✏️ Edit in Plytix";
    rightCol.appendChild(plytixBtn);
  }

  body.appendChild(leftCol);
  body.appendChild(rightCol);
  modal.show();
}

/* --------------------- UI wiring --------------------- */
function init() {
  searchBox.addEventListener("input", applyFilters);
  statusFilter.addEventListener("input", applyFilters);
  variantFilter.addEventListener("input", applyFilters);
  sortFilter.addEventListener("input", applyFilters);
  
  categoryFilter.addEventListener("click", function(e) {
    if (e.target.classList.contains('category-checkbox')) {
      applyFilters();
    }
  });
  
  loadProducts();
}

/* --------------------- Init --------------------- */
init();
