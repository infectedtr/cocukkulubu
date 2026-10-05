import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target block for cell rendering
old_block = """                    const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                    let cellClass = (info.diff < 0) ? 'cell-partial' : (info.diff > 0 ? 'cell-overpaid' : 'cell-paid');
                    let cellText = (info.diff !== 0) ? `${info.diff > 0 ? '+' : ''}${info.diff} ₺` : '✓';
                    let noteIndicator = p.notlar ? '<span style="position:absolute; top:2px; right:2px; font-size:8px; color:var(--accent);">📝</span>' : '';
                    rowHtml += `<td class="${cellClass}" onclick="app.showEditPayment(${p.id})" style="position:relative; cursor:pointer;" title="${p.tarih} - ${p.tutar} ₺${info.isFamily ? ' (Aile İndirimi)' : ''}">
                        ${noteIndicator}<span class="matrix-cell" style="${cellText !== '✓' ? 'font-size:12px; font-weight:700;' : 'font-size:18px;'}">${cellText}</span>
                    </td>`;"""

new_block = """                    const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                    let cellClass = (info.diff < 0) ? 'cell-partial' : (info.diff > 0 ? 'cell-overpaid' : 'cell-paid');
                    
                    // Tik işareti yerine ödenen miktar, fark varsa alt satırda
                    let mainText = info.paid > 0 ? `${info.paid} ₺` : '✓';
                    let diffText = (info.diff !== 0) ? `<div style="font-size:10px; margin-top:1px; opacity:0.8; font-weight:600;">${info.diff > 0 ? '+' : ''}${info.diff} ₺</div>` : '';
                    
                    let noteIndicator = p.notlar ? '<span style="position:absolute; top:2px; right:2px; font-size:8px; color:var(--accent);">📝</span>' : '';
                    rowHtml += `<td class="${cellClass}" onclick="app.showEditPayment(${p.id})" style="position:relative; cursor:pointer;" title="${p.tarih} - ${p.tutar} ₺${info.isFamily ? ' (Aile İndirimi)' : ''}">
                        ${noteIndicator}<span class="matrix-cell" style="display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1; padding:4px 0;">
                            <div style="font-size:13px; font-weight:700;">${mainText}</div>
                            ${diffText}
                        </span>
                    </td>`;"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Matrix cell display fix applied successfully.")
else:
    print("Old block not found. Checking for variations...")
    # Try a slightly different version without line numbers
    # Since I don't know the exact indentation, I'll use a regex-like approach in python if needed.
    # But let's try this first.
