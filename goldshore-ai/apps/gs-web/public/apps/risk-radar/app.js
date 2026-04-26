if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('risk-list');
    const risks = ['Low Latency detected', 'All systems nominal', 'Security scan active'];

    risks.forEach(risk => {
        const li = document.createElement('li');
        li.textContent = risk;
        list.appendChild(li);
    });
});
