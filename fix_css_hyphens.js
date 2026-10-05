const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix all CSS property name missing hyphens in inline styles
const cssHyphenFixes = [
    [/\bmargintop:/g, 'margin-top:'],
    [/\bmarginbottom:/g, 'margin-bottom:'],
    [/\bmarginleft:/g, 'margin-left:'],
    [/\bmarginright:/g, 'margin-right:'],
    [/\bpaddingleft:/g, 'padding-left:'],
    [/\bpaddingright:/g, 'padding-right:'],
    [/\bpaddingtop:/g, 'padding-top:'],
    [/\bpaddingbottom:/g, 'padding-bottom:'],
    [/\bfontsize:/g, 'font-size:'],
    [/\bfontweight:/g, 'font-weight:'],
    [/\bfontfamily:/g, 'font-family:'],
    [/\btextdecoration:/g, 'text-decoration:'],
    [/\btextalign:/g, 'text-align:'],
    [/\bborderradius:/g, 'border-radius:'],
    [/\bbackgroundcolor:/g, 'background-color:'],
    [/\bmaxheight:/g, 'max-height:'],
    [/\bmaxwidth:/g, 'max-width:'],
    [/\bminheight:/g, 'min-height:'],
    [/\bminwidth:/g, 'min-width:'],
    [/\boverflowy:/g, 'overflow-y:'],
    [/\boverflowx:/g, 'overflow-x:'],
    [/\bwhitespace:/g, 'white-space:'],
    [/\bgridtemplatecolumns:/g, 'grid-template-columns:'],
    [/\bgridtemplaterows:/g, 'grid-template-rows:'],
    [/\bcolumngap:/g, 'column-gap:'],
    [/\browgap:/g, 'row-gap:'],
    [/\balignitems:/g, 'align-items:'],
    [/\bjustifycontent:/g, 'justify-content:'],
    [/\bjustifyitems:/g, 'justify-items:'],
    [/\bflexdirection:/g, 'flex-direction:'],
    [/\bflexwrap:/g, 'flex-wrap:'],
    [/\bboxshadow:/g, 'box-shadow:'],
    [/\bzindex:/g, 'z-index:'],
    [/\bgridcolumn:/g, 'grid-column:'],
    [/\bgridrow:/g, 'grid-row:'],
    [/\blineheight:/g, 'line-height:'],
    [/\bletterspace:/g, 'letter-spacing:'],
    [/\bwordbreak:/g, 'word-break:'],
    [/\bobjectfit:/g, 'object-fit:'],
    [/\bpointerevents:/g, 'pointer-events:'],
    [/\bbordertop:/g, 'border-top:'],
    [/\bborderbottom:/g, 'border-bottom:'],
    [/\bborderleft:/g, 'border-left:'],
    [/\bborderright:/g, 'border-right:'],
    [/\bbordercollapse:/g, 'border-collapse:'],
    [/\bbordercolor:/g, 'border-color:'],
    [/\bdisplayblock:/g, 'display:block;'],
    [/\bverticalalign:/g, 'vertical-align:'],
    [/\boverflowwrap:/g, 'overflow-wrap:'],
];

let fixCount = 0;
cssHyphenFixes.forEach(([pattern, replacement]) => {
    const prev = content;
    content = content.replace(pattern, replacement);
    if (content !== prev) fixCount++;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('CSS hyphen fixes applied:', fixCount, 'patterns fixed.');
