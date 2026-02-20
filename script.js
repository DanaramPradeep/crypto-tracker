/**
 * CryptoTracker - Modern Real-Time Crypto Price Tracker
 * A professional cryptocurrency dashboard with real-time updates
 */

// ============================================
// Configuration & Constants
// ============================================
const CONFIG = {
    API_URL: 'https://api.coingecko.com/api/v3/coins/markets',
    API_PARAMS: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 20,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h'
    },
    UPDATE_INTERVAL: 10000, // 10 seconds
    CHART_DAYS: 7,
    FAVORITES_KEY: 'crypto_favorites',
    THEME_KEY: 'crypto_theme'
};

// Cryptocurrency IDs to track
const CRYPTO_IDS = [
    'bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple',
    'cardano', 'dogecoin', 'polkadot', 'chainlink', 'avalanche-2',
    'tron', 'polygon', 'shiba-inu', 'litecoin', 'bitcoin-cash'
];

// ============================================
// State Management
// ============================================
let cryptoData = [];
let filteredData = [];
let favorites = [];
let currentTheme = 'dark';
let isShowingFavorites = false;
let priceChart = null;
let selectedCrypto = null;

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Main containers
    cryptoGrid: document.getElementById('cryptoGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    
    // Controls
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    favoritesBtn: document.getElementById('favoritesBtn'),
    retryBtn: document.getElementById('retryBtn'),
    
    // Header stats
    lastUpdated: document.getElementById('lastUpdated'),
    totalMarketCap: document.getElementById('totalMarketCap'),
    
    // Modal
    cryptoModal: document.getElementById('cryptoModal'),
    modalClose: document.getElementById('modalClose'),
    modalImage: document.getElementById('modalImage'),
    modalName: document.getElementById('modalName'),
    modalSymbol: document.getElementById('modalSymbol'),
    modalPrice: document.getElementById('modalPrice'),
    modalPriceChange: document.getElementById('modalPriceChange'),
    modalMarketCap: document.getElementById('modalMarketCap'),
    modalVolume: document.getElementById('modalVolume'),
    modalHigh: document.getElementById('modalHigh'),
    modalLow: document.getElementById('modalLow'),
    modalSupply: document.getElementById('modalSupply'),
    modalAth: document.getElementById('modalAth'),
    modalFavoriteBtn: document.getElementById('modalFavoriteBtn'),
    
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// ============================================
// Utility Functions
// ============================================

/**
 * Format number as USD currency
 */
function formatCurrency(value, decimals = 2) {
    if (value >= 1e12) {
        return '$' + (value / 1e12).toFixed(2) + 'T';
    } else if (value >= 1e9) {
        return '$' + (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
        return '$' + (value / 1e6).toFixed(2) + 'M';
    } else if (value >= 1e3) {
        return '$' + (value / 1e3).toFixed(2) + 'K';
    } else if (value >= 1) {
        return '$' + value.toFixed(decimals);
    } else {
        return '$' + value.toFixed(6);
    }
}

/**
 * Format large numbers with commas
 */
function formatNumber(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format percentage change
 */
function formatPercentage(value) {
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
}

/**
 * Format time
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

/**
 * Show toast notification
 */
function showToast(message, duration = 3000) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('active');
    
    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, duration);
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch cryptocurrency data from CoinGecko API
 */
async function fetchCryptoPrices() {
    try {
        const params = new URLSearchParams({
            ...CONFIG.API_PARAMS,
            ids: CRYPTO_IDS.join(',')
        });
        
        const response = await fetch(`${CONFIG.API_URL}?${params}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        throw error;
    }
}

/**
 * Fetch historical price data for chart
 */
async function fetchPriceHistory(coinId, days = CONFIG.CHART_DAYS) {
    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
        );
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.prices;
        
    } catch (error) {
        console.error('Error fetching price history:', error);
        return [];
    }
}

// ============================================
// Data Processing
// ============================================

/**
 * Process and update crypto data
 */
function updateCryptoData(data) {
    const oldPrices = new Map(cryptoData.map(c => [c.id, c.current_price]));
    
    cryptoData = data.map(coin => ({
        ...coin,
        priceChanged: oldPrices.has(coin.id) && oldPrices.get(coin.id) !== coin.current_price
    }));
    
    // Apply current filters
    applyFilters();
    
    // Update header stats
    updateHeaderStats();
}

/**
 * Apply search and sort filters
 */
function applyFilters() {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    const sortValue = elements.sortSelect.value;
    
    // Filter by search term
    filteredData = cryptoData.filter(coin => {
        if (isShowingFavorites && !favorites.includes(coin.id)) {
            return false;
        }
        
        if (searchTerm) {
            return coin.name.toLowerCase().includes(searchTerm) || 
                   coin.symbol.toLowerCase().includes(searchTerm);
        }
        
        return true;
    });
    
    // Sort data
    filteredData.sort((a, b) => {
        switch (sortValue) {
            case 'market_cap_desc':
                return b.market_cap - a.market_cap;
            case 'market_cap_asc':
                return a.market_cap - b.market_cap;
            case 'price_desc':
                return b.current_price - a.current_price;
            case 'price_asc':
                return a.current_price - b.current_price;
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });
    
    // Render
    renderCryptoCards();
}

// ============================================
// Rendering Functions
// ============================================

/**
 * Update header statistics
 */
function updateHeaderStats() {
    // Update last updated time
    elements.lastUpdated.textContent = formatTime(new Date());
    
    // Calculate total market cap
    const totalMarketCap = cryptoData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    elements.totalMarketCap.textContent = formatCurrency(totalMarketCap);
}

/**
 * Render cryptocurrency cards
 */
function renderCryptoCards() {
    if (filteredData.length === 0) {
        elements.cryptoGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No cryptocurrencies found</p>
            </div>
        `;
        return;
    }
    
    elements.cryptoGrid.innerHTML = filteredData.map((coin, index) => {
        const isPositive = coin.price_change_percentage_24h >= 0;
        const isFavorite = favorites.includes(coin.id);
        
        return `
            <div class="crypto-card ${isFavorite ? 'favorite' : ''}" 
                 data-id="${coin.id}"
                 style="animation-delay: ${index * 0.05}s"
                 onclick="openModal('${coin.id}')">
                <div class="card-header">
                    <div class="crypto-info">
                        <img src="${coin.image}" alt="${coin.name}" class="crypto-logo" 
                             onerror="this.src='https://via.placeholder.com/48'">
                        <div>
                            <div class="crypto-name">${coin.name}</div>
                            <div class="crypto-symbol">${coin.symbol}</div>
                        </div>
                    </div>
                    <button class="favorite-btn-small ${isFavorite ? 'active' : ''}" 
                            data-id="${coin.id}" 
                            onclick="event.stopPropagation(); toggleFavorite('${coin.id}')">
                        <i class="fa${isFavorite ? 's' : 'r'} fa-star"></i>
                    </button>
                </div>
                <div class="crypto-price ${coin.priceChanged ? 'price-updated' : ''}">
                    ${formatCurrency(coin.current_price)}
                </div>
                <div class="price-change ${isPositive ? 'positive' : 'negative'}">
                    <i class="fas fa-caret-${isPositive ? 'up' : 'down'}"></i>
                    ${formatPercentage(coin.price_change_percentage_24h)}
                </div>
                <div class="card-stats">
                    <div class="card-stat">
                        <span class="card-stat-label">Market Cap</span>
                        <span class="card-stat-value">${formatCurrency(coin.market_cap)}</span>
                    </div>
                    <div class="card-stat">
                        <span class="card-stat-label">Volume 24h</span>
                        <span class="card-stat-value">${formatCurrency(coin.total_volume)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Modal Functions
// ============================================

/**
 * Open crypto details modal
 */
async function openModal(coinId) {
    const coin = cryptoData.find(c => c.id === coinId);
    if (!coin) return;
    
    selectedCrypto = coin;
    
    // Populate modal data
    elements.modalImage.src = coin.image;
    elements.modalImage.alt = coin.name;
    elements.modalName.textContent = coin.name;
    elements.modalSymbol.textContent = coin.symbol.toUpperCase();
    elements.modalPrice.textContent = formatCurrency(coin.current_price);
    
    const isPositive = coin.price_change_percentage_24h >= 0;
    elements.modalPriceChange.textContent = formatPercentage(coin.price_change_percentage_24h);
    elements.modalPriceChange.className = `modal-price-change ${isPositive ? 'positive' : 'negative'}`;
    
    elements.modalMarketCap.textContent = formatCurrency(coin.market_cap);
    elements.modalVolume.textContent = formatCurrency(coin.total_volume);
    elements.modalHigh.textContent = formatCurrency(coin.high_24h);
    elements.modalLow.textContent = formatCurrency(coin.low_24h);
    elements.modalSupply.textContent = formatNumber(coin.circulating_supply);
    elements.modalAth.textContent = formatCurrency(coin.ath);
    
    // Update favorite button
    const isFavorite = favorites.includes(coin.id);
    elements.modalFavoriteBtn.className = `favorite-btn ${isFavorite ? 'active' : ''}`;
    elements.modalFavoriteBtn.innerHTML = `
        <i class="fa${isFavorite ? 's' : 'r'} fa-star"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
    `;
    
    // Show modal
    elements.cryptoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Fetch and display chart
    await loadPriceChart(coinId);
}

/**
 * Close modal
 */
function closeModal() {
    elements.cryptoModal.classList.remove('active');
    document.body.style.overflow = '';
    selectedCrypto = null;
    
    // Destroy chart
    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
}

/**
 * Load and display price chart
 */
async function loadPriceChart(coinId) {
    const priceData = await fetchPriceHistory(coinId);
    
    if (priceData.length === 0) return;
    
    const labels = priceData.map(([timestamp]) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const prices = priceData.map(([, price]) => price);
    
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // Destroy existing chart
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price (USD)',
                data: prices,
                borderColor: '#00d4ff',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1a1a24',
                    titleColor: '#ffffff',
                    bodyColor: '#a0a0b0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#6b6b7b',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// ============================================
// Favorites Management
// ============================================

/**
 * Toggle favorite status
 */
function toggleFavorite(coinId) {
    const index = favorites.indexOf(coinId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push(coinId);
        showToast('Added to favorites');
    }
    
    // Save to localStorage
    localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify(favorites));
    
    // Re-render
    applyFilters();
    
    // Update modal if open
    if (selectedCrypto && selectedCrypto.id === coinId) {
        const isFavorite = favorites.includes(coinId);
        elements.modalFavoriteBtn.className = `favorite-btn ${isFavorite ? 'active' : ''}`;
        elements.modalFavoriteBtn.innerHTML = `
            <i class="fa${isFavorite ? 's' : 'r'} fa-star"></i>
            <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
        `;
    }
}

/**
 * Load favorites from localStorage
 */
function loadFavorites() {
    const stored = localStorage.getItem(CONFIG.FAVORITES_KEY);
    if (stored) {
        favorites = JSON.parse(stored);
    }
}

// ============================================
// Theme Management
// ============================================

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem(CONFIG.THEME_KEY, currentTheme);
    
    const icon = elements.themeToggle.querySelector('i');
    if (currentTheme === 'light') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

/**
 * Load theme from localStorage
 */
function loadTheme() {
    const stored = localStorage.getItem(CONFIG.THEME_KEY);
    if (stored) {
        currentTheme = stored;
    } else {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            currentTheme = 'light';
        }
    }
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    const icon = elements.themeToggle.querySelector('i');
    if (currentTheme === 'light') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

// ============================================
// UI State Management
// ============================================

/**
 * Show loading state
 */
function showLoading() {
    elements.loadingState.classList.add('active');
    elements.errorState.classList.remove('active');
    elements.cryptoGrid.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    elements.loadingState.classList.remove('active');
    elements.cryptoGrid.style.display = 'grid';
}

/**
 * Show error state
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorState.classList.add('active');
    elements.loadingState.classList.remove('active');
    elements.cryptoGrid.style.display = 'none';
}

/**
 * Hide error state
 */
function hideError() {
    elements.errorState.classList.remove('active');
}

// ============================================
// Event Handlers
// ============================================

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Search input
    elements.searchInput.addEventListener('input', applyFilters);
    
    // Sort select
    elements.sortSelect.addEventListener('change', applyFilters);
    
    // Favorites button
    elements.favoritesBtn.addEventListener('click', () => {
        isShowingFavorites = !isShowingFavorites;
        elements.favoritesBtn.classList.toggle('active', isShowingFavorites);
        applyFilters();
    });
    
    // Retry button
    elements.retryBtn.addEventListener('click', () => {
        init();
    });
    
    // Modal close button
    elements.modalClose.addEventListener('click', closeModal);
    
    // Modal overlay click
    elements.cryptoModal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    
    // Modal favorite button
    elements.modalFavoriteBtn.addEventListener('click', () => {
        if (selectedCrypto) {
            toggleFavorite(selectedCrypto.id);
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.cryptoModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ============================================
// Main Application
// ============================================

/**
 * Main initialization function
 */
async function init() {
    // Load saved data
    loadFavorites();
    loadTheme();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initial fetch
    await refreshData();
    
    // Set up polling
    setInterval(refreshData, CONFIG.UPDATE_INTERVAL);
}

/**
 * Refresh cryptocurrency data
 */
async function refreshData() {
    try {
        showLoading();
        hideError();
        
        const data = await fetchCryptoPrices();
        
        updateCryptoData(data);
        hideLoading();
        
    } catch (error) {
        console.error('Failed to fetch data:', error);
        
        if (cryptoData.length === 0) {
            showError('Failed to fetch cryptocurrency data. Please check your internet connection and try again.');
        } else {
            showToast('Failed to update data. Showing cached data.');
            hideLoading();
        }
    }
}

// ============================================
// Start Application
// ============================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
