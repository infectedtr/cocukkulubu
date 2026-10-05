const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

const classMappings = {
    'cardbody': 'card-body',
    'cardheader': 'card-header',
    'modalhead': 'modal-head',
    'modaltitle': 'modal-title',
    'modalclose': 'modal-close',
    'formlabel': 'form-label',
    'searchinput': 'search-input',
    'searchbar': 'search-bar',
    'tablecontainer': 'table-container',
    'infogrid': 'info-grid',
    'infoitem': 'info-item',
    'uploadbox': 'upload-box',
    'uploadicon': 'upload-icon',
    'uploadtext': 'upload-text',
    'uploadsub': 'upload-sub',
    'gridform': 'grid-form',
    'notif': 'notif' // notif is fine
};

for (const [oldClass, newClass] of Object.entries(classMappings)) {
    // This regex looks for the class inside a class attribute
    const regex = new RegExp(`class="([^"]*)\\b${oldClass}\\b([^"]*)"`, 'g');
    c = c.replace(regex, `class="$1${newClass}$2"`);
}

// Fix style attributes
const styleFixes = [
    ['liststyletype', 'list-style-type'],
    ['backgroundcolor', 'background-color'],
    ['borderbottom', 'border-bottom'],
    ['paddingtop', 'padding-top'],
    ['marginbottom', 'margin-bottom'],
    ['margintop', 'margin-top'],
    ['paddingbottom', 'padding-bottom'],
    ['fontweight', 'font-weight'],
    ['fontsize', 'font-size'],
    ['lineheight', 'line-height'],
    ['textalign', 'text-align'],
    ['gridtemplatecolumns', 'grid-template-columns'],
    ['boxshadow', 'box-shadow'],
    ['borderradius', 'border-radius']
];

styleFixes.forEach(([oldS, newS]) => {
    c = c.replace(new RegExp(oldS, 'g'), newS);
});

// Bump version
c = c.replace(/app.js\?v=\d+/g, 'app.js?v=11');

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('index.html CSS classes and styles fixed robustly.');
