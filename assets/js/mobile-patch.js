(function () {


    function isMobile() {
        return window.innerWidth <= 768;
    }

    function injectBackButton() {
        const detailPanel = document.getElementById('level-details');
        if (!detailPanel || detailPanel.querySelector('.mobile-back-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'mobile-back-btn';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Volver a la lista
        `;
        btn.addEventListener('click', volverALista);
        detailPanel.insertBefore(btn, detailPanel.firstChild);
    }

    function abrirDetalle() {
        if (!isMobile()) return;
        const tabList = document.getElementById('tab-list');
        if (tabList) tabList.classList.add('detail-open');
        const detail = document.getElementById('level-details');
        if (detail) detail.scrollTop = 0;
        window.scrollTo(0, 0);
    }

    function volverALista() {
        const tabList = document.getElementById('tab-list');
        if (tabList) tabList.classList.remove('detail-open');
        window.scrollTo(0, 0);
    }

    const _originalMostrar = window.mostrarDetallesNivel;
    window.mostrarDetallesNivel = function (idNivel) {
        _originalMostrar(idNivel);
        injectBackButton();
        abrirDetalle();
    };

    const _originalSwitch = window.switchTab;
    window.switchTab = function (tabId, buttonElement) {
        _originalSwitch(tabId, buttonElement);
        if (tabId !== 'tab-list') {
            const tabList = document.getElementById('tab-list');
            if (tabList) tabList.classList.remove('detail-open');
        }
    };


    window.addEventListener('resize', () => {
        if (!isMobile()) {
            const tabList = document.getElementById('tab-list');
            if (tabList) tabList.classList.remove('detail-open');
        }
    });



    function buildLeaderboardCards() {
        if (!isMobile()) return;

        const container = document.getElementById('leaderboard-container');
        if (!container) return;

        const rows = container.querySelectorAll('tbody tr');
        if (rows.length === 0) return;

        if (container.querySelector('.lb-card')) return;

        const medals = ['🥇', '🥈', '🥉'];
        const rankClasses = ['lb-card__rank--gold', 'lb-card__rank--silver', 'lb-card__rank--bronze'];

        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return;

            const rank       = cells[0].textContent.trim();
            const name       = cells[1].textContent.trim();
            const pts        = cells[2].textContent.trim().replace(/\s+/g, ' ');
            const completions = cells[3].textContent.trim();
            const progresses = cells[4].textContent.trim();
            const hardest    = cells[5].textContent.trim().replace(/\s+/g, ' ');

            const card = document.createElement('div');
            card.className = 'lb-card';

            const rankClass = rankClasses[idx] || '';
            const ptsNum = pts.split(' ')[0];
            const ptsLabel = 'PTS';

            card.innerHTML = `
                <div class="lb-card__rank ${rankClass}">${rank}</div>
                <div class="lb-card__info">
                    <div class="lb-card__name">${name}</div>
                    <div class="lb-card__hardest">${hardest}</div>
                </div>
                <div class="lb-card__stats">
                    <div class="lb-card__pts">${ptsNum} <span>${ptsLabel}</span></div>
                    <div class="lb-card__completions">${completions} compl. · ${progresses} prog.</div>
                </div>
            `;

            container.appendChild(card);
        });
    }


    const lbObserver = new MutationObserver(() => {
        if (isMobile()) buildLeaderboardCards();
    });

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('leaderboard-container');
        if (container) {
            lbObserver.observe(container, { childList: true, subtree: false });
        }
        window.addEventListener('resize', () => {
            if (isMobile()) buildLeaderboardCards();
        });
    });

})();
