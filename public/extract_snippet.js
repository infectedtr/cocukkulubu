const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1');

// Find where showStudentDetail starts
const startIdx = content.lastIndexOf('app.showStudentDetail = function');
if (startIdx !== -1) {
    const studentDetail = content.substring(startIdx);
    fs.writeFileSync('student_detail_snippet.js', studentDetail, 'latin1');
    console.log("Extracted student detail snippet.");
} else {
    console.log("Could not find showStudentDetail");
}
