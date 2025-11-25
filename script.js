/**
 * script.js — v10 with Enhanced Variant Filter
 * - Added "Variants & Singles" option to the product type filter.
 * - Retains all previous features.
 */

// --- CONFIGURATION ---
var USERS_WITH_PRICE_ACCESS = [
  "marblehouse@gmail.com",
  "designacmestones@gmail.com",
  "satishguptajaipur@gmail.com"
];
var PLYTIX_API_ENDPOINT = "fetch_plytix_data.php"; // PHP endpoint that fetches from Plytix
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
  var foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
  if (foundKey) return String(row[foundKey] || "").trim();

  if (row.attributes && typeof row.attributes === 'object') {
    var foundAttrKey = Object.keys(row.attributes).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundAttrKey) return String(row.attributes[foundAttrKey] || "").trim();
  }

  return "";
}

function getImageUrls(imgField) {
  if (!imgField) return "";

  if (Array.isArray(imgField)) {
    return imgField.map(img => (typeof img === 'object' ? img.url || "" : img)).filter(Boolean).join(", ");
  }
  if (typeof imgField === 'object') {
    return imgField.url || "";
  }
  return imgField;
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
  try { localStorage.removeItem("user"); } catch (e) {}
  window.location.replace("login.html");
}

/* --------------------- Load products --------------------- */
function setStatus(text) {
  if (statusBar) statusBar.textContent = text;
}

function loadProducts() {
  console.log("=== LOADING PRODUCTS ===");
  console.log("Endpoint defined?", typeof PLYTIX_API_ENDPOINT !== 'undefined');
  console.log("Endpoint value:", PLYTIX_API_ENDPOINT);
  
  checkPermissions();
  var user = (localStorage && localStorage.getItem("user")) || "unknown";
  if (loggedUserBadge) loggedUserBadge.textContent = "Signed in as " + user;
  setStatus("Loading…");

  if (canViewPrices) {
    sortFilter.innerHTML += '<option value="price-asc">Sort by Price (Low-High)</option>';
    sortFilter.innerHTML += '<option value="price-desc">Sort by Price (High-Low)</option>';
  }

  fetch(PLYTIX_API_ENDPOINT + "?t=" + Date.now(), { cache: "no-store" })
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
      console.log("Length/Keys:", Array.isArray(data) ? data.length : Object.keys(data));
      console.log("First item:", data[0] || data);

      masterProducts = Array.isArray(data) ? data : [];
      populateCategoryFilter();
      applyFilters();
      setStatus("Loaded " + masterProducts.length + " products");
    })
    .catch(function(err) {
      console.error("=== FETCH ERROR ===", err);
      if (grid) grid.innerHTML = '<div class="text-danger">❌ Failed to load data. Check sharing settings.</div>';
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
  var label = getValue(product, "label") || getValue(product, "sku") || "Unnamed";
  var sku = getValue(product, "sku") || "";
  var retailPrice = getPrice(product, "retail_price");
  var isEnabled = getValue(product, "product_enabled").toUpperCase() !== 'FALSE';

  var imgsRaw = getImageUrls(getValue(product, "thumbnail")) || getImageUrls(getValue(product, "product_images")) || "";
  var mainImg = imgsRaw.split(",")[0].trim() || "https://via.placeholder.com/800";

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
  placeholder.innerHTML = '<img class="img-thumb" src="' + thumbSrc + '"><img class="img-full" data-src="' + fullSrc + '">';

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
    
    // Updated Variant/Parent Filter Logic
    if (variant === 'parents' && !isParent) return false;
    if (variant === 'variants' && !isVariant) return false;
    if (variant === 'singles' && (isParent || isVariant)) return false;
    if (variant === 'variants-and-singles' && isParent) return false; // NEW filter condition

    var isEnabled = getValue(p, "product_enabled").toUpperCase() !== 'FALSE';
    if (!((status === 'all') || (status === 'enabled' && isEnabled) || (status === 'disabled' && !isEnabled))) return false;

    var productCats = (getValue(p, "categories") || "Uncategorized").split(',').map(function(c) { return c.trim(); });
    if (selectedCats.length > 0 && !selectedCats.some(function(sc) { return productCats.includes(sc); })) return false;

    var label = getValue(p, "label").toLowerCase();
    var sku = getValue(p, "sku").toLowerCase();
    if (term && !(label.includes(term) || sku.includes(term))) return false;

    return true;
  });

  var sortValue = sortFilter.value;
  filtered.sort(function(a, b) {
    switch (sortValue) {
      case "price-asc": return getPrice(a, "retail_price") - getPrice(b, "retail_price");
      case "price-desc": return getPrice(b, "retail_price") - getPrice(a, "retail_price");
      case "label-asc": return getValue(a, "label").localeCompare(getValue(b, "label"));
      case "label-desc": return getValue(b, "label").localeCompare(getValue(a, "label"));
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
  
  title.textContent = getValue(product, "label") || getValue(product, "sku") || "Product Details";
  body.innerHTML = "";

  var leftCol = document.createElement("div");
  leftCol.className = "col-md-6";

  var imageFields = ["thumbnail","product_images","application_images","production_images","similar_images","assets"];
  imageFields.forEach(function(field) {
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
    if (!v || !String(v).trim() || imageFields.indexOf(k) !== -1) return;
    
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
