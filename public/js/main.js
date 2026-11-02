/* ==========================================================================
   DeltaX College Consulting - Main JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
    initAmbient();
    initHeaderScroll();
    initActiveNav();
    initFormValidation();
    initScrollReveal();
});

/* --------------------------------------------------------------------------
   Ambient background: breathing tint with rippling squares (styled in CSS)
   -------------------------------------------------------------------------- */
function initAmbient() {
    const ambient = document.createElement('div');
    ambient.className = 'ambient';
    ambient.setAttribute('aria-hidden', 'true');
    ambient.innerHTML = '<i></i><i></i><i></i><i></i>';
    document.body.prepend(ambient);
}

/* --------------------------------------------------------------------------
   Header: add a border once the page is scrolled
   -------------------------------------------------------------------------- */
function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const update = () => header.classList.toggle('scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
}

/* --------------------------------------------------------------------------
   Active Nav: mark the current page's desktop nav link
   -------------------------------------------------------------------------- */
function initActiveNav() {
    const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';

    document.querySelectorAll('.nav-links a').forEach(link => {
        const href = link.getAttribute('href').replace(/\/$/, '') || '/';
        if (href === path) {
            link.setAttribute('aria-current', 'page');
        }
    });
}

/* --------------------------------------------------------------------------
   Form Validation
   -------------------------------------------------------------------------- */
function initFormValidation() {
    document.querySelectorAll('form').forEach(form => {
        form.setAttribute('novalidate', '');

        form.addEventListener('submit', function(e) {
            let firstInvalid = null;

            form.querySelectorAll('input, select, textarea').forEach(field => {
                const message = getFieldError(field);
                if (message) {
                    showFieldError(field, message);
                    firstInvalid = firstInvalid || field;
                } else {
                    clearFieldError(field);
                }
            });

            if (firstInvalid) {
                e.preventDefault();
                firstInvalid.focus();
                return;
            }

            const submit = form.querySelector('[type="submit"]');
            if (submit) {
                submit.dataset.label = submit.textContent;
                submit.disabled = true;
                submit.textContent = 'Sending...';
            }
        });

        // Re-enable the button if the user comes back via the back button
        window.addEventListener('pageshow', () => {
            const submit = form.querySelector('[type="submit"]');
            if (submit && submit.dataset.label) {
                submit.disabled = false;
                submit.textContent = submit.dataset.label;
            }
        });

        form.querySelectorAll('input, textarea, select').forEach(field => {
            const clear = () => clearFieldError(field);
            field.addEventListener('input', clear);
            field.addEventListener('change', clear);
        });
    });
}

function getFieldError(field) {
    if (field.type === 'hidden') return null;

    const value = field.value.trim();

    if (field.required && !value) return 'This field is required';
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Please enter a valid email address';
    }
    if (field.type === 'tel' && value && !/^[\d\s\-()+.]{10,}$/.test(value)) {
        return 'Please enter a valid phone number';
    }
    return null;
}

function showFieldError(field, message) {
    clearFieldError(field);

    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('error');
    field.removeAttribute('aria-invalid');

    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

/* --------------------------------------------------------------------------
   Scroll Reveal
   -------------------------------------------------------------------------- */
function initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    const groups = [
        '.grade-btn',
        '.team-card-landing',
        '.pricing-card-landing',
        '.why-col',
        '.contact-form-wrap'
    ];

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    groups.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            // Stagger siblings, not every match on the page
            const index = Array.prototype.indexOf.call(el.parentNode.children, el);
            el.classList.add('reveal');
            if (index < 6) {
                el.classList.add(`stagger-${index + 1}`);
            }
            observer.observe(el);
        });
    });
}
