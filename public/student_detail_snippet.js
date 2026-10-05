app.showStudentDetail = function (tc) {
    app.currentDetailTc = tc;
    const s = allStudents.find(x => x.tc === tc);
    if (!s) return;

    const tbody = document.getElementById('detail-student-info');
    if (tbody) {
        tbody.innerHTML = `
            <tr><th style="width:200px; text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Öğrencinin Adı Soyadı</th><td style="font-weight:700; padding:8px;">${s.ad} ${s.soyad}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Sınıfı</th><td style="padding:8px;">${s.sinif || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Öğrenci No</th><td style="padding:8px;">${s.no || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">TC Kimlik No</th><td style="padding:8px;">${s.tc}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Baba Adı Soyadı</th><td style="padding:8px;">${s.baba_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Anne Adı Soyadı</th><td style="padding:8px;">${s.anne_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Eğitim Türü</th><td style="padding:8px;">${formatEgitimTuru(s.egitim_turu)}</td></tr>
        `;
    }

    const pb = document.getElementById('detail-payments-body');
    if (pb) {
        pb.innerHTML = '';
        const payments = allPayments.filter(p => p.tc === tc).sort((a, b) => {
            const da = new Date(a.tarih);
            const db = new Date(b.tarih);
            return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
        });

        let total = 0;
        if (payments.length === 0) {
            pb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Kayıtlı ödeme bulunamadı.</td></tr>';
        } else {
            payments.forEach((p, index) => {
                const tutar = parseFloat(p.tutar) || 0;
                total += tutar;
                let bgClass = index % 2 !== 0 ? 'background:rgba(0,0,0,0.03);' : '';

                pb.innerHTML += `
                    <tr style="${bgClass} cursor:pointer;" onclick="app.showEditPayment(${p.id})" title="Düzenlemek için tıklayın">
                        <td style="text-align:center;">${index + 1}</td>
                        <td>${p.ay} ${p.tur !== 'Ödeme' ? `(${p.tur})` : ''} ${p.notlar ? ` <span style="color:var(--accent); font-size:10px;">[Not]</span>` : ''}</td>
                        <td>${p.tarih || '-'}</td>
                        <td>${p.dekont || '-'}</td>
                        <td style="text-align:right; font-weight:700;">${tutar} &#8378;</td>
                    </tr>
                `;
            });
        }

        const totalEl = document.getElementById('detail-total-paid');
        if (totalEl) {
            totalEl.innerHTML = `${total} &#8378;`;
        }
    }

    // update title directly
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.innerText = 'Öğ�renci Detaylar1ı';
    if (subEl) subEl.innerText = s.ad + ' ' + s.soyad;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-ogrenci-detay');
    if (target) target.classList.add('active');
};
