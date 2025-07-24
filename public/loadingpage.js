document.addEventListener("DOMContentLoaded", function() {
  const loaderWrapper = document.getElementById('loader-wrapper');
  const content = document.getElementById('content');
  const progressBar = document.getElementById('progress-bar');
  const percentage = document.getElementById('percentage');

  let progress = 0;
  const interval = setInterval(() => {
    progress++;
    progressBar.style.width = progress + '%';
    percentage.textContent = progress + '%';

    if (progress >= 100) {
      clearInterval(interval);
      loaderWrapper.style.opacity = '0';

      // After transition, hide loader and show content
      setTimeout(function() {
        loaderWrapper.style.display = 'none';
        content.style.display = 'block';
      }, 500); // Match this duration with the CSS transition
    }
  }, 50); // Adjust the speed of the loading here
});
