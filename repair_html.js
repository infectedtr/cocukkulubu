const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

// 1. Fix HTML Comments
c = c.replace(/<! ([^>]+) >/g, '<!-- $1 -->');

// 2. Fix corrupt trailing 'Ö' and other garbage
c = c.replace(/"Ö/g, '"'); // Remove Ö after closing quote
c = c.replace(/Ö"/g, '"'); // Remove Ö before opening quote (Wait, be careful with Turkish chars)
// Actually, let's be more specific
c = c.replace(/value="Ödeme"Ö/g, 'value="Ödeme"');
c = c.replace(/F12345"Ö/g, 'F12345"');
c = c.replace(/notlar...Ö/g, 'notlar..."');

// 3. Fix Smooshed Classes (Aggressive)
const words = [
    'cardbody', 'cardheader', 'modalhead', 'modaltitle', 'modalclose', 'modalbody',
    'formlabel', 'searchinput', 'searchbar', 'tablecontainer', 'infogrid', 'infoitem',
    'uploadbox', 'uploadicon', 'uploadtext', 'uploadsub', 'gridform'
];
words.forEach(w => {
    const replacement = w.replace(/([a-z])(body|header|head|title|close|label|input|bar|container|grid|item|box|icon|text|sub|form)/g, '$1-$2');
    c = c.replace(new RegExp(w, 'g'), replacement);
});

// 4. Fix Inline Styles (Aggressive)
const styleProps = [
    'liststyletype', 'backgroundcolor', 'borderbottom', 'paddingtop', 'marginbottom',
    'margintop', 'paddingbottom', 'fontweight', 'fontsize', 'lineheight', 'textalign',
    'gridtemplatecolumns', 'boxshadow', 'borderradius', 'liststyle'
];
styleProps.forEach(p => {
    const replacement = p.replace(/([a-z])(style|color|bottom|top|weight|size|height|align|columns|shadow|radius)/g, '$1-$2');
    c = c.replace(new RegExp(p, 'g'), replacement);
});

// 5. Fix ID mismatches (Final check)
const idFixes = [
    ['newogrenci', 'new-ogrenci'],
    ['matrixheader', 'matrix-header'],
    ['matrixbody', 'matrix-body'],
    ['matrixyear', 'settings-year'],
    ['studenttable', 'student-table']
];
idFixes.forEach(([o, n]) => {
    c = c.replace(new RegExp(o, 'g'), n);
});

// 6. Fix specific character issues
c = c.replace(/ "ğ/g, 'Öğ'); // Fixing the Öğrenci prefix
c = c.replace(/ğapıştır/g, 'yapıştır');

// Bump version
c = c.replace(/app.js\?v=\d+/g, 'app.js?v=12');

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('index.html fully repaired (comments, classes, styles, garbage).');
