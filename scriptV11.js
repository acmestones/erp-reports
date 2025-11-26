/**
 * script.js — v11 with Image Fix and Force Refresh
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
  
  // Direct key match
  var foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
  if (foundKey && row[foundKey]) return String(row[foundKey] || "").trim();

  // Check in attributes
  if (row.attributes && typeof row.attributes === 'object') {
    var foundAttrKey = Object.keys(row.attributes).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundAttrKey && row.attributes[foundAttrKey]) return String(row.attributes[foundAttrKey] || "").trim();
  }

  return "";
}

function getImageUrls(imgField) {
  if (!imgField) return "";

  // Handle array of image objects
  if (Array.isArray(imgField)) {
    return imgField
      .map(function(img) {
        if (typeof img === 'object' && img !== null) {
          return img.url || img.original_url || img.thumbnail_url || "";
        }
        return String(img || "");
      })
      .filter(Boolean)
      .join(", ");
  }
  
  // Handle single image object
  if (typeof imgField === 'object' && imgField !== null) {
    return imgField.url || imgField.original_url || imgField.thumbnail_url || "";
  }
  
  // Handle string
  return String(imgField);
}

function getFirstImage(product) {
  // Try multiple image field keys in priority order
  var imageFields = [
    "thumbnail",
    "product_images", 
    "images",
    "main_image",
    "primary_image",
    "image"
  ];
  
  for (var i = 0; i < imageFields.length; i++) {
    var fieldValue = getValue(product, imageFields[i]);
    if (fieldValue) {
      var urls = getImageUrls(fieldValue);
      if (urls) {
        var firstUrl = urls.split(",")[0].trim();
        if (firstUrl && firstUrl !== "" && !firstUrl.includes("placeholder")) {
          return firstUrl;
        }
      }
    }
  }
  
  return "https://via.placeholder.com/800/CCCCCC/666666?text=No+Image";
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
  if (!url || url.indexOf("via.placeholder.com") !== -1) return url;
  
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

function logout() {
  try { 
    localStorage.removeItem("user");
    localStorage.removeItem("forceRefresh");
  } catch (e) {}
  window.location.replace("login.html");
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

  // Check if force refresh is requested
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
      console.log("URL:", res.url);
      if (!res.ok) throw new Error("HTTP " + res.status); 
      return res.json(); 
    })
    .then(function(data) {
      console.log("=== RAW DATA RECEIVED ===");
      console.log("Type:", Array.isArray(data) ? "Array" : typeof data);
      console.log("Length:", Array.isArray(data) ? data.length : "N/A");
      
      if (data.length > 0) {
        console.log("First product sample:", data[0]);
        console.log("Available keys in first product:", Object.keys(data[0]));
      }

      masterProducts = Array.isArray(data) ? data : [];
      populateCategoryFilter();
      applyFilters();
      setStatus("Loaded " + masterProducts.length + " products");
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
  var label = getValue(product, "label") || getValue(product, "name") || getValue(product, "sku") || "Unnamed";
  var sku = getValue(product, "sku") || "";
  var retailPrice = getPrice(product, "retail_price");
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
            img.src = "https://via.placeholder.com/800/CCCCCC/666666?text=Image+Error";
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
    var isVariant = !!getValue(p, "variant_of");
    var isParent = !!getValue(p, "variants");
    
    if (variant === 'parents' && !isParent) return false;
    if (variant === 'variants' && !isVariant) return false;
    if (variant === 'singles' && (isParent || isVariant)) return false;
    if (variant === 'variants-and-singles' && isParent) return false;

    var isEnabled = getValue(p, "product_enabled").toUpperCase() !== 'FALSE';
    if (!((status === 'all') || (status === 'enabled' && isEnabled) || (status === 'disabled' && !isEnabled))) return false;

    var productCats = (getValue(p, "categories") || "Uncategorized").split(',').map(function(c) { return c.trim(); });
    if (selectedCats.length > 0 && !selectedCats.some(function(sc) { return productCats.includes(sc); })) return false;

    var label = getValue(product, "label").toLowerCase();
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

  // Collect all possible image fields
  var imageFieldKeys = Object.keys(product).filter(function(k) {
    return k.toLowerCase().includes('image') || k.toLowerCase().includes('thumbnail') || k.toLowerCase().includes('photo') || k.toLowerCase().includes('asset');
  });

  imageFieldKeys.forEach(function(field) {
    var val = getValue(product, field);
    if (!val) return;
    var imgs = val.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (!imgs.length) return;

    var h6 = document.createElement("h6");
    h6.textContent = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " ");
    leftCol.appendChild(h6);
    
    imgs.forEach(function(imgUrl) {
      var a = document.createElement("a");
      a.href = optimizeImage(imgUrl, 'full').replace('w=800&h=800', 'w=1200&h=1200');
      a.target = "_blank";
      
      var im = document.createElement("img");
      im.src = optimizeImage(imgUrl, 'modal-thumb');
      im.style.cssText = "height:100px; width:100px; object-fit:cover; margin:4px; border-radius:6px;";
      im.onerror = function() {
        this.src = "https://via.placeholder.com/100/CCCCCC/666666?text=Error";
      };
      a.appendChild(im);
      leftCol.appendChild(a);
    });
  });

  var rightCol = document.createElement("div");
  rightCol.className = "col-md-6";
  var table = document.createElement("table");
  table.className = "table table-sm table-bordered";

  var urlRegex = /^(https?:\/\/[^\s]+)$/;
  Object.keys(product).forEach(function(k) {
    var isPriceField = k.toLowerCase().includes("price");
    if (isPriceField && !canViewPrices) return;

    var v = product[k];
    if (!v || !String(v).trim() || imageFieldKeys.indexOf(k) !== -1) return;
    
    var tr = table.insertRow();
    tr.insertCell().textContent = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
    var td = tr.insertCell();
    
    if (urlRegex.test(v)) {
      td.innerHTML = '<a href="' + escapeHtml(v) + '" target="_blank" rel="noopener">' + escapeHtml(v) + '</a>';
    } else {
      td.textContent = v;
    }
  });

  rightCol.appendChild(table);

  var sku = getValue(product, "sku"), productId = getValue(product, "product_id"), plytixLink = null;
  if (productId) plytixLink = "https://pim.plytix.com/products/panel/" + encodeURIComponent(productId) + "/detail/attributes";
  else if (sku) plytixLink = "https://pim.plytix.com/products/" + encodeURIComponent(sku);

  if (plytixLink) {
    var plytixBtn = document.createElement("a");
    plytixBtn.href = plytixLink;
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
  document.getElementById("searchBox").addEventListener("input", applyFilters);
  document.getElementById("statusFilter").addEventListener("input", applyFilters);
  document.getElementById("variantFilter").addEventListener("input", applyFilters);
  document.getElementById("sortFilter").addEventListener("input", applyFilters);
  
  categoryFilter.addEventListener("click", function(e) {
    if (e.target.classList.contains('category-checkbox')) {
      applyFilters();
    }
  });
  
  loadProducts();
}

/* --------------------- Init --------------------- */
init();
