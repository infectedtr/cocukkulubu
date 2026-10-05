const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

const finalFixes = [
    { from: /class="tableheader"/g, to: 'class="table-header"' },
    { from: /class="tabletitle"/g, to: 'class="table-title"' },
    { from: /class="tabcontent"/g, to: 'class="tab-content"' },
    { from: /class="tabbtn"/g, to: 'class="tab-btn"' },
    { from: /class="navicon"/g, to: 'class="nav-icon"' },
    { from: /class="navbtn"/g, to: 'class="nav-btn"' },
    { from: /class="navsectiontitle"/g, to: 'class="nav-section-title"' },
    { from: /class="logoicon"/g, to: 'class="logo-icon"' },
    { from: /class="topbartitle"/g, to: 'class="topbar-title"' },
    { from: /class="topbarsub"/g, to: 'class="topbar-sub"' },
    { from: /class="topbaractions"/g, to: 'class="topbar-actions"' },
    { from: /class="uploadarea"/g, to: 'class="upload-area"' },
    { from: /class="datatable"/g, to: 'class="data-table"' },
    { from: /class="searchbar"/g, to: 'class="search-bar"' },
    { from: /class="searchinput"/g, to: 'class="search-input"' },
    { from: /class="formlabel"/g, to: 'class="form-label"' }
];

finalFixes.forEach(f => {
    c = c.replace(f.from, f.to);
});

// Bump version
c = c.replace(/app.js\?v=\d+/g, 'app.js?v=14');

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('index.html final class hyphens fixed.');
