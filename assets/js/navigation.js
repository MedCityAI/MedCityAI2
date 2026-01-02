// MedCityAI Navigation Component
// This file handles the navigation bar HTML injection and mobile menu functionality

(function() {
    'use strict';
    
    // Navigation HTML template
    const navigationHTML = `
        <nav class="top-bar" role="navigation" aria-label="Main navigation">
            <div class="top-bar-content">
                <div class="logo">
                    <a href="index.html" style="text-decoration: none; border: none; outline: none;">
                        <img src="images/medcityai_logo1.png" alt="MedCityAI Logo" style="height:48px; width:auto; display: block;" />
                    </a>
                </div>
                <div class="nav-links" role="menubar">
                    <a href="index.html" role="menuitem" data-page="index">New Today</a>
                    <a href="search.html" role="menuitem" data-page="search">Search</a>
                    <a href="leaderboard.html" role="menuitem" data-page="leaderboard">Leaderboard</a>
                    <a href="about.html" role="menuitem" data-page="about">About</a>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <button class="menu-icon" aria-label="Toggle mobile menu" aria-expanded="false" aria-controls="mobile-menu">
                        <span class="sr-only">Menu</span>
                        <div aria-hidden="true"></div>
                        <div aria-hidden="true"></div>
                        <div aria-hidden="true"></div>
                    </button>
                </div>
            </div>
        </nav>
        
        <!-- Mobile Menu -->
        <div id="mobile-menu" class="mobile-menu" aria-hidden="true">
            <a href="index.html" data-page="index">New Today</a>
            <a href="search.html" data-page="search">Search</a>
            <a href="leaderboard.html" data-page="leaderboard">Leaderboard</a>
            <a href="about.html" data-page="about">About</a>
        </div>
    `;
    
    // Initialize navigation on page load
    function initializeNavigation() {
        // Find the navigation placeholder
        const navPlaceholder = document.getElementById('navigation-placeholder');
        if (!navPlaceholder) {
            console.warn('Navigation placeholder not found');
            return;
        }
        
        // Inject navigation HTML
        navPlaceholder.innerHTML = navigationHTML;
        
        // Set active page
        setActivePage();
        
        // Initialize mobile menu
        initializeMobileMenu();
        
        // Handle index.html "New Today" special behavior
        if (getCurrentPage() === 'index') {
            const newTodayLink = document.querySelector('.nav-links a[data-page="index"]');
            if (newTodayLink) {
                newTodayLink.href = '#';
                newTodayLink.id = 'newTodayNavLink';
                newTodayLink.addEventListener('click', handleNewTodayClick);
            }
        }
    }
    
    // Get current page name from URL
    function getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '') || 'index';
        return page;
    }
    
    // Set active page styling
    function setActivePage() {
        const currentPage = getCurrentPage();
        const links = document.querySelectorAll('.nav-links a[data-page], #mobile-menu a[data-page]');
        
        links.forEach(link => {
            if (link.getAttribute('data-page') === currentPage) {
                link.setAttribute('aria-current', 'page');
            }
        });
    }
    
    // Handle "New Today" click on index.html
    function handleNewTodayClick(e) {
        e.preventDefault();
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Scroll to results section with header offset
        const resultsSection = document.getElementById('pubmed-results');
        if (resultsSection) {
            const headerHeight = 70;
            const elementPosition = resultsSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
        
        // Filter for today's publications
        setTimeout(() => {
            if (typeof fetchPubMedResults === 'function') {
                fetchPubMedResults('', 1, '', today);
            }
        }, 500);
    }
    
    // Initialize mobile menu functionality
    function initializeMobileMenu() {
        const menuIcon = document.querySelector('.menu-icon');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (!menuIcon || !mobileMenu) return;
        
        // Toggle menu on icon click
        menuIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            mobileMenu.classList.toggle('active');
            mobileMenu.setAttribute('aria-hidden', isExpanded);
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.menu-icon') && !event.target.closest('.mobile-menu')) {
                if (mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                    mobileMenu.setAttribute('aria-hidden', 'true');
                    menuIcon.setAttribute('aria-expanded', 'false');
                }
            }
        });
        
        // Close mobile menu when clicking a link
        const mobileMenuLinks = mobileMenu.querySelectorAll('a');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
                mobileMenu.setAttribute('aria-hidden', 'true');
                menuIcon.setAttribute('aria-expanded', 'false');
            });
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNavigation);
    } else {
        initializeNavigation();
    }
    
})();
