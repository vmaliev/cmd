document.addEventListener('DOMContentLoaded', function() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;
    function setTheme(dark) {
        if (dark) {
            document.body.classList.add('dark-theme');
            themeToggleBtn.textContent = '☀️ Light Mode';
        } else {
            document.body.classList.remove('dark-theme');
            themeToggleBtn.textContent = '🌙 Dark Mode';
        }
    }
    const darkTheme = localStorage.getItem('theme') === 'dark';
    setTheme(darkTheme);
    themeToggleBtn.addEventListener('click', function() {
        const isDark = document.body.classList.toggle('dark-theme');
        setTheme(isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}); 