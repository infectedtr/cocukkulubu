import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_kardes_block = """                    if (info.isFamily && info.paid > 0) {
                        rowHtml += `<td class="${info.diff >= 0 ? 'cell-sibling' : 'cell-partial'}" onclick="app.openMatrixQuickAdd('${s.tc}','${s.ad} ${s.soyad}','${m}')" style="cursor:pointer;" title="Kardeşi üzerinden aile ödemesi. Tıkla: Ödeme/Not ekle"><span class="matrix-cell">KARDEŞ</span></td>`;
                    }"""

new_kardes_block = """                    if (info.isFamily && info.paid > 0) {
                        let diffText = (info.diff !== 0) ? `<div style="font-size:10px; margin-top:1px; opacity:0.8; font-weight:600;">${info.diff > 0 ? '+' : ''}${info.diff} ₺</div>` : '';
                        rowHtml += `<td class="${info.diff >= 0 ? 'cell-sibling' : 'cell-partial'}" onclick="app.openMatrixQuickAdd('${s.tc}','${s.ad} ${s.soyad}','${m}')" style="cursor:pointer; position:relative;" title="Kardeşi üzerinden aile ödemesi. Tıkla: Ödeme/Not ekle">
                            <span class="matrix-cell" style="display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1; padding:4px 0;">
                                <div style="font-size:13px; font-weight:700;">${info.paid} ₺</div>
                                <div style="font-size:9px; margin-top:1px; opacity:0.7;">KARDEŞ</div>
                                ${diffText}
                            </span>
                        </td>`;
                    }"""

if old_kardes_block in content:
    content = content.replace(old_kardes_block, new_kardes_block)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Matrix sibling cell display fix applied successfully.")
else:
    print("Old sibling block not found.")
