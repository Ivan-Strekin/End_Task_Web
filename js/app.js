(function () {
  'use strict';
  const STORAGE_CART = 'coffee_cart_v1';
  const STORAGE_PREFS = 'coffee_prefs_v1';
  const STORAGE_ORDERS = 'coffee_orders_v1';

  // DATA LOADING
  const DATA = {
    categories: [],
    products: [],
    options: { sizes: [], extras: [], milks: [] }
  };
  
  const sizeIdToNameMap = { 1: 'Short', 2: 'Tall', 3: 'Grande', 4: 'Venti' };
  const sizeStringToIdMap = { 'short': 1, 'tall': 2, 'grande': 3, 'venti': 4 };
  const milkStringToIdMap = { 'oat': 1, 'soy': 2, 'almond': 3 };
  const extraStringToIdMap = { 'sugar': 1, 'milk': 2 };
  
  async function loadJSONData() {
    try {
      const [categoriesRes, productsRes, optionsRes] = await Promise.all([
        fetch('data/categories.json'),
        fetch('data/products.json'),
        fetch('data/options.json')
      ]);
      if (!categoriesRes.ok || !productsRes.ok || !optionsRes.ok) throw new Error('Failed to load JSON data');
      DATA.categories = await categoriesRes.json();
      DATA.products = await productsRes.json();
      DATA.options = await optionsRes.json();
      initApp();
    } catch (error) {
      console.error('Error loading JSON data:', error);
    }
  }
  
  function migrateSavedData(saved) {
    if (typeof saved.size === 'string' && sizeStringToIdMap[saved.size]) {
      saved.size = sizeStringToIdMap[saved.size];
    } else if (typeof saved.size === 'string') {
      saved.size = 1;
    }
    if (typeof saved.milk === 'string' && milkStringToIdMap[saved.milk]) {
      saved.milk = milkStringToIdMap[saved.milk];
    } else if (typeof saved.milk === 'string') {
      saved.milk = 1;
    }
    if (Array.isArray(saved.extras)) {
      saved.extras = saved.extras.map(extra => {
        if (typeof extra === 'string' && extraStringToIdMap[extra]) return extraStringToIdMap[extra];
        if (typeof extra === 'string') return null;
        return extra;
      }).filter(extra => extra !== null);
    }
    return saved;
  }

  // MENU BUTTONS SWITCHING
  const categorySlider = document.querySelector('#categorySlider');
  const categoryList = document.querySelector('#categoryList');
  const categoryVerticalContainer = document.querySelector('#categoryVerticalContainer');
  const categoryScrollUp = document.querySelector('#categoryScrollUp');
  const categoryScrollDown = document.querySelector('#categoryScrollDown');
  const catPrev = document.querySelector('#catPrev');
  const catNext = document.querySelector('#catNext');
  const burgerBtn = document.querySelector('#burgerBtn');
  const burgerClose = document.querySelector('#burgerClose');
  const categoryPanel = document.querySelector('#categoryPanel');
  const overlay = document.querySelector('#overlay');
  let activeCategory = 1;
  let searchQuery = '';

  function updateCategoryContainer(container, containerType) {
    if (!container) return;
    let html = '';
    for (let i = 0; i < DATA.categories.length; i++) {
      const category = DATA.categories[i];
      const isActive = category.id === activeCategory;
      if (containerType === 'burger') {
        html += `<li><button class="category-list button" type="button" role="listitem" data-cat="${category.id}" aria-current="${isActive}">${isActive ? `<img class="category-list__icon" src="assets/icons/logo-coffee-menu.svg" alt="${category.name}">` : ''}<span class="category-list__name">${category.name}</span></button></li>`;
      } else {
        const className = containerType === 'slider' ? 'category-chip' : 'category-vertical-item';
        const iconClass = containerType === 'slider' ? 'category-chip__icon' : 'category-vertical-item__icon';
        const nameClass = containerType === 'slider' ? 'category-chip__name' : 'category-vertical-item__name';
        html += `<button class="${className}" type="button" role="listitem" data-cat="${category.id}" aria-current="${isActive}">${isActive ? `<img class="${iconClass}" src="assets/icons/logo-coffee-menu.svg" alt="${category.name}">` : ''}<span class="${nameClass}">${category.name}</span></button>`;
      }
    }
    container.innerHTML = html;
  }

  function changeActiveCategory(newCategory) {
    activeCategory = parseInt(newCategory, 10);
    if (categorySlider) updateCategoryContainer(categorySlider, 'slider');
    if (categoryList) updateCategoryContainer(categoryList, 'burger');
    if (categoryVerticalContainer) updateCategoryContainer(categoryVerticalContainer, 'vertical');
    renderProducts();
  }

  function openBurger() {
    if (!categoryPanel || !burgerBtn) return;
    categoryPanel.classList.add('is-open');
    burgerBtn.setAttribute('aria-expanded', 'true');
    if (overlay) overlay.hidden = false;
  }

  function closeBurger() {
    if (!categoryPanel || !burgerBtn) return;
    categoryPanel.classList.remove('is-open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.hidden = true;
  }

  // SEARCH FILTER
  const searchForm = document.querySelector('.search');
  const qInput = document.querySelector('#q');

  // MY ORDER (CART)
  function money(n) {
    return '₹' + String(n.toFixed(0));
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function cartGet() {
    return readJSON(STORAGE_CART, {items: []});
  }

  function cartSet(cart) {
    writeJSON(STORAGE_CART, cart);
    renderCartCount();
  }

  function cartTotals(cart) {
    let qty = 0, total = 0;
    for (let i = 0; i < cart.items.length; i++) {
      qty += cart.items[i].qty;
      total += cart.items[i].totalPrice;
    }
    return {qty, total};
  }

  function renderCartCount() {
    const cartCount = document.querySelector('#cartCount');
    if (!cartCount) return;
    const totals = cartTotals(cartGet());
    cartCount.textContent = String(totals.qty);
  }

  function openCart() {
    const cartDrawer = document.querySelector('#cartDrawer');
    if (cartDrawer) {
      cartDrawer.classList.add('is-open');
      if (overlay) overlay.hidden = false;
    }
    const cartBtn = document.querySelector('#cartBtn');
    if (cartBtn) cartBtn.setAttribute('aria-expanded', 'true');
    showOrderStatus();
    renderCart();
  }

  function closeCart() {
    const cartDrawer = document.querySelector('#cartDrawer');
    if (cartDrawer) {
      cartDrawer.classList.remove('is-open');
      if (overlay) overlay.hidden = true;
    }
    const cartBtn = document.querySelector('#cartBtn');
    if (cartBtn) cartBtn.setAttribute('aria-expanded', 'false');
  }

  function updateCartItem(it, action) {
    const cart = cartGet();
    if (action === 'decrease') {
      it.qty = Math.max(1, it.qty - 1);
    } else if (action === 'increase') {
      it.qty = Math.min(99, it.qty + 1);
    } else if (action === 'remove') {
      cart.items = cart.items.filter(x => x.key !== it.key);
      cartSet(cart);
      renderCart();
      if (cart.items.length === 0) {
        showOrderStatus();
      } else {
        updateOrderFromCart();
      }
      return;
    }
    it.totalPrice = it.qty * it.unitPrice;
    cartSet(cart);
    renderCart();
    if (cart.items.length > 0) updateOrderFromCart();
  }

  function updateOrderFromCart() {
    const cart = cartGet();
    if (cart.items.length === 0) return;
    const order = createOrderFromCart(cart);
    const orders = ordersGet();
    if (orders.length === 0) {
      orders.push(order);
    } else {
      orders[orders.length - 1] = order;
    }
    ordersSet(orders);
    showOrderStatus();
  }

  function updateCartContainer(cartItems, items) {
    if (!cartItems) return;
    if (items.length === 0) {
      cartItems.innerHTML = '<li class="cart-item">Cart is empty.</li>';
      return;
    }
    let html = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const product = DATA.products[it.index] || DATA.products[0];
      const imagePath = 'assets/img/Coffee/' + (product.image || '3.png');
      html += `<li class="cart-item" data-key="${it.key}"><div class="cart-item__image-wrapper"><img class="cart-item__image" src="${imagePath}" alt="${it.name}" role="img" aria-label="Drink photo"></div><div class="cart-item__content"><div class="cart-item__top"><p class="cart-item__name">${it.name}</p><strong>${money(it.totalPrice)}</strong></div><p class="cart-item__meta">${it.options} · ${String(it.qty)} pcs.</p><div class="cart-item__actions"><button class="icon-btn" type="button" aria-label="Decrease" data-action="decrease">−</button><button class="icon-btn" type="button" aria-label="Increase" data-action="increase">+</button><button class="icon-btn" type="button" aria-label="Remove item" data-action="remove">Remove</button></div></div></li>`;
    }
    cartItems.innerHTML = html;
    const buttons = cartItems.querySelectorAll('[data-action]');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const li = btn.closest('.cart-item');
      const key = li.dataset.key;
      const it = items.find(item => item.key === key);
      if (it) {
        btn.addEventListener('click', () => updateCartItem(it, btn.dataset.action));
      }
    }
    updateOrderFromCart();
  }

  function renderCart() {
    const cartItems = document.querySelector('#cartItems');
    const cartTotalQty = document.querySelector('#cartTotalQty');
    const cartTotalPrice = document.querySelector('#cartTotalPrice');
    if (!cartItems || !cartTotalQty || !cartTotalPrice) return;
    const cart = cartGet();
    const totals = cartTotals(cart);
    updateCartContainer(cartItems, cart.items);
    cartTotalQty.textContent = String(totals.qty);
    cartTotalPrice.textContent = money(totals.total);
    renderCartCount();
  }

  function ordersGet() {
    return readJSON(STORAGE_ORDERS, []);
  }

  function ordersSet(orders) {
    writeJSON(STORAGE_ORDERS, orders);
  }

  function createOrderFromCart(cart) {
    return {
      id: Date.now(),
      timestamp: Date.now(),
      items: cart.items.map(item => ({
        index: item.index,
        name: item.name,
        options: item.options,
        qty: item.qty,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      subtotal: cartTotals(cart).total,
      discount: 0,
      discountPercent: 0
    };
  }

  function renderOrderStatus() {
    const orders = ordersGet();
    const orderedItems = document.querySelector('#orderedItems');
    const preparingItems = document.querySelector('#preparingItems');
    const finishingItems = document.querySelector('#finishingItems');
    const servedItems = document.querySelector('#servedItems');
    const orderedStage = document.querySelector('#orderedStage');
    const preparingStage = document.querySelector('#preparingStage');
    const finishingStage = document.querySelector('#finishingStage');
    const servedStage = document.querySelector('#servedStage');
    const orderSubtotal = document.querySelector('#orderSubtotal');
    const orderDiscount = document.querySelector('#orderDiscount');
    const orderDiscountPercent = document.querySelector('#orderDiscountPercent');
    const orderTotal = document.querySelector('#orderTotal');

    if (orders.length === 0) {
      if (orderedItems) orderedItems.innerHTML = '';
      if (preparingItems) preparingItems.innerHTML = '';
      if (finishingItems) finishingItems.innerHTML = '';
      if (servedItems) servedItems.innerHTML = '';
      [orderedStage, preparingStage, finishingStage, servedStage].forEach(stage => {
        if (stage) stage.classList.add('order-stage--empty');
      });
      if (orderSubtotal) orderSubtotal.textContent = money(0);
      if (orderDiscountPercent) orderDiscountPercent.textContent = '0';
      if (orderDiscount) orderDiscount.textContent = money(0);
      if (orderTotal) orderTotal.textContent = money(0);
      return;
    }

    const latestOrder = orders[orders.length - 1];
    const orderedTime = document.querySelector('#orderedTime');
    if (orderedTime) orderedTime.textContent = 'JUST NOW';

    function renderOrderItems(container, items, stage) {
      if (!container) return;
      if (items.length === 0) {
        container.innerHTML = '';
        if (stage) stage.classList.add('order-stage--empty');
        return;
      }
      if (stage) stage.classList.remove('order-stage--empty');
      let html = '';
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const product = DATA.products[item.index] || DATA.products[0];
        const imagePath = 'assets/img/Coffee/' + (product.image || '3.png');
        html += `<div class="order-status-item"><img class="order-status-item__image" src="${imagePath}" alt="${item.name}"><p class="order-status-item__name">${item.name}</p><span class="order-status-item__badge">${item.qty}</span></div>`;
      }
      container.innerHTML = html;
    }

    renderOrderItems(orderedItems, latestOrder.items, orderedStage);
    renderOrderItems(preparingItems, [], preparingStage);
    renderOrderItems(finishingItems, [], finishingStage);
    renderOrderItems(servedItems, [], servedStage);

    if (orderSubtotal) orderSubtotal.textContent = money(latestOrder.subtotal);
    const discountPercent = latestOrder.discountPercent || 0;
    if (orderDiscountPercent) orderDiscountPercent.textContent = discountPercent > 0 ? '-' + String(discountPercent) : '0';
    const discountAmount = latestOrder.subtotal * discountPercent / 100;
    if (orderDiscount) orderDiscount.textContent = money(discountAmount);
    if (orderTotal) orderTotal.textContent = money(latestOrder.subtotal - discountAmount);
  }

  function showOrderStatus() {
    const orderStatusView = document.querySelector('#orderStatusView');
    if (orderStatusView) {
      orderStatusView.style.display = 'flex';
      renderOrderStatus();
    }
  }

  function initCartUI() {
    const year = document.querySelector('#year');
    if (year) year.textContent = String(new Date().getFullYear());
    renderCartCount();

    const cartBtn = document.querySelector('#cartBtn');
    const cartClose = document.querySelector('#cartClose');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        const cartDrawer = document.querySelector('#cartDrawer');
        if (cartDrawer && cartDrawer.classList.contains('is-open')) {
          closeCart();
        } else {
          openCart();
        }
      });
    }
    if (cartClose) cartClose.addEventListener('click', closeCart);

    const checkoutBtn = document.querySelector('#checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        const cart = cartGet();
        if (cart.items.length === 0) return;
        updateOrderFromCart();
        openCart();
      });
    }

    const slideHandle = document.querySelector('#slideHandle');
    const slideToClose = document.querySelector('#slideToClose');
    if (slideHandle && slideToClose) {
      let isDragging = false, startX = 0, currentX = 0, startTranslate = 0, currentTranslate = 0;
      const handleDrag = (clientX, isTouch) => {
        if (!isDragging) return;
        currentX = clientX;
        currentTranslate = startTranslate + (currentX - startX);
        if (currentTranslate < 0) currentTranslate = 0;
        const maxTranslate = slideToClose.offsetWidth - slideHandle.offsetWidth;
        if (currentTranslate > maxTranslate) {
          currentTranslate = maxTranslate;
          closeCart();
          isDragging = false;
          currentTranslate = 0;
        }
        slideHandle.style.transform = 'translateX(' + currentTranslate + 'px)';
      };
      const handleEnd = () => {
        if (isDragging) {
          isDragging = false;
          slideHandle.style.cursor = 'grab';
          if (currentTranslate > slideToClose.offsetWidth * 0.7) closeCart();
          currentTranslate = 0;
          slideHandle.style.transform = 'translateX(0)';
        }
      };
      slideHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startTranslate = currentTranslate;
        slideHandle.style.cursor = 'grabbing';
      });
      document.addEventListener('mousemove', (e) => handleDrag(e.clientX, false));
      document.addEventListener('mouseup', handleEnd);
      slideHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        startTranslate = currentTranslate;
      });
      document.addEventListener('touchmove', (e) => handleDrag(e.touches[0].clientX, true));
      document.addEventListener('touchend', handleEnd);
    }

    showOrderStatus();
    renderCart();

    const deleteAllOrdersBtn = document.querySelector('#deleteAllOrdersBtn');
    if (deleteAllOrdersBtn) {
      deleteAllOrdersBtn.addEventListener('click', () => {
        ordersSet([]);
        cartSet({items: []});
        renderOrderStatus();
        renderCart();
        renderCartCount();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        closeCart();
        if (categoryPanel) categoryPanel.classList.remove('is-open');
        if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'false');
        overlay.hidden = true;
      });
    }
  }

  // PRODUCTS RENDERING
  function updateProductsContainer(productsGrid, products) {
    if (!productsGrid) return;
    let html = '';
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const imagePath = 'assets/img/Coffee/' + (p.image || '3.png');
      let productIndex = -1;
      for (let j = 0; j < DATA.products.length; j++) {
        if (DATA.products[j] === p) {
          productIndex = j;
          break;
        }
      }
      html += `<article class="product-card"><div class="product-photo-wrapper"><img class="product-photo" src="${imagePath}" alt="${p.name}" role="img" aria-label="Drink photo"><button class="product-add" type="button" aria-label="Add coffee" onclick="window.location.href='product.html?index=${productIndex}'">+</button></div><div class="product-price"><span>${money(p.price)}</span></div><h3 class="product-name">${p.name}</h3></article>`;
    }
    productsGrid.innerHTML = html;
  }

  function renderProducts() {
    const productsGrid = document.querySelector('#productsGrid');
    const resultsMeta = document.querySelector('#resultsMeta');
    if (!productsGrid) return;
    const filteredProducts = [];
    for (let i = 0; i < DATA.products.length; i++) {
      const p = DATA.products[i];
      if (p.category === activeCategory && (!searchQuery || p.name.toLowerCase().indexOf(searchQuery) !== -1)) {
        filteredProducts.push(p);
      }
    }
    updateProductsContainer(productsGrid, filteredProducts);
    if (resultsMeta) resultsMeta.textContent = 'Showing: ' + String(filteredProducts.length);
  }

  // PRODUCT PAGE
  function chipButton(label, pressed, sizeId) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    const sizeIds = [1, 2, 3, 4];
    if (sizeId && sizeIds.indexOf(sizeId) !== -1) {
      b.classList.add('chip--size');
      const sizeName = sizeIdToNameMap[sizeId];
      const folder = pressed ? 'No-click' : 'Click';
      const imagePath = 'assets/icons/coffee-logo-size/' + folder + '/' + sizeName + '.png';
      b.innerHTML = `<img src="${imagePath}" alt="${label}" data-size="${sizeId}"><span>${label}</span>`;
    } else {
      b.innerHTML = label;
    }
    return b;
  }

  function updateChipsContainer(container, options, savedValue, isArray, sizeChips, milkChips, saved, persist, renderChips, renderPrice) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const pressed = isArray ? savedValue.indexOf(opt.id) !== -1 : savedValue === opt.id;
      const sizeIdForButton = (container === sizeChips) ? opt.id : null;
      const b = chipButton(opt.name, pressed, sizeIdForButton);
      b.dataset.value = opt.id;
      b.addEventListener('click', () => {
        if (isArray) {
          const index = savedValue.indexOf(opt.id);
          if (index === -1) {
            savedValue.push(opt.id);
          } else {
            savedValue.splice(index, 1);
          }
        } else {
          if (container === sizeChips) saved.size = opt.id;
          else if (container === milkChips) saved.milk = opt.id;
        }
        persist();
        renderChips();
        if (container === sizeChips) renderPrice();
      });
      container.appendChild(b);
    }
  }

  function formatOptionsText(saved) {
    let sizeName = saved.size;
    for (let i = 0; i < DATA.options.sizes.length; i++) {
      if (DATA.options.sizes[i].id === saved.size) {
        sizeName = DATA.options.sizes[i].name;
        break;
      }
    }
    let milkName = saved.milk;
    for (let i = 0; i < DATA.options.milks.length; i++) {
      if (DATA.options.milks[i].id === saved.milk) {
        milkName = DATA.options.milks[i].name;
        break;
      }
    }
    const extras = [];
    for (let i = 0; i < saved.extras.length; i++) {
      for (let j = 0; j < DATA.options.extras.length; j++) {
        if (DATA.options.extras[j].id === saved.extras[i]) {
          extras.push(DATA.options.extras[j].name);
          break;
        }
      }
    }
    return sizeName + '; ' + milkName + (extras.length ? ('; ' + extras.join(', ')) : '');
  }

  // INITIALIZATION
  function initApp() {
    if (DATA.categories.length > 0) activeCategory = DATA.categories[0].id;
    renderCartCount();

    const productsGrid = document.querySelector('#productsGrid');
    if (productsGrid) {
      if (categorySlider) {
        updateCategoryContainer(categorySlider, 'slider');
        categorySlider.addEventListener('click', (e) => {
          const target = e.target.closest('.category-chip');
          if (target) changeActiveCategory(parseInt(target.dataset.cat, 10));
        });
      }
      if (categoryList) {
        updateCategoryContainer(categoryList, 'burger');
        categoryList.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-cat]');
          if (btn) {
            changeActiveCategory(parseInt(btn.dataset.cat, 10));
            closeBurger();
          }
        });
      }
      if (categoryVerticalContainer) {
        updateCategoryContainer(categoryVerticalContainer, 'vertical');
        categoryVerticalContainer.addEventListener('click', (e) => {
          const target = e.target.closest('.category-vertical-item');
          if (target) changeActiveCategory(parseInt(target.dataset.cat, 10));
        });
        function changeCategory(direction) {
          let currentIndex = -1;
          for (let i = 0; i < DATA.categories.length; i++) {
            if (DATA.categories[i].id === activeCategory) {
              currentIndex = i;
              break;
            }
          }
          const newIndex = direction === 'up' 
            ? (currentIndex > 0 ? currentIndex - 1 : DATA.categories.length - 1)
            : (currentIndex < DATA.categories.length - 1 ? currentIndex + 1 : 0);
          changeActiveCategory(DATA.categories[newIndex].id);
          const items = categoryVerticalContainer.querySelectorAll('.category-vertical-item');
          if (items[newIndex]) items[newIndex].scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
        if (categoryScrollUp) categoryScrollUp.addEventListener('click', () => changeCategory('up'));
        if (categoryScrollDown) categoryScrollDown.addEventListener('click', () => changeCategory('down'));
      }
      if (catPrev && categorySlider) {
        catPrev.addEventListener('click', () => categorySlider.scrollBy({left: -280, behavior: 'smooth'}));
      }
      if (catNext && categorySlider) {
        catNext.addEventListener('click', () => categorySlider.scrollBy({left: 280, behavior: 'smooth'}));
      }
      if (burgerBtn) {
        burgerBtn.addEventListener('click', () => {
          if (categoryPanel && categoryPanel.classList.contains('is-open')) {
            closeBurger();
          } else {
            openBurger();
          }
        });
      }
      if (burgerClose) burgerClose.addEventListener('click', closeBurger);
      if (qInput) {
        qInput.addEventListener('input', () => {
          searchQuery = qInput.value.trim().toLowerCase();
          renderProducts();
        });
      }
      if (searchForm) {
        searchForm.addEventListener('submit', (e) => e.preventDefault());
      }
      initCartUI();
      renderProducts();
    }

    const productTitle = document.querySelector('#productTitle');
    const productPrice = document.querySelector('#productPrice');
    if (productTitle && productPrice) {
      const productDesc = document.querySelector('#productDesc');
      const productImage = document.querySelector('#productImage');
      const params = new URLSearchParams(window.location.search);
      const indexParam = params.get('index');
      const productIndex = indexParam !== null ? parseInt(indexParam, 10) : 0;
      const product = DATA.products[productIndex] || DATA.products[0];
      productTitle.textContent = product.name;
      if (productDesc) productDesc.textContent = product.desc;
      if (productImage) {
        const imagePath = 'assets/img/Coffee/' + (product.image || '3.png');
        productImage.innerHTML = `<img src="${imagePath}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
      }
      const prefs = readJSON(STORAGE_PREFS, {});
      const productKey = productIndex.toString();
      const savedRaw = prefs[productKey] || {size: 1, extras: [], milk: 1, qty: 1};
      const saved = migrateSavedData(savedRaw);
      const sizeChips = document.querySelector('#sizeChips');
      const extraChips = document.querySelector('#extraChips');
      const milkChips = document.querySelector('#milkChips');

      function renderChips() {
        updateChipsContainer(sizeChips, DATA.options.sizes, saved.size, false, sizeChips, milkChips, saved, persist, renderChips, renderPrice);
        updateChipsContainer(extraChips, DATA.options.extras, saved.extras, true, sizeChips, milkChips, saved, persist, renderChips, renderPrice);
        updateChipsContainer(milkChips, DATA.options.milks, saved.milk, false, sizeChips, milkChips, saved, persist, renderChips, renderPrice);
        const qtyValue = document.querySelector('#qtyValue');
        if (qtyValue) qtyValue.textContent = String(saved.qty);
      }

      function calcPrice() {
        let size = DATA.options.sizes[0];
        for (let i = 0; i < DATA.options.sizes.length; i++) {
          if (DATA.options.sizes[i].id === saved.size) {
            size = DATA.options.sizes[i];
            break;
          }
        }
        return Math.round(product.price * size.mult);
      }

      function renderPrice() {
        productPrice.textContent = money(calcPrice());
      }

      function persist() {
        const cur = readJSON(STORAGE_PREFS, {});
        cur[productKey] = saved;
        writeJSON(STORAGE_PREFS, cur);
      }

      const qtyMinus = document.querySelector('#qtyMinus');
      const qtyPlus = document.querySelector('#qtyPlus');
      if (qtyMinus) {
        qtyMinus.addEventListener('click', () => {
          saved.qty = Math.max(1, saved.qty - 1);
          persist();
          renderChips();
        });
      }
      if (qtyPlus) {
        qtyPlus.addEventListener('click', () => {
          saved.qty = Math.min(99, saved.qty + 1);
          persist();
          renderChips();
        });
      }
      const addToCartBtn = document.querySelector('#addToCartBtn');
      if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
          const cart = cartGet();
          const unitPrice = calcPrice();
          const optsText = formatOptionsText(saved);
          const key = productIndex + '|' + saved.size + '|' + saved.milk + '|' + saved.extras.slice().sort().join(',');
          let existing = null;
          for (let i = 0; i < cart.items.length; i++) {
            if (cart.items[i].key === key) {
              existing = cart.items[i];
              break;
            }
          }
          if (existing) {
            existing.qty += saved.qty;
            existing.totalPrice = existing.qty * existing.unitPrice;
          } else {
            cart.items.push({
              key: key,
              index: productIndex,
              name: product.name,
              options: optsText,
              unitPrice: unitPrice,
              qty: saved.qty,
              totalPrice: unitPrice * saved.qty
            });
          }
          cartSet(cart);
          initCartUI();
          updateOrderFromCart();
          openCart();
        });
      }
      initCartUI();
      renderChips();
      renderPrice();
      renderCartCount();
    }
  }
  
  document.addEventListener('DOMContentLoaded', loadJSONData);
})();
