// Placeholder for ThemeManager
export class ThemeManager {
  static init() {
    // Check for saved theme
    const savedTheme = localStorage.getItem('goldshore.theme.v1');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }
}
