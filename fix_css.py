import sys
with open('public/style.css', 'r', encoding='utf-8') as f:
    data = f.read()
idx = data.find('.sibling-item:first-child')
if idx != -1:
    data = data[:idx] + """.sibling-item:first-child { border-top: none; }

/* Modern toggle switch */
.mode-toggle-container.full-width-toggle { margin-bottom:20px; padding:16px; background:var(--surface); border-radius:12px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; gap:16px; width: 100%; }

.switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
}
.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}
.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border);
    transition: .4s;
    border-radius: 24px;
}
.slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 2px;
    bottom: 2px;
    background-color: var(--surface);
    border: 1px solid var(--text3);
    transition: .4s;
    border-radius: 50%;
}
input:checked + .slider {
    background-color: var(--accent);
}
input:checked + .slider:before {
    transform: translateX(24px);
    background-color: var(--surface);
    border-color: var(--accent);
}

/* Checkbox styles */
.student-checkbox { width: 18px; height: 18px; cursor: pointer; }

/* Danger button */
.btn-danger { background: #f85149; color: white; border: 1px solid #da3633; }
.btn-danger:hover { background: #da3633; }

/* Hard reset card */
.card-body { padding: 24px; }
"""
    with open('public/style.css', 'w', encoding='utf-8') as f:
        f.write(data)
