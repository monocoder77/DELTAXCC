/* ==========================================================================
   DeltaX College Consulting - Main JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle (initialize first for fast theme application)
    initThemeToggle();

    // Mobile Menu Toggle
    initMobileMenu();

    // FAQ Accordion
    initFaqAccordion();

    // Smooth scroll for anchor links
    initSmoothScroll();

    // Form validation (if forms exist)
    initFormValidation();

    // Service type toggle for contact form
    initServiceTypeToggle();

    // Scroll reveal animations
    initScrollReveal();
});

/* --------------------------------------------------------------------------
   Theme Toggle (Dark/Light Mode)
   -------------------------------------------------------------------------- */
function initThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    // Get stored theme or default to dark
    const storedTheme = localStorage.getItem('theme');

    // Apply stored theme (dark is default, so only apply if light)
    if (storedTheme === 'light') {
        html.setAttribute('data-theme', 'light');
    }

    // Toggle theme on button click
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = html.getAttribute('data-theme');

            if (currentTheme === 'light') {
                // Switch to dark
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                // Switch to light
                html.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}

/* --------------------------------------------------------------------------
   Mobile Menu
   -------------------------------------------------------------------------- */
function initMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (!menuToggle || !navLinks) return;

    menuToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
        menuToggle.classList.toggle('active');

        // Update aria-expanded
        const isExpanded = navLinks.classList.contains('active');
        menuToggle.setAttribute('aria-expanded', isExpanded);
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function() {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
        }
    });
}

/* --------------------------------------------------------------------------
   FAQ Accordion
   -------------------------------------------------------------------------- */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    if (!faqItems.length) return;

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', function() {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

/* --------------------------------------------------------------------------
   Smooth Scroll
   -------------------------------------------------------------------------- */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');

            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault();

                const headerHeight = document.querySelector('.site-header').offsetHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* --------------------------------------------------------------------------
   Form Validation
   -------------------------------------------------------------------------- */
function initFormValidation() {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            let isValid = true;

            // Check required fields
            const requiredFields = form.querySelectorAll('[required]');

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    showFieldError(field, 'This field is required');
                } else {
                    clearFieldError(field);
                }
            });

            // Check email fields
            const emailFields = form.querySelectorAll('input[type="email"]');

            emailFields.forEach(field => {
                if (field.value && !isValidEmail(field.value)) {
                    isValid = false;
                    showFieldError(field, 'Please enter a valid email address');
                }
            });

            // Check phone fields
            const phoneFields = form.querySelectorAll('input[type="tel"]');

            phoneFields.forEach(field => {
                if (field.value && !isValidPhone(field.value)) {
                    isValid = false;
                    showFieldError(field, 'Please enter a valid phone number');
                }
            });

            if (!isValid) {
                e.preventDefault();
            }
        });

        // Clear errors on input
        form.querySelectorAll('input, textarea, select').forEach(field => {
            field.addEventListener('input', function() {
                clearFieldError(field);
            });
        });
    });
}

function showFieldError(field, message) {
    clearFieldError(field);

    field.classList.add('error');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.color = 'var(--color-error)';
    errorDiv.style.fontSize = 'var(--text-sm)';
    errorDiv.style.marginTop = 'var(--space-1)';

    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('error');

    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    // Allow various phone formats
    const phoneRegex = /^[\d\s\-\(\)\+\.]{10,}$/;
    return phoneRegex.test(phone);
}

/* --------------------------------------------------------------------------
   Scroll Reveal Animations
   -------------------------------------------------------------------------- */
function initScrollReveal() {
    // Add reveal classes to elements
    const revealElements = [
        { selector: '.diff-card', class: 'reveal' },
        { selector: '.what-we-do-card', class: 'reveal' },
        { selector: '.pricing-card-landing', class: 'reveal' },
        { selector: '.pricing-card', class: 'reveal' },
        { selector: '.team-card', class: 'reveal' },
        { selector: '.testimonial-card', class: 'reveal' },
        { selector: '.resource-card', class: 'reveal' },
        { selector: '.service-item', class: 'reveal-left' },
        { selector: '.value-item', class: 'reveal-left' },
        { selector: '.process-step', class: 'reveal' },
        { selector: '.faq-item', class: 'reveal' },
        { selector: '.grade-btn', class: 'reveal-scale' },
        { selector: '.comparison-table', class: 'reveal-scale' },
        { selector: '.college-name', class: 'reveal-scale' }
    ];

    revealElements.forEach(({ selector, class: revealClass }) => {
        document.querySelectorAll(selector).forEach((el, index) => {
            if (!el.classList.contains('reveal') &&
                !el.classList.contains('reveal-left') &&
                !el.classList.contains('reveal-right') &&
                !el.classList.contains('reveal-scale')) {
                el.classList.add(revealClass);
                // Add stagger effect for grid items
                if (index < 6) {
                    el.classList.add(`stagger-${index + 1}`);
                }
            }
        });
    });

    // Create intersection observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    // Observe all reveal elements
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
        observer.observe(el);
    });
}




/* --------------------------------------------------------------------------
   Scroll Animation (legacy - kept for compatibility)
   -------------------------------------------------------------------------- */
function initScrollAnimation() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');

    if (!animatedElements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    animatedElements.forEach(element => {
        observer.observe(element);
    });
}

/* --------------------------------------------------------------------------
   Service Type Toggle (Contact Form) - Kept for compatibility
   -------------------------------------------------------------------------- */
function initServiceTypeToggle() {
    // Function kept for compatibility but no longer needed
    // as tutoring has been removed from the website
}
