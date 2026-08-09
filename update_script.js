const fs = require('fs');
const filepath = 'apps/gs-admin/src/pages/admin/page-editor.astro';
let content = fs.readFileSync(filepath, 'utf8');

const target = `    const updatePreview = () => {
      if (!(editor instanceof HTMLTextAreaElement) || !preview) return;
      const value = editor.value;
      preview.innerHTML = value
        .replace(/\\n/g, '<br />')
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    };`;

const replacement = `    const updatePreview = () => {
      if (!(editor instanceof HTMLTextAreaElement) || !preview) return;
      const value = editor.value;

      // Escape HTML entities securely without third-party libraries
      const escapeEl = document.createElement('div');
      escapeEl.textContent = value;
      const escapedValue = escapeEl.innerHTML;

      // Safe HTML structure construction based on escaped content
      preview.innerHTML = escapedValue
        .replace(/\\n/g, '<br />')
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    };`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filepath, content);
    console.log("Successfully replaced vulnerable code.");
} else {
    console.error("Target code not found!");
}
