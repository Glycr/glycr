// Glycr Modern App
class GlycrApp {
  constructor() {
    this.currentUser = null;
    this.events = this.loadFromStorage('glycr_events') || [];
    this.tickets = this.loadFromStorage('glycr_tickets') || [];
    this.waitlists = this.loadFromStorage('glycr_waitlists') || [];
    this.users = this.loadFromStorage('glycr_users') || [];
    this.favorites = this.loadFromStorage('glycr_favorites') || {}; // userId -> [eventIds]
    this.shares = this.loadFromStorage('glycr_shares') || {}; // eventId -> count
    this.payouts = this.loadFromStorage('glycr_payouts') || []; // Array of payout objects
    this.currentEventId = null;
    this.selectedTicket = null;
    this.selectedTicketType = null;
    this.editingEvent = null;
    this.salesChart = null;
    this.selectedPaymentMethod = 'mtn-momo';
    this.currentDate = new Date('2025-10-15'); // Fixed for demo

    this.init();
  }

  sendSMS(phone, message) {
    console.log(`📱 SMS to ${phone}: ${message}`);
    // In production, integrate with Twilio or similar SMS API
  }

  sendEmail(email, subject, body) {
    console.log(`📧 Email to ${email}: ${subject} - ${body}`);
    // In production, integrate with email API
  }

  getCategoryEmoji(slug) {
    const emojis = {
      music: '🎵',
      food: '🍽️',
      arts: '🎭',
      sports: '⚽',
      business: '💼',
      nightlife: '🌃',
      family: '👨‍👩‍👧‍👦',
      workshops: '🛠️',
      community: '🎉',
      free: '🆓'
    };
    return emojis[slug] || '';
  }

  getCategoryName(slug) {
    const names = {
      music: 'Music',
      food: 'Food & Drink',
      arts: 'Arts & Theater',
      sports: 'Sports & Fitness',
      business: 'Business & Networking',
      nightlife: 'Nightlife & Parties',
      family: 'Family & Kids',
      workshops: 'Workshops & Classes',
      community: 'Community & Festivals',
      free: 'Free Events'
    };
    return names[slug] || slug;
  }

  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'CA$',
      'GHC': '₵'
    };
    return symbols[currency] || '$';
  }

  getDisplayPrice(price, symbol, isEarlyBird = false) {
    const prefix = isEarlyBird ? 'EARLY BIRD ' : '';
    return price === 0 ? 'FREE' : `${prefix}${symbol}${price}`;
  }

  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  validatePhone(phone) {
    const regex = /^\+233\d{9}$/;
    return regex.test(phone);
  }

  isEarlyBird(event, ticketType) {
    const ticketTypes = JSON.parse(event.ticketTypes);
    const earlyBirdEnd = ticketTypes[ticketType]?.earlyBirdEnd;
    if (!earlyBirdEnd) return false;
    return this.currentDate < new Date(earlyBirdEnd);
  }

  getTicketPrice(event, ticketType) {
    const ticketTypes = JSON.parse(event.ticketTypes);
    const basePrice = ticketTypes[ticketType]?.price || 0;
    if (this.isEarlyBird(event, ticketType)) {
      return ticketTypes[ticketType]?.earlyBirdPrice || basePrice;
    }
    return basePrice;
  }

  getGroupDiscount(quantity, ticketType) {
    // Demo: 10% off for 5+, 20% for 10+
    const event = this.events.find(e => e.id === this.currentEventId);
    if (!event) return 0;
    const ticketTypes = JSON.parse(event.ticketTypes);
    const discount = ticketTypes[ticketType]?.groupDiscount || 0;
    if (quantity >= 10) return discount * 2;
    if (quantity >= 5) return discount;
    return 0;
  }

  getPendingPayouts() {
    const totalRevenue = this.getTotalRevenue();
    const totalPaidOut = this.payouts.reduce((sum, p) => sum + p.amount, 0);
    return totalRevenue - totalPaidOut;
  }

  getTotalRevenue() {
    const allMyEvents = this.events.filter(e => e.organizerId === this.currentUser.id);
    const myTickets = this.tickets.filter(t => allMyEvents.some(e => e.id === t.eventId));
    return myTickets.reduce((sum, t) => sum + t.price, 0);
  }

  init() {
    this.checkAuth();
    this.bindEvents();
    this.renderEvents();
    this.setupMobileMenu();
    document.addEventListener('keydown', this.handleEscKey.bind(this));
  }

  handleEscKey(e) {
    if (e.key === 'Escape') {
      this.closeAllModals();
    }
  }

  loadFromStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  bindEvents() {
    // Navigation
    this.on('home-link', 'click', () => this.showSection('home'));
    this.on('profile-link', 'click', () => this.showSection('profile'));
    this.on('dashboard-link', 'click', () => this.showSection('dashboard'));
    this.on('analytics-link', 'click', () => this.showSection('insights'));
    this.on('login-link', 'click', () => this.openModal('auth-modal'));
    this.on('logout-link', 'click', () => this.logout());

    // Search & Filters
    this.on('search-input', 'input', () => this.renderEvents());
    this.on('category-filter', 'change', () => this.renderEvents());
    this.on('location-filter', 'change', () => this.renderEvents());
    this.on('clearFilters', 'click', () => this.clearFilters());
    this.on('event-date-filter', 'change', () => this.loadDashboard());

    // Auth
    this.on('auth-form', 'submit', (e) => {
      e.preventDefault();
      this.handleAuth();
    });

    // Profile
    this.on('edit-profile-btn', 'click', () => this.openModal('profile-edit-modal'));
    this.on('profile-form', 'submit', (e) => {
      e.preventDefault();
      this.saveProfile();
    });

    // Use event delegation for toggle auth link
    document.getElementById('toggle-auth').addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        e.preventDefault();
        this.toggleAuthMode();
      }
    });

    // Event Creation
    this.on('create-event-btn', 'click', () => this.showEventForm());
    this.on('create-event-btn-hero', 'click', () => this.showEventForm());
    this.on('event-form', 'submit', (e) => {
      e.preventDefault();
      this.saveEvent();
    });
    this.on('add-ticket-type', 'click', () => this.addTicketTypeInput());

    // Payment
    this.on('buy-ticket-btn', 'click', () => this.showPurchaseFlow());
    this.on('pay-btn', 'click', () => this.processPayment());

    // Payout
    this.on('request-payout-btn', 'click', () => this.showPayoutModal());
    this.on('payout-form', 'submit', (e) => {
      e.preventDefault();
      this.requestPayout();
    });
    document.getElementById('payout-method').addEventListener('change', (e) => this.togglePayoutDetails(e.target.value));

    // Waitlist
    this.on('waitlist-form', 'submit', (e) => {
      e.preventDefault();
      this.joinWaitlist();
    });

    // Modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => this.closeAllModals());
    });

    // Payment Methods
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.selectPaymentMethod(e.target.closest('.payment-method-btn')));
    });

    // Share
    this.on('share-btn', 'click', () => this.shareEvent());

    // Analytics
    this.on('generate-promo', 'click', () => this.generatePromo());
    this.on('validate-ticket', 'click', () => this.validateTicket());

    // Ticket removal
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-ticket')) {
        e.target.closest('.ticket-type').remove();
      }
    });

    // Waitlist join button delegation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('waitlist-btn')) {
        this.showWaitlistModal(e.target.dataset.eventId, e.target.dataset.ticketType);
      }
    });

    // Favorite toggle
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('favorite-btn')) {
        this.toggleFavorite(e.target.dataset.eventId);
      }
    });

    // Dashboard actions delegation
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.dataset.action === 'edit-event') {
        const event = this.events.find(ev => ev.id === parseInt(target.dataset.eventId));
        if (event) this.showEventForm(event);
      } else if (target.dataset.action === 'cancel-event') {
        this.showCancelModal(parseInt(target.dataset.eventId));
      } else if (target.dataset.action === 'toggle-publish') {
        this.togglePublish(parseInt(target.dataset.eventId));
      } else if (target.dataset.action === 'export-report') {
        this.exportReport(parseInt(target.dataset.eventId));
      } else if (target.dataset.action === 'delete-event') {
        this.deleteEvent(parseInt(target.dataset.eventId));
      } else if (target.dataset.action === 'view-waitlist') {
        this.viewWaitlist(parseInt(target.dataset.eventId), target.dataset.ticketType);
      }
    });

    // Confirm cancel
    this.on('confirm-cancel', 'click', () => this.cancelEvent());

    // Notify waitlist
    document.getElementById('notify-waitlist-btn').addEventListener('click', () => this.notifyWaitlist());
  }

  on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  setupMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');

    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        const isActive = navMenu.classList.toggle('active');
        navMenu.setAttribute('aria-hidden', !isActive);
        mobileBtn.setAttribute('aria-expanded', isActive);
      });
    }
  }

  checkAuth() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
      this.updateNav();
      if (this.currentUser.isOrganizer) {
        this.showSection('dashboard');
      } else {
        this.showSection('profile');
      }
    }
  }

  updateNav() {
    const isLoggedIn = !!this.currentUser;
    const isOrganizer = this.currentUser?.isOrganizer;

    document.getElementById('login-link').style.display = isLoggedIn ? 'none' : 'block';
    document.getElementById('logout-link').style.display = isLoggedIn ? 'block' : 'none';
    document.getElementById('profile-link').style.display = isLoggedIn ? 'block' : 'none';
    document.getElementById('dashboard-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('analytics-link').style.display = isOrganizer ? 'block' : 'none';
    document.getElementById('create-event-btn-hero').style.display = isOrganizer ? 'block' : 'none';
  }

  toggleAuthMode() {
    const title = document.getElementById('auth-title');
    const isLogin = title.textContent === 'Sign In';
    const authBtn = document.getElementById('auth-btn');
    const organizerCheckbox = document.getElementById('is-organizer').parentElement;
    const toggleText = document.getElementById('toggle-auth');
    const phoneInput = document.getElementById('phone');

    if (isLogin) {
      title.textContent = 'Create Account';
      authBtn.textContent = 'Create Account';
      organizerCheckbox.style.display = 'flex';
      phoneInput.style.display = 'block';
      toggleText.innerHTML = 'Already have an account? <a href="#">Sign in</a>';
    } else {
      title.textContent = 'Sign In';
      authBtn.textContent = 'Sign In';
      organizerCheckbox.style.display = 'none';
      phoneInput.style.display = 'none';
      toggleText.innerHTML = 'Don\'t have an account? <a href="#">Create one</a>';
    }
  }

  handleAuth() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const isOrganizer = document.getElementById('is-organizer').checked;
    const isLogin = document.getElementById('auth-title').textContent === 'Sign In';

    if (!email || !password) {
      return this.showError('Please fill in all fields');
    }

    if (!this.validateEmail(email)) {
      return this.showError('Invalid email format');
    }

    let user = this.users.find(u => u.email === email);

    if (isLogin) {
      if (!user || user.password !== this.hashPassword(password)) {
        return this.showError('Invalid credentials');
      }
    } else {
      if (user) {
        return this.showError('User already exists');
      }
      const phone = document.getElementById('phone').value.trim();
      if (!phone) {
        return this.showError('Phone number required');
      }
      if (!this.validatePhone(phone)) {
        return this.showError('Invalid phone number format (use +233xxxxxxxxx)');
      }
      user = {
        id: Date.now(),
        name: email.split('@')[0], // Demo name
        email,
        phone,
        password: this.hashPassword(password),
        isOrganizer,
        currency: 'GHC',
        createdAt: new Date().toISOString()
      };
      this.users.push(user);
      this.saveToStorage('glycr_users', this.users);
    }

    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.updateNav();
    this.closeAllModals();

    if (user.isOrganizer) {
      this.showSection('dashboard');
    } else {
      this.showSection('profile');
      this.loadProfile();
    }
  }

  hashPassword(password) {
    return btoa(password + 'glycr_salt');
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.updateNav();
    this.showSection('home');
  }

  showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.getElementById(section).style.display = 'block';

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    let activeLinkId;
    if (section === 'home') activeLinkId = 'home-link';
    else if (section === 'profile') activeLinkId = 'profile-link';
    else if (section === 'dashboard') activeLinkId = 'dashboard-link';
    else if (section === 'insights') activeLinkId = 'analytics-link';
    const activeLink = document.getElementById(activeLinkId);
    if (activeLink) activeLink.classList.add('active');

    if (section === 'home') this.renderEvents();
    if (section === 'profile') this.loadProfile();
    if (section === 'dashboard') this.loadDashboard();
    if (section === 'insights') this.loadInsights();
  }

  loadProfile() {
    if (!this.currentUser) return;
    document.getElementById('profile-name').textContent = this.currentUser.name || 'User';
    document.getElementById('profile-email').textContent = `Email: ${this.currentUser.email}`;
    document.getElementById('profile-phone').textContent = `Phone: ${this.currentUser.phone}`;

    // Purchase history
    const userTickets = this.tickets.filter(t => t.userId === this.currentUser.id);
    document.getElementById('purchase-history-list').innerHTML = userTickets.map(t => {
      const event = this.events.find(e => e.id === t.eventId);
      return `
        <div class="purchase-item">
          <h4>${event ? event.title : 'Event'}</h4>
          <p>${t.ticketType.toUpperCase()} - ${this.getDisplayPrice(t.price, this.getCurrencySymbol(event?.currency || 'GHC'))}</p>
          <p>Purchased: ${new Date(t.purchasedAt).toLocaleDateString()}</p>
        </div>
      `;
    }).join('') || '<p class="empty-state">No purchases yet</p>';

    // Favorites
    const userFavorites = this.favorites[this.currentUser.id] || [];
    const favoriteEvents = this.events.filter(e => userFavorites.includes(e.id) && !e.isCancelled);
    const grid = document.getElementById('favorite-events-list');
    grid.innerHTML = favoriteEvents.map(event => this.renderEventCard(event)).join('') || '<p class="empty-state">No favorites yet</p>';
  }

  saveProfile() {
    const name = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const phone = document.getElementById('profile-phone-input').value.trim();

    if (!name || !email || !phone) {
      return this.showError('Please fill in all fields');
    }

    if (!this.validateEmail(email)) {
      return this.showError('Invalid email format');
    }

    if (!this.validatePhone(phone)) {
      return this.showError('Invalid phone number format');
    }

    this.currentUser.name = name;
    this.currentUser.email = email;
    this.currentUser.phone = phone;
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

    // Update in users array
    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    if (userIndex > -1) {
      this.users[userIndex] = { ...this.currentUser };
      this.saveToStorage('glycr_users', this.users);
    }

    this.closeAllModals();
    this.loadProfile();
  }

  toggleFavorite(eventId) {
    if (!this.currentUser) return;
    const userId = this.currentUser.id;
    this.favorites[userId] = this.favorites[userId] || [];
    const index = this.favorites[userId].indexOf(eventId);
    if (index > -1) {
      this.favorites[userId].splice(index, 1);
    } else {
      this.favorites[userId].push(eventId);
    }
    this.saveToStorage('glycr_favorites', this.favorites);
    this.renderEvents(); // Refresh
    if (document.getElementById('profile')) this.loadProfile();
  }

  isFavorited(eventId) {
    if (!this.currentUser) return false;
    return (this.favorites[this.currentUser.id] || []).includes(eventId);
  }

  clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('location-filter').value = '';
    this.renderEvents();
  }

  renderEventCard(event) {
    const ticketTypes = JSON.parse(event.ticketTypes);
    // Fixed min-price calculation
    let minPrice = Infinity;
    let minType = null;
    Object.entries(ticketTypes).forEach(([type, data]) => {
      const price = this.getTicketPrice(event, type);
      if (price < minPrice) {
        minPrice = price;
        minType = type;
      }
    });
    const symbol = this.getCurrencySymbol(event.currency);
    const displayMinPrice = this.getDisplayPrice(minPrice, symbol, this.isEarlyBird(event, minType));
    const date = new Date(event.date);
    const categoryEmoji = this.getCategoryEmoji(event.category);
    const categoryName = this.getCategoryName(event.category);
    const isFav = this.isFavorited(event.id);
    const cancelledClass = event.isCancelled ? 'cancelled' : '';

    return `
      <div class="event-card ${cancelledClass}" data-event-id="${event.id}">
        ${event.isCancelled ? '<div style="position: absolute; top: 10px; right: 10px; background: var(--error); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">CANCELLED</div>' : ''}
        <img src="${event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400'}"
             alt="${event.title} event image"
             onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400'; this.alt='Generic event image'">
        <div class="event-card-content">
          <h3>${event.title}</h3>
          <p>📅 ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p>📍 ${event.venue}, ${event.location || 'TBA'}</p>
          <p>${categoryEmoji} ${categoryName}</p>
          <div class="event-card-footer">
            <span class="event-price">${displayMinPrice}</span>
            ${!event.isCancelled ? `<button class="favorite-btn ${isFav ? 'active' : ''}" data-event-id="${event.id}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">❤️</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderEvents() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const location = document.getElementById('location-filter').value;
    const now = this.currentDate;

    // Fixed filter callback syntax
    let filtered = this.events.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(search) ||
        e.description.toLowerCase().includes(search);
      const matchCategory = !category || e.category === category;
      const matchLocation = !location || e.location?.toLowerCase() === location;
      const isFuture = new Date(e.date) > now;
      const isPublished = e.isPublished;
      return !e.isCancelled && matchSearch && matchCategory && matchLocation && isFuture && isPublished;
    });

    const grid = document.getElementById('events-grid');

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <h3>No events found</h3>
          <p>Try adjusting your filters or create a new event</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(event => this.renderEventCard(event)).join('');

    // Add click handlers for event cards
    grid.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('favorite-btn') && !card.classList.contains('cancelled')) {
          this.showEventDetail(parseInt(card.dataset.eventId));
        }
      });
    });
  }

  showEventDetail(id) {
    const event = this.events.find(e => e.id === id);
    if (!event || event.isCancelled) return this.showError('Event not found or cancelled');

    this.currentEventId = id;
    const ticketTypes = JSON.parse(event.ticketTypes);
    const date = new Date(event.date);
    const symbol = this.getCurrencySymbol(event.currency);
    const categoryEmoji = this.getCategoryEmoji(event.category);
    const categoryName = this.getCategoryName(event.category);

    document.getElementById('event-detail').innerHTML = `
      <img src="${event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800'}"
           alt="${event.title} event image"
           onerror="this.src='https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800'; this.alt='Generic event image'">
      <h2 id="event-detail-h2">${event.title}</h2>
      <p>${event.description}</p>
      <p><strong>📅 Date:</strong> ${date.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}</p>
      <p><strong>📍 Venue:</strong> ${event.venue}, ${event.location}</p>
      <p><strong>🎭 Category:</strong> ${categoryEmoji} ${categoryName}</p>
      <p><strong>📧 Organizer:</strong> <a href="mailto:${event.organizerEmail}">${event.organizerEmail}</a></p>
      <p><strong>📱 Organizer Phone:</strong> ${event.organizerPhone}</p>
    `;

    document.getElementById('ticket-benefits').innerHTML = Object.entries(ticketTypes).map(([type, data]) => {
      const benefits = this.getTicketBenefits(type);
      const available = data.capacity - (data.sold || 0);
      const soldOut = available <= 0;
      const price = this.getTicketPrice(event, type);
      const isEB = this.isEarlyBird(event, type);
      const displayPrice = this.getDisplayPrice(price, symbol, isEB);

      let actionHtml = soldOut ? '' : `data-action="select-ticket" data-type="${type}" data-price="${price}"`;

      if (soldOut) {
        const waitlistCount = this.waitlists.filter(w => w.eventId === event.id && w.ticketType === type).length;
        actionHtml = `data-action="join-waitlist" data-event-id="${event.id}" data-ticket-type="${type}"`;
        return `
          <div class="ticket-option sold-out">
            <div style="flex: 1;">
              <h4>${type.toUpperCase()} - ${displayPrice}</h4>
              <p style="color: var(--error);">SOLD OUT</p>
              <div class="ticket-benefits">
                <strong>Includes:</strong>
                <ul>
                  ${benefits.map(b => `<li>${b}</li>`).join('')}
                </ul>
              </div>
              <p style="color: var(--text-muted); font-size: 0.85rem;">${waitlistCount} on waitlist</p>
              <button class="waitlist-btn" data-event-id="${event.id}" data-ticket-type="${type}">Join Waitlist</button>
            </div>
          </div>
        `;
      }

      return `
        <div class="ticket-option ${soldOut ? 'sold-out' : ''}" ${actionHtml}>
          <div style="flex: 1;">
            <h4>${type.toUpperCase()} - ${displayPrice}</h4>
            <p style="color: ${soldOut ? 'var(--error)' : 'var(--text-muted)'};">
              ${soldOut ? 'SOLD OUT' : `${available} tickets remaining`}
            </p>
            <div class="ticket-benefits">
              <strong>Includes:</strong>
              <ul>
                ${benefits.map(b => `<li>${b}</li>`).join('')}
              </ul>
            </div>
            ${isEB ? '<small style="color: var(--success);">Early Bird Special!</small>' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers for ticket selection
    document.getElementById('ticket-benefits').querySelectorAll('.ticket-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const action = option.dataset.action;
        if (action === 'select-ticket') {
          this.selectTicket(option.dataset.type, parseFloat(option.dataset.price), event.id);
        } else if (action === 'join-waitlist') {
          this.showWaitlistModal(event.id, option.dataset.ticketType);
        }
      });
    });

    this.openModal('event-modal');
  }

  showWaitlistModal(eventId, ticketType) {
    this.currentEventId = eventId;
    this.selectedTicket = { type: ticketType, eventId };
    document.getElementById('waitlist-title').textContent = `Join Waitlist for ${ticketType.toUpperCase()} Tickets`;
    document.getElementById('waitlist-form').reset();
    this.openModal('waitlist-modal');
  }

  joinWaitlist() {
    const name = document.getElementById('waitlist-name').value.trim();
    const email = document.getElementById('waitlist-email').value.trim();
    const phone = document.getElementById('waitlist-phone').value.trim();

    if (!name || !email || !phone) {
      return this.showError('Please fill in all fields');
    }

    if (!this.validateEmail(email)) {
      return this.showError('Invalid email format');
    }

    if (!this.validatePhone(phone)) {
      return this.showError('Invalid phone number format (use +233xxxxxxxxx)');
    }

    const existing = this.waitlists.find(w =>
      w.eventId === this.selectedTicket.eventId &&
      w.ticketType === this.selectedTicket.type &&
      w.email.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      return this.showError('You are already on the waitlist for this ticket type.');
    }

    const event = this.events.find(e => e.id === this.selectedTicket.eventId);
    if (!event) return this.showError('Event not found');

    const waitlistEntry = {
      id: Date.now(),
      eventId: this.selectedTicket.eventId,
      ticketType: this.selectedTicket.type,
      name,
      email,
      phone,
      joinedAt: new Date().toISOString()
    };

    this.waitlists.push(waitlistEntry);
    this.saveToStorage('glycr_waitlists', this.waitlists);

    this.sendSMS(phone, `Hi ${name}, you've joined the waitlist for ${this.selectedTicket.type.toUpperCase()} tickets for ${event.title}! You'll be notified via SMS when tickets are available. Reply STOP to unsubscribe.`);

    const statusEl = document.getElementById('waitlist-status');
    statusEl.className = 'payment-status success';
    statusEl.innerHTML = '<strong>✓ Joined waitlist!</strong><br>SMS confirmation sent. You\'ll be notified when tickets are available.';

    setTimeout(() => {
      this.closeAllModals();
      this.showEventDetail(this.currentEventId);
    }, 2000);
  }

  getTicketBenefits(type) {
    const benefits = {
      free: ['Free entry', 'General admission', 'Event access', 'Digital ticket'],
      regular: ['General admission', 'Event access', 'Digital ticket'],
      vip: ['Early entry', 'Premium seating', 'VIP lounge access', 'Meet & greet'],
      vvip: ['All VIP benefits', 'Backstage access', 'Photo opportunities', 'Exclusive merchandise']
    };
    return benefits[type.toLowerCase()] || ['Event access'];
  }

  selectTicket(type, price, eventId) {
    this.selectedTicket = { type, price, eventId };
    this.showPurchaseFlow();
  }

  showPurchaseFlow() {
    if (!this.selectedTicket) return;

    const event = this.events.find(e => e.id === this.selectedTicket.eventId);
    if (!event) return this.showError('Event not found');
    const benefits = this.getTicketBenefits(this.selectedTicket.type);
    const symbol = this.getCurrencySymbol(event.currency);
    const displayPrice = this.getDisplayPrice(this.selectedTicket.price, symbol, this.isEarlyBird(event, this.selectedTicket.type));

    document.getElementById('purchase-title').textContent =
      `${this.selectedTicket.type.toUpperCase()} Ticket - ${displayPrice}`;

    document.getElementById('ticket-types').innerHTML = `
      <div class="ticket-option selected">
        <h4>${this.selectedTicket.type.toUpperCase()} - ${displayPrice}</h4>
        <div class="ticket-benefits">
          <strong>Includes:</strong>
          <ul>
            ${benefits.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>
        ${this.isEarlyBird(event, this.selectedTicket.type) ? '<p style="color: var(--success);">Early Bird Pricing Applied!</p>' : ''}
      </div>
    `;

    document.getElementById('quantity-section').style.display = 'grid';
    const ticketTypes = JSON.parse(event.ticketTypes);
    document.getElementById('ticket-quantity').max = ticketTypes[this.selectedTicket.type].capacity - (ticketTypes[this.selectedTicket.type].sold || 0);
    this.updateDiscountInfo();

    // Handle group booking section visibility
    const qtyInput = document.getElementById('ticket-quantity');
    const groupSection = document.getElementById('group-booking-section');
    const handleQuantityChange = () => {
      const qty = parseInt(qtyInput.value) || 1;
      if (qty >= 5) {
        groupSection.style.display = 'grid';
      } else {
        groupSection.style.display = 'none';
        // Clear fields if hidden
        document.getElementById('company-name').value = '';
        document.getElementById('billing-address').value = '';
        document.getElementById('po-number').value = '';
      }
      this.updateDiscountInfo();
    };
    qtyInput.addEventListener('input', handleQuantityChange);
    handleQuantityChange(); // Initial check

    document.getElementById('payment-section').style.display = 'block';
    const paymentH4 = document.querySelector('#payment-section h4');
    const paymentMethods = document.querySelector('.payment-methods');
    const cardElement = document.getElementById('card-element');
    const payBtn = document.getElementById('pay-btn');

    if (this.selectedTicket.price === 0) {
      paymentH4.style.display = 'none';
      paymentMethods.style.display = 'none';
      cardElement.style.display = 'none';
      payBtn.textContent = 'Claim Free Ticket';
    } else {
      paymentH4.style.display = 'block';
      paymentMethods.style.display = 'grid';
      cardElement.style.display = this.selectedPaymentMethod === 'stripe' ? 'block' : 'none';
      payBtn.textContent = 'Complete Purchase';
    }

    this.openModal('purchase-modal');
  }

  updateDiscountInfo() {
    const quantity = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const discount = this.getGroupDiscount(quantity, this.selectedTicket.type);
    const infoEl = document.getElementById('discount-info');
    if (discount > 0) {
      infoEl.textContent = `Group discount: ${discount}% off for ${quantity} tickets!`;
    } else {
      infoEl.textContent = '';
    }
  }

  selectPaymentMethod(btn) {
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const method = btn.dataset.method;
    this.selectedPaymentMethod = method;
    document.getElementById('card-element').style.display = method === 'stripe' ? 'block' : 'none';
  }

  async processPayment() {
    const email = document.getElementById('payer-email').value.trim();
    const phone = document.getElementById('payer-phone').value.trim();
    const quantity = parseInt(document.getElementById('ticket-quantity').value) || 1;
    const setReminder = document.getElementById('set-reminder').checked;
    const companyName = document.getElementById('company-name')?.value.trim() || '';
    const billingAddress = document.getElementById('billing-address')?.value.trim() || '';
    const poNumber = document.getElementById('po-number')?.value.trim() || '';

    if (!email) {
      return this.showError('Email required for receipt');
    }
    if (!phone) {
      return this.showError('Phone number required');
    }

    if (!this.validateEmail(email)) {
      return this.showError('Invalid email format');
    }

    if (!this.validatePhone(phone)) {
      return this.showError('Invalid phone number format (use +233xxxxxxxxx)');
    }

    if (quantity >= 5 && companyName && !billingAddress) {
      return this.showError('Billing address required for corporate/group bookings');
    }

    const event = this.events.find(e => e.id === this.selectedTicket.eventId);
    if (!event) return this.showError('Event not found');
    const ticketTypes = JSON.parse(event.ticketTypes);
    const available = ticketTypes[this.selectedTicket.type].capacity - (ticketTypes[this.selectedTicket.type].sold || 0);
    if (quantity > available) {
      return this.showError('Not enough tickets available');
    }

    const statusEl = document.getElementById('payment-status');
    const method = this.selectedPaymentMethod;
    statusEl.className = 'payment-status';
    statusEl.textContent = this.selectedTicket.price === 0 ? 'Claiming tickets...' : `Processing ${method} payment for ${quantity} tickets...`;

    if (this.selectedTicket.price === 0) {
      statusEl.className = 'payment-status success';
      statusEl.innerHTML = `<strong>✓ ${quantity} tickets claimed!</strong>`;
      this.generateTicket(email, phone, quantity, setReminder, companyName, billingAddress, poNumber);
      return;
    }

    await this.delay(2000);

    statusEl.className = 'payment-status success';
    const discount = this.getGroupDiscount(quantity, this.selectedTicket.type);
    const total = quantity * this.selectedTicket.price * (1 - discount / 100);
    const isGroup = quantity >= 5 && companyName;
    statusEl.innerHTML = `<strong>✓ Payment successful via ${method.toUpperCase()} for ${quantity} tickets (Total: ${this.getCurrencySymbol(event.currency)}${total.toFixed(2)} ${discount > 0 ? `(Discount: ${discount}%)` : ''})!</strong>${isGroup ? '<br><small>Corporate/Group booking details saved.</small>' : ''}`;

    await this.delay(1500);
    this.generateTicket(email, phone, quantity, setReminder, companyName, billingAddress, poNumber);
  }

  generateTicket(email, phone, quantity = 1, setReminder = false, companyName = '', billingAddress = '', poNumber = '') {
    const event = this.events.find(e => e.id === this.selectedTicket.eventId);
    if (!event) return this.showError('Event not found');
    const ticketTypes = JSON.parse(event.ticketTypes);
    const discount = this.getGroupDiscount(quantity, this.selectedTicket.type);
    const pricePerTicket = this.selectedTicket.price * (1 - discount / 100);
    const isGroup = quantity >= 5 && companyName;

    // Generate multiple tickets
    for (let i = 0; i < quantity; i++) {
      const ticketId = `GLY-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const ticket = {
        id: ticketId,
        eventId: this.selectedTicket.eventId,
        userId: this.currentUser?.id || 'guest',
        userEmail: email,
        userPhone: phone,
        ticketType: this.selectedTicket.type,
        price: pricePerTicket,
        companyName,
        billingAddress,
        poNumber,
        purchasedAt: new Date().toISOString()
      };

      this.tickets.push(ticket);
      ticketTypes[this.selectedTicket.type].sold = (ticketTypes[this.selectedTicket.type].sold || 0) + 1;
    }

    event.ticketTypes = JSON.stringify(ticketTypes);
    this.saveToStorage('glycr_events', this.events);
    this.saveToStorage('glycr_tickets', this.tickets);

    this.sendSMS(phone, `Your Glycr tickets for ${event.title} (${this.selectedTicket.type.toUpperCase()}) have been purchased successfully! Check your email for details. Reply HELP for support.`);

    if (setReminder) {
      const date = new Date(event.date);
      this.sendSMS(phone, `Reminder: ${event.title} is on ${date.toLocaleDateString()}. See you there!`);
      this.sendEmail(email, 'Event Reminder', `Don't forget: ${event.title} on ${date.toLocaleDateString()}`);
    }

    if (isGroup) {
      this.sendEmail(email, `Group Booking Confirmation - ${event.title}`, `
Dear ${companyName},

Your group booking of ${quantity} ${this.selectedTicket.type.toUpperCase()} tickets for ${event.title} has been confirmed.

Billing Address: ${billingAddress}
PO Number: ${poNumber || 'N/A'}
Total: ${this.getCurrencySymbol(event.currency)}${ (quantity * this.selectedTicket.price * (1 - this.getGroupDiscount(quantity, this.selectedTicket.type) / 100)).toFixed(2) }

Individual tickets have been sent to ${email}.

Best,
Glycr Team
      `);
    }

    // Generate QR for first ticket (demo)
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, this.tickets.slice(-quantity)[0].id, { width: 300, margin: 2 }, (error) => {
      if (error) console.error(error);
    });

    document.getElementById('ticket-canvas').innerHTML = '';
    document.getElementById('ticket-canvas').appendChild(canvas);
    document.getElementById('ticket-id').textContent = `Ticket ID (x${quantity}): ${this.tickets.slice(-quantity)[0].id}`;

    this.closeAllModals();
    this.openModal('ticket-modal');

    if (this.currentUser && !this.currentUser.isOrganizer) {
      this.loadProfile();
    } else if (this.currentUser && this.currentUser.isOrganizer) {
      // Add this block to refresh dashboard for organizers
      setTimeout(() => {
        this.closeAllModals(); // Close ticket modal after viewing
        this.showSection('dashboard'); // Navigate back to dashboard
        this.loadDashboard(); // Force revenue/stats refresh
      }, 3000); // Brief delay to let user view ticket
    }
  }

  validateTicket() {
    alert('✓ Ticket Validated!\n\nWelcome to the event!\n\n(In production, this would integrate with NFC/QR scanner)');
  }

  showPayoutModal() {
    if (!this.currentUser?.isOrganizer) return this.showError('Access denied: Organizers only');
    const pending = this.getPendingPayouts();
    document.getElementById('payout-amount').max = pending;
    document.getElementById('payout-amount').placeholder = `Available: ${this.getCurrencySymbol(this.currentUser.currency || 'GHC')}${pending.toFixed(2)}`;
    document.getElementById('payout-form').reset();
    document.getElementById('payout-title').textContent = `Request Payout (Available: ${this.getCurrencySymbol(this.currentUser.currency || 'GHC')}${pending.toFixed(2)})`;
    this.openModal('payout-modal');
  }

  togglePayoutDetails(method) {
    const bankDetails = document.getElementById('bank-details');
    const momoDetails = document.getElementById('momo-details');
    bankDetails.style.display = method === 'bank' ? 'grid' : 'none';
    momoDetails.style.display = method === 'momo' ? 'block' : 'none';
  }

  requestPayout() {
    const amount = parseFloat(document.getElementById('payout-amount').value);
    const method = document.getElementById('payout-method').value;
    const email = document.getElementById('payout-email').value.trim();
    const notes = document.getElementById('payout-notes').value.trim();

    const pending = this.getPendingPayouts();
    if (amount > pending) {
      return this.showPayoutError('Amount exceeds available balance');
    }
    if (!amount || !method || !email) {
      return this.showPayoutError('Please fill in all required fields');
    }
    if (!this.validateEmail(email)) {
      return this.showPayoutError('Invalid email format');
    }

    if (method === 'bank') {
      const bankName = document.getElementById('bank-name').value.trim();
      const accountNumber = document.getElementById('account-number').value.trim();
      const accountName = document.getElementById('account-name').value.trim();
      if (!bankName || !accountNumber || !accountName) {
        return this.showPayoutError('All bank details required');
      }
    } else if (method === 'momo') {
      const momoNumber = document.getElementById('momo-number').value.trim();
      if (!this.validatePhone(momoNumber)) {
        return this.showPayoutError('Invalid Mobile Money number format');
      }
    }

    const payout = {
      id: Date.now(),
      organizerId: this.currentUser.id,
      amount,
      method,
      status: 'pending',
      email,
      notes,
      details: method === 'bank' ? {
        bankName: document.getElementById('bank-name').value.trim(),
        accountNumber: document.getElementById('account-number').value.trim(),
        accountName: document.getElementById('account-name').value.trim()
      } : method === 'momo' ? {
        phone: document.getElementById('momo-number').value.trim()
      } : {},
      requestedAt: new Date().toISOString()
    };

    this.payouts.push(payout);
    this.saveToStorage('glycr_payouts', this.payouts);

    this.sendEmail(email, 'Payout Request Received', `
Your payout request of ${this.getCurrencySymbol(this.currentUser.currency || 'GHC')}${amount} via ${method.toUpperCase()} has been received.
It will be processed within 3-5 business days.

Notes: ${notes || 'N/A'}

Best,
Glycr Team
    `);

    const statusEl = document.getElementById('payout-status');
    statusEl.className = 'payment-status success';
    statusEl.innerHTML = `<strong>✓ Payout request submitted!</strong><br>Confirmation sent to ${email}. Processing in 3-5 days.`;

    setTimeout(() => {
      this.closeAllModals();
      this.loadDashboard();
    }, 2000);
  }

  showPayoutError(message) {
    const statusEl = document.getElementById('payout-status');
    statusEl.className = 'payment-status error';
    statusEl.textContent = message;
  }

  viewWaitlist(eventId, ticketType) {
    if (!this.currentUser?.isOrganizer) return this.showError('Access denied: Organizers only');
    this.currentEventId = eventId;
    this.selectedTicketType = ticketType;
    const event = this.events.find(e => e.id === eventId);
    if (!event) return this.showError('Event not found');
    const entries = this.waitlists.filter(w => w.eventId === eventId && w.ticketType === ticketType)
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

    document.getElementById('waitlist-view-title').textContent = `${ticketType.toUpperCase()} Waitlist - ${event.title}`;
    const html = `
      <div style="max-height: 400px; overflow-y: auto;">
        ${entries.map(entry => `
          <div class="waitlist-entry">
            <p><strong>Name:</strong> ${entry.name}</p>
            <p><strong>Email:</strong> ${entry.email}</p>
            <p><strong>Phone:</strong> ${entry.phone}</p>
            <p><strong>Joined:</strong> ${new Date(entry.joinedAt).toLocaleString()}</p>
          </div>
        `).join('') || '<p style="text-align: center; color: var(--text-muted);">No waitlist entries</p>'}
      </div>
    `;
    document.getElementById('waitlist-entries').innerHTML = html;
    document.getElementById('notify-waitlist-btn').onclick = () => this.notifyWaitlist();
    this.openModal('waitlist-view-modal');
  }

  notifyWaitlist() {
    if (!this.currentEventId || !this.selectedTicketType) return;
    const event = this.events.find(e => e.id === this.currentEventId);
    if (!event) return this.showError('Event not found');
    const entries = this.waitlists.filter(w => w.eventId === this.currentEventId && w.ticketType === this.selectedTicketType);
    if (entries.length === 0) {
      this.showError('No waitlist entries to notify');
      return;
    }
    entries.forEach(entry => {
      this.sendSMS(entry.phone, `Good news! ${this.selectedTicketType.toUpperCase()} tickets for ${event.title} are now available. Purchase quickly at glycr.com/event/${event.id}. Reply STOP to unsubscribe.`);
    });
    alert(`📱 SMS notifications sent to ${entries.length} waitlist users!\n\n(In production, integrate with SMS API like Twilio for real delivery.)`);
    this.closeAllModals();
  }

  showEventForm(event = null) {
    this.editingEvent = event;
    const form = document.getElementById('event-form');
    form.reset();

    document.getElementById('form-title').textContent = event ? 'Edit Event' : 'Create Event';

    const defaultCurrency = this.currentUser?.currency || 'GHC';

    if (event) {
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-desc').value = event.description;
      document.getElementById('event-date').value = event.date.slice(0, 16);
      document.getElementById('event-venue').value = event.venue;
      document.getElementById('event-location').value = event.location || '';
      document.getElementById('event-category').value = event.category;
      document.getElementById('event-currency').value = event.currency;
      document.getElementById('organizer-email').value = event.organizerEmail || this.currentUser.email;
      document.getElementById('organizer-phone').value = event.organizerPhone || this.currentUser.phone || '';

      const ticketTypes = JSON.parse(event.ticketTypes);
      document.getElementById('ticket-types-form').innerHTML = '';
      Object.entries(ticketTypes).forEach(([type, data]) => {
        this.addTicketTypeInput(type, data.price, data.capacity, data.earlyBirdPrice || '', data.earlyBirdEnd || '', data.groupDiscount || 10);
      });
    } else {
      document.getElementById('ticket-types-form').innerHTML = '';
      this.addTicketTypeInput('free', 0, 100, '', '', 10);
      this.addTicketTypeInput('regular', 50, 200, 40, '2025-11-15T00:00', 10);
      this.addTicketTypeInput('vip', 150, 50, 120, '2025-11-15T00:00', 10);
      this.addTicketTypeInput('vvip', 300, 20, 250, '2025-11-15T00:00', 10);
      document.getElementById('event-currency').value = defaultCurrency;
      document.getElementById('organizer-email').value = this.currentUser.email;
      document.getElementById('organizer-phone').value = this.currentUser.phone || '';
    }

    this.openModal('event-form-modal');
  }

  addTicketTypeInput(name = '', price = '', capacity = '', earlyBirdPrice = '', earlyBirdEnd = '', groupDiscount = '10') {
    const container = document.getElementById('ticket-types-form');
    const div = document.createElement('div');
    div.className = 'ticket-type';
    div.innerHTML = `
      <input type="text" class="input type-name" placeholder="Type (e.g., Regular)" value="${name}">
      <input type="number" class="input type-price" placeholder="Price" min="0" value="${price}">
      <input type="number" class="input type-capacity" placeholder="Capacity" min="1" value="${capacity}">
      <input type="number" class="input type-early-price" placeholder="Early Bird Price" min="0" value="${earlyBirdPrice}">
      <input type="datetime-local" class="input type-early-end" value="${earlyBirdEnd}">
      <input type="number" class="input type-group-disc" placeholder="Group Discount %" min="0" max="50" value="${groupDiscount}">
      <button type="button" class="remove-ticket">Remove</button>
    `;
    container.appendChild(div);
  }

  saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    if (!title) return this.showError('Event title required');

    const organizerEmail = document.getElementById('organizer-email').value.trim();
    const organizerPhone = document.getElementById('organizer-phone').value.trim();
    if (!organizerEmail || !organizerPhone) {
      return this.showError('Organizer contact info required');
    }

    if (!this.validateEmail(organizerEmail)) {
      return this.showError('Invalid organizer email format');
    }

    if (!this.validatePhone(organizerPhone)) {
      return this.showError('Invalid organizer phone number format (use +233xxxxxxxxx)');
    }

    const currency = document.getElementById('event-currency').value;

    const ticketInputs = document.querySelectorAll('.ticket-type');
    const ticketTypes = {};

    ticketInputs.forEach(input => {
      const type = input.querySelector('.type-name').value.trim().toLowerCase();
      const price = parseFloat(input.querySelector('.type-price').value);
      const capacity = parseInt(input.querySelector('.type-capacity').value);
      const earlyBirdPrice = parseFloat(input.querySelector('.type-early-price').value) || price;
      const earlyBirdEnd = input.querySelector('.type-early-end').value;
      const groupDiscount = parseInt(input.querySelector('.type-group-disc').value) || 10;

      if (type && !isNaN(price) && !isNaN(capacity)) {
        ticketTypes[type] = { price, capacity, sold: 0, earlyBirdPrice, earlyBirdEnd, groupDiscount };
      }
    });

    if (Object.keys(ticketTypes).length === 0) {
      return this.showError('Add at least one ticket type');
    }

    const imageFile = document.getElementById('event-image').files[0];
    let imageUrl = this.editingEvent?.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800';

    if (this.editingEvent && this.editingEvent.image && this.editingEvent.image.startsWith('blob:')) {
      URL.revokeObjectURL(this.editingEvent.image);
    }

    if (imageFile) {
      imageUrl = URL.createObjectURL(imageFile);
    }

    const event = {
      id: this.editingEvent?.id || Date.now(),
      title,
      description: document.getElementById('event-desc').value,
      date: document.getElementById('event-date').value,
      venue: document.getElementById('event-venue').value,
      location: document.getElementById('event-location').value,
      category: document.getElementById('event-category').value,
      currency,
      organizerEmail,
      organizerPhone,
      image: imageUrl,
      ticketTypes: JSON.stringify(ticketTypes),
      organizerId: this.currentUser.id,
      isPublished: true,
      isCancelled: false,
      createdAt: this.editingEvent?.createdAt || new Date().toISOString()
    };

    const index = this.events.findIndex(e => e.id === event.id);
    if (index > -1) {
      this.events[index] = event;
    } else {
      this.events.push(event);
    }

    this.saveToStorage('glycr_events', this.events);
    this.closeAllModals();
    this.showSection('dashboard');
  }

  showCancelModal(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    document.getElementById('cancel-title').textContent = `Cancel ${event.title}?`;
    document.getElementById('cancel-reason').innerHTML = `
      <p>This will notify all ticket holders and simulate refunds.</p>
      <p>Are you sure?</p>
    `;
    this.currentEventId = eventId; // Reuse for cancel
    this.openModal('cancel-event-modal');
  }

  cancelEvent() {
    const event = this.events.find(e => e.id === this.currentEventId);
    if (!event) return;

    event.isCancelled = true;
    this.saveToStorage('glycr_events', this.events);

    // Notify ticket holders
    const eventTickets = this.tickets.filter(t => t.eventId === event.id);
    eventTickets.forEach(ticket => {
      this.sendSMS(ticket.userPhone, `Unfortunately, ${event.title} has been cancelled. Full refund processed to your original payment method. Sorry for the inconvenience.`);
    });

    // Simulate refund (remove revenue, but keep tickets for history)
    alert(`Event cancelled. Notifications sent to ${eventTickets.length} ticket holders. Refunds simulated.`);

    this.closeAllModals();
    this.loadDashboard();
    this.renderEvents();
  }

  deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

    const event = this.events.find(e => e.id === id);
    if (event && event.image && event.image.startsWith('blob:')) {
      URL.revokeObjectURL(event.image);
    }

    this.events = this.events.filter(e => e.id !== id);
    this.tickets = this.tickets.filter(t => t.eventId !== id);
    this.waitlists = this.waitlists.filter(w => w.eventId !== id);
    this.saveToStorage('glycr_events', this.events);
    this.saveToStorage('glycr_tickets', this.tickets);
    this.saveToStorage('glycr_waitlists', this.waitlists);
    this.loadDashboard();
  }

  loadDashboard() {
    const dateFilter = document.getElementById('event-date-filter')?.value || 'upcoming';
    const now = this.currentDate;
    let myEvents = this.events.filter(e => e.organizerId === this.currentUser.id && !e.isCancelled);
    if (dateFilter === 'upcoming') {
      myEvents = myEvents.filter(e => new Date(e.date) > now);
    } else if (dateFilter === 'past') {
      myEvents = myEvents.filter(e => new Date(e.date) <= now);
    }
    const allMyEvents = this.events.filter(e => e.organizerId === this.currentUser.id);
    const myTickets = this.tickets.filter(t =>
      allMyEvents.some(e => e.id === t.eventId)
    );

    const userCurrency = this.currentUser.currency || 'GHC';
    const totalRevenue = this.getTotalRevenue();
    const liveEvents = allMyEvents.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > now).length;
    const pendingPayouts = this.getPendingPayouts();
    const defaultSymbol = this.getCurrencySymbol(userCurrency);

    document.getElementById('total-revenue').textContent = `${defaultSymbol}${totalRevenue.toFixed(2)}`;
    document.getElementById('total-sold').textContent = myTickets.length;
    document.getElementById('events-live').textContent = liveEvents;
    document.getElementById('pending-payouts').textContent = `${defaultSymbol}${pendingPayouts.toFixed(2)}`;

    // Payout history
    const historyEl = document.getElementById('payout-history');
    historyEl.innerHTML = this.payouts.filter(p => p.organizerId === this.currentUser.id).map(p => {
      const statusColor = p.status === 'completed' ? 'var(--success)' : p.status === 'pending' ? 'var(--warning)' : 'var(--error)';
      const details = p.method === 'bank' ? `Bank: ${p.details.bankName}` : p.method === 'momo' ? `MoMo: ${p.details.phone}` : p.method.toUpperCase();
      return `
        <div class="payout-item">
          <div>
            <p><strong>${defaultSymbol}${p.amount}</strong> via ${details}</p>
            <p style="color: var(--text-muted); font-size: 0.85rem;">${new Date(p.requestedAt).toLocaleDateString()} - ${p.notes || 'No notes'}</p>
          </div>
          <span style="color: ${statusColor}; font-weight: 600;">${p.status.toUpperCase()}</span>
        </div>
      `;
    }).join('') || '<p class="empty-state">No payout history</p>';

    document.getElementById('my-events').innerHTML = myEvents.map(e => {
      const ticketTypes = JSON.parse(e.ticketTypes);
      const breakdown = Object.entries(ticketTypes).map(([type, t]) => {
        const sold = t.sold || 0;
        const pct = t.capacity > 0 ? ((sold / t.capacity) * 100).toFixed(1) : 0;
        const waitlistCount = this.waitlists.filter(w => w.eventId === e.id && w.ticketType === type).length;
        const viewBtn = waitlistCount > 0
          ? `<button class="btn-ghost" data-action="view-waitlist" data-event-id="${e.id}" data-ticket-type="${type}" style="font-size:0.8rem; padding:0.25rem 0.5rem; margin-left:0.5rem;">View</button>`
          : '';
        return `<p>${type.toUpperCase()}: ${sold}/${t.capacity} (${pct}%) | Waitlist: ${waitlistCount} ${viewBtn}</p>`;
      }).join('');
      const totalRevenueEvent = Object.entries(ticketTypes).reduce((sum, [type, t]) => sum + ((t.sold || 0) * t.price), 0);
      const totalSold = Object.values(ticketTypes).reduce((sum, t) => sum + (t.sold || 0), 0);
      const totalCapacity = Object.values(ticketTypes).reduce((sum, t) => sum + t.capacity, 0);
      const symbol = this.getCurrencySymbol(e.currency);
      const categoryEmoji = this.getCategoryEmoji(e.category);
      const categoryName = this.getCategoryName(e.category);

      return `
        <div class="event-admin">
          <h3>${e.title}</h3>
          <p>📅 ${new Date(e.date).toLocaleDateString()}</p>
          <p>📧 ${e.organizerEmail}</p>
          <p>📱 ${e.organizerPhone}</p>
          <div class="ticket-breakdown">
            <h4>Ticket Breakdown:</h4>
            ${breakdown}
          </div>
          <p>💰 Total Revenue: ${symbol}${totalRevenueEvent}</p>
          <button class="btn-ghost" data-action="edit-event" data-event-id="${e.id}">Edit</button>
          ${!e.isCancelled ? `<button class="btn-ghost" data-action="cancel-event" data-event-id="${e.id}" style="background: var(--warning); color: white;">Cancel Event</button>` : ''}
          <button class="btn-ghost" data-action="toggle-publish" data-event-id="${e.id}">
            ${e.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button class="btn-ghost" data-action="export-report" data-event-id="${e.id}">Export CSV</button>
          <button class="btn-ghost" data-action="delete-event" data-event-id="${e.id}" style="background: var(--error); color: white;">Delete</button>
        </div>
      `;
    }).join('') || '<div class="empty-state" style="grid-column:1/-1;"><h3>No events yet</h3><p>Create your first event to get started</p></div>';
  }

  togglePublish(id) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;
    event.isPublished = !event.isPublished;
    this.saveToStorage('glycr_events', this.events);
    this.loadDashboard();
  }

  exportReport(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return this.showError('Event not found');
    const eventTickets = this.tickets.filter(t => t.eventId === eventId);

    let csv = 'Ticket ID,Type,Price,Buyer Email,Phone,Purchase Date,Company Name,Billing Address,PO Number\n';
    eventTickets.forEach(t => {
      csv += `"${t.id}","${t.ticketType}",${t.price},"${t.userEmail}","${t.userPhone}","${new Date(t.purchasedAt).toLocaleString()}","${t.companyName || ''}","${t.billingAddress || ''}","${t.poNumber || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '_')}_tickets.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadInsights() {
    const myEvents = this.events.filter(e => e.organizerId === this.currentUser.id && !e.isCancelled);
    const myTickets = this.tickets.filter(t =>
      myEvents.some(e => e.id === t.eventId)
    );

    // Use currentDate for consistency
    const salesData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(this.currentDate);
      date.setDate(date.getDate() - i);
      const count = Math.floor(Math.random() * 15) + 5;
      salesData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      });
    }

    if (this.salesChart) {
      this.salesChart.destroy();
    }

    const ctx = document.getElementById('sales-chart').getContext('2d');
    this.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: salesData.map(d => d.date),
        datasets: [{
          label: 'Daily Sales',
          data: salesData.map(d => d.count),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              color: '#f1f5f9'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8'
            },
            grid: {
              color: '#475569'
            }
          },
          x: {
            ticks: {
              color: '#94a3b8'
            },
            grid: {
              color: '#475569'
            }
          }
        }
      }
    });

    const avgSales = salesData.reduce((sum, d) => sum + d.count, 0) / salesData.length;
    const prediction = Math.round(avgSales * 1.2);
    const confidence = Math.round(70 + Math.random() * 20);

    document.getElementById('ai-predictions').innerHTML = `
      <h4>Next Week Forecast</h4>
      <p style="font-size: 2rem; font-weight: 700; color: var(--primary); margin: 1rem 0;">
        ${prediction} tickets
      </p>
      <p style="color: var(--text-muted);">
        Confidence: ${confidence}%
      </p>
      <p style="margin-top: 1rem;">
        ${prediction > avgSales
      ? '📈 Trending up! Consider premium pricing or adding VIP tiers.'
      : '📊 Steady demand. Boost engagement with social media campaigns.'}
      </p>
    `;
  }

  generatePromo() {
    const templates = [
      "Don't miss out! Join us for an unforgettable experience. Limited tickets available - grab yours now!",
      "The event of the season is here! Secure your spot today. Your perfect night awaits!",
      "Early bird special! Be among the first to experience this amazing event. Book now!"
    ];

    const promo = templates[Math.floor(Math.random() * templates.length)];

    alert(`AI-Generated Promo:\n\n${promo}\n\nCopy this and use it in your marketing campaigns!`);
  }

  shareEvent() {
    const event = this.events.find(e => e.id === this.currentEventId);
    if (!event) return;

    // Track share
    this.shares[event.id] = (this.shares[event.id] || 0) + 1;
    this.saveToStorage('glycr_shares', this.shares);

    const shareData = {
      title: event.title,
      text: `Check out ${event.title} on Glycr!`,
      url: window.location.href + '#event-' + event.id + '?ref=' + this.currentUser?.id
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareData.url).then(() => {
        alert('Event link copied to clipboard! (Share tracked)');
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
      const content = modal.querySelector('.modal-content');
      content.setAttribute('tabindex', '-1');
      content.focus();

      const focusableElements = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      const handleFocusTrap = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              e.preventDefault();
              lastFocusable.focus();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable.focus();
            }
          }
        }
      };

      content.addEventListener('keydown', handleFocusTrap);
      modal._focusTrapHandler = handleFocusTrap;
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('show');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.removeAttribute('tabindex');
        if (modal._focusTrapHandler) {
          content.removeEventListener('keydown', modal._focusTrapHandler);
          delete modal._focusTrapHandler;
        }
      }
    });
    document.body.style.overflow = '';
  }

  showError(message) {
    const statusEl = document.querySelector('.payment-status') || document.getElementById('waitlist-status');
    if (statusEl) {
      statusEl.className = 'payment-status error';
      statusEl.textContent = message;
    } else {
      alert(message);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize app
const app = new GlycrApp();

// Add some demo events if none exist
if (app.events.length === 0) {
  if (app.users.length === 0) {
    const demoUser = {
      id: 1,
      name: 'Demo Organizer',
      email: 'demo@organizer.com',
      phone: '+233550123456',
      password: app.hashPassword('demo123'),
      isOrganizer: true,
      currency: 'GHC',
      createdAt: new Date().toISOString()
    };
    app.users.push(demoUser);
    app.saveToStorage('glycr_users', app.users);
    app.currentUser = demoUser;
    localStorage.setItem('currentUser', JSON.stringify(demoUser));
    app.updateNav();
  }

  const demoEvents = [
    {
      id: Date.now(),
      title: "Summer Music Festival 2025",
      description: "The biggest music festival of the year featuring top artists from around the world. Three days of non-stop entertainment, food, and fun!",
      date: "2025-12-15T18:00",
      venue: "Accra Sports Stadium",
      location: "accra-central",
      category: "music",
      currency: "GHC",
      organizerEmail: "demo@organizer.com",
      organizerPhone: "+233550123456",
      image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800",
      ticketTypes: JSON.stringify({
        free: { price: 0, capacity: 100, sold: 20, earlyBirdPrice: 0, earlyBirdEnd: '', groupDiscount: 10 },
        regular: { price: 75, capacity: 500, sold: 120, earlyBirdPrice: 60, earlyBirdEnd: '2025-11-15T00:00', groupDiscount: 10 },
        vip: { price: 150, capacity: 100, sold: 45, earlyBirdPrice: 120, earlyBirdEnd: '2025-11-15T00:00', groupDiscount: 15 },
        vvip: { price: 300, capacity: 25, sold: 10, earlyBirdPrice: 250, earlyBirdEnd: '2025-11-15T00:00', groupDiscount: 20 }
      }),
      organizerId: 1,
      isPublished: true,
      isCancelled: false,
      createdAt: new Date().toISOString()
    },
    {
      id: Date.now() + 1,
      title: "Tech Innovation Summit",
      description: "Join industry leaders and innovators for a day of cutting-edge technology discussions, networking, and workshops.",
      date: "2025-11-20T09:00",
      venue: "Kumasi City Hall",
      location: "kumasi",
      category: "business",
      currency: "GHC",
      organizerEmail: "demo@organizer.com",
      organizerPhone: "+233550123456",
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      ticketTypes: JSON.stringify({
        free: { price: 0, capacity: 50, sold: 10, earlyBirdPrice: 0, earlyBirdEnd: '', groupDiscount: 10 },
        regular: { price: 50, capacity: 300, sold: 80, earlyBirdPrice: 40, earlyBirdEnd: '2025-10-31T00:00', groupDiscount: 10 },
        vip: { price: 120, capacity: 50, sold: 20, earlyBirdPrice: 100, earlyBirdEnd: '2025-10-31T00:00', groupDiscount: 15 }
      }),
      organizerId: 1,
      isPublished: true,
      isCancelled: false,
      createdAt: new Date().toISOString()
    }
  ];

  app.events = demoEvents;
  app.saveToStorage('glycr_events', demoEvents);
  app.renderEvents();
}
