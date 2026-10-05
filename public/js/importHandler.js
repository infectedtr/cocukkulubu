/**
 * Renderer side Import Handler
 * Connects the UI to the Electron IPC API.
 */

const ImportHandler = {
    init() {
        this.setupUI();
        this.bindEvents();
    },

    setupUI() {
        // Create Progress Modal if it doesn't exist
        if (!document.getElementById('import-modal')) {
            const modalHtml = `
                <div id="import-modal" class="modal-overlay" style="display:none;">
                    <div class="modal-content import-progress-card">
                        <div class="import-header">
                            <h3 id="import-title">Veri Aktarılıyor</h3>
                            <span id="import-status-text">Başlatılıyor...</span>
                        </div>
                        <div class="progress-container">
                            <div id="import-progress-bar" class="progress-bar"></div>
                        </div>
                        <div class="import-stats">
                            <div class="stat-item">
                                <span class="label">İşlenen</span>
                                <span id="import-count">0 / 0</span>
                            </div>
                            <div class="stat-item">
                                <span class="label">İlerleme</span>
                                <span id="import-percent">0%</span>
                            </div>
                        </div>
                        <div id="import-footer" class="import-footer" style="display:none;">
                            <button onclick="document.getElementById('import-modal').style.display='none'" class="btn-primary">Tamam</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    },

    bindEvents() {
        if (!window.electronAPI) {
            console.warn('[IMPORT] Electron API bulunamadı. Masaüstü modunda değilsiniz.');
            return;
        }

        window.electronAPI.onImportStatus((msg) => {
            document.getElementById('import-status-text').innerText = msg;
        });

        window.electronAPI.onImportProgress((data) => {
            const bar = document.getElementById('import-progress-bar');
            const count = document.getElementById('import-count');
            const percent = document.getElementById('import-percent');

            bar.style.width = `${data.percent}%`;
            count.innerText = `${data.current} / ${data.total}`;
            percent.innerText = `${data.percent}%`;
            
            document.getElementById('import-status-text').innerText = `İşleniyor: ${data.remaining} kayıt kaldı...`;
        });

        window.electronAPI.onImportDone(async (data) => {
            document.getElementById('import-status-text').innerText = 'Tamamlandı!';
            document.getElementById('import-status-text').style.color = '#3fb950';
            document.getElementById('import-footer').style.display = 'flex';
            
            // Refresh data
            if (window.app && window.app.loadData) {
                await window.app.loadData();
            }
        });

        window.electronAPI.onImportError((msg) => {
            alert('Hata: ' + msg);
            document.getElementById('import-modal').style.display = 'none';
        });
    },

    async start(type) {
        // KVKK Check before import
        const kvkkAccepted = localStorage.getItem('kvkk_accepted');
        if (!kvkkAccepted) {
            alert('Toplu veri aktarımı yapabilmek için öncelikle KVKK aydınlatma metnini okuyup kabul etmelisiniz.');
            if (window.app && window.app.checkKVKK) {
                window.app.checkKVKK();
            }
            return;
        }

        if (!window.electronAPI) {
            alert('Toplu Excel aktarımı sadece masaüstü uygulamasında (start-desktop) desteklenmektedir.');
            return;
        }
        const filePath = await window.electronAPI.selectFile();
        if (!filePath) return;

        // Show Modal
        const modal = document.getElementById('import-modal');
        modal.style.display = 'flex';
        document.getElementById('import-footer').style.display = 'none';
        document.getElementById('import-progress-bar').style.width = '0%';
        document.getElementById('import-count').innerText = '0 / 0';
        document.getElementById('import-percent').innerText = '0%';
        document.getElementById('import-status-text').innerText = 'Dosya hazırlanıyor...';
        document.getElementById('import-status-text').style.color = '#8b949e';

        // Trigger IPC
        window.electronAPI.startImport(filePath, type, { chunkSize: 500 });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => ImportHandler.init());
window.ImportHandler = ImportHandler;
