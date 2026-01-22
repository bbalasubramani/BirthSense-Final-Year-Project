document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    function showSection(targetId) {
        contentSections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(targetId).classList.add('active');
    }

    navItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            event.currentTarget.classList.add('active');
            const targetId = event.currentTarget.dataset.target;
            showSection(targetId);
        });
    });

    if (navItems.length > 0) {
        // Find the section to show based on the URL hash or default to the first
        const hash = window.location.hash.substring(1);
        const initialSection = hash && document.getElementById(hash) ? hash : navItems[0].dataset.target;
        
        navItems.forEach(item => {
            if (item.dataset.target === initialSection) {
                item.classList.add('active');
            }
        });
        showSection(initialSection);
    }
});