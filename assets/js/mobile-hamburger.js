(function () {

    const hamburger = document.createElement('button');
    hamburger.className = 'nav__hamburger';
    hamburger.setAttribute('aria-label', 'Abrir menú');
    hamburger.innerHTML = '<span></span><span></span><span></span>';

    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'nav__mobile-menu';
    mobileMenu.innerHTML = `
        <button class="nav__link-btn active" data-tab="tab-list">List</button>
        <button class="nav__link-btn" data-tab="tab-leaderboard">Leaderboard</button>
        <button class="nav__link-btn" data-tab="tab-roulette">Roulette</button>
        <button class="nav__link-btn" data-tab="tab-frk-dm">FRK-DM</button>
        <div class="nav__mobile-actions">
            <a href="https://discord.gg/5Ht99YYBwn" target="_blank" class="btn"
               style="background:#5865F2;border:1px solid #5865F2;color:white;font-family:var(--font-mono);font-weight:bold;text-decoration:none;">
               DISCORD
            </a>
            <a href="https://discord.gg/5Ht99YYBwn" class="btn btn--primary"
               style="font-family:var(--font-mono);font-weight:bold;text-decoration:none;">
               SUBIR RECORD
            </a>
        </div>
    `;

    document.querySelector('.nav__inner').appendChild(hamburger);
    document.querySelector('.nav').appendChild(mobileMenu);

    function closeMenu() {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
    }

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = mobileMenu.classList.toggle('open');
        hamburger.classList.toggle('open', open);
    });

    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) closeMenu();
    });


    const sidebar     = document.getElementById('levels-sidebar');
    const detailPanel = document.getElementById('level-details');

    function isMobile() { return window.innerWidth <= 768; }

    const backBtn = document.createElement('button');
    backBtn.id = 'mobile-back-btn';
    backBtn.setAttribute('aria-label', 'Volver a la lista');
    backBtn.innerHTML = '&#x2715;'; 
    backBtn.addEventListener('click', showSidebar);
    document.body.appendChild(backBtn); 

    function showDetail() {
        if (!isMobile()) return;
        if (sidebar)     sidebar.classList.add('mobile-hidden');
        if (detailPanel) detailPanel.classList.add('mobile-active');
        backBtn.classList.add('visible');
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function showSidebar() {
        if (sidebar)     sidebar.classList.remove('mobile-hidden');
        if (detailPanel) detailPanel.classList.remove('mobile-active');
        backBtn.classList.remove('visible');
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (sidebar) {
        sidebar.addEventListener('click', () => {
            if (isMobile()) setTimeout(showDetail, 60);
        });
    }

    window.addEventListener('resize', () => {
        if (!isMobile()) showSidebar();
    });

    mobileMenu.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            mobileMenu.querySelectorAll('.nav__link-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.nav__links .nav__link-btn').forEach(b => {
                b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(tab));
            });
            if (typeof switchTab === 'function') switchTab(tab, btn);
            if (tab === 'tab-list') showSidebar();
            closeMenu();
        });
    });

})();
