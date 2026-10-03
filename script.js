document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = menuToggle.querySelector('.menu-icon');
    const closeIcon = menuToggle.querySelector('.close-icon');

    let isMenuOpen = false;

    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            mobileMenu.classList.add('active');
            menuIcon.style.transform = 'rotate(180deg) scale(0.5)';
            menuIcon.style.opacity = '0';
            closeIcon.style.transform = 'rotate(0deg) scale(1)';
            closeIcon.style.opacity = '1';
        } else {
            mobileMenu.classList.remove('active');
            menuIcon.style.transform = 'rotate(0deg) scale(1)';
            menuIcon.style.opacity = '1';
            closeIcon.style.transform = 'rotate(-180deg) scale(0.5)';
            closeIcon.style.opacity = '0';
        }
    });
});