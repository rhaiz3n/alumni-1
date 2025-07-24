const images = document.querySelectorAll('.slideshow-image');
let current = 0;

function showNextImage() {
  images[current].classList.remove('active');
  current = (current + 1) % images.length;
  images[current].classList.add('active');
}

// Initial display
images[0].classList.add('active');

// Change image every 3 seconds
setInterval(showNextImage, 4000);
